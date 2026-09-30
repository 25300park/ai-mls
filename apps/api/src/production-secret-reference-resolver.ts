import { X509Certificate } from "node:crypto";

import {
  PgConnectionPoolAdapter,
  type PgPoolFactory,
  type PostgreSqlPoolPort,
} from "../../../modules/identity/src/postgresql-pool.js";
import {
  createProductionPostgreSqlPoolOptions,
  type RailwayProductionRuntimeConfiguration,
} from "./production-runtime-configuration.js";

const connectionReference = "railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1";
const certificateReference = "railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1";
const connectionVariable = "AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1";
const certificateVariable = "AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1";

export type ProductionDatabaseSecretConsumer = "PG_PRODUCTION_POOL" | "PG_IDENTITY_POOL";

export class ProductionSecretBindingError extends Error {
  public constructor() {
    super("Production secret binding is unavailable.");
    this.name = "ProductionSecretBindingError";
  }
}

export function createRailwaySealedProductionPostgreSqlPool(
  configuration: RailwayProductionRuntimeConfiguration,
  environment: Readonly<Record<string, string | undefined>>,
  consumer: unknown,
  factory?: PgPoolFactory,
): PostgreSqlPoolPort {
  try {
    if (!validRailwayRuntimeEnvironment(environment) || (consumer !== "PG_PRODUCTION_POOL" && consumer !== "PG_IDENTITY_POOL")
      || configuration.identityDatabase.connectionReference !== connectionReference
      || configuration.identityDatabase.caCertificateReference !== certificateReference
      || environment["DATABASE_URL"] !== undefined) throw unavailable();
    const connectionString = environment[connectionVariable];
    const caCertificate = environment[certificateVariable];
    if (!safeConnectionString(connectionString) || !safeCertificate(caCertificate)) throw unavailable();
    const options = createProductionPostgreSqlPoolOptions(configuration, { connectionString, caCertificate });
    return factory === undefined
      ? new PgConnectionPoolAdapter(options)
      : new PgConnectionPoolAdapter(options, factory);
  } catch {
    throw unavailable();
  }
}

function validRailwayRuntimeEnvironment(environment: Readonly<Record<string, string | undefined>>): boolean {
  return environment["RAILWAY_SERVICE_NAME"] === "ai-mls-api"
    && environment["RAILWAY_ENVIRONMENT_NAME"]?.toLowerCase() === "production"
    && safeRailwayIdentifier(environment["RAILWAY_PROJECT_ID"])
    && safeRailwayIdentifier(environment["RAILWAY_ENVIRONMENT_ID"])
    && safeRailwayIdentifier(environment["RAILWAY_SERVICE_ID"])
    && safeRailwayIdentifier(environment["RAILWAY_DEPLOYMENT_ID"]);
}

function safeRailwayIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9-]{0,127}$/u.test(value);
}

function safeConnectionString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 4096
    && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value);
}

function safeCertificate(value: unknown): value is string {
  if (!(typeof value === "string" && value.length > 0 && value.length <= 65_536
    && value.trim() === value
    && /^-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END CERTIFICATE-----$/u.test(value)
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value))) return false;
  try { new X509Certificate(value); return true; } catch { return false; }
}

function unavailable(): ProductionSecretBindingError {
  return new ProductionSecretBindingError();
}
