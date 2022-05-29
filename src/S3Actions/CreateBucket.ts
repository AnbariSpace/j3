import { inject, injectable } from 'tsyringe';
import Config from '../Authenticator';
import Database from '../Database';
import BucketAlreadyExistsError from '../Errors/BucketAlreadyExistsError';
import InvalidBucketNameError from '../Errors/InvalidBucketNameError';
import ShouldNotHappendError from '../Errors/ShouldNotHappendError';
import HttpResponse from '../HttpResponse';
import PeerManager from '../PeerManager';
import Action from './Action';

@injectable()
export default class CreateBucket extends Action {
  public readonly method: string = 'PUT';

  public readonly parameters = {
    Bucket: {
      required: true,
      place: 'url',
    },
  };

  public Bucket: string|undefined;

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
      throw new ShouldNotHappendError("bucket name is empty");
    }
    const bucketInfo = await this.database.getBucket(this.Bucket);
    if (bucketInfo !== undefined && !bucketInfo.deleteMarker) {
      throw new BucketAlreadyExistsError();
    }
    const update = await this.database.createBucket(this.Bucket);
    await this.peerManager.broadcastUpdate(update);

    return new HttpResponse(undefined);
  }

  public async validate() {
    this.peerManager.insureFullOperationalMode();
    await this.authenticator.mustHasAccess(this.constructor.name);
    if (!this.Bucket || this.Bucket.length < 3) {
      throw new InvalidBucketNameError("Bucket is empty");
    }
  }
}
