import InternalError from "./InternalError";

export default class ReadOnyModeError extends InternalError {
	public constructor(message = "We are currently in read only mode, try again latter") {
		super(message);
	}
}