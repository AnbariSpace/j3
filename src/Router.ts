import { IncomingMessage } from 'http';
import { container, inject, injectable } from 'tsyringe';
import Config from './Config';
import * as Actions from './S3Actions';
import Action from './S3Actions/Action';
import { getParameterCaseInsensitive, ltrim } from './utilties';

@injectable()
export default class Router {
  private sortedActions: Action[] | undefined;

  public constructor(
    @inject(Config) private config: Config
  ) {}

  public findAction(req: IncomingMessage): Action | undefined {
    const { method, headers } = req;
    if (req.url === undefined || method === undefined || headers === undefined) {
      throw new Error();
    }
    if (req.headers.host === undefined) {
      return undefined;
    }
    const mainEndpoint = this.config.data['public-domain'];

    const url = new URL(req.url, `http://${req.headers.host}`);
    if (!url.hostname.endsWith(mainEndpoint)) {
      return undefined;
    }
    const { bucket, key } = this.extractBucketAndKey(url, mainEndpoint);

    const action = this.getActions().find((action) => this.isActionMatch(action, method, bucket, key, headers, url.searchParams));
    if (action === undefined) {
      return undefined;
    }

    const newAction =  this.createAction(action.constructor as typeof Action, bucket, key, headers, url.searchParams);
    newAction.request = req;

    return newAction;
  }

  private extractBucketAndKey(url: URL, mainEndpoint: string) {
    let bucket: string | undefined;
    let key: string | undefined;
    if (url.hostname.endsWith(`.${mainEndpoint}`)) {
      bucket = url.hostname.substring(0, url.hostname.length - mainEndpoint.length - 1);
      key = url.pathname;
    } else {
      const matches = url.pathname.match(/(?:^|\/)([a-z0-9\.\_\-]{1,63})($|\/.*)/i);
      if (matches && matches.length) {
        bucket = matches[1];
        key = matches[2];
      }
    }
    if (key !== undefined) {
      key = ltrim(key, "/");
      if (key.length !== 0) {
        key = decodeURIComponent(key);
      } else {
        key = undefined;
      }
    }

    return { bucket, key };
  }

  private getActions() {
    if (this.sortedActions == undefined) {
      const actionsList = Actions as { [key: string]: any };
      this.sortedActions = [];
      for (const name in actionsList) {
        if (actionsList[name] !== undefined) {
          this.sortedActions.push(container.resolve(actionsList[name]));
        }
      }
      this.sortedActions.sort((a, b) => {
        const filter = (filter: { required?: boolean }) => filter.required === true;
        return Object.values(b.parameters).filter(filter).length - Object.values(a.parameters).filter(filter).length;
      });
    }

    return this.sortedActions;
  }

  private isActionMatch(
    action: Action,
    method: string,
    bucket: string | undefined,
    key: string | undefined,
    headers: NodeJS.Dict<string | string[]>,
    urlParameters: URLSearchParams,
  ): boolean {
    if (action.method !== method) {
      return false;
    }
    if (bucket !== undefined && action.parameters.Bucket === undefined) {
      return false;
    }
    if (key !== undefined && action.parameters.Key === undefined) {
      return false;
    }
    for (const name in action.parameters) {
      if (action.parameters[name] !== undefined) {
        const parameter = action.parameters[name];
        if (parameter.required !== true) {
          continue;
        }
        if (parameter.place === 'url') {
          if (name === 'Bucket') {
            if (bucket === undefined) {
              return false;
            }
            continue;
          }
          if (name === 'Key') {
            if (key === undefined) {
              return false;
            }
            continue;
          }
          let found = false;
          for (const parameter of urlParameters.keys()) {
            if (name.toLowerCase() === parameter.toLowerCase()) {
              found = true;
              break;
            }
          }
          if (!found) {
            return false;
          }
        } else if (parameter.place === 'header') {
          if (getParameterCaseInsensitive(headers, name) === undefined) {
            return false;
          }
        } else {
          throw new Error(`unknown parameter place: ${parameter.place}`);
        }
      }
    }
    return true;
  }

  protected createAction(
    action: typeof Action,
    bucket: string | undefined,
    key: string | undefined,
    headers: NodeJS.Dict<string | string[]>,
    urlParameters: URLSearchParams,
  ): Action {
    const newAction = container.resolve(action);

    for (const name in newAction.parameters) {
      if (newAction.parameters[name] !== undefined) {
        const parameter = newAction.parameters[name];
        if (parameter.place === 'url') {
          if (name === 'Bucket') {
            newAction.Bucket = bucket;
            continue;
          }
          if (name === 'Key') {
            newAction.Key = key;
            continue;
          }
          for (const parameter of urlParameters.keys()) {
            if (name.toLowerCase() === parameter.toLowerCase()) {
              newAction[name] = urlParameters.get(parameter);
              break;
            }
          }
        } else if (parameter.place === 'header') {
          const value = getParameterCaseInsensitive(headers, name);
          newAction[name] = value;
        } else {
          throw new Error(`unknown parameter place: ${parameter.place}`);
        }
      }
    }

    return newAction;
  }
}
