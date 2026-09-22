import assert from "node:assert/strict";
import test from "node:test";

import {
  createProductionPostgreSqlPoolOptions,
  parseRailwayProductionRuntimeConfiguration,
} from "./production-runtime-configuration.js";

function environment(): Readonly<Record<string, string>> {
  return Object.freeze({
    RUNTIME_ENVIRONMENT: "PRODUCTION",
    CONFIGURATION_REFERENCE: "config:production:v1",
    REQUIRED_SERVICE_REGISTRATIONS: "registration-api-014,registration-api-015",
    PROVIDER_EXECUTION_AUTHORIZED: "false",
    IDENTITY_PERSISTENCE_ENGINE: "POSTGRESQL",
    IDENTITY_DATABASE_CONNECTION_MODE: "DIRECT",
    IDENTITY_DATABASE_HOST: "db.mfonujjeokvpsfucfxuq.supabase.co",
    IDENTITY_DATABASE_PORT: "5432",
    IDENTITY_DATABASE_NAME: "postgres",
    IDENTITY_DATABASE_USER: "ai_mls_production_runtime",
    IDENTITY_DATABASE_CONNECTION_REF: "secret-ref:production:identity-db",
    IDENTITY_DATABASE_CA_CERT_REF: "secret-ref:production:supabase-ca",
    IDENTITY_DATABASE_SSL_MODE: "VERIFY_FULL",
    IDENTITY_DATABASE_CONNECTION_TIMEOUT_MS: "10000",
    IDENTITY_DATABASE_POOL_IDLE_TIMEOUT_MS: "30000",
    IDENTITY_DATABASE_STATEMENT_TIMEOUT_MS: "30000",
    IDENTITY_DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: "30000",
    IDENTITY_DATABASE_SHUTDOWN_TIMEOUT_MS: "30000",
    IDENTITY_DATABASE_MAX_CONNECTIONS: "5",
    IDENTITY_DATABASE_APPLICATION_NAME: "ai-mls-api-production",
    PORT: "8080",
  });
}

test("parses only the approved Railway Production configuration contract", () => {
  const parsed = parseRailwayProductionRuntimeConfiguration(environment());
  assert.equal(parsed.runtimeEnvironment, "PRODUCTION");
  assert.equal(parsed.identityPersistenceEngine, "POSTGRESQL");
  assert.equal(parsed.identityDatabase.connectionMode, "DIRECT");
  assert.equal(parsed.identityDatabase.sslMode, "VERIFY_FULL");
  assert.equal(parsed.identityDatabase.maxConnections, 5);
  assert.equal(parsed.identityDatabase.poolIdleTimeoutMilliseconds, 30_000);
  assert.equal(parsed.port, 8080);
  assert.deepEqual(parsed.requiredServiceRegistrations, ["registration-api-014", "registration-api-015"]);
});

test("missing, lower-environment, SQLite, unsafe, or hidden-default configuration fails closed", () => {
  for (const replacement of [
    { ...environment(), RUNTIME_ENVIRONMENT: "STAGING" },
    { ...environment(), IDENTITY_PERSISTENCE_ENGINE: "SQLITE" },
    { ...environment(), PROVIDER_EXECUTION_AUTHORIZED: "true" },
    { ...environment(), IDENTITY_DATABASE_MAX_CONNECTIONS: "6" },
    { ...environment(), IDENTITY_DATABASE_SSL_MODE: "DISABLE" },
    { ...environment(), IDENTITY_DATABASE_CONNECTION_REF: "postgresql://runtime:secret@host/db" },
    { ...environment(), PORT: "0" },
    Object.fromEntries(Object.entries(environment()).filter(([key]) => key !== "IDENTITY_DATABASE_CA_CERT_REF")),
  ]) {
    assert.throws(() => parseRailwayProductionRuntimeConfiguration(replacement), /Production runtime configuration is unavailable/u);
  }
});

test("maps exact approved timeout, pool, and VERIFY_FULL TLS values without logging references", () => {
  const configuration = parseRailwayProductionRuntimeConfiguration(environment());
  const options = createProductionPostgreSqlPoolOptions(configuration, {
    connectionString: "postgresql://ai_mls_production_runtime:secret@db.mfonujjeokvpsfucfxuq.supabase.co:5432/postgres",
    caCertificate: "test-ca",
  });
  assert.deepEqual(options, {
    connectionString: "postgresql://ai_mls_production_runtime:secret@db.mfonujjeokvpsfucfxuq.supabase.co:5432/postgres",
    connectionTimeoutMilliseconds: 10_000,
    idleTimeoutMilliseconds: 30_000,
    statementTimeoutMilliseconds: 30_000,
    idleTransactionTimeoutMilliseconds: 30_000,
    shutdownTimeoutMilliseconds: 30_000,
    maxConnections: 5,
    applicationName: "ai-mls-api-production",
    ssl: { rejectUnauthorized: true, ca: "test-ca" },
  });
  assert.throws(() => createProductionPostgreSqlPoolOptions(configuration, {
    connectionString: "postgresql://ai_mls_production_runtime:secret@wrong.example:5432/postgres",
    caCertificate: "test-ca",
  }), /configuration is unavailable/u);
  for (const connectionString of [
    "postgresql://ai_mls_production_runtime:secret@db.mfonujjeokvpsfucfxuq.supabase.co:5432/postgres?sslmode=disable",
    "postgresql://ai_mls_production_runtime:secret@db.mfonujjeokvpsfucfxuq.supabase.co:5432/postgres?sslrootcert=attacker",
    "postgresql://ai_mls_production_%ZZ:secret@db.mfonujjeokvpsfucfxuq.supabase.co:5432/postgres",
  ]) {
    assert.throws(() => createProductionPostgreSqlPoolOptions(configuration, {
      connectionString, caCertificate: "test-ca",
    }), (error: unknown) => error instanceof Error
      && error.name === "ProductionRuntimeConfigurationError"
      && error.message === "Production runtime configuration is unavailable.");
  }
});
