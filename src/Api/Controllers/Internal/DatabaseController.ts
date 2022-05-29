import { ParamsDictionary } from "express-serve-static-core";
import { Request, Response } from "express";
import { inject, injectable } from "tsyringe";
import Database, { DatabaseUpdates } from "../../../Database";

@injectable()
export default class DatabaseController {
	public constructor(
		@inject(Database) private database: Database,
	) {}

	public async applyUpdates(request: Request<ParamsDictionary, any, {updates: DatabaseUpdates}>, response: Response) {
		await this.database.waitForUpdating(15 * 1000);
		await this.database.applyUpdates(request.body.updates);
		response.status(204).send();
	}
}