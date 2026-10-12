# Advisory isolated component diagnostic completion

Version: v0.1 | Status: DRAFT | Owner: Architecture Owner
Baseline: a18b16fa9f43ee215a5f0555ee759fd044025fe5

## 1. Objective
Prepare static-only PG17/PG18 Advisory captures to prove or reject the NOT NULL catalog representation hypothesis. No fixture execution or compatibility implementation.

## 2. Documents read
Current AO brief; [child-root contract](../../apps/api/src/child-root-postgresql-readiness.ts); [canonical fixture](../../apps/api/src/rel002-r3c2-startup-postgresql.integration.test.ts); Advisory001/002 and historical verifier; reviewed External Integration capture and shared Publication/R3C1 extraction/lifecycle helpers.

## 3. Files created
- [Harness](../../scripts/rel002-advisory-fixture-capture.mjs)
- [Focused tests](../../scripts/rel002-advisory-fixture-capture.test.mjs)
- [Diagnostic SQL](../diagnostics/REL002_ADVISORY_COMPONENT_DIAGNOSTIC.sql)
- This report.

## 4. Files modified
None. Existing untracked evidence retained. No staging, commit or push.

## 5. Key decisions added
Exact sequence: Advisory001 then Advisory002 runtime grants. Capture stage: POST_ADVISORY_RUNTIME_GRANTS. No unrelated migrations or historical DO verifier execution. Administrator observes catalog metadata; runtime effective privileges are calculated explicitly. No business rows queried or created.

Reuses reviewed owned-cluster lifecycle and safe stage reporting. Explicit REL002_ADVISORY_CAPTURE_DISPOSABLE=CONFIRMED, execute flag, loopback host, non-5432 port, major17/18 and binary path required. Production bindings denied; inherited PG environment sanitized. Target identity and pre-existing schema/role gates precede mutation. Only new owned cluster shutdown permitted; local evidence retained.

Seven historical child-root component expressions preserved. Separate non-n diagnostic excludes only contype='n', preserving historical full hash and independent column nullability. Captures environment/data_directory, schema owner/comment/inventory/count, artifact GUC presence/value separately, counts by contype, NOT NULL count and ordered validated non-n definitions. Migration checksums recorded separately. Offline comparison requires both majors, matching stage and checksums and reports unequal evidence as false.

## 6. Open decisions
OPEN DECISION: actual PG17/PG18 capture requires separate authorization. Root cause and compatibility necessity remain unproven.

## 7. Inconsistencies found
Historical constraints a2680ba17fd129ee99b229492ae7b1f0 differ from saved PG17 9ab8405707b12c37950fb2dc3c945709. Static preparation does not resolve this mismatch.

## 8. Validation performed
Focused static/mock tests: 13 PASS. Affected harness tests: 73 PASS. Syntax checks PASS. Tests cover source-derived SELECT-only diagnostic, sidecar checksum, major/host/port/opt-in, denied Production environment, exact ordering, owned teardown and comparison rejection. No actual PostgreSQL execution. Historical migrations/verifier/query/helpers unchanged against HEAD.

## 9. Known limitations
No live PostgreSQL semantic equivalence claimed. No Production/Railway operations or credential access.

## 10. Next brief prerequisites
Explicit major-specific capture approval and local binary/port inputs. Capture both versions before compatibility design.
