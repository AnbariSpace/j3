import HttpError from "./HttpError";

export default class InvalidArgumentError extends HttpError {
	public BucketName: string | undefined;
	public constructor(message: string) {
		super(400, message);
	}
}