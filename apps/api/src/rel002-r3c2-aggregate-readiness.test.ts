import assert from "node:assert/strict";
import test from "node:test";
import type { PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
import {normalizeIdentityConstraintCatalog} from "./r3c2-aggregate-readiness.js";
test("R3-C2 catalog normalization accepts only approved equivalent Identity CHECK forms",()=>{
 const row={constraint_name:"identity_sessions_version_check",kind:"c",columns:"session_version",check_expression:"((session_version >= 1) AND (session_version <= '9007199254740991'::bigint))"};
 assert.equal(normalizeIdentityConstraintCatalog([row])[0]?.check_expression,"session_version BETWEEN 1 AND 9007199254740991");
 const changed={...row,check_expression:row.check_expression.replace(" >= 1"," >= 0")};assert.deepEqual(normalizeIdentityConstraintCatalog([changed]),[changed]);
 const chronology={constraint_name:"identity_sessions_chronology_check",kind:"c",columns:"updated_at,created_at",check_expression:"(updated_at >= created_at)"};
 assert.equal(normalizeIdentityConstraintCatalog([chronology])[0]?.columns,"created_at,updated_at");
 const reversed={...chronology,check_expression:"(created_at >= updated_at)"};assert.deepEqual(normalizeIdentityConstraintCatalog([reversed]),[reversed]);
 assert.deepEqual(normalizeIdentityConstraintCatalog([{kind:"n"},{kind:"u",constraint_name:"unexpected"}]),[{kind:"u",constraint_name:"unexpected"}]);
 assert.equal(row.check_expression.includes("BETWEEN"),false);
});
test("R3-C2 aggregate readiness fails closed with missing roots and excludes migration-role clients",async()=>{
 const path="./r3c2-aggregate-readiness.js";const {assertR3C2AggregateSchemasReady}=await import(path) as {assertR3C2AggregateSchemasReady:(pool:PostgreSqlPoolPort)=>Promise<void>};
 for(const role of ["ai_mls_production_runtime","ai_mls_production_migration_operator"]){let releases=0;const pool:PostgreSqlPoolPort={connect:()=>Promise.resolve({query:<R extends Record<string,unknown>>(sql:string)=>Promise.resolve({rows:(sql==="SELECT current_user AS role"?[{role}]:[]) as unknown as readonly R[],rowCount:sql==="SELECT current_user AS role"?1:0}),release:()=>{releases++;}}),close:()=>Promise.reject(Error("shared pool close forbidden"))};await assert.rejects(assertR3C2AggregateSchemasReady(pool));assert.ok(releases>0);}
});
