import Type from "./Type";

export default class Owner extends Type {
	public constructor(
		public readonly ID: string,
		public readonly DisplayName: string
	) {
		super();
	}
}
