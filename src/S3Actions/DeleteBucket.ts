import { inject, injectable } from 'tsyringe';
import Config from '../Authenticator';
import Database from '../Database';
import BucketNotEmptyError from '../Errors/BucketNotEmptyError';
import ShouldNotHappendError from '../Errors/ShouldNotHappendError';
import HttpResponse from '../HttpResponse';
import PeerManager from '../PeerManager';
import Action from './Action';

@injectable()
export default class DeleteBucket extends Action {
  public readonly method: string = 'DELETE';

  public readonly parameters = {
    Bucket: {
      required: true,
      place: 'url',
    },
    'x-amz-expected-bucket-owner': {
      required: false,
      place: 'header',
    },
  };

  public Bucket: string  | undefined;

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
    const update = await this.database.markBucketAsDeleted(this.Bucket);
    await this.peerManager.broadcastUpdate(update);

    return new HttpResponse(undefined);
  }

  public async validate() {
    this.peerManager.insureFullOperationalMode();
    await this.authenticator.mustHasAccess(this.constructor.name);

    if (!this.Bucket) {
      throw new ShouldNotHappendError("Bucket name is empty");
    }
    const info = await this.database.getBucket(this.Bucket);
    if (info === undefined) {
      throw new ShouldNotHappendError(`bucket '${this.Bucket}' is listed on database but cannot access to it's info`);
    }
    const objects = await this.database.getObjects(this.Bucket, undefined, 1);
    if (Object.keys(objects).length > 0) {
      throw new BucketNotEmptyError();
    }
  }
}
