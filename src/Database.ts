import { inject, singleton } from "tsyringe";
import Config from "./Config";
import lmdb, { RootDatabase } from "lmdb";
import DatabaseUpdatingBlockTimeoutError from "./Errors/DatabaseUpdatingBlockTimeoutError";
import ShouldNotHappendError from "./Errors/ShouldNotHappendError";
import { Logger } from "winston";

export type IObjectMetadata = Record<string, string>;

interface IBucketPolicyStatement {
	Sid: string;
	Effect: "Allow" | "Deny";
	Actions: string[];
	Principal: { AWS: string | string[] };
}

interface IBucketPolicy {
	Version: string;
	Statement: IBucketPolicyStatement[];
}

export interface IBucket {
	versionId: string;
	accessPolicy: IBucketPolicy;

	creationDate: Date;
	deleteMarker?: boolean;
}

export interface IObject {
	versionId: string;
	backends: string[];
	size: number;
	etag: string;
	lastModified: Date;
	storageClass: string;
	metadata: IObjectMetadata;
	deleteMarker?: boolean;
}

export interface IObjectDatabaseUpdate extends IObject {
	type: "object";
	bucket: string;
	key: string;
}

export interface IBucketDatabaseUpdate extends IBucket {
	type: "bucket";
	name: string;
}

export type DatabaseUpdate = IObjectDatabaseUpdate | IBucketDatabaseUpdate;
export type DatabaseUpdates = DatabaseUpdate[];

interface IObjectList {
	[key: string]: IObject;
}

type Key = string;

@singleton()
export default class Database {
	private db: RootDatabase<any, Key>;
	private updatePromise: Promise<void>|undefined;
	private updating = false;

	public constructor(
		@inject(Config) private config: Config,
		@inject("Logger") private logger: Logger,
	) {}

	public async init(): Promise<void> {
		if (this.db !== undefined) {
			return;
		}
		this.logger.debug("opening database", {path: this.config.data.database});
		this.db = lmdb.open({
			path: this.config.data.database,
		});
		this.logger.debug("database opened successfully", { path: this.config.data.database });
	}

	public async getVersionId(): Promise<string> {
		return this.getVersionIdSync();
	}

	public async applyUpdates(updates: DatabaseUpdates): Promise<void> {
		if (this.updating) {
			this.logger.warn("another update came in case of a running update, in ideal world this should not happen", {firstVersionId: updates[0]?.versionId});
			await this.updatePromise;
		}
		this.updatePromise = new Promise((resolve, reject) => this.db.transaction(() => {
			this.updating = true;
			this.logger.info("Running database update", { firstVersionId: updates[0]?.versionId });
			try {
				for (const update of updates) {
					if (update.type === "object") {
						this.updateObject(update);
					} else if (update.type === "bucket") {
						this.updateBucket(update);
					}
				}
				resolve();
			} catch (e) {
				reject(e);
			} finally {
				this.updating = false;
				this.updatePromise = undefined;
			}
		}));
		return this.updatePromise;
	}

	public waitForUpdating(timeout: number = 15000): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.updatePromise === undefined) {
				return resolve();
			}
			const timer = setTimeout(() => {
				this.logger.error("wait for database update timed out", {timeout: timeout});
				reject(new DatabaseUpdatingBlockTimeoutError());
			}, timeout);
			this.updatePromise.then(resolve, reject).finally(() => {
				clearTimeout(timer);
			});
		});
	}

	public async hasBucket(name: string): Promise<boolean> {
		return this.getBucketsListSync().includes(name);
	}

	public async getBucketsList() {
		return this.getBucketsListSync();
	}

	public async getBucket(name: string) {
		return this.getBucketSync(name);
	}

	public async createBucket(name: string, createDate?: Date): Promise<IBucketDatabaseUpdate> {
		await this.waitForUpdating();
		let bucketInfo: IBucket|undefined;
		await this.db.transaction(() => {
			this.logger.info("creating bucket", { name: name });
			if (this.getBucketsListSync().includes(name)) {
				this.logger.error("bucket already exists, we should not reach this place.", { name: name });
				return;
			}
			bucketInfo = {
				versionId: this.generateVersionId(),
				accessPolicy: {
					Version: "",
					Statement: [],
				},
				creationDate: createDate || new Date(),
			};
			this.putBucketSync(name, bucketInfo);
		});
		return Object.assign({ type: "bucket", name: name }, bucketInfo) as IBucketDatabaseUpdate;
	}

	public async markBucketAsDeleted(name: string): Promise<IBucketDatabaseUpdate> {
		await this.waitForUpdating();
		let bucketInfo: IBucket | undefined;
		await this.db.transaction(() => {
			bucketInfo = this.getBucketSync(name);
			if (bucketInfo === undefined) {
				throw new ShouldNotHappendError("bucket is not exists");
			}
			bucketInfo.versionId = this.generateVersionId();
			bucketInfo.deleteMarker = true;
			this.putBucketSync(name, bucketInfo);
		});
		return Object.assign({ type: "bucket", name: name }, bucketInfo) as IBucketDatabaseUpdate; 
	}

	public async deleteBucket(name: string): Promise<void> {

		await this.waitForUpdating();
		await this.db.transaction(() => {
			const bucketsList = this.getBucketsListSync();
			const index = bucketsList.indexOf(name);
			if (index !== -1) {
				bucketsList.splice(index, 1);
			}
			this.db.put("buckets-list", bucketsList);
			this.db.remove(`bucket.${name}`);
		});
	}

	public async createObject(versionId: string, bucket: string, key: string, size: number, etag: string, backends: string[], storageClass: string, lastModified?: Date, metadata: IObjectMetadata = {}): Promise<IObjectDatabaseUpdate> {
		await this.waitForUpdating();
		const objectInfo: IObject = {
			versionId: versionId,
			size: size,
			etag: etag,
			backends: backends,
			metadata: metadata,
			lastModified: lastModified || new Date(),
			storageClass: storageClass,
		};
		await this.db.transaction(() => {
			this.putObjectSync(bucket, key, objectInfo);
		});
		return Object.assign({ type: "object", bucket: bucket, key: key }, objectInfo) as IObjectDatabaseUpdate;
	}

	public async getObject(bucket: string, key: string) {
		return this.getObjectSync(bucket, key);
	}

	public async getObjects(bucket: string, start?: string, limit?: number, _prefix?: string, includedDeleted = false): Promise<IObjectList> {
		const keyPrefix = `bucket.${bucket}.objects.`;
		const bucketObjectsStartKey = `bucket.${bucket}.objects-start`;
		const startKey = start === undefined ? bucketObjectsStartKey : keyPrefix + start;
		const endKey = `bucket.${bucket}.objects/end`;
		const range = this.db.getRange({
			start: startKey,
			end: endKey,
		});

		let count = 0;
		const list: IObjectList = {};
		for (const entry of range) {
			if (entry.key === bucketObjectsStartKey) {
				continue;
			}
			const value = entry.value as IObject;
			if (!includedDeleted && value.deleteMarker) {
				continue;
			}
			const key = (entry.key as string).substring(keyPrefix.length);
			list[key] = entry.value;
			count++;
			if (limit !== undefined && count >= limit) {
				break;
			}
		}

		return list;
	}

	public async export(): Promise<Record<Key, any>> {
		const combined: Record<Key, any> = {};
		for (const entity of this.db.getRange()) {
			combined[entity.key] = entity.value;
		}

		return combined;
	}

	private updateObject(update: IObjectDatabaseUpdate) {
		const current = this.getObjectSync(update.bucket, update.key);
		this.logger.debug("Running database object update", {
			bucket: update.bucket,
			key: update.key,
			currentVersionId: current?.versionId,
			updateVersionId: update.versionId
		});
		if (current !== undefined && current.versionId > update.versionId) {
			return;
		}
		const object: IObject = Object.assign({}, update);
		delete (object as any).bucket;
		delete (object as any).key;
		this.putObjectSync(update.bucket, update.key, object);
	}

	private updateBucket(update: IBucketDatabaseUpdate) {
		const current = this.getBucketSync(update.name);
		this.logger.debug("Running database bucket update", {
			name: update.name,
			currentVersionId: current?.versionId,
			updateVersionId: update.versionId
		});
		if (current !== undefined && current.versionId > update.versionId) {
			return;
		}
		const bucket: IBucket = Object.assign({}, update);
		delete (bucket as any).name;
		this.putBucketSync(update.name, bucket);
	}

	private putObjectSync(bucket: string, key: string, object: IObject) {
		this.insureModelVersionId(object);
		this.db.put(`bucket.${bucket}.objects.${key}`, object);
		this.updateVersionIdFromModelSync(object);
		this.putBucketObjectsBoundrySync(bucket);
	}

	private putBucketSync(name: string, bucket: IBucket) {
		this.insureModelVersionId(bucket);
		const list = (this.db.get("buckets-list") || []) as string[];
		if (!list.includes(name)) {
			list.push(name);
			this.db.put("buckets-list", list);
		}
		this.db.put(`bucket.${name}`, bucket);
		this.updateVersionIdFromModelSync(bucket);
		this.putBucketObjectsBoundrySync(name);
	}

	private putBucketObjectsBoundrySync(bucket: string) {
		this.db.put(`bucket.${bucket}.objects-start`, "start");
		this.db.put(`bucket.${bucket}.objects/end`, "end");
	}

	private insureModelVersionId(model: IBucket | IObject) {
		if (model.versionId === "") {
			model.versionId = this.generateVersionId();
		}
	}

	private updateVersionIdFromModelSync(model: IBucket | IObject) {
		const versionId = this.getVersionIdSync();
		if (versionId < model.versionId) {
			this.db.put("version-id", model.versionId);
			this.logger.debug("Database version id increased", {
				old: versionId,
				new: model.versionId,
			});
		}
	}

	public generateVersionId(): string {
		return Date.now().toString();
	}

	private getVersionIdSync(): string {
		return this.db.get("version-id") || "0";
	}

	private getObjectSync(bucket: string, key: string) {
		return this.db.get(`bucket.${bucket}.objects.${key}`) as IObject | undefined;
	}

	private getBucketSync(name: string) {
		return this.db.get(`bucket.${name}`) as IBucket | undefined;
	}
	private getBucketsListSync() {
		return (this.db.get("buckets-list") || []) as string[];
	}

	public async getUpdates(since: string): Promise<DatabaseUpdates> {
		if (since >= this.getVersionIdSync()) {
			return [];
		}
		const updates: DatabaseUpdates = [];
		for (const entry of this.db.getRange()) {
			if (typeof entry.value === "object" && entry.value.versionId > since) {
				updates.push(this.buildUpdate(entry));
			}
		}

		return updates;
	}

	private buildUpdate({key, value}: {key: Key, value: any}): DatabaseUpdate {
		const matches = key.match(/^bucket\.(?<bucket>[^\.]+)(?:\.objects.(?<key>.+))?$/);
		if (!matches) {
			throw new ShouldNotHappendError("There is a entry in database that have 'versionId' field but it's not a bucket or object. key: " + key);
		}
		if (matches.groups === undefined) {
			throw new ShouldNotHappendError("Regex matches but there is no group");
		}
		if (matches.groups.key === undefined) {
			const bucketUpdate: IBucketDatabaseUpdate = Object.assign({
				type: "bucket",
				name: matches.groups.bucket
			}, value);
			return bucketUpdate;
		}
		const objectUpdate: IObjectDatabaseUpdate = Object.assign({
			type: "object",
			bucket: matches.groups.bucket,
			key: matches.groups.key,
		}, value);
		return objectUpdate;
	}

}