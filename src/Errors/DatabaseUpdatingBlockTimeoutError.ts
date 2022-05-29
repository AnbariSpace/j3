import InternalError from "./InternalError";

export default class DatabaseUpdatingBlockTimeoutError extends InternalError {
	public constructor(message = "database updating block any write opration") {
		super(message);
	}
}