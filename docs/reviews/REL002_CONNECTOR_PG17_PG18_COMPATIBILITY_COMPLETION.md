# REL002 Connector PG17/PG18 Compatibility Completion

| Field | Value |
|---|---|
| Version | v0.1 |
| Status | DRAFT |
| Owner | Architecture Owner |
| Date | 2026-10-12 |
| Baseline | 2191943a7816c24a93241ee1154fe6687428fdbe |
| Scope | Approved forward-only Connector catalog compatibility; local validation only |

## 1. Objective
Implement the AO-approved Connector-only PG17 catalog compatibility through the forward R3C2 composition. PG18 keeps the historical exact contract. Unknown majors fail closed. No Production or Railway operation, commit, or push occurred.

## 2. Documents read
Current AO approval; [child-root readiness](../../apps/api/src/child-root-postgresql-readiness.ts); [canonical R3C2 fixture](../../apps/api/src/rel002-r3c2-startup-postgresql.integration.test.ts); Connector001/002 and historical verifier; existing Administration and Publication adapters; [Connector diagnostic report](REL002_CONNECTOR_ISOLATED_COMPONENT_DIAGNOSTIC_COMPLETION.md); the saved PG17/PG18 captures; completion template.

## 3. Files created
- [Connector adapter](../../apps/api/src/connector-catalog-compatibility.ts)
- [Focused tests](../../apps/api/src/connector-catalog-compatibility.test.ts)
- [Disposable integration tests](../../scripts/rel002-connector-compatibility.integration.test.mjs)
- This report

## 4. Files modified
[R3C2 aggregate](../../apps/api/src/r3c2-aggregate-readiness.ts): two added lines, an import and pool adapter composition. Generic historical child-root behavior, existing adapters, migrations, verifiers, and expected hashes remain unchanged. Existing untracked evidence/diagnostics/reports remain preserved and unstaged.

## 5. Key decisions added
No new architectural authority was introduced. PG17 excludes only Connector `pg_constraint.contype='n'` from the constraints query. Every historical component/authority condition, exact 11-table inventory, owner, comment, artifact, columns, indexes, runtime/effective ACL, triggers/functions, privilege leakage, grant-option and membership restrictions remains mandatory. Nullable semantics remain independently exact in `information_schema.columns.is_nullable`.

PG17 normalized constraints evidence is `462926ec173263014727594215d20d8c`; PG18 historical constraints remain `256c3fc580fa577b32298aac39a2f67e`. The PG17 hash alone never establishes readiness. Only after all exact conditions pass is the constraints result projected for the unchanged historical evaluator. The composed query preserves Administration and Publication normalization in the same catalog snapshot. Other queries pass through unchanged.

## 6. Open decisions
OPEN DECISION: the next ExternalIntegration child-root blocker requires a separate AO brief. No fix or root-cause investigation was performed for it.

## 7. Inconsistencies found
Fresh full PG17 aggregate reports Publication, Administration, and Connector PASS. The next first blocker is `app_external_integration.constraints_hash`: expected `33533b7e20fa31f87ef1d3b38f740f4e`, observed `18486b92d120924d8f23a6a8b6c1b31f`. Overall readiness remains BLOCKED; later readiness stages were not reached.

## 8. Validation performed
- TDD: positive/query/composition tests failed with an unimplemented adapter before implementation.
- Focused Connector tests: 34 PASS; combined Connector/Administration/Publication focused tests: 99 PASS.
- PG17.11 disposable Connector integration: 26 PASS. Evidence: `C:/Users/Pc/AppData/Local/Temp/rel002-connector-compat-AgVVz9/result.json`.
- PG18.4 disposable Connector integration: 26 PASS. Evidence: `C:/Users/Pc/AppData/Local/Temp/rel002-connector-compat-LloaEI/result.json`.
- Actual catalog drift rejection includes NOT NULL removed/added, nullable flag changed, PK/FK/CHECK/UNIQUE/non-n constraints, indexes, triggers, functions, schema owner/comment, inventory, runtime/effective ACL, PUBLIC leakage, schema CREATE/USAGE, grant options, membership, missing schema, and absent artifact. Each transaction rolled back and the canonical baseline passed again.
- Unit tests reject unknown majors, PG18 acceptance of the PG17 hash, alternate-hash-only states, incomplete/duplicate results, and retain lease release/unrelated query passthrough.
- Affected child-root/R3C2/readiness suites: 170 PASS / 1 SKIP.
- Full regression: 2024 PASS / 1 existing approved immutable historical REL-001 fingerprint mismatch / 25 SKIP. No new failure.
- Build/typecheck/scoped lint/syntax: PASS. Full lint was not repeated after the preceding diagnostic task's repository-wide Node OOM; scoped lint covered all changed TypeScript source/test files.
- git diff --check, secret-literal scan, document links: PASS.
- Connector001 SHA256 `a6a65bd9c779cf047a4261eb11822414fff131708af68b7ee3029cb3cfbe91fd`; Connector002 `884993e84b9b83fa4dcc47c4ccd850bf4ef7dae13b60362460a23e1ab1d4822c`; historical verifier `e4a7e9f82e844fc7738a7a9f0fe8d14a1219154cb8d2496bcb650cdee7cce537`: HEAD blob matches. Connector001 also matches its approved sidecar.
- Historical modules, generic child-root, R3C1, Publication, and Administration compatibility: no diff against HEAD.
- Fresh full PG17 evidence: `C:/Users/Pc/AppData/Local/Temp/rel002-pg17-aggregate-8sP2Rp/aggregate-evidence.json`. Canonical migration state includes Identity014 and excludes 015/016. Historical child-root DO verifiers were not executed, so the forward readiness path could be observed. The only fixture data insertion was the canonical migration ledger attestation; no actual registration command or business data was created.
- All three new owned clusters were shut down, confirmed by their server logs. Their evidence directories remain retained.

## 9. Known limitations
These are local fixture results, not Production readiness/deployment approval. Full PG17 aggregate remains blocked at ExternalIntegration. The historical REL-001 mismatch is preserved. No current Production state was inspected.

Integration reproduction requires the existing untracked [Connector capture helper](../../scripts/rel002-connector-fixture-capture.mjs), which imports committed lifecycle helpers. Diagnostic assets were not edited or staged; a later commit candidate review must include required test dependencies explicitly.

## 10. Next brief prerequisites
Separate AO authorization is needed to analyze the next blocker and to approve any commit/push. The approved Connector implementation scope is complete; no next-phase fix was started.
