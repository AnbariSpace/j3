import Type from "./Type";

export default class Bucket extends Type {
	public constructor(
		public readonly Name: string,
		public readonly CreationDate: Date,
	) {
		super();
	}
}