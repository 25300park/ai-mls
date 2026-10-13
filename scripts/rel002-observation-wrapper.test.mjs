import assert from 'node:assert/strict';import test from 'node:test';
import {resolvePgConstructors,prepareObservationWrapper} from './rel002-observation-wrapper.mjs';
class Client{}class Pool{}
test('CommonJS default shape',()=>{assert.equal(resolvePgConstructors({default:{Client,Pool}}).Client,Client);});
test('ESM shape',()=>{assert.equal(resolvePgConstructors({Client,Pool}).Client,Client);});
for(const value of [null,{}, {Client:()=>{},Pool},{default:{Client:'bad',Pool}},{Client,Pool:null}])test('malformed shape fails before fixture',async()=>{let created=false;await assert.rejects(async()=>{await prepareObservationWrapper({loadModule:async()=>value});created=true;});assert.equal(created,false);});
test('module is resolved once; safe source binding and corrected import',async()=>{let count=0;const r=await prepareObservationWrapper({loadModule:async()=>{count++;return{Client,Pool};}});assert.equal(count,1);assert.ok(r.source.includes('loadInstalledPg'));assert.ok(!r.source.includes("from 'pg'"));assert.ok(r.source.includes('executionSourceHashes'));assert.ok(r.source.includes('countsUnchanged'));assert.equal(typeof r.hashes['scripts/rel002-local-registration-live.mjs'],'string');});
