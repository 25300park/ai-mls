// Local observation bootstrap only. Importing/preparing never creates a fixture.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
function constructable(value){
 assert.equal(typeof value,'function','PG_CONSTRUCTOR_UNAVAILABLE');
 try{Reflect.construct(Object,[],value);}catch{throw Error('PG_CONSTRUCTOR_UNAVAILABLE');}
}
export function resolvePgConstructors(module){
 assert.ok(module&&typeof module==='object','PG_MODULE_UNAVAILABLE');
 const Client=module.Client??module.default?.Client,Pool=module.Pool??module.default?.Pool;
 constructable(Client);constructable(Pool);return Object.freeze({Client,Pool});
}
let installedPg;
export function loadInstalledPg(){return installedPg??=import('pg').then(resolvePgConstructors);}
export async function prepareObservationWrapper({loadModule}={}){
 // Validation precedes even reading fixture source; never substitutes another driver.
 if(loadModule)resolvePgConstructors(await loadModule());else await loadInstalledPg();
 const base=resolve('scripts/rel002-local-registration-live.mjs'),rootURL=pathToFileURL(base);
 let source=await readFile(base,'utf8');const hashes={};
 const files=['scripts/rel002-local-registration-live.mjs','scripts/rel002-membership-grantor.mjs','scripts/rel002-read-only-statement-policy.mjs','scripts/rel002-local-registration-target.mjs','scripts/rel002-r3c1-fixture-capture.mjs','scripts/rel002-observation-wrapper.mjs'];
 files.push(...Array.from(source.matchAll(/from '([^']+)'/g)).map(m=>m[1]).filter(p=>p.startsWith('../dist/')).map(p=>resolve('scripts',p)));
 for(const p of files)hashes[p]=createHash('sha256').update(await readFile(p)).digest('hex');
 const replace=(before,after)=>{assert.ok(source.includes(before),'OBSERVATION_ANCHOR_MISSING');source=source.replace(before,after);};
 replace("import { Client, Pool } from 'pg';",`import { loadInstalledPg } from '${import.meta.url}';\nconst { Client, Pool } = await loadInstalledPg();`);
 replace('const evidence={classification:',`const executionSourceHashes=${JSON.stringify(hashes)};\nconst evidence={executionSourceHashes,classification:`);
 replace('    statementPolicy.accept(sql);','    const before=statementPolicy.state;statementPolicy.accept(sql);(evidence.transactionTrace??=[]).push({before,after:statementPolicy.state,queryHash:sha(sql)});');
 replace(' evidence.readiness=await validateDualPoolRegistrationOperationalReadiness(runtimePool,registrationPool,FORWARD_REGISTRATION_CONTRACT_ID,policy);',' try{evidence.readiness=await validateDualPoolRegistrationOperationalReadiness(runtimePool,registrationPool,FORWARD_REGISTRATION_CONTRACT_ID,policy);}finally{try{evidence.afterCounts=await counts();evidence.countsUnchanged=JSON.stringify(evidence.beforeCounts)===JSON.stringify(evidence.afterCounts);}catch{evidence.postCountsUnavailable=true;}}');
 source=source.replace(/from '([^']+)'/g,(full,p)=>p.startsWith('.')?`from '${new URL(p,rootURL).href}'`:full);
 return Object.freeze({source,hashes,bootstrap:'PRE_FIXTURE_READY',preparedSourceSha256:createHash('sha256').update(source).digest('hex')});
}
