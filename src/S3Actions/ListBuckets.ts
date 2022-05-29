import { inject, injectable } from 'tsyringe';
import Config from '../Authenticator';
import Database from '../Database';
import InternalError from '../Errors/InternalError';
import HttpResponse from '../HttpResponse';
import PeerManager from '../PeerManager';
import Bucket from '../S3Types/Bucket';
import ListAllMyBucketsResult from '../S3Types/ListAllMyBucketsResult';
import Action from './Action';

@injectable()
export default class ListBuckets extends Action {
  public readonly method: string = 'GET';

  public readonly parameters = {};

  public constructor(
    @inject(Database) private database: Database,
    @inject(Config) private authenticator: Config,
    @inject(PeerManager) private peerManager: PeerManager,
    
  ) {
    super();
  }


  public async run(): Promise<HttpResponse> {
    await this.validate();
    const bucketsList = await this.database.getBucketsList();
    const buckets = await Promise.all(bucketsList.map((name) => this.getBucketByName(name)));
    const activeBuckets = buckets
      .filter(({ info }) => !info.deleteMarker)
      .map(({ name, info }) => new Bucket(name, info.creationDate));
    const body = new ListAllMyBucketsResult(activeBuckets);
    return new HttpResponse(body);
  }
  
  public async validate() {
    this.peerManager.insureAtleastReadOnlyMode();
    await this.authenticator.mustHasAccess(this.constructor.name);
  }

  private async getBucketByName(name: string) {
    const info = await this.database.getBucket(name);
    if (info === undefined) {
      throw new InternalError(`bucket '${name}' is listed on database but cannot access to it's info`);
    }
    return {name, info};
  }
}
