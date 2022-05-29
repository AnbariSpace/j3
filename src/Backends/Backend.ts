import { Readable, Writable } from "stream";
import { IBackendConfig } from "../Config";

export interface IObjectReadResult {
	length: number;
	stream: Readable;
}

export default abstract class Backend {
	
	public id: string;
	
	public abstract init(config: IBackendConfig): Promise<void>;
	public abstract allocateSpace(bucket: string, key: string, size: number): Promise<Writable>;
	public abstract reaccessAllocation(bucket: string, key: string, size: number): Promise<Writable | undefined>;
	public abstract freeAllocation(stream: Writable): Promise<void>;
	public abstract commitObject(stream: Writable): Promise<void>;
	public abstract getRemainingSpace(): Promise<number>;
	public abstract getObject(bucket: string, key: string): Promise<IObjectReadResult>;
}