import { OutgoingHttpHeaders } from "http";
import { Readable } from "stream";
import Type from "./S3Types/Type";

export default class HttpResponse {
	public constructor(
		public readonly body: string|Buffer|Readable|Type|undefined,
		public readonly status: number = 200,
		public readonly headers: OutgoingHttpHeaders = {},
	){}
}