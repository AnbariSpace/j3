import HttpError from "./HttpError";

export default class NoSuchKeyError extends HttpError {
	public constructor(
		public Bucket: string,
		public Key: string,
	) {
		super(404, "The specified key does not exist.");
	}
}