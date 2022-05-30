import { IncomingMessage } from 'http';
import { Logger } from 'winston';
import NotImplementedError from '../Errors/NotImplementedError';
import HttpResponse from '../HttpResponse';

export enum UnsuportErrorLevel {
    FATAL,
    WARNING,
    IGNORE,
}

export interface IParameter {
    required?: boolean;
    place: string;
    unsupported?: UnsuportErrorLevel;
}
export type IParameters = Record<string, IParameter>;

export default class Action {
    public readonly method: string = '';

    public readonly parameters: IParameters = {};

    public requestId?: string;
    public request?: IncomingMessage;

    [key: string]: any;

    public async run(): Promise<HttpResponse> {
        throw new Error("Not supported");
    }

    public handleUnsuportedParameters(logger: Logger): void {
        for (const name in this.parameters) {
            const parameter = this.parameters[name];
            if (this[name] === undefined || parameter.unsupported === undefined) {
                continue;
            }
            if (parameter.unsupported === UnsuportErrorLevel.FATAL) {
                throw new NotImplementedError(`parameter '${name}' is not implemented`);
            }
            if (parameter.unsupported === UnsuportErrorLevel.WARNING) {
                logger.warn("not implemented parameter used", {
                    action: this.constructor.name,
                    parameter: name,
                    value: this[name],
                    requestId: this.requestId,
                });
            }
        }
    }
}
