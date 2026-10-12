# External Integration isolated component diagnostic completion

Version: v0.1 | Status: DRAFT | Owner: Architecture Owner
Baseline: ee40c72f9e74aa4f1a834c707e434dac879c86ec

## 1. Objective
Prepare static-only PG17/PG18 component capture to prove or reject the NOT NULL catalog representation hypothesis. No compatibility implementation or fixture execution.

## 2. Documents read
Current AO brief; [child-root contract](../../apps/api/src/child-root-postgresql-readiness.ts); [canonical fixture](../../apps/api/src/rel002-r3c2-startup-postgresql.integration.test.ts); External Integration001/002 and historical verifier; reviewed Connector capture and Publication/R3C1 extraction/lifecycle helpers.

## 3. Files created
- [Harness](../../scripts/rel002-external-integration-fixture-capture.mjs)
- [Static tests](../../scripts/rel002-external-integration-fixture-capture.test.mjs)
- [Diagnostic SQL](../diagnostics/REL002_EXTERNAL_INTEGRATION_COMPONENT_DIAGNOSTIC.sql)
- This report.

## 4. Files modified
None. Existing untracked evidence preserved. No staging, commit or push.

## 5. Key decisions added
Exact sequence: ExternalIntegration001 then ExternalIntegration002 runtime grants. Stage: `POST_EXTERNAL_INTEGRATION_RUNTIME_GRANTS`. The administrator observes catalog metadata; runtime effective privileges are calculated explicitly. No business rows are queried or created.

Reuses reviewed owned-cluster lifecycle and stage-safe error handling. Explicit `REL002_EXTERNAL_INTEGRATION_CAPTURE_DISPOSABLE=CONFIRMED`, execute flag, loopback host, non-5432 port, major17/18 and binary path required. Production bindings rejected; inherited PG environment sanitized. Identity and pre-existing schema/role checks precede mutation. Only the new owned cluster is stopped; evidence retained.

Seven historical component expressions are extracted unchanged from the child-root query. Constraint normalization exists only as separate diagnostic material excluding `contype='n'`; no readiness hash or historical verifier is altered. Captures environment, owner/comment/inventory, artifact GUC separately, counts by type, NOT NULL count and validated non-n rows. Offline comparison requires both majors, matching migration checksums and capture stage; unequal results remain false.

## 6. Open decisions
OPEN DECISION: actual PG17/PG18 capture requires separate authorization. Root cause and compatibility necessity remain unproven.

## 7. Inconsistencies found
Historical constraints hash `33533b7e20fa31f87ef1d3b38f740f4e` differs from observed PG17 `18486b92d120924d8f23a6a8b6c1b31f`. This preparation does not resolve it.

## 8. Validation performed
Focused static/mock tests: 13 PASS. Affected harness tests: 60 PASS. Syntax checks passed. Diagnostic source equality, SELECT-only enforcement, sidecar SHA, ordering, environment isolation and bounded teardown covered. Historical artifacts unchanged against HEAD. No actual PostgreSQL execution.

## 9. Known limitations
Static preparation proves no live PG17/PG18 catalog equivalence. No Production secrets or business data accessed. No Production or Railway operations.

## 10. Next brief prerequisites
Explicit major-specific capture approval and local binary/port inputs. Capture both versions before deciding on compatibility.
