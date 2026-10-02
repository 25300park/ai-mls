import type { ProductionPinnedServiceIdentityReference } from "./production-service-identity-resolver.js";
import { X509Certificate } from "node:crypto";

import type { PgConnectionPoolOptions } from "../../../modules/identity/src/index.js";
import type { ProductionRuntimeConfiguration } from "./production-bootstrap.js";

const exactDatabaseHost = "db.mfonujjeokvpsfucfxuq.supabase.co";
const exactDatabaseUser = "ai_mls_production_runtime";
const exactConnectionReference = "railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1";
const exactCaCertificateReference = "railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1";

export interface RailwayProductionRuntimeConfiguration extends ProductionRuntimeConfiguration {
  readonly requiredServiceWorkloadPins: readonly ProductionPinnedServiceIdentityReference[];
  readonly startupWorkloadPurpose: string; readonly startupWorkloadAudience: string;
  readonly port: number;
  readonly identityDatabase: Readonly<{
    connectionMode: "DIRECT";
    host: typeof exactDatabaseHost;
    port: 5432;
    name: "postgres";
    user: typeof exactDatabaseUser;
    connectionReference: string;
    caCertificateReference: string;
    sslMode: "VERIFY_FULL";
    connectionTimeoutMilliseconds: 10_000;
    poolIdleTimeoutMilliseconds: 30_000;
    statementTimeoutMilliseconds: 30_000;
    idleTransactionTimeoutMilliseconds: 30_000;
    shutdownTimeoutMilliseconds: 30_000;
    maxConnections: 5;
    applicationName: "ai-mls-api-production";
  }>;
}

export interface ResolvedProductionDatabaseSecrets {
  readonly connectionString: string;
  readonly caCertificate: string;
}

export class ProductionRuntimeConfigurationError extends Error {
  public constructor() {
    super("Production runtime configuration is unavailable.");
    this.name = "ProductionRuntimeConfigurationError";
  }
}

export function parseRailwayProductionRuntimeConfiguration(raw: unknown): RailwayProductionRuntimeConfiguration {
  const source = asStringRecord(raw);
  if (source["DATABASE_URL"] !== undefined) throw unavailable();
  const runtimeEnvironment = exact(source, "RUNTIME_ENVIRONMENT", "PRODUCTION");
  const configurationReference = reference(source, "CONFIGURATION_REFERENCE");
  const requiredServiceRegistrations = registrations(required(source, "REQUIRED_SERVICE_REGISTRATIONS"));
  const requiredServiceWorkloadPins = workloadPins(required(source,"REQUIRED_SERVICE_WORKLOAD_PINS"),requiredServiceRegistrations);
  const startupWorkloadPurpose = required(source,"STARTUP_WORKLOAD_PURPOSE");
  const startupWorkloadAudience = required(source,"STARTUP_WORKLOAD_AUDIENCE");
  exact(source, "PROVIDER_EXECUTION_AUTHORIZED", "false");
  const providerExecutionAuthorized = false as const;
  const identityPersistenceEngine = exact(source, "IDENTITY_PERSISTENCE_ENGINE", "POSTGRESQL");
  const identityDatabase = Object.freeze({
    connectionMode: exact(source, "IDENTITY_DATABASE_CONNECTION_MODE", "DIRECT"),
    host: exact(source, "IDENTITY_DATABASE_HOST", exactDatabaseHost),
    port: exactInteger(source, "IDENTITY_DATABASE_PORT", 5432),
    name: exact(source, "IDENTITY_DATABASE_NAME", "postgres"),
    user: exact(source, "IDENTITY_DATABASE_USER", exactDatabaseUser),
    connectionReference: exact(source, "IDENTITY_DATABASE_CONNECTION_REF", exactConnectionReference),
    caCertificateReference: exact(source, "IDENTITY_DATABASE_CA_CERT_REF", exactCaCertificateReference),
    sslMode: exact(source, "IDENTITY_DATABASE_SSL_MODE", "VERIFY_FULL"),
    connectionTimeoutMilliseconds: exactInteger(source, "IDENTITY_DATABASE_CONNECTION_TIMEOUT_MS", 10_000),
    poolIdleTimeoutMilliseconds: exactInteger(source, "IDENTITY_DATABASE_POOL_IDLE_TIMEOUT_MS", 30_000),
    statementTimeoutMilliseconds: exactInteger(source, "IDENTITY_DATABASE_STATEMENT_TIMEOUT_MS", 30_000),
    idleTransactionTimeoutMilliseconds: exactInteger(source, "IDENTITY_DATABASE_IDLE_TRANSACTION_TIMEOUT_MS", 30_000),
    shutdownTimeoutMilliseconds: exactInteger(source, "IDENTITY_DATABASE_SHUTDOWN_TIMEOUT_MS", 30_000),
    maxConnections: exactInteger(source, "IDENTITY_DATABASE_MAX_CONNECTIONS", 5),
    applicationName: exact(source, "IDENTITY_DATABASE_APPLICATION_NAME", "ai-mls-api-production"),
  });
  const port = boundedInteger(source, "PORT", 1, 65_535);
  if (providerExecutionAuthorized !== false) throw unavailable();
  return Object.freeze({
    runtimeEnvironment,
    configurationReference,
    requiredServiceRegistrations, requiredServiceWorkloadPins, startupWorkloadPurpose, startupWorkloadAudience,
    providerExecutionAuthorized,
    identityPersistenceEngine,
    identityDatabase,
    port,
  });
}

export function createProductionPostgreSqlPoolOptions(
  configuration: RailwayProductionRuntimeConfiguration,
  secrets: ResolvedProductionDatabaseSecrets,
): PgConnectionPoolOptions {
  if (!safeValue(secrets.connectionString, 4096) || !safeCertificate(secrets.caCertificate)) throw unavailable();
  const database = configuration.identityDatabase;
  try {
    const connection = new URL(secrets.connectionString);
    if (connection.protocol !== "postgresql:" || connection.hostname !== database.host
      || connection.port !== String(database.port) || connection.pathname !== `/${database.name}`
      || connection.search !== "" || connection.hash !== ""
      || decodeURIComponent(connection.username) !== database.user
      || !safeValue(decodeURIComponent(connection.password), 1024)) throw unavailable();
  } catch {
    throw unavailable();
  }
  return Object.freeze({
    connectionString: secrets.connectionString,
    connectionTimeoutMilliseconds: database.connectionTimeoutMilliseconds,
    idleTimeoutMilliseconds: database.poolIdleTimeoutMilliseconds,
    statementTimeoutMilliseconds: database.statementTimeoutMilliseconds,
    idleTransactionTimeoutMilliseconds: database.idleTransactionTimeoutMilliseconds,
    shutdownTimeoutMilliseconds: database.shutdownTimeoutMilliseconds,
    maxConnections: database.maxConnections,
    applicationName: database.applicationName,
    ssl: Object.freeze({ rejectUnauthorized: true as const, ca: secrets.caCertificate }),
  });
}

function asStringRecord(raw: unknown): Readonly<Record<string, string | undefined>> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw unavailable();
  return raw as Readonly<Record<string, string | undefined>>;
}

function required(source: Readonly<Record<string, string | undefined>>, key: string): string {
  const value = source[key];
  if (!safeValue(value, 2048)) throw unavailable();
  return value;
}

function exact<const Value extends string>(source: Readonly<Record<string, string | undefined>>, key: string, value: Value): Value {
  if (source[key] !== value) throw unavailable();
  return value;
}

function exactInteger<const Value extends number>(source: Readonly<Record<string, string | undefined>>, key: string, value: Value): Value {
  if (source[key] !== String(value)) throw unavailable();
  return value;
}

function boundedInteger(source: Readonly<Record<string, string | undefined>>, key: string, minimum: number, maximum: number): number {
  const raw = required(source, key);
  if (!/^\d+$/u.test(raw)) throw unavailable();
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw unavailable();
  return value;
}

function reference(source: Readonly<Record<string, string | undefined>>, key: string): string {
  const value = required(source, key);
  if (!/^[a-z][a-z0-9-]{1,31}:[a-zA-Z0-9][a-zA-Z0-9:._-]{0,478}$/u.test(value)) throw unavailable();
  return value;
}

function registrations(value: string): readonly string[] {
  const values = value.split(",");
  if (values.length < 1 || values.length > 64 || values.some((item) => !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u.test(item))) throw unavailable();
  if (new Set(values).size !== values.length) throw unavailable();
  return Object.freeze(values);
}

function safeValue(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && value.trim() === value
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function safeCertificate(value: unknown): value is string {
  if (!(typeof value === "string" && value.length > 0 && value.length <= 65_536 && value.trim() === value
    && /^-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END CERTIFICATE-----$/u.test(value)
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value))) return false;
  try { new X509Certificate(value); return true; } catch { return false; }
}

function unavailable(): ProductionRuntimeConfigurationError {
  return new ProductionRuntimeConfigurationError();
}
function workloadPins(text:string,registrations:readonly string[]):readonly ProductionPinnedServiceIdentityReference[] {
 try {
  const value:unknown=JSON.parse(text);
  if(!Array.isArray(value)||value.length!==registrations.length)throw unavailable();
  const pins:ProductionPinnedServiceIdentityReference[]=[];
  for(const item of value as unknown[]){
   if(typeof item!=="object"||item===null||Object.keys(item).length!==2)throw unavailable();
   const row=item as Record<string,unknown>;
   if(!safeValue(row["registrationId"],128)||typeof row["registrationVersion"]!=="number"||!Number.isSafeInteger(row["registrationVersion"])||row["registrationVersion"]<1)throw unavailable();
   pins.push(Object.freeze({registrationId:row["registrationId"],registrationVersion:row["registrationVersion"]}));
  }
  if(new Set(pins.map(p=>p.registrationId)).size!==pins.length||pins.some(p=>!registrations.includes(p.registrationId)))throw unavailable();
  return Object.freeze(pins);
 }catch{throw unavailable();}
}