import { container, inject, singleton } from "tsyringe";
import { Logger } from "winston";
import Config, { IPeerConfig } from "./Config";
import BackendManager from "./BackendManager";
import Database, { DatabaseUpdate, DatabaseUpdates } from "./Database";
import ReadOnyModeError from "./Errors/ReadOnlyModeError";
import ShouldNotHappendError from "./Errors/ShouldNotHappendError";
import Peer from "./Peer";
import { IRemotePeerPeerConfig } from "./Api/Controllers/Internal/HealthCheckController";
import { IExportedBackend } from "./Api/Controllers/Internal/BackendController";

@singleton()
export default class PeerManager {

	private peers: Peer[]|undefined;
	private readOnlyMode: boolean = true;
	private runningHealthCheck = false;
	private healthCheckInterval: NodeJS.Timer | undefined;

	public constructor(
		@inject(Config) private config: Config,
		@inject(Database) private database: Database,
		@inject("Logger") private logger: Logger,
		@inject(BackendManager) private backendManager: BackendManager,
	) {}

	public async init(): Promise<void> {
		if (this.peers !== undefined) {
			throw new ShouldNotHappendError("Already inited");
		}
		if (this.config.data.peers === undefined) {
			this.peers = [];
			return;
		}
		const promises = this.config.data.peers.map((peerConfig) => this.initPeer(peerConfig));
		this.peers = await Promise.all(promises);
	}

	private async initPeer(peerConfig: IPeerConfig): Promise<Peer> {
		const peer = container.resolve(Peer);
		await peer.init(peerConfig);
		return peer;
	}

	public all(): Peer[] {
		if (!this.peers) {
			throw new ShouldNotHappendError("Did not inited, yet");
		}

		return this.peers;
	}

	public setupHealthCheckInterval(timer: number) {
		this.logger.debug("Setuping health check interval", {timer});
		this.healthCheckInterval = setInterval(() => {
			this.logger.debug("health check interval hit, if already there is a running health check, this will skiped", { alreadyRunningHealthCheck: this.runningHealthCheck});
			if (!this.runningHealthCheck) {
				this.healthCheck();
			}
		}, timer);
	}

	public clearHealthCheckInterval() {
		this.logger.debug("clear health check interval, if it's not setuped already, this will do nothing", { alreadySetup: this.healthCheckInterval !== undefined });
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
			this.healthCheckInterval = undefined;
			this.runningHealthCheck = false;
		}
	}


	public async healthCheck() {
		const peers = this.all();
		if (peers.length === 0) {
			this.goInFullOprationMode();
			return;
		}
		this.logger.info("Run health check for all peers");
		this.runningHealthCheck = true;
		for (const peer of peers) {
			try {
				await this.runPeerHealthCheck(peer);
			} catch (e) {
				peer.isSync = false;
				this.logger.error("health check for peer failed", { peer: peer.getName(), error:e.toString() });
			}
		}
		this.runningHealthCheck = false;

		if (peers.find((p) => p.isSync) !== undefined) {
			this.goInFullOprationMode();
		} else {
			this.goInReadOnlyMode();
		}
	}

	public goInReadOnlyMode(): void {
		if (!this.readOnlyMode) {
			this.logger.info("go in readonly mode");
			this.readOnlyMode = true;
		}
	}

	public goInFullOprationMode(): void {
		if (this.readOnlyMode) {
			this.logger.info("exit from readonly mode");
			this.readOnlyMode = false;
		}
	}

	public isReadOnly() {
		return this.readOnlyMode;
	}

	public insureFullOperationalMode() {
		if (this.readOnlyMode) {
			throw new ReadOnyModeError();
		}
	}

	public insureAtleastReadOnlyMode() {
	}

	public broadcastUpdate(update: DatabaseUpdate): Promise<void> {
		return this.broadcastUpdates([update]);
	}

	public async broadcastUpdates(updates: DatabaseUpdates): Promise<void> {
		const promises = this.all()
			.filter((peer) => peer.isSync) // This cause newly recovered nodes not receiving new updates and keep their old version id. this help them to pull updates from correct version id.
			.map((peer) => {
				const promise = peer.broadcastUpdates(updates);
				promise.catch((e) => {
					this.logger.debug("broadcast updates failed for peer", {
						peer: peer.getName(),
						updates: updates.map((update) => update.versionId),
						error: e,
					});
				});

				return promise;
			});
		if (promises.length === 0) {
			return;
		}
		return Promise.any(promises);
	}

	private async runPeerHealthCheck(peer: Peer): Promise<void> {
		const versionId = await this.database.getVersionId();
		this.logger.info("Run health check for peer", { peer: peer.getName(), myVersionId: versionId });
		const timeout = 15 * 1000;
		const config = await peer.getConfigHealthCheck(versionId, timeout);
		this.logger.info("Health check for peer ran successfully", { peer: peer.getName(), myVersionId: versionId, peerVersionId: config.databaseVerionId });
		peer.lastContact = new Date();

		this.checkPeersOfPeer(config.peers);
		this.syncListOfBackends(peer, config.backends);

		if (config.databaseVerionId < versionId) {
			peer.isSync = false;
			return;
		}
		peer.isSync = true;
		if (config.updates.length) {
			await this.applyUpdates(config.updates);
		}
	}

	private async applyUpdates(updates: DatabaseUpdates) {
		this.logger.info("Applying updates from peer", { count: updates.length });
		this.goInReadOnlyMode();
		await this.database.applyUpdates(updates);
		this.goInFullOprationMode();
	}

	private checkPeersOfPeer(_peers: IRemotePeerPeerConfig[]) {
		// TODO: check all peers have same list of peers in their configs
	}

	private syncListOfBackends(peer: Peer, backends: IExportedBackend[]) {
		for (const backend of backends) {
			this.backendManager.insureHaveRemotePeerBackend(peer, backend.id);
		}
	}

}