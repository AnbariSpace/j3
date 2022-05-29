import Type from "./Type";

export default class ListBucketResult extends Type {

	public readonly $ = {
		xmlns: "http://s3.amazonaws.com/doc/2006-03-01/"
	};

	public constructor(
		public readonly Name: string,
		public readonly Prefix: string,
		public readonly Marker: string,
		public readonly MaxKeys: number,
		public readonly Delimiter: string,
		public readonly IsTruncated: boolean,
		public readonly Contents: Object[],
	) {
		super()
	}
}