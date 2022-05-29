import Type from "./Type";

export default class Error extends Type {
	[key: string]: string;
	public constructor(
		public readonly Code: string,
		public readonly Message: string,
		public readonly Resource: string,
		public readonly RequestId: string,
		public readonly HostId: string,
	) {
		super();
	}
}
