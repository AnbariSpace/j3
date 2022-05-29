import { inject, injectable } from 'tsyringe';
import Config from '../Authenticator';
import Database from '../Database';
import NoSuchBucketError from '../Errors/NoSuchBucketError';
import ShouldNotHappendError from '../Errors/ShouldNotHappendError';
import HttpResponse from '../HttpResponse';
import PeerManager from '../PeerManager';
import ListBucketResult from '../S3Types/ListBucketResult';
import Object from '../S3Types/Object';
import Owner from '../S3Types/Owner';
import Action from './Action';

@injectable()
export default class ListObjects extends Action {
  public readonly method: string = 'GET';

  public readonly parameters = {
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

  };

  public Bucket: string|undefined;
  public prefix: string|undefined;
  public delimiter: string|undefined;
  public "start-after": string|undefined;

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
    const Prefix = "";
    const Marker = "";
    const MaxKeys = 1000;
    const Delimiter = "";
    
    const objects = await this.database.getObjects(this.Bucket, undefined, MaxKeys + 1, undefined, false);
    const owner = new Owner("", "j3"); // TODO this must be service owner

    const Contents: Object[] = [];
    for (const key in objects) {
      const object = objects[key];
      if (object.deleteMarker) {
        continue;
      }
      Contents.push(new Object(key, object.size, object.etag, object.lastModified, undefined, object.storageClass, owner));
    }
    const IsTruncated = Contents.length > MaxKeys;

    if (IsTruncated) {
      Contents.splice(MaxKeys);
    }


    const body = new ListBucketResult(
      this.Bucket,
      Prefix,
      Marker,
      MaxKeys,
      Delimiter,
      IsTruncated,
      Contents,
    );
    return new HttpResponse(body);
  }

  public async validate() {
    this.peerManager.insureAtleastReadOnlyMode();
    await this.authenticator.mustHasAccess(this.constructor.name);
    if (!this.Bucket) {
      throw new ShouldNotHappendError("Bucket name is empty");
    }
    const bucket = await this.database.getBucket(this.Bucket);
    if (bucket === undefined || bucket.deleteMarker) {
      throw new NoSuchBucketError();
    }
  }
}
