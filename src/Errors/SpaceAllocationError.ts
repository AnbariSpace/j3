import InternalError from "./InternalError";

export default class SpaceAllocationError extends InternalError {
	public constructor(message = "Cannot Allocate space for your request") {
		super(message);
	}
}