import { Readable, Writable } from "stream";
import { container, inject, singleton } from "tsyringe";
import { Logger } from "winston";
import Backend, { IObjectReadResult as IParentObjectReadResult } from "./Backends/Backend";
import LocalDisk from "./Backends/LocalDisk";
import RemotePeerBackend from "./Backends/RemotePeerBackend";
import Config, { IBackendConfig } from "./Config";
import { IObject } from "./Database";
import NoAccessableBackendError from "./Errors/NoAccessableBackendError";
import SpaceAllocationError from "./Errors/SpaceAllocationError";
import Peer from "./Peer";

interface IAllocationSpaceResult {
	backend: Backend;
	stream: Writable;
}
interface IObjectReadResult extends IParentObjectReadResult {
	backend: Backend;
	stream: Readable;
}

@singleton()
export default class BackendManager {
	private backends: Backend[]| undefined;

	public constructor(
		@inject(Config) private config: Config,
		@inject("Logger") private logger: Logger,
	) {}

	public async init() {
		if (this.backends !== undefined) {
			return;
		}
		this.backends = await Promise.all(
			this.config.data.backends.map((backend) => this.initBackend(backend))
		);
	}

	public all(): Backend[] {
		if (this.backends === undefined) {
			throw new Error("manager is not initized");
		}

		return this.backends;
	}

	public get(id: string): Backend|undefined {
		return this.all().find((backend) => backend.id === id);
	}

	public async findSuitableBackendForObject(size: number): Promise<Backend|undefined> {
		for (const backend of this.all()) {
			try {
				if (await backend.getRemainingSpace() >= size) {
					return backend;
				}
			} catch (e) {
				this.logger.error("Error in geting remain space of backend", {
					backend: backend.id,
					errorName: e instanceof Error ? e.constructor.name : undefined,
					error: e,
				});
			}
		}
		return undefined;
	}

	public async allocateSpace(bucket: string, key: string, size: number): Promise<IAllocationSpaceResult> {
		for (const backend of this.all()) {
			try {
				const freeSpace = await backend.getRemainingSpace();
				if (freeSpace < size) {
					continue;
				}
				const stream = await backend.allocateSpace(bucket, key, size);
				return {backend, stream};
			} catch (e) {
				this.logger.error("Error in allocating space for object", {
					bucket,
					key,
					size,
					backend: backend.id,
					errorName: e instanceof Error ? e.constructor.name : undefined,
					error: e,
				});
			}
		}
		throw new SpaceAllocationError();
	}

	public async getObject(bucket: string, key: string, object: IObject): Promise<IObjectReadResult> {
		const backends = object.backends
			.map((id) => this.get(id))
			.filter((backend) => backend !== undefined)
			.sort((a, b) => {
				const aScore = a instanceof BackendManager ? 0 : 1;
				const bScore = b instanceof BackendManager ? 0 : 1;
				return bScore - aScore;
			}) as Array<Backend>;
		for (const backend of backends) {
			try {
				const {stream, length} = await backend.getObject(bucket, key);
				return { backend, stream, length };
			} catch (e) {
				this.logger.error("Error in read object from backend", {
					bucket,
					key,
					object: object,
					backend: backend.id,
					errorName: e instanceof Error ? e.constructor.name : undefined,
					error: e,
				});
			}
		}
		throw new NoAccessableBackendError();

	}

	public insureHaveRemotePeerBackend(peer: Peer, id: string) {
		if (this.backends === undefined) {
			throw new Error("manager is not initized");
		}
		const remoteBackend = this.all().find((b) => {
			b instanceof RemotePeerBackend && b.id == id && b.peer === peer
		});
		if (remoteBackend !== undefined) {
			return;
		}
		this.backends.push(new RemotePeerBackend(peer, id));
	}

	private async initBackend(config: IBackendConfig): Promise<Backend> {
		const backend: Backend = container.resolve(LocalDisk);
		backend.id = config.id;
		await backend.init(config);
		return backend;
	}
}