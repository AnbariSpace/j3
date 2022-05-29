import HttpError from "./HttpError";

export default class InternalError extends HttpError {
	public constructor(message: string) {
		super(500, message);
	}
}