# REL002 Initial Identity Readiness Diagnostics

Version: v0.1 | Status: IN REVIEW

## Objective
Expose the bounded subordinate stage behind INITIAL_IDENTITY_READINESS without changing readiness decisions.

## Documents read
[Operating principles](../governance/AI_MLS_DEVELOPMENT_OPERATING_PRINCIPLES.md) and the current Human brief.

## Files created
apps/api/src/production-initial-identity-diagnostics.ts; this report.

## Files modified
apps/api/src/production-startup-preparation.ts; apps/api/src/r3c2-aggregate-readiness.ts; apps/api/src/rel002-r3c2-aggregate-readiness.test.ts.

## Key decisions added
Production startup authority.assertSchemaReady delegates to assertR3C2IdentityBaseReady. Its first transaction query is BEGIN; the namespace SELECT interception then validates extensions before executing the base inspector. Extension inventory, team/evidence/human/session contracts and function inventory precede base-schema/provenance inspection. The historical inspector masks errors; the Production wrapper now captures allowlisted SQLSTATE before masking, plus a query SHA256 and predefined stage. For semantic rejection, querySha256 identifies the last catalog query, not proof of a SQL execution error. Rollback does not replace original query/SQLSTATE evidence.

The five canonical artifact keys and expected values are derived from R3B1_CHILD_ROOT_SCHEMA_CONTRACTS. A parameterized SELECT on the exact same checked-out inspector client reports only PRESENT_MATCH, MISSING, MISMATCH or UNRESOLVED per predefined key. It runs before the existing read-only transaction and never changes a binding or readiness decision. Observation and sink failures are swallowed; the original validator still runs and preserves fail-closed outcomes and cleanup. No additional connection is opened.

## Open decisions
Production subordinate cause and five binding results remain UNRESOLVED until Human-operated evidence is supplied. No deployment or Production probe was performed.

## Inconsistencies found
FIRST_QUERY_COMPLETED proves a successful first query; it does not prove extension contracts, base-schema readiness or native provenance. No evidence supports returning to networking analysis. Workload pins, configuration-reference-dependent workload resolution and full aggregate readiness occur after this failing initial assertion.

## Validation performed
Focused aggregate/runtime pool/database diagnostics: 24 PASS. Affected bootstrap/main/startup gates/pinned identity/registration compatibility/strict helper: 114 PASS using normal per-file isolation. An initial combined no-isolation invocation caused test-interference cancellations; normal isolated execution passed. Build, typecheck, scoped lint, diff check and secret literal scan PASS. No changed historical Identity/Audit migration, generic Identity pool, artifact-startup values or legacy registration wrapper. Previous broader regression evidence reused; not rerun.

## Known limitations
Production network/first-query PASS are Human evidence. Production GUC presence/matches, native provenance, authority and subordinate failure remain unresolved. New diagnostics have only local mock evidence. Additional diagnostic SELECT is read-only; it adds an observation round trip but changes no connection, TLS, role, ACL, retry, startup binding or authority semantics. Base-schema/provenance is one bounded stage; query hash localizes its last catalog operation without emitting material or data rows.

## Next brief prerequisites
Review the bounded candidate. Any Production deployment or readiness rerun remains Human-controlled. Capture PRODUCTION_INITIAL_IDENTITY_DIAGNOSTIC events before selecting a repair. No migration, role/ACL change or registration action is authorized by this report.
