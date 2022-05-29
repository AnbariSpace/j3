import HttpError from "./HttpError";

export default class MissingContentLengthError extends HttpError {
	public constructor() {
		super(411, "You must provide the Content-Length HTTP header.");
	}
}