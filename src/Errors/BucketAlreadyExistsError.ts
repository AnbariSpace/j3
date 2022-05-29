import HttpError from "./HttpError";

export default class BucketAlreadyExistsError extends HttpError {
	public constructor() {
		super(409, "This bucket name already taken");
	}
}