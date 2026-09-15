import { createAuditIntentSourcePort, type AuditIntentSourcePort } from "../../../modules/audit/src/index.js";

export interface MaterializationReadyAuditIntentStoreReads {
  readonly sourceRegistry: () => readonly unknown[];
  readonly intake: () => readonly unknown[];
  readonly property: () => readonly unknown[];
  readonly listing: () => readonly unknown[];
  readonly contact: () => readonly unknown[];
  readonly matching: () => readonly unknown[];
  readonly jobs: () => readonly unknown[];
}

export type MaterializationReadyAuditIntentSources = readonly [
  AuditIntentSourcePort,
  AuditIntentSourcePort,
  AuditIntentSourcePort,
  AuditIntentSourcePort,
  AuditIntentSourcePort,
  AuditIntentSourcePort,
  AuditIntentSourcePort,
];

export function createMaterializationReadyAuditIntentSources(
  stores: Readonly<MaterializationReadyAuditIntentStoreReads>,
): MaterializationReadyAuditIntentSources {
  return Object.freeze([
    createAuditIntentSourcePort({ sourceDomain: "SOURCE_REGISTRY", read: stores.sourceRegistry }),
    createAuditIntentSourcePort({ sourceDomain: "INTAKE", read: stores.intake }),
    createAuditIntentSourcePort({ sourceDomain: "PROPERTY", read: stores.property }),
    createAuditIntentSourcePort({ sourceDomain: "LISTING", read: stores.listing }),
    createAuditIntentSourcePort({ sourceDomain: "CONTACT", read: stores.contact }),
    createAuditIntentSourcePort({ sourceDomain: "MATCHING", read: stores.matching }),
    createAuditIntentSourcePort({ sourceDomain: "API-017", read: stores.jobs }),
  ]);
}
