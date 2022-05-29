import { createHash, Hash } from 'crypto';
import { OutgoingHttpHeaders } from 'http';
import { Writable } from 'stream';
import { inject, injectable } from 'tsyringe';
import Config from '../Authenticator';
import BackendManager from '../BackendManager';
import Database, { IObjectMetadata } from '../Database';
import BadDigestError from '../Errors/BadDigestError';
import InternalError from '../Errors/InternalError';
import InvalidArgumentError from '../Errors/InvalidArgumentError';
import InvalidBucketNameError from '../Errors/InvalidBucketNameError';
import InvalidDigestError from '../Errors/InvalidDigestError';
import MissingContentLengthError from '../Errors/MissingContentLengthError';
import NoSuchBucketError from '../Errors/NoSuchBucketError';
import NotImplementedError from '../Errors/NotImplementedError';
import HttpResponse from '../HttpResponse';
import PeerManager from '../PeerManager';
import Action, { UnsuportErrorLevel } from './Action';

@injectable()
export default class PutObject extends Action {
    public readonly method: string = 'PUT';

    public readonly parameters = {
        Bucket: {
            required: true,
            place: 'url',
        },
        Key: {
            required: true,
            place: 'url',
        },
        "Content-MD5": {
            required: false,
            place: "header",
        },
        "Content-Type": {
            required: false,
            place: "header"
        },
        "Content-Length": {
            required: true,
            place: "header",
        },
        "x-amz-acl": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-sdk-checksum-algorithm": {
            required: false,
            place: "header",
        },
        "x-amz-checksum": {
            required: false,
            place: "header",
        },
        "x-amz-checksum-crc32": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-checksum-crc32c": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-checksum-sha1": {
            required: false,
            place: "header",
        },
        "x-amz-checksum-sha256": {
            required: false,
            place: "header",
        },
        "x-amz-grant-full-control": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-grant-read": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-grant-read-acp": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-grant-write-acp": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-server-side-encryption": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-storage-class": {
            required: false,
            place: "header",
        },
        "x-amz-website-redirect-location": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-server-side-encryption-customer-algorithm": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-server-side-encryption-customer-key": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-server-side-encryption-customer-key-MD5": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-server-side-encryption-aws-kms-key-id": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-server-side-encryption-context": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-server-side-encryption-bucket-key-enabled": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-request-payer": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.IGNORE,
        },
        "x-amz-tagging": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-object-lock-mode": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-object-lock-retain-until-date": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-object-lock-legal-hold": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.FATAL,
        },
        "x-amz-expected-bucket-owner": {
            required: false,
            place: "header",
            unsupported: UnsuportErrorLevel.IGNORE,
        },
    };

    public Bucket?: string;
    public Key?: string;
    public "Content-MD5"?: string;
    public "Content-Type"?: string;
    public "Content-Length"?: number;
    public "x-amz-sdk-checksum-algorithm"?: string;
    public "x-amz-checksum"?: string;
    public "x-amz-checksum-sha1"?: string;
    public "x-amz-checksum-sha256"?: string;
    public "x-amz-storage-class"?: string;

    public constructor(
        @inject(Database) private database: Database,
        @inject(Config) private authenticator: Config,
        @inject(BackendManager) private backendManager: BackendManager,
        @inject(PeerManager) private peerManager: PeerManager,
    ) {
        super();
    }

    public async run(): Promise<HttpResponse> {
        await this.validate();
        if (this.Bucket === undefined || this.Key === undefined || this['Content-Length'] === undefined) {
            throw new Error();
        }

        if (this["x-amz-storage-class"] === undefined) {
            this["x-amz-storage-class"] = "STANDARD";
        }

        if (this['x-amz-checksum-sha1'] || this["x-amz-checksum-sha256"]) {
            this["x-amz-sdk-checksum-algorithm"] = undefined;
            this["x-amz-checksum"] = undefined;
        }

        if (this["x-amz-sdk-checksum-algorithm"] && this["x-amz-checksum"]) {
            this['x-amz-checksum-' + this["x-amz-sdk-checksum-algorithm"]] = this["x-amz-checksum"];
        }

        const { backend, stream } = await this.backendManager.allocateSpace(this.Bucket, this.Key, this['Content-Length']);

        const { hashs, calculators: hashCalculators } = this.buildHashs();

        const versionId = this.database.generateVersionId();
        try {
            await this.saveInTempFile(stream, Object.values(hashCalculators));

            for (const name in hashCalculators) {
                hashs[name] = hashCalculators[name].digest("hex");
            }

            this.checkChecksum(hashs);
            await backend.commitObject(stream);
            const update = await this.database.createObject(
                versionId,
                this.Bucket,
                this.Key,
                this['Content-Length'],
                hashs.md5,
                [backend.id],
                this["x-amz-storage-class"],
                undefined,
                this.getMetadata(),
            );
            await this.peerManager.broadcastUpdate(update);

        } finally {
            backend.freeAllocation(stream);
        }
        const headers = Object.assign({}, this.exportHashHeaders(hashs));
        return new HttpResponse(undefined, 200, headers);
    }

    public async validate() {
        this.peerManager.insureFullOperationalMode();
        await this.authenticator.mustHasAccess(this.constructor.name);

        if (this.Bucket === undefined || this.Bucket.length < 3) {
            throw new InvalidBucketNameError("Bucket is empty");
        }
        if (this.Key === undefined || this.Key.length < 1) {
            throw new InternalError("Key is empty or undefined");
        }

        if (this['Content-Length'] === undefined || this['Content-Length'] < 0) {
            throw new MissingContentLengthError();
        }

        if (this["x-amz-storage-class"] !== undefined && this["x-amz-storage-class"] !== "STANDARD") {
            throw new NotImplementedError("customize storage class is not implemented");
        }
        if (this["x-amz-sdk-checksum-algorithm"] !== undefined) {
            const algo = this["x-amz-sdk-checksum-algorithm"];
            if (
                algo !== 'CRC32' &&
                algo !== 'CRC32C' &&
                algo !== 'SHA1' &&
                algo !== 'SHA256'
            ) {
                throw new InvalidArgumentError("invalid value for x-amz-sdk-checksum-algorithm header");
            }

            if (algo !== 'SHA1' && algo !== 'SHA256') {
                throw new NotImplementedError(`checksum algorithm ${algo} is not implemented`);
            }

            if (!this["x-amz-checksum"]) {
                throw new InvalidDigestError("invalid x-amz-checksum");
            }
        }

        const info = await this.database.getBucket(this.Bucket);
        if (info === undefined) {
            throw new NoSuchBucketError();
        }
    }

    private saveInTempFile(file: Writable, hashs: Hash[]): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.request === undefined) {
                throw new Error();
            }
            this.request.on("data", (chunk: Buffer) => {
                for (const hash of hashs) {
                    hash.update(chunk);
                }

                file.write(chunk, (err) => {
                    if (err) {
                        return reject(new InternalError(`Error in writing in temp file`));
                    }
                });
            });
            this.request.on("end", () => {
                resolve();
            });
        });
    }

    private buildHashs(): {hashs: Record<string, string>, calculators: Record<string, Hash>} {
        const calculators: Record<string, Hash> = {
            md5: createHash("md5")
        };
        const hashs: Record<string, string> = {};

        if (this["x-amz-checksum-sha1"] !== undefined) {
            calculators.sha1 = createHash("sha1");
        }
        if (this["x-amz-checksum-sha256"] !== undefined) {
            calculators.sha256 = createHash("sha256");
        }

        return { calculators, hashs };
    }


    private checkChecksum(hashs: Record<string, string>): void {
        if (this['Content-MD5'] !== undefined && hashs.md5 !== this['Content-MD5']) {
            throw new BadDigestError("The Content-MD5 you specified did not match what we received.");
        }
        for (const name in hashs) {
            if (name === 'md5') {
                continue;
            }
            const key = `x-amz-checksum-${name}`;
            if (this[key] !== undefined && this[key] !== hashs[name]) {
                throw new BadDigestError(`The ${key} you specified did not match what we received.`);
            }
        }
    }

    private getMetadata(): IObjectMetadata {
        const metadata: IObjectMetadata = {};
        if (this['Content-Type'] !== undefined) {
            metadata["content-type"] = this['Content-Type'];
        }
        if (this.request?.headers) {
            for (const key in this.request.headers) {
                if (!key.startsWith("x-amz-meta-")) {
                    continue;
                }
                const metaKey = key.substring("x-amz-meta-".length);
                const metaValue = this.request.headers[key];
                if (typeof metaValue === "string") {
                    metadata[metaKey] = metaValue;
                }
            }
        }
        return metadata;
    }

    private exportHashHeaders(hashs: Record<string, string>): OutgoingHttpHeaders {
        const headers: OutgoingHttpHeaders = {
            "ETag": hashs.md5
        };
        for (const hash in hashs) {
            if (hash === "md5") {
                continue;
            }
            headers[`x-amz-checksum-${hash}`] = hashs[hash];
        }

        return headers;
    }
}
