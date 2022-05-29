import Bucket from "./Bucket";
import Type from "./Type";

export default class ListAllMyBucketsResult extends Type {
	public readonly Buckets: {Bucket: Bucket[]} = {Bucket: []};
	public constructor(
		Buckets: Bucket[],
	) {
		super();
		this.Buckets.Bucket = Buckets;
	}
}