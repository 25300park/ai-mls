import { isAbsolute } from "node:path";

import { AuditIntentMaterializer, DurableAuditEventStore, type AuditIntentSourcePort, type DurableMaterializedAuditEvent, type MaterializationReadySourceDomain } from "../../../modules/audit/src/index.js";

const requiredSources = Object.freeze<readonly MaterializationReadySourceDomain[]>(["SOURCE_REGISTRY", "INTAKE", "PROPERTY", "LISTING", "CONTACT", "MATCHING"]);

export interface StagingApi016AuditRuntime {
  status(): Readonly<{ health: "HEALTHY"; readiness: "READY"; sourceCount: 6 }>;
  materializeAvailable(): readonly DurableMaterializedAuditEvent[];
  close(): void;
}

export function createStagingApi016AuditRuntime(input: Readonly<{ environment: "Staging"; databasePath: string; sources: readonly AuditIntentSourcePort[]; clock?: () => Date }>): StagingApi016AuditRuntime {
  if (input.environment !== "Staging" || !validPath(input.databasePath) || !validSources(input.sources)) throw new Error("AUDIT_RUNTIME_UNAVAILABLE");
  let store: DurableAuditEventStore;
  try { store = new DurableAuditEventStore({ databasePath: input.databasePath }); }
  catch { throw new Error("AUDIT_RUNTIME_UNAVAILABLE"); }
  const materializer = new AuditIntentMaterializer({ store, clock: input.clock ?? ((): Date => new Date()) });
  let closed = false;
  return Object.freeze({
    status: () => {
      if (closed) throw new Error("AUDIT_RUNTIME_UNAVAILABLE");
      return Object.freeze({ health: "HEALTHY", readiness: "READY", sourceCount: 6 as const });
    },
    materializeAvailable: () => {
      if (closed) throw new Error("AUDIT_RUNTIME_UNAVAILABLE");
      return Object.freeze(input.sources.flatMap((source) => materializer.consume(source)));
    },
    close: () => { if (!closed) { closed = true; store.close(); } },
  });
}

function validPath(value: string): boolean { return typeof value === "string" && value.trim() === value && value.length > 0 && isAbsolute(value); }
function validSources(sources: readonly AuditIntentSourcePort[]): boolean {
  if (sources.length !== requiredSources.length) return false;
  const domains = new Set(sources.map((source) => source.sourceDomain));
  return requiredSources.every((domain) => domains.has(domain)) && sources.every((source) => typeof source.readByIntentId === "function" && typeof source.listEligible === "function");
}
