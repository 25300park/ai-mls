import assert from "node:assert/strict";
import test from "node:test";
import { safeRuntimeDatabaseFailure } from "./production-runtime-pool.js";
test("safe database diagnostics preserve SQLSTATE without raw exception fields",()=>{
 const diagnostic=safeRuntimeDatabaseFailure('PHYSICAL_CONNECTION',{code:'28P01',message:'DO_NOT_LOG_PASSWORD',detail:'DO_NOT_LOG_URI',name:'DO_NOT_LOG_CA'});
 assert.equal(diagnostic.sqlstate,'28P01');
 assert.equal(diagnostic.code,'POSTGRESQL_ERROR');
 assert.doesNotMatch(JSON.stringify(diagnostic),/DO_NOT_LOG/u);
});
test("transport codes are allowlisted and arbitrary error code/name/message never escape",()=>{
 assert.equal(safeRuntimeDatabaseFailure('PHYSICAL_CONNECTION',{code:'ENOTFOUND'}).code,'ENOTFOUND');
 const diagnostic=safeRuntimeDatabaseFailure('INITIAL_IDENTITY_READINESS',{code:'DO_NOT_LOG',name:'DO_NOT_LOG',message:'DO_NOT_LOG'});
 assert.equal(diagnostic.sqlstate,null);assert.equal(diagnostic.code,'READINESS_UNAVAILABLE');assert.doesNotMatch(JSON.stringify(diagnostic),/DO_NOT_LOG/u);
});
test("physical connection diagnostics classify network errors hidden in nested causes",()=>{
 const diagnostic=safeRuntimeDatabaseFailure('PHYSICAL_CONNECTION',{cause:{code:'ENETUNREACH',address:'DO_NOT_LOG_ADDRESS',message:'DO_NOT_LOG_MESSAGE'}});
 assert.equal(Reflect.get(diagnostic,'transportCode'),'NETWORK_UNREACHABLE');
 assert.doesNotMatch(JSON.stringify(diagnostic),/DO_NOT_LOG/u);
});
