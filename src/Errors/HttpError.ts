import ErrorType from "../S3Types/Error";

export default class HttpError extends Error {
	public constructor(public readonly errorCode: number, message?: string) {
		super(message);
	}

	public toType(resource: string, request: string, host: string): ErrorType {
		let name = this.constructor.name;
		if (name.endsWith("Error")) {
			name = name.substring(0, name.length - 5);
		}
		const type = new ErrorType(
			name,
			this.message,
			resource,
			request,
			host,
		);
		for (const key in this) {
			const code = key.charCodeAt(0);
			if (code >= 65 && code < 91) {
				type[key] = this[key] as any;
			}
		}
		return type;
	}
}