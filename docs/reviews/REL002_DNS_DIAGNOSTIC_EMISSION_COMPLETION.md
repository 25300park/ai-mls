# REL002 DNS Diagnostic Emission Correction

Version: v0.1 | Status: IN REVIEW

## Objective
Emit safe DNS family observations on physical connection failure.
## Documents read
[Operating principles](../governance/AI_MLS_DEVELOPMENT_OPERATING_PRINCIPLES.md).
## Files created
This completion report.
## Files modified
production-connection-diagnostics.ts and its test; production-runtime-pool.ts and its test, under apps/api/src.
## Key decisions added
DNS was previously standalone and never invoked during startup. The physical failure handler now awaits a bounded observation before emitting the original classified failure. Lookup rejection or the one-second deadline returns null/null. Successful resolution returns only family-presence booleans. No addresses or raw exceptions are emitted.
## Open decisions
None within local scope. Production rollout remains Human controlled.
## Inconsistencies found
Missing fields were a missing invocation, not serialization or process-exit loss.
## Validation performed
Focused diagnostics/pool: 33 PASS. Bootstrap affected: 30 PASS (child-process sandbox restriction resolved by approved local test execution). Build, typecheck, scoped lint, diff check and scoped secret scan PASS. No live DNS or Production probe. Broader unchanged regression evidence reused: 2256 PASS / 1 known historical failure / 25 SKIP.
## Known limitations
Failure propagation may wait up to one second for diagnostics. Deadline bounds observation waiting; it does not cancel the underlying OS lookup. DNS does not select a connection family, retry, change configuration, or affect authority/readiness results. Abrupt external process termination cannot guarantee log delivery.
## Next brief prerequisites
Human-controlled review/deployment before observing Production output. No deployment or readiness rerun performed.
