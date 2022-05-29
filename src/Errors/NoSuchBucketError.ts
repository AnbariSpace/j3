import HttpError from "./HttpError";

export default class NoSuchBucketError extends HttpError {
	public constructor() {
		super(404, "The specified bucket does not exist.");
	}
}