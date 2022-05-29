import HttpError from "./HttpError";

export default class BucketNotEmptyError extends HttpError {
	public constructor() {
		super(409, "The bucket that you tried to delete is not empty.");
	}
}