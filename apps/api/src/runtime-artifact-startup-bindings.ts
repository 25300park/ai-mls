import { R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from "./child-root-postgresql-readiness.js";
function unavailable(): Error { return new Error("Production runtime configuration is unavailable."); }
/** Fixed release contract only; no environment-supplied startup options. */
export function createRuntimeArtifactStartupOptions(contracts: readonly {schemaName:string;artifactSha256:string}[] = R3B1_CHILD_ROOT_SCHEMA_CONTRACTS): string {
 const names = ["app_publication","app_administration","app_connector","app_external_integration","app_advisory"];
 if (contracts.length !== names.length) throw unavailable();
 return names.map(name => {
  const matches = contracts.filter(c => c.schemaName === name);
  const expected = R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.find(c => c.schemaName === name);
  if(matches.length !== 1 || !expected || !/^[a-f0-9]{64}$/u.test(matches[0]!.artifactSha256) || matches[0]!.artifactSha256 !== expected.artifactSha256) throw unavailable();
  return `-c ai_mls.r3b1_${name.slice(4)}_artifact_sha256=${matches[0]!.artifactSha256}`;
 }).join(" ");
}
