import { NextFunction, Request, RequestHandler, Response } from "express";
import { container, InjectionToken } from "tsyringe";

export function getParameterCaseInsensitive<T>(object: { [key: string]: T }, key: string): T | undefined {
	const asLowercase = key.toLowerCase();
	const index = Object.keys(object).find((k) => k.toLowerCase() === asLowercase);
	if (index === undefined) {
		return undefined;
	}
	return object[index];
}

export function ltrim(str: string, chars: string = '/') {
	while (str.length) {
		let found = false;
		for (const char of chars) {
			if (str.startsWith(char)) {
				str = str.substring(1);
				found = true;
			}
		}
		if (!found) {
			break;
		}
	}

	return str;
}

export function runController<T, P, ResBody, ReqBody, ReqQuery, Locals>(controller: InjectionToken<T>, method: RequestHandler<P, ResBody, ReqBody, ReqQuery, Locals>): RequestHandler {
	return (request: Request, response: Response, next: NextFunction) => {
		const object: T = container.resolve<T>(controller);
		if (typeof object !== "object") {
			throw new Error("controller is not class or object");
		}
		const result = method.call(object, request, response, next);
		if (typeof result === "object" && result instanceof Promise) {
			result.catch((e) => {
				next(e);
			});
		}

		return result;
	};
}
