import HttpError from "./HttpError";

export default class TooManyBucketsError extends HttpError {
	public constructor(message = "You have attempted to create more buckets than are allowed for an account.") {
		super(400, message);
	}
}