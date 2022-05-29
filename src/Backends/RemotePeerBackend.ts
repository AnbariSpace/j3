import { Readable, Writable, WritableOptions } from "stream";
import { IExportedBackend } from "../Api/Controllers/Internal/BackendController";
import { IBackendConfig } from "../Config";
import Peer from "../Peer";
import Backend, { IObjectReadResult } from "./Backend";


export class WriteableRequest extends Writable {
	public constructor(
		public readonly bucket: string,
		public readonly key: string,
		public readonly size: number,
		public readonly readStream: Readable,
		opts: WritableOptions
	) {
		super(opts);
	}
}

export default class RemotePeerBackend extends Backend {
	public constructor(
		public readonly peer: Peer,
		public readonly id: string,
	) {
		super();
	}

	public init(_config: IBackendConfig): Promise<void> {
		throw new Error("No need initing remote backends");
	}

	public reaccessAllocation(_bucket: string, _key: string, _size: number): Promise<Writable | undefined> {
		throw new Error("Method not implemented.");
	}

	public async allocateSpace(bucket: string, key: string, size: number): Promise<Writable> {
		const readStream = new Readable({
			read(_size) {

			},
		});
		const writeStream = new WriteableRequest(bucket, key, size, readStream, {
			write(chunk, encoding, callback) {
				if (readStream.push(chunk, encoding)) {
					callback();
				} else {
					callback(new Error());
				}
			},
		});

		return writeStream;
	}

	public async freeAllocation(stream: Writable): Promise<void> {
		if (!(stream instanceof WriteableRequest)) {
			throw new Error("Invalid stream");
		}
		stream.readStream.destroy();
		stream.destroy();
	}

	public async commitObject(stream: Writable): Promise<void> {
		if (!(stream instanceof WriteableRequest)) {
			throw new Error("Invalid stream");
		}
		const response = await this.peer.getHttpClient().put(`/api/internal/backends/${this.id}/objects/${stream.bucket}/${stream.key}`, stream.readStream, {
			headers: {
				"Content-Length": stream.size,
			}
		});
		if (response.status !== 204) {
			throw new Error();
		}
	}

	public async getRemainingSpace(): Promise<number> {
		const response = await this.peer.getHttpClient().get<IExportedBackend>(`/api/internal/backends/${this.id}`);
		return response.data.remainingSpace;
	}

	public async getObject(bucket: string, key: string): Promise<IObjectReadResult> {
		const response = await this.peer.getHttpClient().get<Readable>(`/api/internal/backends/${this.id}/objects/${bucket}/${key}`, {
			responseType: "stream"
		});

		if (response.headers["Content-Length"] !== undefined) {
			throw new Error("missing content-length");
		}

		const length = parseInt(response.headers["Content-Length"]);

		return {
			stream: response.data,
			length: length,
		};
	}

}