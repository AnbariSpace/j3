import { inject, injectable } from 'tsyringe';
import Config from '../Authenticator';
import Database from '../Database';
import InvalidBucketNameError from '../Errors/InvalidBucketNameError';
import NoSuchBucketError from '../Errors/NoSuchBucketError';
import HttpResponse from '../HttpResponse';
import PeerManager from '../PeerManager';
import Action from './Action';

@injectable()
export default class HeadBucket extends Action {
  public readonly method: string = 'HEAD';

  public readonly parameters = {
    Bucket: {
      required: true,
      place: 'url',
    },
  };

  public Bucket: string;

  public constructor(
    @inject(Database) private database: Database,
    @inject(Config) private authenticator: Config,
    @inject(PeerManager) private peerManager: PeerManager,
  ) {
    super();

  }


  public async run(): Promise<HttpResponse> {
    await this.validate();

    return new HttpResponse(undefined);
  }

  public async validate() {
    this.peerManager.insureAtleastReadOnlyMode();
    await this.authenticator.mustHasAccess(this.constructor.name);

    if (!this.Bucket || this.Bucket.length < 3) {
      throw new InvalidBucketNameError("Bucket is empty");
    }
    if (!await this.database.hasBucket(this.Bucket)) {
      throw new NoSuchBucketError();
    }
  }
}
