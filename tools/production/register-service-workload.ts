import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { PgConnectionPoolAdapter, type PostgreSqlPoolPort } from "../../modules/identity/src/postgresql-pool.js";
import { parseRegistrationManifest, RegisterServiceWorkloadCommand, RegistrationCommandError, REGISTRATION_DATABASE_TARGET, REGISTRATION_OPERATOR } from "../../modules/identity/src/register-service-workload.js";

export const REGISTRATION_CONNECTION_BINDING = "AI_MLS_PRODUCTION_REGISTRATION_DATABASE_CONNECTION_V1";
export const REGISTRATION_CA_BINDING = "AI_MLS_PRODUCTION_REGISTRATION_DATABASE_CA_CERT_V1";
export interface RegistrationRunnerArguments { readonly mode: "DRY_RUN" | "EXECUTE"; readonly manifestPath: string }
export function parseRegistrationRunnerArguments(args: readonly string[]): RegistrationRunnerArguments {
  if (args.length !== 3 || !["--dry-run","--execute"].includes(args[0] ?? "") || args[1] !== "--manifest" || !args[2] || args[2].startsWith("--")) throw new RegistrationCommandError("INPUT_INVALID");
  return Object.freeze({ mode: args[0] === "--execute" ? "EXECUTE" : "DRY_RUN", manifestPath: args[2] });
}
export function openRegistrationOperatorPool(environment: Readonly<Record<string,string | undefined>>): PostgreSqlPoolPort {
  try {
    const connection = environment[REGISTRATION_CONNECTION_BINDING];
    const ca = environment[REGISTRATION_CA_BINDING];
    if (!connection || !ca || connection.length > 4096 || connection.trim() !== connection || /[\u0000-\u001f\u007f]/u.test(connection)) throw new Error();
    const url = new URL(connection);
    if (!["postgres:","postgresql:"].includes(url.protocol) || url.hostname !== REGISTRATION_DATABASE_TARGET.host
      || url.port !== "5432" || url.pathname !== "/postgres" || decodeURIComponent(url.username) !== REGISTRATION_OPERATOR
      || !url.password || url.search !== "" || url.hash !== "") throw new Error();
    return new PgConnectionPoolAdapter({ connectionString:connection,connectionTimeoutMilliseconds:10000,idleTimeoutMilliseconds:30000,statementTimeoutMilliseconds:30000,idleTransactionTimeoutMilliseconds:30000,shutdownTimeoutMilliseconds:30000,maxConnections:1,applicationName:"ai-mls-registration-operator",ssl:{rejectUnauthorized:true,ca} });
  } catch { throw new RegistrationCommandError("UNAVAILABLE"); }
}
export async function runRegistrationOperator(args: readonly string[], environment: Readonly<Record<string,string | undefined>>, output: (safe: string) => void = line => { process.stdout.write(`${line}\n`); }): Promise<void> {
  const options = parseRegistrationRunnerArguments(args);
  let pool: PostgreSqlPoolPort | undefined;
  let report: string | undefined;
  try {
    const text = await readFile(options.manifestPath, "utf8");
    if (Buffer.byteLength(text) > 32768) throw new RegistrationCommandError("INPUT_INVALID");
    const raw: unknown = JSON.parse(text);
    const manifest = parseRegistrationManifest(raw);
    pool = openRegistrationOperatorPool(environment);
    const result = await new RegisterServiceWorkloadCommand(pool).run(manifest, options.mode);
    report = JSON.stringify({ command:"REGISTER_SERVICE_WORKLOAD",mode:result.mode,result:result.result,DRY_RUN:options.mode === "DRY_RUN" ? "PASS" : "NOT_REQUESTED",EXPECTED_WRITES:result.expectedWrites,ACTUAL_WRITES:result.actualWrites,registrationId:manifest.registrationId,registrationVersion:manifest.registrationVersion,executionRole:REGISTRATION_OPERATOR });
  } catch { throw new RegistrationCommandError("UNAVAILABLE"); }
  finally { if (pool) await pool.close(); }
  if (report !== undefined) output(report);
}
if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  void runRegistrationOperator(process.argv.slice(2), process.env).catch(() => {
    const dry = process.argv[2] === "--dry-run";
    process.stderr.write(`${JSON.stringify(dry ? {command:"REGISTER_SERVICE_WORKLOAD",DRY_RUN:"FAIL",EXPECTED_WRITES:3,ACTUAL_WRITES:0} : {command:"REGISTER_SERVICE_WORKLOAD",result:"FAILED"})}\n`); process.exitCode = 1;
  });
}
