import { Pool, type QueryResultRow } from "pg";
import { createHash } from "node:crypto";
import { PgConnectionPoolAdapter, type PgPoolFactory, type PostgreSqlPoolPort, type PostgreSqlClientPort, type PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
import { createProductionPostgreSqlPoolOptions, type RailwayProductionRuntimeConfiguration, type ResolvedProductionDatabaseSecrets } from "./production-runtime-configuration.js";
import { createRuntimeArtifactStartupOptions } from "./runtime-artifact-startup-bindings.js";

type DatabaseDiagnosticStage = "PHYSICAL_CONNECTION" | "READINESS_QUERY" | "INITIAL_IDENTITY_AUTHORITY_OPEN" | "INITIAL_IDENTITY_READINESS";
export interface RuntimeDatabaseDiagnostic {
  readonly event: "PRODUCTION_RUNTIME_DATABASE_DIAGNOSTIC";
  readonly stage: DatabaseDiagnosticStage;
  readonly status: "PASS" | "FAIL";
  readonly code: string;
  readonly sqlstate: string | null;
  readonly querySha256: string | null;
}
export function safeRuntimeDatabaseFailure(stage: DatabaseDiagnosticStage, error: unknown, query?: string): RuntimeDatabaseDiagnostic {
  let code: unknown;
  try { code = error !== null && typeof error === "object" ? Reflect.get(error, "code") : undefined; } catch { code = undefined; }
  const sqlstate = typeof code === "string" && /^(?:08|0A|22|23|25|28|3D|3F|40|42|53|54|55|57|58|F0|P0|XX)[0-9A-Z]{3}$/u.test(code) ? code : null;
  const transport = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT"]);
  return Object.freeze({ event: "PRODUCTION_RUNTIME_DATABASE_DIAGNOSTIC", stage, status: "FAIL", code: sqlstate !== null ? "POSTGRESQL_ERROR" : typeof code === "string" && transport.has(code) ? code : "READINESS_UNAVAILABLE", sqlstate, querySha256: query === undefined ? null : createHash("sha256").update(query).digest("hex") });
}
export function emitRuntimeDatabaseDiagnostic(diagnostic: RuntimeDatabaseDiagnostic): void {
  try { process.stderr.write(`${JSON.stringify(diagnostic)}\n`); } catch { /* diagnostics never change fail-closed behavior */ }
}

// Trusted test/composition injection only; never exposed through environment or CLI.
const physicalFactory: PgPoolFactory = configuration => {
  const pool = new Pool(configuration);
  return {
    connect: async (): Promise<PostgreSqlClientPort> => {
      const client = await pool.connect();
      return {
        query: async <Row extends Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<PostgreSqlQueryResult<Row>> => {
          const result = await client.query<QueryResultRow>(text, values === undefined ? undefined : [...values]);
          return Object.freeze({ rows: Object.freeze(result.rows.map(row => Object.freeze({ ...row }) as Row)), rowCount: result.rowCount ?? 0 });
        },
        release: (destroy = false) => client.release(destroy),
      };
    },
    end: async (): Promise<void> => { await pool.end(); },
  };
};

/** Both Production startup and readiness use this runtime-only constructor. */
export function createProductionRuntimePool(
  configuration: RailwayProductionRuntimeConfiguration,
  secrets: ResolvedProductionDatabaseSecrets,
  factory: PgPoolFactory = physicalFactory,
  diagnosticSink: (diagnostic: RuntimeDatabaseDiagnostic) => void = emitRuntimeDatabaseDiagnostic,
): PostgreSqlPoolPort {
  const target = configuration.identityDatabase;
  if (target.host !== "db.mfonujjeokvpsfucfxuq.supabase.co" || target.port !== 5432 || target.name !== "postgres" || target.user !== "ai_mls_production_runtime") throw new Error("Production runtime pool is unavailable.");
  for (const value of [configuration, secrets]) {
    if (["options", "startupOptions", "runtimeStartupBindings", "artifactBindings"].some(key => Object.hasOwn(value, key))) throw new Error("Production runtime pool is unavailable.");
  }
  if (Object.keys(secrets).length !== 2 || !Object.hasOwn(secrets, "connectionString") || !Object.hasOwn(secrets, "caCertificate")) throw new Error("Production runtime pool is unavailable.");
  const options = createProductionPostgreSqlPoolOptions(configuration, secrets);
  const startup = createRuntimeArtifactStartupOptions();
  let connected = false, queried = false, failed = false;
  const report = (diagnostic: RuntimeDatabaseDiagnostic): void => { try { diagnosticSink(diagnostic); } catch { /* preserve original outcome */ } };
  const reportFailure = (stage: DatabaseDiagnosticStage, error: unknown, query?: string): void => {
    if (!failed) { failed = true; report(safeRuntimeDatabaseFailure(stage, error, query)); }
  };
  return new PgConnectionPoolAdapter(options, pgConfiguration => {
    const physical = factory(Object.freeze({ ...pgConfiguration, options: startup }));
    return {
      connect: async (): Promise<PostgreSqlClientPort> => {
        let client: PostgreSqlClientPort;
        try { client = await physical.connect(); }
        catch (error) { reportFailure("PHYSICAL_CONNECTION", error); throw error; }
        if (!connected) { connected = true; report(Object.freeze({ event: "PRODUCTION_RUNTIME_DATABASE_DIAGNOSTIC", stage: "PHYSICAL_CONNECTION", status: "PASS", code: "CONNECTION_ESTABLISHED", sqlstate: null, querySha256: null })); }
        return {
          query: async <Row extends Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<PostgreSqlQueryResult<Row>> => {
            try {
              const result = await client.query<Row>(text, values);
              if (!queried) { queried = true; report(Object.freeze({ event: "PRODUCTION_RUNTIME_DATABASE_DIAGNOSTIC", stage: "READINESS_QUERY", status: "PASS", code: "FIRST_QUERY_COMPLETED", sqlstate: null, querySha256: createHash("sha256").update(text).digest("hex") })); }
              return result;
            } catch (error) { reportFailure("READINESS_QUERY", error, text); throw error; }
          },
          release: destroy => client.release(destroy),
        };
      },
      end: (): Promise<void> => physical.end(),
    };
  });
}
