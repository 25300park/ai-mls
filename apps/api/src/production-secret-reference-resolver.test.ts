import assert from "node:assert/strict";
import test from "node:test";
import { rootCertificates } from "node:tls";

import type { PgPoolLike } from "../../../modules/identity/src/postgresql-pool.js";
import { parseRailwayProductionRuntimeConfiguration } from "./production-runtime-configuration.js";
import {
  createRailwaySealedProductionPostgreSqlPool,
  ProductionSecretBindingError,
} from "./production-secret-reference-resolver.js";

const connectionKey = "AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1";
const certificateKey = "AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1";
const connectionString = "postgresql://ai_mls_production_runtime:runtime-secret@db.mfonujjeokvpsfucfxuq.supabase.co:5432/postgres";
const caCertificate = rootCertificates[0] ?? "";

function configuration() {
  return parseRailwayProductionRuntimeConfiguration({
    RUNTIME_ENVIRONMENT: "PRODUCTION",
    CONFIGURATION_REFERENCE: "config:production:v1",
    REQUIRED_SERVICE_REGISTRATIONS: "registration-api-014",
    PROVIDER_EXECUTION_AUTHORIZED: "false",
    IDENTITY_PERSISTENCE_ENGINE: "POSTGRESQL",
    IDENTITY_DATABASE_CONNECTION_MODE: "DIRECT",
    IDENTITY_DATABASE_HOST: "db.mfonujjeokvpsfucfxuq.supabase.co",
    IDENTITY_DATABASE_PORT: "5432",
    IDENTITY_DATABASE_NAME: "postgres",
    IDENTITY_DATABASE_USER: "ai_mls_production_runtime",
    IDENTITY_DATABASE_CONNECTION_REF: `railway-sealed-env:${connectionKey}`,
    IDENTITY_DATABASE_CA_CERT_REF: `railway-sealed-env:${certificateKey}`,
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

function environment(overrides: Readonly<Record<string, string | undefined>> = {}): Readonly<Record<string, string | undefined>> {
  return Object.freeze({
    RAILWAY_PROJECT_ID: "project-id",
    RAILWAY_ENVIRONMENT_ID: "environment-id",
    RAILWAY_ENVIRONMENT_NAME: "production",
    RAILWAY_SERVICE_ID: "service-id",
    RAILWAY_SERVICE_NAME: "ai-mls-api",
    RAILWAY_DEPLOYMENT_ID: "deployment-id",
    [connectionKey]: connectionString,
    [certificateKey]: caCertificate,
    ...overrides,
  });
}

test("resolves the exact two sealed variables only for PG_IDENTITY_POOL", async () => {
  let received: Readonly<Record<string, unknown>> | undefined;
  const fakePool: PgPoolLike = { connect: () => Promise.reject(new Error("unused")), end: () => Promise.resolve() };
  const pool = createRailwaySealedProductionPostgreSqlPool(configuration(), environment(), "PG_IDENTITY_POOL", (options) => {
    received = options;
    return fakePool;
  });

  assert.equal(received?.["connectionString"], connectionString);
  assert.deepEqual(received?.["ssl"], { rejectUnauthorized: true, ca: caCertificate });
  await pool.close();
});

test("missing, empty, malformed, or successor-only sealed values fail closed without fallback", () => {
  const invalidEnvironments = [
    environment({ [connectionKey]: undefined }),
    environment({ [connectionKey]: "" }),
    environment({ [connectionKey]: "postgresql://ai_mls_production_runtime@db.mfonujjeokvpsfucfxuq.supabase.co:5432/postgres" }),
    environment({ [certificateKey]: "not-a-pem" }),
    environment({ [certificateKey]: "-----BEGIN CERTIFICATE-----\nVEVTVC1DQQ==\n-----END CERTIFICATE-----" }),
    environment({ [certificateKey]: "-----BEGIN CERTIFICATE-----\n-----END PRIVATE KEY-----" }),
    Object.freeze({
      AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V2: connectionString,
      AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V2: caCertificate,
    }),
  ];
  for (const source of invalidEnvironments) {
    assert.throws(
      () => createRailwaySealedProductionPostgreSqlPool(configuration(), source, "PG_IDENTITY_POOL", () => {
        throw new Error("pool factory must not run");
      }),
      (error: unknown) => error instanceof ProductionSecretBindingError
        && error.message === "Production secret binding is unavailable."
        && !error.message.includes("runtime-secret")
        && !error.message.includes(connectionKey),
    );
  }
});

test("an unauthorized consumer cannot resolve Production database secrets", () => {
  assert.throws(
    () => createRailwaySealedProductionPostgreSqlPool(configuration(), environment(), "API-015", () => {
      throw new Error("pool factory must not run");
    }),
    ProductionSecretBindingError,
  );
});

test("raw DATABASE_URL never becomes a fallback secret authority", () => {
  assert.throws(
    () => createRailwaySealedProductionPostgreSqlPool(configuration(), {
      DATABASE_URL: connectionString,
      [certificateKey]: caCertificate,
    }, "PG_IDENTITY_POOL", () => { throw new Error("pool factory must not run"); }),
    ProductionSecretBindingError,
  );
});

test("non-Railway, wrong-service, PR, and non-Production runtime environments cannot consume sealed values", () => {
  const invalidEnvironments = [
    environment({ RAILWAY_PROJECT_ID: undefined }),
    environment({ RAILWAY_ENVIRONMENT_NAME: "staging" }),
    environment({ RAILWAY_ENVIRONMENT_NAME: "pr-42" }),
    environment({ RAILWAY_SERVICE_NAME: "shared-runtime" }),
    environment({ RAILWAY_DEPLOYMENT_ID: "unsafe value" }),
  ];
  for (const source of invalidEnvironments) {
    assert.throws(
      () => createRailwaySealedProductionPostgreSqlPool(configuration(), source, "PG_IDENTITY_POOL", () => {
        throw new Error("pool factory must not run");
      }),
      ProductionSecretBindingError,
    );
  }
});
