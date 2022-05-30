import Owner from "./Owner"
import Type from "./Type";

export default class Object extends Type {
	public constructor(
		public readonly Key: string,
		public readonly Size: number,
		public readonly ETag: string,
		public readonly LastModified: Date,
		public readonly ChecksumAlgorithm: string | undefined,
		public readonly StorageClass: string,
		public readonly Owner: Owner | undefined,
	) {
		super();
	}
}
