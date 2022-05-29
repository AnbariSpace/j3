import { inject, singleton } from "tsyringe";
import Config from "./Config";
import * as http from "http";
import Router from "./Router";
import NotImplementedError from "./Errors/NotImplementedError";
import { Readable } from "stream";
import HttpError from "./Errors/HttpError";
import winston from "winston";
import Type from "./S3Types/Type";
import S3ResponseSerializer from "./S3ResponseSerializer";
import express from "express";
import ApiRouter from "./Api";
import ShouldNotHappendError from "./Errors/ShouldNotHappendError";
import HttpResponse from "./HttpResponse";

@singleton()
export default class Server {
	private backend: http.Server;
	private express: express.Express;
	private requestCounter: number = 0;

	public constructor(
		@inject(Config) private config: Config,
		@inject("Logger") private logger: winston.Logger,
		@inject(Router) private router: Router,
		@inject(S3ResponseSerializer) private responseSerializer: S3ResponseSerializer,
	) {
		this.backend = new http.Server();
		this.backend.on("request", this.requestHandler.bind(this));
		this.express = express();
		this.express.use(ApiRouter);
	}

	public listen(): Promise<void> {
		return new Promise((resolve) => {
			this.backend.listen({
				port: this.config.data.server?.port || 80,
				host: this.config.data.server?.host
			}, resolve);
		});
	}

	private async requestHandler(request: http.IncomingMessage, response: http.ServerResponse) {
		if (request.url === undefined) {
			throw new ShouldNotHappendError("request url should be defined");
		}
		const requestId = this.makeRequestId();
		const logData: Record<string,any> = {
			method: request.method,
			path: request.url,
			host: request.headers.host,
			client: request.socket.remoteAddress,
			requestId: requestId,
		};
		try {
			if (request.url.startsWith("/api")) {
				await this.handleApiRequests(request, response, logData);
			} else {
				await this.handleS3Requests(request, response, logData);
			}
		} catch (e) {
			console.error(e);
			if (e instanceof HttpError) {
				const type = e.toType(request.url, requestId, this.config.data["node-id"]);
				this.sendResponse(new HttpResponse(type, e.errorCode), response);
			} else {
				response.writeHead(500);
				response.end(e.stack || e.toString());
				// TODO: handle this error
			}
			
		}
		this.logger.http("http request", logData);
	}

	private async handleApiRequests(request: http.IncomingMessage, response: http.ServerResponse, _logData: Record<string,any>) {
		(this.express as any).handle(request, response);
	}

	private async handleS3Requests(request: http.IncomingMessage, remote: http.ServerResponse, logData: Record<string, any>) {
		const action = this.router.findAction(request);
		logData.action = action?.constructor.name;
		if (action === undefined) {
			throw new NotImplementedError();
		}
		action.requestId = logData.requestId;
		action.handleUnsuportedParameters(this.logger);
		const response = await action.run();
		this.sendResponse(response, remote);
	}

	private sendResponse(actionResponse: HttpResponse, remote: http.ServerResponse) {
		let body: string | Buffer | undefined = undefined;
		if (typeof actionResponse.body === 'string' || actionResponse.body instanceof Buffer) {
			body = actionResponse.body;
		} if (actionResponse.body instanceof Type) {
			body = this.responseSerializer.serialize(actionResponse.body);
			actionResponse.headers["Content-Type"] = "application/xml";
		}
		if (actionResponse.body instanceof Readable) {
			actionResponse.body.pipe(remote, {
				end: true,
			});
			actionResponse.body.on("error", (_error) => {
				// TODO: Log this error
				remote.destroy();
			});
			return;
		}
		actionResponse.headers["Content-Length"] = body?.length || 0;
		remote.writeHead(actionResponse.status, actionResponse.headers);
		remote.end(body);
	}

	private makeRequestId(): string {
		this.requestCounter++;
		return( Date.now() + this.requestCounter).toString(16);
	}
}
