import InternalError from "./InternalError";

export default class NoAccessableBackendError extends InternalError {
	public constructor(message = "Cannot find a accessable backend that has this object") {
		super(message);
	}
}