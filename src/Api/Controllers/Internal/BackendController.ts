import { Request, Response } from "express";
import { inject, singleton } from "tsyringe";
import BackendManager from "../../../BackendManager";
import Backend from "../../../Backends/Backend";
import RemotePeerBackend from "../../../Backends/RemotePeerBackend";


interface IBackendParams {
	backend: string;
}

interface IObjectParams extends IBackendParams {
	bucket: string;
	key: string;
}

interface IAllocationQuery {
	size: number;
}

type AllocationRequest = Request<IObjectParams, any, any, IAllocationQuery>;

export interface IExportedBackend {
	id: string;
	remainingSpace: number;
}

@singleton()
export default class BackendController {
	public constructor(
		@inject(BackendManager) private backendManager: BackendManager
 	) {}
	
	public async list(_request: Request, response: Response) {
		response.send(await this.exportAllBackends());
	}

	public async exportAllBackends(): Promise<IExportedBackend[]> {
		const promises = this.backendManager.all()
			.filter((backend) => !(backend instanceof RemotePeerBackend))
			.map((backend) => this.exportBackend(backend));
		return await Promise.all(promises);
	}

	public async getBackend(request: Request, response: Response) {
		const backend = this.backendManager.get(request.params.backend);
		if (backend === undefined) {
			response.status(404).send();
			return;
		}

		const exportBackend = await this.exportBackend(backend);
		response.send(exportBackend);
	}

	public async putObject(request: AllocationRequest, response: Response) {
		const backend = this.backendManager.get(request.params.backend);
		if (backend === undefined) {
			response.status(404).send();
			return;
		}

		const stream = await backend.allocateSpace(request.params.bucket, request.params.key, request.query.size);
		request.pipe(stream, {
			end: true,
		});
		await new Promise((resolve) => request.on("end", resolve));
		await backend.commitObject(stream);
		response.status(204).send();
	}

	public async getObject(request: Request<IObjectParams>, response: Response) {
		const backend = this.backendManager.get(request.params.backend);
		if (backend === undefined) {
			response.status(404).send();
			return;
		}

		const {stream, length} = await backend.getObject(request.params.bucket, request.params.key);

		response.status(200);
		response.setHeader("Content-Length", length);
		stream.pipe(response, {
			end: true
		});
	}

	private async exportBackend(backend: Backend): Promise<IExportedBackend> {
		const remainingSpace = await backend.getRemainingSpace();
		return {
			id: backend.id,
			remainingSpace: remainingSpace,
		};
	}
}