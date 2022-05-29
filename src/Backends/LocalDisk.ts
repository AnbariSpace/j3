import { createWriteStream, WriteStream } from "fs";
import * as fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path"
import { ILocalDiskBackendConfig } from "../Config";
import Backend, { IObjectReadResult } from "./Backend";
import checkDiskSpace from 'check-disk-space';

export default class LocalDisk extends Backend {
	private location: string;

	public async init(config: ILocalDiskBackendConfig): Promise<void> {
		const stat = await fs.stat(config.location);
		if (!stat.isDirectory()) {
			throw new Error(`It's not directory: ${config.location}`);
		}
		this.location = config.location;
	}

	public async allocateSpace(bucket: string, key: string, _size: number): Promise<WriteStream> {
		const tempPath = path.resolve(this.getTempPath(), bucket, key);
		const dir = path.dirname(tempPath);
		await fs.mkdir(dir, { recursive: true });
		return createWriteStream(tempPath);
	}

	public async reaccessAllocation(bucket: string, key: string, _size: number): Promise<WriteStream | undefined> {
		const tempPath = path.resolve(this.getTempPath(), bucket, key);
		try {
			await fs.access(tempPath)
		} catch (e) {
			return undefined;
		}
		return createWriteStream(tempPath);
	}

	public async freeAllocation(stream: WriteStream): Promise<void> {
		const path = stream.path;
		try {
			await fs.access(path);
			stream.destroy();
			return fs.unlink(path);
		} catch (e) {

		}
	}

	public async commitObject(stream: WriteStream): Promise<void> {
		const basePath = this.getTempPath();
		const tempPath = stream.path.toString();
		const bucketKey = tempPath.substring(basePath.length + 1);
		const objectPath = path.resolve(this.location, bucketKey);
		stream.end();
		
		const dir = path.dirname(objectPath);
		await fs.mkdir(dir, {recursive: true});
		return fs.rename(tempPath, objectPath);
	}

	public async getRemainingSpace(): Promise<number> {
		const diskSpace = await checkDiskSpace(this.location);
		return diskSpace.free;
	}

	public getTempPath(): string {
		return path.resolve(this.location, ".j3", "temp");
	}


	public async getObject(bucket: string, key: string): Promise<IObjectReadResult> {
		const objectPath = path.resolve(this.location, bucket, key);
		const stat = await fs.stat(objectPath);
		return {
			stream: createReadStream(objectPath, {
				autoClose: true,
			}),
			length: stat.size,
		};
	}
}