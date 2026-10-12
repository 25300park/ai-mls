# External Integration PG17/PG18 compatibility completion

Version: v0.1 | Status: DRAFT | Owner: Architecture Owner
Baseline: ee40c72f9e74aa4f1a834c707e434dac879c86ec

## 1. Objective
Implement the approved External Integration-only forward R3C2 catalog compatibility. PG18 remains historical exact; PG17 requires every component and authority condition before projecting the constraints component. Unknown majors fail closed.

## 2. Documents read
Current AO implementation brief; [child-root contract](../../apps/api/src/child-root-postgresql-readiness.ts); [canonical full fixture](../../apps/api/src/rel002-r3c2-startup-postgresql.integration.test.ts); ExternalIntegration001/002 and historical verifier; existing Connector adapter and integration; [isolated diagnostic report](REL002_EXTERNAL_INTEGRATION_ISOLATED_COMPONENT_DIAGNOSTIC_COMPLETION.md); saved PG17/PG18 captures.

## 3. Files created
- [Compatibility adapter](../../apps/api/src/external-integration-catalog-compatibility.ts)
- [Focused tests](../../apps/api/src/external-integration-catalog-compatibility.test.ts)
- [Disposable integration](../../scripts/rel002-external-integration-compatibility.integration.test.mjs)
- This report.

## 4. Files modified
[R3C2 composition](../../apps/api/src/r3c2-aggregate-readiness.ts): adapter import and wrapper invocation only. Earlier diagnostic files and other untracked evidence remain preserved. No staging/commit/push.

## 5. Key decisions added
Compatibility applies solely to app_external_integration in forward R3C2 composition. The composed query preserves Publication/Administration/Connector projections in the same snapshot. PG17 excludes only constraint type n; information_schema column nullability, exact five-table inventory, all six other hashes, artifact, owner and every existing ACL/membership/count condition remain required. Only then is the semantic constraints component projected for the unchanged historical evaluator. PG18 uses historical constraints exactly; no alternate-hash-only acceptance.

PG17 canonical constraints: 18486b92d120924d8f23a6a8b6c1b31f. PG18 historical constraints: 33533b7e20fa31f87ef1d3b38f740f4e. Saved captures prove identical 21 non-n rows, 48 NOT NULL columns, and matching non-n hashes; PG18 adds 48 n rows. Other queries pass through unchanged; pool ownership remains unchanged.

## 6. Open decisions
OPEN DECISION: the next Advisory blocker is outside this scope. No Production execution or deployment authorized here.

## 7. Inconsistencies found
Full PG17 R3C2 advances past Publication, Administration, Connector and External Integration. It stops at app_advisory.constraints_hash: expected a2680ba17fd129ee99b229492ae7b1f0, observed 9ab8405707b12c37950fb2dc3c945709. No Advisory analysis/fix performed.

## 8. Validation performed
- New focused: 34 PASS; combined four compatibility suites: 133 PASS.
- PG17.11 disposable: 26 PASS. Evidence C:/Users/Pc/AppData/Local/Temp/rel002-external-integration-compat-VHRbgZ/result.json.
- PG18.4 disposable: 26 PASS. Evidence C:/Users/Pc/AppData/Local/Temp/rel002-external-integration-compat-wAt6nZ/result.json.
- Both integrations reject NOT NULL/nullable, PK/FK/CHECK/UNIQUE/non-n, index/trigger/function, owner/comment/inventory, runtime/effective ACL, PUBLIC leakage, schema authority, grant option, membership, missing schema and artifact drift; rollback restores canonical PASS.
- Unit cases reject unknown major, PG18 alternate hash, malformed/duplicate/incomplete results and component/authority drift; historical path remains exact.
- Affected readiness: 70 PASS.
- Full regression: 2058 PASS / 1 existing approved immutable REL001 fingerprint mismatch / 25 SKIP.
- Build, typecheck, scoped lint, script syntax, git diff --check and secret-literal scan PASS. Full lint not repeated after previously established repository lint memory exhaustion; changed TypeScript files passed scoped lint.
- Full PG17 evidence: C:/Users/Pc/AppData/Local/Temp/rel002-pg17-aggregate-zYA3Ci/aggregate-evidence.json. Canonical fixture includes Identity014, excludes015/016; no actual registration. All three newly owned clusters stopped, server logs confirm shutdown.
- External Integration migrations/verifier, generic child-root hashes/query and earlier R3C1/Publication/Administration/Connector compatibility files unchanged against HEAD.

## 9. Known limitations
Overall full PG17 aggregate remains BLOCKED by Advisory. Local fixtures establish catalog compatibility, not Production readiness. Existing full-regression historical mismatch preserved. No Production/Railway operation.

## 10. Next brief prerequisites
AO commit candidate review for bounded scope; separate authority for subsequent blocker investigation. No next phase started.
