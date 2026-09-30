import type { PublicationIdentity, PublicationSnapshot } from "./publication-contracts.js";

export interface PublicationRepository {
  save(snapshot: PublicationSnapshot): Promise<void>;
  update(expectedAggregateVersion: number, snapshot: PublicationSnapshot): Promise<void>;
  find(identity: PublicationIdentity): Promise<PublicationSnapshot | undefined>;
  exists(identity: PublicationIdentity): Promise<boolean>;
  checkVersion(identity: PublicationIdentity, expectedAggregateVersion: number): Promise<boolean>;
  readHistory(identity: PublicationIdentity): Promise<readonly PublicationSnapshot[]>;
}
