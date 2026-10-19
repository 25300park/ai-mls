// LOCAL / STATIC: reads emitted artifacts and Git objects; never opens a database.
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';

test('A2 preserves clean-HEAD REL-001 files, component fingerprints and adapter bytes', async () => {
 const baselineSource = path => execFileSync('git',['show',`HEAD:${path}`]);
 const pool='modules/identity/src/postgresql-pool.ts';
 assert.deepEqual(readFileSync(pool),baselineSource(pool));
 const paths=[pool,'apps/api/src/production-runtime-configuration.ts','apps/api/src/production-secret-reference-resolver.ts','tools/production/register-service-workload.ts'];
 const baseline=new Map(paths.map(path=>[
  resolve('dist/'+path.replace(/\.ts$/u,'.js')),
  Buffer.from(ts.transpileModule(baselineSource(path).toString('utf8'),{fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2024,module:ts.ModuleKind.ESNext,verbatimModuleSyntax:true,sourceMap:true}}).outputText),
 ]));
 let overlay=new Map();
 const key='__rel002ClosureDiagnosticFs';
 assert.equal(globalThis[key],undefined);
 globalThis[key]={readFile:async path=>overlay.get(resolve(path))??await readFile(path),stat};
 try {
  const original=readFileSync('dist/modules/operations/src/release-candidate-artifact.js','utf8');
  const transformed=original.replace(/import \{ readFile, stat \} from ["']node:fs\/promises["'];/u,`const {readFile,stat}=globalThis.${key};`);
  assert.notEqual(transformed,original);
  const {materializeRel001StagingCandidate}=await import('data:text/javascript;base64,'+Buffer.from(transformed).toString('base64'));
  const input={distRoot:'dist',sourceCommitSha:'b7d2a864b8dbed9c6b1f0c7874481035159af886',repositoryIdentity:'https://github.com/25300park/ai-mls.git',sourceBranch:'main',generatedAt:'2026-09-16T15:00:00.000Z'};
  const candidate=await materializeRel001StagingCandidate(input);
  overlay=baseline;
  const clean=await materializeRel001StagingCandidate(input);
  assert.deepEqual(candidate.artifactManifest.includedFilePaths,clean.artifactManifest.includedFilePaths);
  assert.deepEqual(candidate.artifactManifest.runtimeComponents,clean.artifactManifest.runtimeComponents);
  assert.equal(candidate.artifactFingerprint,clean.artifactFingerprint);
  assert.equal(candidate.artifactFingerprint,'aedb6aaa7b3277125d6115ca63d7bf224895a082d3ce81791d2e22bfce701f96');
  for(const path of ['apps/api/src/runtime-artifact-startup-bindings.js','apps/api/src/production-runtime-pool.js','apps/api/src/child-root-postgresql-readiness.js'])assert.ok(!candidate.artifactManifest.includedFilePaths.includes(path));
  console.log('REL001_CLOSURE_FILES='+candidate.artifactManifest.includedFilePaths.length);
  console.log('REL001_REDESIGNED_CANDIDATE_ACTUAL='+candidate.artifactFingerprint);
 } finally { delete globalThis[key]; }
});
