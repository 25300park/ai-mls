import { DurableAdvisoryStore } from "./advisory-durable-persistence.js";
import { AdvisoryRuntime } from "./advisory-runtime.js";
import type { AdvisoryAdapter, AdvisorySnapshotResolver } from "./advisory-runtime-contracts.js";
import { assertProductionRootBootstrapContext, type ProductionBootstrapContextView } from "../../../packages/security-contracts/src/production-bootstrap-proof.js";

export interface ProductionAdvisoryRuntimeOptions {
  readonly databasePath: string;
  readonly runtimeEnvironment: "TEST" | "STAGING" | "PRODUCTION";
  readonly bootstrapContext?: ProductionBootstrapContextView;
  readonly schemaMode?: "INITIALIZE" | "REQUIRE_EXISTING";
  readonly snapshotResolver: AdvisorySnapshotResolver;
}

export function createProductionAdvisoryRuntime(options: ProductionAdvisoryRuntimeOptions): Readonly<{ runtime: AdvisoryRuntime; close: () => void }> {
  if (!isRuntimeEnvironment(options.runtimeEnvironment)) throw new Error("Production Advisory configuration is invalid.");
  if (options.runtimeEnvironment === "PRODUCTION") assertProductionRootBootstrapContext(options.bootstrapContext);
  else if (options.bootstrapContext !== undefined) throw new Error("Production Advisory configuration is invalid.");
  if (!exactOptions(options) || typeof options.databasePath !== "string" || options.databasePath.trim().length === 0 || options.databasePath === ":memory:" || options.snapshotResolver === null || typeof options.snapshotResolver?.resolve !== "function") {
    throw new Error("Production Advisory configuration is invalid.");
  }
  const persistence = new DurableAdvisoryStore({ databasePath: options.databasePath, ...(options.schemaMode === undefined ? {} : { schemaMode: options.schemaMode }) });
  const runtime = new AdvisoryRuntime({ persistence, snapshotResolver: options.snapshotResolver, adapter: unavailableAdapter, clock: (): Date => new Date() });
  return Object.freeze({ runtime, close: () => persistence.close() });
}

function isRuntimeEnvironment(value: unknown): value is "TEST" | "STAGING" | "PRODUCTION" {
  return value === "TEST" || value === "STAGING" || value === "PRODUCTION";
}

const unavailableAdapter: AdvisoryAdapter = Object.freeze({
  adapterVersion: "production-unavailable-v1",
  generate(): unknown { throw new Error("ADVISORY_UNAVAILABLE"); },
});

function exactOptions(value: object): value is ProductionAdvisoryRuntimeOptions {
  const keys = Object.keys(value).filter((key) => key !== "bootstrapContext" && key !== "runtimeEnvironment").sort();
  return (keys.length === 2 && keys[0] === "databasePath" && keys[1] === "snapshotResolver")
    || (keys.length === 3 && keys[0] === "databasePath" && keys[1] === "schemaMode" && keys[2] === "snapshotResolver");
}
