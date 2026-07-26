import type { PublicationIdentity, PublicationSnapshot } from "./publication-contracts.js";

export interface PublicationRepository {
  save(snapshot: PublicationSnapshot): void;
  update(expectedAggregateVersion: number, snapshot: PublicationSnapshot): void;
  find(identity: PublicationIdentity): PublicationSnapshot | undefined;
  exists(identity: PublicationIdentity): boolean;
  checkVersion(identity: PublicationIdentity, expectedAggregateVersion: number): boolean;
  readHistory(identity: PublicationIdentity): readonly PublicationSnapshot[];
}
