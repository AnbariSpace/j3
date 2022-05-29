import { inject, injectable } from 'tsyringe';
import Config from '../Authenticator';
import BackendManager from '../BackendManager';
import Database from '../Database';
import InternalError from '../Errors/InternalError';
import InvalidBucketNameError from '../Errors/InvalidBucketNameError';
import NoSuchBucketError from '../Errors/NoSuchBucketError';
import NoSuchKeyError from '../Errors/NoSuchKeyError';
import ShouldNotHappendError from '../Errors/ShouldNotHappendError';
import HttpResponse from '../HttpResponse';
import PeerManager from '../PeerManager';
import Action from './Action';

@injectable()
export default class GetObject extends Action {
  public readonly method: string = 'GET';

  public readonly parameters = {
    Bucket: {
      required: true,
      place: 'url',
    },
    Key: {
      required: true,
      place: 'url',
    }
  };

  public Bucket: string | undefined;
  public Key: string | undefined;

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
    if (this.Bucket === undefined || this.Key === undefined) {
      throw new ShouldNotHappendError("Bucket or Key is empty");
    }
    const object = await this.database.getObject(this.Bucket, this.Key);
    if (object === undefined || object.deleteMarker) {
      throw new NoSuchKeyError(this.Bucket, this.Key);
    }
    const {stream, length} = await this.backendManager.getObject(this.Bucket, this.Key, object);
    return new HttpResponse(stream, undefined, {
      "Content-Length": length,
    });
  }

  public async validate() {
    this.peerManager.insureAtleastReadOnlyMode();
    await this.authenticator.mustHasAccess(this.constructor.name);

    if (this.Bucket === undefined || this.Bucket.length < 3) {
      throw new InvalidBucketNameError("Bucket is empty");
    }
    if (this.Key === undefined || this.Key.length < 1) {
      throw new InternalError("Key is empty or undefined");
    }
  
    const info = await this.database.getBucket(this.Bucket);
    if (info === undefined || info.deleteMarker) {
      throw new NoSuchBucketError();
    }
  }
}
