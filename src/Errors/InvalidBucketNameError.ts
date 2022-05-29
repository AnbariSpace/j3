import HttpError from "./HttpError";

export default class InvalidBucketNameError extends HttpError {
	public constructor(message = "Bucket name is invalid") {
		super(400, message);
	}
}