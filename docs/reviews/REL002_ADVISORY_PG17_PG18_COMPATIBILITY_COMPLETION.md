# Advisory PG17/PG18 compatibility completion

Version: v0.1 | Status: DRAFT | Owner: Architecture Owner
Baseline: a18b16fa9f43ee215a5f0555ee759fd044025fe5

## 1. Objective
Implement the approved Advisory-only forward R3C2 catalog compatibility. Preserve historical PG18 exact behavior and all earlier authority boundaries. Unknown majors fail closed.

## 2. Documents read
AO approval brief; [child-root contract](../../apps/api/src/child-root-postgresql-readiness.ts); [canonical fixture](../../apps/api/src/rel002-r3c2-startup-postgresql.integration.test.ts); Advisory001/002 and historical verifier; existing External Integration adapter/integration; [diagnostic report](REL002_ADVISORY_ISOLATED_COMPONENT_DIAGNOSTIC_COMPLETION.md); saved PG17/PG18 captures.

## 3. Files created
- [Adapter](../../apps/api/src/advisory-catalog-compatibility.ts)
- [Focused tests](../../apps/api/src/advisory-catalog-compatibility.test.ts)
- [Disposable integration](../../scripts/rel002-advisory-compatibility.integration.test.mjs)
- This report.

## 4. Files modified
[R3C2 composition](../../apps/api/src/r3c2-aggregate-readiness.ts): one import and one wrapper invocation. No historical artifacts, earlier adapters or existing untracked files changed. No staging/commit/push.

## 5. Key decisions added
Only app_advisory PG17 constraints exclude type n. The combined catalog query retains earlier projections in the same snapshot. Before projection, exact three-table inventory, nullable columns, all six other components, artifact, owners and every historical privilege/membership/violation condition are required. Semantic non-n evidence 9ab8405707b12c37950fb2dc3c945709 is never a standalone acceptance condition. PG18 remains a2680ba17fd129ee99b229492ae7b1f0 historical exact. Generic readiness outside this composition is unchanged.

Saved proof captures establish seven identical non-n rows and twenty NOT NULL columns; PG18 alone adds twenty n rows. Pool ownership and unrelated query behavior preserved.

## 6. Open decisions
OPEN DECISION: the later post-child-root aggregate UNAVAILABLE failure requires separately scoped diagnosis. No further blocker fix performed.

## 7. Inconsistencies found
All five PG17 child roots now PASS. Full aggregate remains BLOCKED after that gate with GovernancePersistenceError code UNAVAILABLE. Safe metadata did not localize the exact failing component; do not infer a fingerprint cause. First run runner suppressed exception context, so a second owned run retained safe metadata. Neither run established full R3C2 readiness.

## 8. Validation performed
- Focused: 34 PASS; combined five compatibility suites: 167 PASS.
- PG17.11 disposable Advisory: 25 PASS. Evidence C:/Users/Pc/AppData/Local/Temp/rel002-advisory-compat-TZvpQe/result.json.
- PG18.4 disposable Advisory: 25 PASS. Evidence C:/Users/Pc/AppData/Local/Temp/rel002-advisory-compat-flph1m/result.json.
- Negative drift covers nullability, PK/FK/CHECK/non-n addition/removal, index, trigger, function, owner/comment/inventory, runtime/effective ACL, PUBLIC leakage, schema privileges, grant option, membership, missing schema and artifact. Transaction rollback restores canonical PASS. Unit cases also cover unknown major, malformed/duplicate/incomplete results, historical isolation and PG18 alternate-hash rejection.
- Affected readiness: 70 PASS.
- Full regression: 2092 PASS / 1 existing approved immutable REL001 historical fingerprint mismatch / 25 SKIP.
- Build, typecheck, scoped lint, integration syntax PASS. Full lint not repeated after previously established repository lint memory exhaustion.
- PG17 full aggregate evidence: C:/Users/Pc/AppData/Local/Temp/rel002-pg17-aggregate-7wjW0I/aggregate-evidence.json and C:/Users/Pc/AppData/Local/Temp/rel002-pg17-aggregate-dXSnMr/aggregate-evidence.json. Canonical Identity014 included; 015/016 excluded. No actual registration or business data; canonical fixture ledger attestation only.
- All four new owned clusters stopped; server logs confirm shutdown. Historical migrations/verifier/hash/query and prior R3C1/Publication/Administration/Connector/External Integration compatibility unchanged against HEAD.

## 9. Known limitations
Local compatibility completion does not establish Production readiness. Full aggregate remains BLOCKED after child roots; exact next component is unresolved. No Production/Railway operations. Existing historical regression mismatch preserved.

## 10. Next brief prerequisites
AO commit candidate review for bounded Advisory scope and separate authorization for post-child-root blocker diagnosis. No next phase implemented.
