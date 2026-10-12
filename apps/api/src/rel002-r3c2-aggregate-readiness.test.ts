import assert from "node:assert/strict";
import test from "node:test";
import type { PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
import {assertR3C2IdentityBaseReady,normalizeIdentityConstraintCatalog,normalizeIdentityExtensionCatalogQuery} from "./r3c2-aggregate-readiness.js";
import { readFile } from "node:fs/promises";
test("historical compatibility preserves frozen hash algorithm with bounded extension projection", async () => {
 const adapter = await import("./r3c2-aggregate-readiness.js") as unknown as Record<string, unknown>;
 assert.equal(typeof adapter["R3C2_HISTORICAL_COMPATIBILITY_QUERY"], "string");
 const query=String(adapter["R3C2_HISTORICAL_COMPATIBILITY_QUERY"]);
 const historical=await readFile("modules/identity/migrations/postgresql/production/006_historical_migration_attestation_schema_v1.sql","utf8");
 for(const hash of historical.matchAll(/value = '([a-f0-9]{32})'/gu))assert.ok(query.includes(hash[1]!));
 assert.ok(query.includes("attr.attnotnull"));
 assert.doesNotMatch(query,/\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE)\b/iu);
 assert.ok(query.includes("identity_sessions_production_binding_check"));
 assert.ok(query.includes("identity_sessions_production_binding_guard"));
 assert.ok(!query.includes("rel.relname <> 'identity_historical_migration_attestations'"));
});
test("extension catalog normalization preserves NOT NULL column semantics and non-NOT-NULL constraints",()=>{
 const query="SELECT attr.attnotnull, k.contype FROM pg_attribute attr, pg_constraint k WHERE k.conrelid=c.oid)";
 assert.equal(normalizeIdentityExtensionCatalogQuery(query),query.replace("WHERE k.conrelid=c.oid)","WHERE k.conrelid=c.oid AND k.contype <> 'n')"));
});
test("extension read failure rolls back and releases the single inspector lease",async()=>{
 const queries:string[]=[];let leases=0,releases=0;
 const pool:PostgreSqlPoolPort={connect:async()=>{await Promise.resolve();leases++;return {
  query:async<R extends Record<string,unknown>>(sql:string)=>{await Promise.resolve();queries.push(sql);if(sql.startsWith("SELECT relname AS table_name"))throw Error("fixture extension read unavailable");return {rows:[] as R[],rowCount:0};},
  release:()=>{releases++;}
 };},close:()=>Promise.reject(Error("shared pool close forbidden"))};
 await assert.rejects(assertR3C2IdentityBaseReady(pool));
 assert.equal(queries[0],"BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");assert.equal(queries.at(-1),"ROLLBACK");
 assert.equal(leases,1);assert.equal(releases,1);
});
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
