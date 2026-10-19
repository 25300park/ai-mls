# REL002 Full R3C2 five-root diagnostic completion

## 1. Objective
Distinguish the shared five-root failure's query, cardinality, compatibility and semantic requirements. No Production diagnosis is invented from OPERATION_REJECTED.

## 2. Documents read
Canonical AI_MLS_DEVELOPMENT_OPERATING_PRINCIPLES.md (applied from preceding review), current approved attachment and preceding child-gate completion evidence. Earlier user-supplied missing-schema evidence is historical, not proof of present state.

## 3. Files created
- apps/api/src/child-root-diagnostics.ts
- apps/api/src/child-root-diagnostics.test.ts
- This completion report.

## 4. Files modified
- apps/api/src/child-root-postgresql-readiness.ts
- apps/api/src/publication-catalog-compatibility.ts
- apps/api/src/publication-catalog-compatibility.test.ts
- apps/api/src/administration-catalog-compatibility.ts
- apps/api/src/connector-catalog-compatibility.ts
- apps/api/src/external-integration-catalog-compatibility.ts
- apps/api/src/advisory-catalog-compatibility.ts
- apps/api/src/r3c2-aggregate-readiness.ts
- apps/api/src/forward-registration-readiness.ts
- scripts/rel002-production-strict-registration-readiness.mjs
- scripts/rel002-production-strict-registration-readiness.test.mjs

## 5. Key decisions added
Diagnostics only. Existing Error names/messages and rejection predicates remain; private WeakMap metadata identifies the precise failed adapter check. Observer exceptions cannot authorize readiness. No SQL, roles, target, TLS, transactions, registration behavior or fingerprints changed.

Shared query source: child-root-postgresql-readiness.ts READINESS_QUERY; evaluateContracts executes and schemaMismatch accepts. Forward composition transforms the same query through Publication, Administration, Connector, External Integration, Advisory adapters. The physical catalog query is the combined ADVISORY_FORWARD_COMPATIBILITY_QUERY; unwinding validates Advisory first, then External Integration, Connector, Administration, Publication. Thus Publication is first in reported contract order, not necessarily the adapter that first rejected. Any inner adapter failure aborts the shared result and unavailableEvidence marks all five failed. Driver errors, malformed result cardinality and release errors can also fail the batch.

Safe events contain only FULL_R3C2_ROOT, ROOT_REQUIREMENT, RESULT, FAILURE_CATEGORY, allowlisted SQLSTATE or null, QUERY_SHA256=null. No hash is synthesized or claimed for a different query. Requirements correspond to actual version/inventory/artifact/comment/catalog component/authority/cardinality/query/release checks. No data rows, exception text, environment values or credentials are emitted. No separate SELECT file or additional query is introduced.

## 6. Open decisions
Production failing requirement and common cause remain UNRESOLVED until separately approved Human trace. Existing runtime identity/access and five matching artifact bindings do not establish root inventory, comments, component hashes, ACLs or query success. Registration absence is not diagnosed as this failure.

## 7. Inconsistencies found
All five FAIL summaries do not establish five independent defects. They collapse adapter/driver failures into the same batch-unavailable state. Tests prove one Advisory compatibility rejection produces five unavailable child summaries while the new trace identifies only Advisory's rejected requirement.

## 8. Validation performed
Focused diagnostic/Publication/helper: 78 PASS. Affected other four compatibility modules, Full R3C2, forward validator and dual-pool tests: 220 PASS. Build, typecheck, scoped TypeScript/JavaScript lint PASS. Shared historical contract constants, READINESS_QUERY and schemaMismatch byte content (line endings normalized) match HEAD. Diff and secret-literal scan PASS. All existing negative compatibility tests retained. Broader regression evidence reused; no database fixture, Production connection or readiness rerun performed.

## 9. Known limitations
SQLSTATE is restricted to 42501, 42704, 42P01, 42883, 25006, 57014, 08006, 08003; everything else is null. A tagged compatibility failure reports the first exact rejected requirement and its actual root, not an invented result for the other roots. Authority grouping does not establish which GRANT should change. PG17 normalization remains bounded to prior approved rules; no new normalization is inferred. No Production migration/ACL change is recommended without the exact trace. Artifact bindings remain relevant despite prior Human confirmation. Historical migration/verifier artifacts and Identity pool adapter remain untouched; no A2 semantics or registration write path changed. Unrelated existing untracked artifacts preserved.

## 10. Next brief prerequisites
Review the diagnostic candidate. Any commit/push, rollout and Human readiness execution require their separate authority. Then use the first ROOT_REQUIREMENT failure (and SQLSTATE when available) to establish cause before proposing a repair. Identity014 rerun remains prohibited; Identity015/016, registration dry-run and actual registration remain outside this task.
