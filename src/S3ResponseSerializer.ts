import { Builder } from 'xml2js';
import Type from './S3Types/Type';

export default class S3ResponseSerializer {
	private builder = new Builder();

	public serialize(type: Type): string {
		const object: any = {};
		object[type.constructor.name] = type;
		return this.builder.buildObject(object);
	}
}