import HttpError from "./HttpError";

export default class AccessDeniedError extends HttpError {
	public constructor() {
		super(403, "Access Denied.");
	}
}