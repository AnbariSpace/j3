import HttpError from "./HttpError";

export default class InvalidDigestError extends HttpError {
	public constructor(message: string = "The Content-MD5 or checksum value that you specified is not valid.") {
		super(400, message);
	}
}