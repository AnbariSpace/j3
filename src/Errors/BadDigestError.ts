import HttpError from "./HttpError";

export default class BadDigestError extends HttpError {
	public constructor(message = "The Content-MD5 or checksum value that you specified did not match what the server received.") {
		super(400, message);
	}
}