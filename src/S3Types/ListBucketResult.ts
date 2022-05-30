import CommonPrefix from "./CommonPrefix";
import Type from "./Type";

export default class ListBucketResult extends Type {

	public readonly $ = {
		xmlns: "http://s3.amazonaws.com/doc/2006-03-01/"
	};

	public Marker?: string;
	public NextMarker?: string;
	public EncodingType?: string;
	public StartAfter?: string;
	public ContinuationToken?: string;
	public NextContinuationToken?: string;
	public CommonPrefixes?: CommonPrefix[];
	public Contents?: Object[];

	public constructor(
		public Name: string,
		public Prefix: string,
		public Delimiter: string,
		public IsTruncated: boolean,
		public MaxKeys: number,
		public KeyCount: number,
	) {
		super()
	}
}