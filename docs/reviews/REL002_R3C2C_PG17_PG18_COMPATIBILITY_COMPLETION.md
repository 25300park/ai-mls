# REL002 R3C2C two-root PostgreSQL 17/18 compatibility completion

Version: v0.1
Status: IN REVIEW
Owner: Architecture Owner
Baseline: d414cc77e09083aac80cacf32401286f55dae9cc

## 1. Objective
Implement the AO-approved two-root R3C2C catalog compatibility in current R3C2 composition only. No Production access, migrations, registration, Railway action, commit or push.

## 2. Documents read
AO implementation approval; [historical R3C2C contract](../../apps/api/src/r3c2c-postgresql-readiness.ts); historical R3C2B query; existing R3C2B compatibility; [aggregate](../../apps/api/src/r3c2-aggregate-readiness.ts); registration wrapper; canonical full fixture; [paired diagnostic preparation](REL002_R3C2C_TWO_ROOT_DIAGNOSTIC_PREPARATION_COMPLETION.md).

## 3. Files created
- [Two-root compatibility](../../apps/api/src/r3c2c-catalog-compatibility.ts)
- [Focused tests](../../apps/api/src/r3c2c-catalog-compatibility.test.ts)
- [Disposable integration/full revalidation](../../scripts/rel002-r3c2c-compatibility.integration.test.mjs)
- This report.

## 4. Files modified
R3C2 aggregate: import the bounded adapter and replace only the current R3C2C assertion. Historical evaluator/assertion/query remain unchanged. No earlier untracked files modified.

## 5. Key decisions added
No new architecture decision. PG18 requires both unchanged historical exact fingerprints. PG17 requires one matching row per root, authority=true and exactly 19 component hashes per root. Whole PG17 fingerprints are evidence only, never sufficient for acceptance. Unknown majors fail closed.
Only constraints exclude contype=n on PG17; attnotnull and every other component remain exact. The existing registration projection and mandatory authority gate are reused unchanged. Registration operator absence passes; no provisioning state is fabricated.

Paired proof: C:/Users/Pc/AppData/Local/Temp/rel002-r3c2c-capture-SWyhTX/capture.json (PG17) and rel002-r3c2c-capture-tyXRdn/capture.json (PG18). Only constraints differ; PG18 non-n material equals PG17 full material for both roots. Audit inventory and function material/order are equal.

## 6. Open decisions
Commit/push and Production verification require separate authorization. This fixture does not establish registration post-provision readiness.

## 7. Inconsistencies found
Full regression retains the previously approved immutable REL-001 release-candidate fingerprint mismatch. No historical hash was rewritten. No new aggregate blocker found.

## 8. Validation performed
- Focused: 42 PASS.
- PG17.11 disposable: 49 PASS; C:/Users/Pc/AppData/Local/Temp/rel002-r3c2c-compat-3l5vd9/result.json.
- PG18.4 disposable: 49 PASS; C:/Users/Pc/AppData/Local/Temp/rel002-r3c2c-compat-mcs6xs/result.json.
- Negative drift: 47 rollback-isolated cases per major, covering both roots' nullability, non-n constraints, indexes/triggers/functions, owners, schema/table/column ACL, effective privileges, RLS/forceRLS, options/comments, authority and missing roots; Audit relation/function inventory; Identity base/team guard missing or changed. Focused tests independently reject each component drift, cardinality, malformed results, authority and unsupported major.
- Affected aggregate/team/startup: 47 PASS.
- Fresh PG17 full R3C2: PASS; C:/Users/Pc/AppData/Local/Temp/rel002-r3c2c-compat-pkX596/result.json. All child roots, Identity base, R3C1, R3C2B and R3C2C passed; Identity015/016 excluded. No actual registration.
- Full regression: 2157 PASS / 1 previously approved historical fingerprint mismatch / 25 SKIP. Log: C:/Users/Pc/AppData/Local/Temp/rel002-r3c2c-regression.log.
- Clean build, typecheck, scoped TypeScript/JavaScript lint, git diff --check and secret-literal scan PASS.
- Historical Identity/Audit artifacts, historical R3C2C contract, registration wrapper and all prior compatibility modules unchanged against HEAD.
- All three owned integration clusters stopped; evidence retained.

## 9. Known limitations
Local disposable verification only. Registration readiness NOT_REACHED: the tested full R3C2 schema gate excludes the separately authorized operational registration gate. No Production readiness/deploy authorization is implied. Full regression is not entirely green because of the known immutable historical mismatch.

## 10. Next brief prerequisites
AO commit candidate review of the four new files plus aggregate change. Existing diagnostic/evidence assets remain untracked and excluded unless actual reproducibility requires them. Integration imports only the already committed R3C1 lifecycle helper, not the untracked two-root capture harness. No next phase started.
