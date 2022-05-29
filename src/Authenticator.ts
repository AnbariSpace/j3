import { injectable } from "tsyringe";
import AccessDeniedError from "./Errors/AccessDeniedError";

@injectable()
export default class Authenticator {
	public async hasAccess(_action: string): Promise<boolean> {
		return true;
	}

	public async mustHasAccess(action: string): Promise<void> {
		if (!await this.hasAccess(action)) {
			throw new AccessDeniedError();
		}
	}
}