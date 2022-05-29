import { IPeerConfig } from "./Config";
import axios, { AxiosInstance } from "axios";
import { inject, injectable } from "tsyringe";
import { IHealthCheckResponse } from "./Api/Controllers/Internal/HealthCheckController";
import { DatabaseUpdates } from "./Database";
import { Logger } from "winston";

@injectable()
export default class Peer {
	public hostname?: string;
	public port?: number;
	private axios: AxiosInstance | undefined;

	public lastContact?: Date;
	public isSync: boolean = false;

	public constructor(
		@inject("Logger") private logger: Logger,
	) {}

	public async init(config: IPeerConfig) {
		this.hostname = config.hostname;
		this.port = config.port;
	}
	

	public async getConfigHealthCheck(currentDatabaseVerionId: string, timeout?: number): Promise<IHealthCheckResponse> {
		const response = await this.getHttpClient().get<IHealthCheckResponse>("/api/internal/health-check", {
			params: {
				"version-id": currentDatabaseVerionId
			},
			timeout: timeout,
		})
		return response.data;
	}

	public async broadcastUpdates(updates: DatabaseUpdates) {
		this.logger.debug("broadcast updates to peer", {
			peer: this.getName(),
			updates: updates.map((update) => update.versionId),
		});
		const response = await this.getHttpClient().post("/api/internal/database/apply-updates", { updates }, {
			
		});
		if (response.status !== 204) {
			throw new Error();
		}
	}

	public getHttpClient(): AxiosInstance {
		if (!this.axios) {
			this.axios = axios.create({
				baseURL: this.getURL(),
				headers: {
					Authtorization: this.getAuthorizationValue(),
				}
			});
		}
		return this.axios
	}

	private getURL(append?: string): string {
		return `http://${this.hostname}:${this.port}/${append || ""}`;
	}

	public getName(): string {
		return `${this.hostname}:${this.port}`;
	}

	private getAuthorizationValue(): string {
		return "Bear hi";
	}
}