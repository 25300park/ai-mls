# REL002 Identity Team Contract Diagnostic

Version: v0.1 | Status: IN REVIEW

## Objective
Identify the bounded requirement behind Production IDENTITY_TEAM_CONTRACT failure without changing contracts or connecting to Production.

## Documents read
[Operating principles](../governance/AI_MLS_DEVELOPMENT_OPERATING_PRINCIPLES.md); current Human brief; R3C2C compatibility and historical completion reports; repository Production catalog snapshot SQL; existing Production Identity verification transcript.

## Files created
This report.

## Files modified
apps/api/src/r3c2-aggregate-readiness.ts; apps/api/src/production-initial-identity-diagnostics.ts; apps/api/src/rel002-r3c2-aggregate-readiness.test.ts.

## Key decisions added
QUERY_SOURCE_FILE: apps/api/src/r3c2c-postgresql-readiness.ts. QUERY_FUNCTION: R3C2C_TEAM_CATALOG_QUERY, consumed by validateIdentityExtensions/check in r3c2-aggregate-readiness.ts after normalizeIdentityExtensionCatalogQuery.

Exact normalized SHA256: 68fa7bfe67ace14e69641dd41a349c3d514eb3a34333df9a45c66c0f3053e202. This matches the Human-supplied Production prefix. Purpose: post-Identity014 team root validation, including both guard functions, before historical base-schema projection. This initial stage checks only the Identity contract row, although the SQL also selects Audit material and contains the legacy registration gate.

| Requirement | Expected semantic condition | Local canonical PG17 | Existing current Production evidence | Further evidence |
|---|---|---|---|---|
| ROOT_CARDINALITY | Exactly one projected app_identity/workload_startup_binding_versions row | PASS in prior canonical fixture | UNRESOLVED | requirement result |
| FINGERPRINT_CONTRACT | Normalized projected fingerprint equals immutable post-014 contract be3dbce8569e67e89c43b75bb6e9abff; approved normalized 474c1456def4862e43167f2777a94c23 maps to it | PASS in prior canonical fixture | UNRESOLVED | requirement result; components only if needed later |
| AUTHORITY_CONTRACT | Exact row authority_ok=true | PASS in prior canonical fixture | UNRESOLVED | requirement result |

Fingerprint material includes schema owner/ACL, table owner/kind/RLS/options/comment, columns including attnotnull, constraints, indexes, triggers, both guard functions ordered by OID, table/column ACLs, runtime effective table/column/schema privileges, and null auditInventory for Identity. Neither A2 GUC values nor workload data enter this root material.

Authority requires migration-operator schema/table ownership, ordinary table kind, exact runtime/migration restricted role checks and runtime database CREATE absence. The unchanged registration wrapper replaces historical membership/TEMPORARY predicates only when the registration role exists, and then requires its exact POST-022/023 gate via an outer WHERE. Otherwise historical predicates remain. That outer gate can produce zero rows independently of team-table existence. Its failure is not automatically a missing team migration.

Each of the three requirements now emits only predefined requirement/result with stage, fixed safe code, null SQLSTATE for boolean rejection, and query hash. No fingerprints, catalog rows, IDs or raw errors are emitted. Acceptance condition and normalization are unchanged.

## Open decisions
The exact failed Production requirement remains UNRESOLVED. Production migration necessity remains UNRESOLVED. A2 is Human-confirmed 5_OF_5_PRESENT_MATCH and is not reopened.

## Inconsistencies found
No new PG18-only NOT NULL assumption found: the exact failing query already excludes contype=n while columns preserve attnotnull. Existing local PG17/18 proof covers this normalization. Other Production material differences remain possible; none is proven by a hash prefix plus generic failure. Repository snapshot SQL is a query artifact, not a captured result. Located historical transcript and completion evidence do not establish current three requirement results. No persisted current snapshot result adequate for this fingerprint was found in the inspected repository evidence. Earlier registration authority confirmations cannot prove the post-Identity014 fingerprint.

## Validation performed
Focused aggregate/two-root compatibility/runtime diagnostic tests: 56 PASS. Affected bootstrap/main/startup gates/pins/legacy wrapper/strict helper: 114 PASS. Build, typecheck, scoped lint, diff check and secret literal scan PASS. Existing PG17.11 disposable 49 PASS and PG18.4 disposable 49 PASS evidence reused from R3C2C compatibility report; no new cluster or migration executed. No historical migration/verifier/fingerprint, registration wrapper or runtime artifact source diff. Broader regression evidence unchanged and reused.

## Known limitations
Diagnostic masking is corrected locally; Production root cause is not claimed solved. Three FAIL results after absent rows are dependent failures, not proof of three independent defects. Cardinality failure must be distinguished from an outer registration gate rejection before proposing any repair. If fingerprint alone fails, component-level evidence is needed before attributing it to missing Identity014, function ordering, ACL changes or another cause.

## Next brief prerequisites
Human-controlled candidate review and diagnostic evidence, with no automatic deployment/rerun. No new Production query is requested at this stage. Preserve historical artifacts; no Production mutation, migration, Railway action, registration, commit or push performed.
