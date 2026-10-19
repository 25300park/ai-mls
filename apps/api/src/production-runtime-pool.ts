import { Pool, type QueryResultRow } from "pg";
import { PgConnectionPoolAdapter, type PgPoolFactory, type PostgreSqlPoolPort, type PostgreSqlClientPort, type PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
import { createProductionPostgreSqlPoolOptions, type RailwayProductionRuntimeConfiguration, type ResolvedProductionDatabaseSecrets } from "./production-runtime-configuration.js";
import { createRuntimeArtifactStartupOptions } from "./runtime-artifact-startup-bindings.js";

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
): PostgreSqlPoolPort {
  const target = configuration.identityDatabase;
  if (target.host !== "db.mfonujjeokvpsfucfxuq.supabase.co" || target.port !== 5432 || target.name !== "postgres" || target.user !== "ai_mls_production_runtime") throw new Error("Production runtime pool is unavailable.");
  for (const value of [configuration, secrets]) {
    if (["options", "startupOptions", "runtimeStartupBindings", "artifactBindings"].some(key => Object.hasOwn(value, key))) throw new Error("Production runtime pool is unavailable.");
  }
  if (Object.keys(secrets).length !== 2 || !Object.hasOwn(secrets, "connectionString") || !Object.hasOwn(secrets, "caCertificate")) throw new Error("Production runtime pool is unavailable.");
  const options = createProductionPostgreSqlPoolOptions(configuration, secrets);
  const startup = createRuntimeArtifactStartupOptions();
  return new PgConnectionPoolAdapter(options, pgConfiguration => factory(Object.freeze({ ...pgConfiguration, options: startup })));
}
