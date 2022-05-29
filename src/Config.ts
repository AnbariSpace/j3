
import Ajv from 'ajv';
import { singleton } from 'tsyringe';
import * as fs from 'fs/promises';
import { getDefaultConfigSchemaPath } from './CommandsHelper';
import { hostname } from 'os';

export interface IServerConfig {
	port: number;
	host: string;
}

export interface IBackendConfig {
	id: string;
}

export interface ILocalDiskBackendConfig extends IBackendConfig {
	location: string;
}

export interface IPeerConfig {
	hostname: string;
	port: number;
}

export interface ILoggingConfig {
	file: string;
	console: boolean;
	level: string;
}

export interface IConfigData {
	"node-id": string;
	database: string;
	server?: IServerConfig;
	"access-key": string;
	"access-secret": string;
	"public-domain": string;
	backends: Array<ILocalDiskBackendConfig>;
	peers?: IPeerConfig[];
	logging?: ILoggingConfig;
}

@singleton()
export default class Config {
	public static instance: Config | undefined;
	public static async fromFile(path: string): Promise<Config> {
		const content = (await fs.readFile(path)).toString();
		const schemaString = (await fs.readFile(getDefaultConfigSchemaPath())).toString();
		const data = JSON.parse(content);
		const schema = JSON.parse(schemaString);

		const ajv = new Ajv();
		const validate = ajv.compile<IConfigData>(schema);

		if (!validate(data)) {
			console.error(validate.errors);
			throw new Error('config validation failed');
		}
		if (data['node-id'] === undefined) {
			data['node-id'] = hostname();
		}
		return new Config(data);
	}
	public constructor(public readonly data: IConfigData) {
	}

	public get(name: keyof IConfigData): any {
		return this.data[name];
	}

}
