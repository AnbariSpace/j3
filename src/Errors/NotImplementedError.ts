import HttpError from "./HttpError";

export default class NotImplementedError extends HttpError {
	public constructor(message: string = "") {
		super(501, message);
	}
}