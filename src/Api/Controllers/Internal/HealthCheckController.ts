import { Request, Response } from "express";
import Database, { DatabaseUpdates } from "../../../Database";
import { inject, singleton } from "tsyringe";
import BackendController, { IExportedBackend } from "./BackendController";
import PeerManager from "../../../PeerManager";
import ShouldNotHappendError from "../../../Errors/ShouldNotHappendError";


export interface IRemotePeerPeerConfig {
	hostname: string;
	port: number;
	isSync: boolean;
	lastContact?: Date;
}

export interface IHealthCheckResponse {
	databaseVerionId: string;
	readOnlyMode: boolean;
	backends: IExportedBackend[];
	peers: IRemotePeerPeerConfig[];
	updates: DatabaseUpdates;
}

@singleton()
export default class HealthCheckController {
	public constructor(
		@inject(Database) private database: Database,
		@inject(BackendController) private backendController: BackendController,
		@inject(PeerManager) private peerManager: PeerManager,
	) {}

	public async handle(request: Request, response: Response<IHealthCheckResponse>) {
		const since = request.query["version-id"];
		if (typeof since !== "string") {
			throw new Error("invalid version-id");
		}
		const [databaseVerionId, backends, updates] = await Promise.all([
			this.database.getVersionId(),
			this.backendController.exportAllBackends(),
			this.database.getUpdates(since),
		]);

		const peers: IRemotePeerPeerConfig[] = this.peerManager.all().map((peer) => {
			if (peer.hostname === undefined) {
				throw new ShouldNotHappendError("peer.hostname is undefined");
			}
			if (peer.port === undefined) {
				throw new ShouldNotHappendError("peer.port is undefined");
			}
			return {
				hostname: peer.hostname,
				port: peer.port,
				isSync: peer.isSync,
				lastContact: peer.lastContact,
			};
		});

		response.status(200).send({
			databaseVerionId,
			readOnlyMode: this.peerManager.isReadOnly(),
			backends,
			updates,
			peers,
		});
	}
}