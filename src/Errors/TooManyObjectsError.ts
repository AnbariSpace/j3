import HttpError from "./HttpError";

export default class TooManyObjectsError extends HttpError {
	public constructor(message = "You have attempted to create more objects than are allowed for an bucket.") {
		super(400, message);
	}
}