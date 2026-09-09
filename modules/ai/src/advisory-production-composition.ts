import { DurableAdvisoryStore } from "./advisory-durable-persistence.js";
import { AdvisoryRuntime } from "./advisory-runtime.js";
import type { AdvisoryAdapter, AdvisorySnapshotResolver } from "./advisory-runtime-contracts.js";

export interface ProductionAdvisoryRuntimeOptions {
  readonly databasePath: string;
  readonly snapshotResolver: AdvisorySnapshotResolver;
}

export function createProductionAdvisoryRuntime(options: ProductionAdvisoryRuntimeOptions): Readonly<{ runtime: AdvisoryRuntime; close: () => void }> {
  if (!exactOptions(options) || typeof options.databasePath !== "string" || options.databasePath.trim().length === 0 || options.databasePath === ":memory:" || options.snapshotResolver === null || typeof options.snapshotResolver?.resolve !== "function") {
    throw new Error("Production Advisory configuration is invalid.");
  }
  const persistence = new DurableAdvisoryStore({ databasePath: options.databasePath });
  const runtime = new AdvisoryRuntime({ persistence, snapshotResolver: options.snapshotResolver, adapter: unavailableAdapter, clock: (): Date => new Date() });
  return Object.freeze({ runtime, close: () => persistence.close() });
}

const unavailableAdapter: AdvisoryAdapter = Object.freeze({
  adapterVersion: "production-unavailable-v1",
  generate(): unknown { throw new Error("ADVISORY_UNAVAILABLE"); },
});

function exactOptions(value: object): value is ProductionAdvisoryRuntimeOptions {
  const keys = Object.keys(value).sort();
  return keys.length === 2 && keys[0] === "databasePath" && keys[1] === "snapshotResolver";
}
