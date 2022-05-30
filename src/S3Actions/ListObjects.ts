import { inject, injectable } from 'tsyringe';
import Config from '../Authenticator';
import Database from '../Database';
import InvalidArgumentError from '../Errors/InvalidArgumentError';
import NoSuchBucketError from '../Errors/NoSuchBucketError';
import ShouldNotHappendError from '../Errors/ShouldNotHappendError';
import HttpResponse from '../HttpResponse';
import PeerManager from '../PeerManager';
import CommonPrefix from '../S3Types/CommonPrefix';
import ListBucketResult from '../S3Types/ListBucketResult';
import ObjectModel from '../S3Types/Object';
import Owner from '../S3Types/Owner';
import Action, { IParameters, UnsuportErrorLevel } from './Action';

@injectable()
export default class ListObjects extends Action {
    public readonly method: string = 'GET';

    public readonly parameters: IParameters = {
        Bucket: {
            required: true,
            place: 'url',
        },
        delimiter: {
            required: false,
            place: 'url'
        },
        prefix: {
            required: false,
            place: 'url'
        },
        "start-after": {
            required: false,
            place: 'url'
        },
        "encoding-type": {
            required: false,
            place: 'url'
        },
        marker: {
            required: false,
            place: 'url'
        },
        "max-keys": {
            required: false,
            place: 'url'
        },
        "list-type": {
            required: false,
            place: "url"
        },
        "continuation-token": {
            required: false,
            place: "url"
        },
        "fetch-owner": {
            required: false,
            place: "url"
        },
        "x-amz-request-payer": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.IGNORE,
        },
        "x-amz-expected-bucket-owner": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.IGNORE,
        }
    };

    public Bucket?: string;
    public prefix?: string;
    public delimiter?: string;
    public "start-after"?: string;
    public "encoding-type"?: string;
    public "marker"?: string;
    public "max-keys"?: string;
    public "list-type"?: string;
    public "continuation-token"?: string;
    public "fetch-owner"?: string;

    public constructor(
        @inject(Database) private database: Database,
        @inject(Config) private authenticator: Config,
        @inject(PeerManager) private peerManager: PeerManager,
    ) {
        super();
    }


    public async run(): Promise<HttpResponse> {
        await this.validate();
        if (!this.Bucket) {
            throw new ShouldNotHappendError("Bucket name is empty");
        }

        const isV2 = this['list-type'] === "2";
        let startAt: string | undefined;
        if (isV2) {
            startAt = this['continuation-token'] || this['start-after'];
        } else {
            startAt = this.marker;
        }
        let nextMarker: string | undefined;


        const maxKeys = this["max-keys"] !== undefined ? Math.min(parseInt(this["max-keys"]), 1000) : 1000;
        const objects = await this.database.getObjects(this.Bucket, startAt, maxKeys + 1, this.prefix, false);
        const owner = (!isV2 || this["fetch-owner"] !== undefined) ? new Owner("", "j3") : undefined; // TODO this must be service owner
        const keys = Object.keys(objects);
        const keyCount = Math.min(maxKeys, keys.length);
        const commonGroups = this.delimiter !== undefined ? this.getCommonGroups(keys, this.delimiter, this.prefix) : [];
        
        for (const key of keys) {
            for (const group of commonGroups) {
                if (key.startsWith(group)) {
                    delete objects[key];
                }
            }
        }


        const Contents: ObjectModel[] = [];
        for (const key in objects) {
            const object = objects[key];
            Contents.push(new ObjectModel(key, object.size, object.etag, object.lastModified, undefined, object.storageClass, owner));
        }

        const isTruncated = Contents.length > maxKeys;

        if (isTruncated) {
            const last = Contents.splice(maxKeys);
            nextMarker = last[0].Key;
        }


        const body = new ListBucketResult(
            this.Bucket,
            this.prefix || "",
            this.delimiter || "",
            isTruncated,
            maxKeys,
            keyCount,
        );
        body.Contents = Contents;
        body.CommonPrefixes = commonGroups.map((prefix) => new CommonPrefix(prefix));
        body.EncodingType = this['encoding-type'];
        if (isV2) {
            body.ContinuationToken = startAt;
            body.NextContinuationToken = nextMarker;
            body.StartAfter = this['start-after'];
        } else {
            body.Marker = this.marker;
            body.NextMarker = nextMarker;
        }

        return new HttpResponse(body);
    }

    public async validate() {
        this.peerManager.insureAtleastReadOnlyMode();
        await this.authenticator.mustHasAccess(this.constructor.name);
        if (!this.Bucket) {
            throw new ShouldNotHappendError("Bucket name is empty");
        }

        if (this['encoding-type'] !== undefined && this['encoding-type'] !== "url") {
            throw new InvalidArgumentError("Invalid Encoding Method specified in Request");
        }

        if (this['list-type'] !== undefined && this['list-type'] !== "2") {
            throw new InvalidArgumentError("Invalid List Type specified in Request");
        }

        if (this['max-keys'] !== undefined && !(/^\d+$/.test(this['max-keys']))) {
            throw new InvalidArgumentError("Argument maxKeys must be an integer between 0 and 1000");
        }
    
    
        const bucket = await this.database.getBucket(this.Bucket);
        if (bucket === undefined || bucket.deleteMarker) {
            throw new NoSuchBucketError();
        }

    }

    private getCommonGroups(keys: string[], delimiter: string, prefix?: string): string[] {
        const l = keys.length;
        if (l === 1) {
            return [];
        }

        let groups: string[] = [];
        let last: number = -1;
        for (let x = 1; x < l; x++) {
            const common = this.findCommonPrefix(keys[x - 1], keys[x], delimiter, prefix !== undefined ? prefix.length : 0);
            if (common === -1 && last !== -1) {
                groups.push(keys[x - 1].substring(0, last) + delimiter);
                last = common;
            } else if (last === -1 && common !== -1) {
                last = common;
            } else {
                last = Math.min(last, common);
            }
        }
        if (last !== -1) {
            groups.push(keys[l - 1].substring(0, last) + delimiter);
        }
        return groups;
    }

    private findCommonPrefix(a: string, b: string, delimiter: string, startAt: number = 0): number {
        let pos: number = startAt - 1;
        for (let l = Math.min(a.length, b.length); pos < l;) {
            const aPrefixOffset = a.indexOf(delimiter, pos + 1);
            const bPrefixOffset = b.indexOf(delimiter, pos + 1);
            console.log({ aPrefixOffset, bPrefixOffset });
            if (aPrefixOffset === -1 || bPrefixOffset === -1 || aPrefixOffset !== bPrefixOffset) {
                break;
            }
            const aPrefix = a.substring(0, aPrefixOffset);
            const bPrefix = b.substring(0, bPrefixOffset);
            if (aPrefix !== bPrefix) {
                break;
            }
            pos = aPrefixOffset;
        }

        return pos > startAt ? pos : -1;
    }
}
