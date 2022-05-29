import Type from "./Type";

export default class CommonPrefix extends Type {
	public constructor(
		public readonly Prefix: string
	) {
		super();
	}
}
