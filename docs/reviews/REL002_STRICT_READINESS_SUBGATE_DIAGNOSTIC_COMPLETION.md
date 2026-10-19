# REL002 Strict Readiness Exact Subgate Diagnostics

Version: v0.1 | Status: IN REVIEW

## Objective
Remove subordinate readiness masking using safe stage/result/category events only. No Production readiness rerun or registration action.

## Documents read
[Operating principles](../governance/AI_MLS_DEVELOPMENT_OPERATING_PRINCIPLES.md); current Human brief; strict readiness helper/tests; registration-dual-pool.ts; forward-registration-readiness.ts; aggregate composition; existing dual-pool tests.

## Files created
This report.

## Files modified
apps/api/src/forward-registration-readiness.ts; tools/production/registration-dual-pool.ts; modules/identity/src/registration-dual-pool.test.ts; scripts/rel002-production-strict-registration-readiness.mjs; scripts/rel002-production-strict-registration-readiness.test.mjs.

## Key decisions added
### Exact source order, not assumed order
1. Helper verifies configuration, constructs distinct physical pool objects, then sets stage=READINESS.
2. validateDualPoolRegistrationOperationalReadiness validates contract and pool-separation/target-policy inputs.
3. RUNTIME_SESSION: connect runtime, execute REGISTRATION_TARGET_QUERY, verify runtime current_user/session_user/database/major and endpoint/TLS/session metadata, release client. FIRST_QUERY_COMPLETED occurs during this query, before identity validation can PASS.
4. FORWARD_STRUCTURE wraps validateForwardRegistrationStructureEvidence:
   - RUNTIME_STRUCTURE_IDENTITY: fresh runtime lease, exact identity query/check, release.
   - FULL_R3C2: approved projected aggregate verifies five child-root artifacts/current schemas, Identity base, R3C1, R3C2B, R3C2C. The five artifact checks are inside this gate, not a separately reordered query.
   - IDENTITY_BASE_PROVENANCE: explicit base evidence recheck and permitted native/historical provenance verification.
5. STRUCTURE_RESULT: require artifact_bindings_verified, r3c2_ready, forward_structure_ready and accepted provenance evidence.
6. REGISTRATION_SESSION: connect independently authenticated registration pool.
7. SESSION_PAIR: read registration target and apply target policy. Production policy preserves this order:
   - RUNTIME_SESSION_RECHECK
   - REGISTRATION_IDENTITY
   - SESSION_PAIR_IDENTITIES
   - DISTINCT_BACKENDS
   - SAME_TARGET (address, port, database_oid, cluster_started, server_version_num, database equality; none emitted).
8. FORWARD_AUTHORITY:
   - REGISTRATION_AUTHORITY_IDENTITY query/check
   - REGISTRATION_AUTHORITY_CATALOG exact ready-row check.
9. OPERATIONAL_RESULT: construct unchanged readiness evidence with writes=0; release registration client first.
10. Helper advances to RESULT_ASSERTIONS. NATIVE_PROVENANCE then records the existing native-only requirement; all original contract/policy/writes/flag assertions remain. Native-only enforcement is at the helper end, not before registration session verification.
11. Helper finally attempts both physical-pool closures, independently.

### Masking and evidence limit
validateDualPoolRegistrationOperationalReadiness previously caught all subordinate errors and threw RegistrationCommandError(UNAVAILABLE). runReadiness then discarded that error, retaining only its READINESS stage and fixed READINESS_UNAVAILABLE. The supplied prior log cannot reveal the original failed operation retroactively. No exact Production subgate or lower-level defect is claimed from that old log.

### Bounded correction
Optional trusted diagnostic observers emit only immutable/primitive predefined subgate, PASS/FAIL and NONE/OPERATION_REJECTED. Helper rechecks its own allowlist and prints READINESS_SUBGATE, READINESS_RESULT, FAILURE_CATEGORY. No driver error, message, stack, row, SQL, URI, CA, environment or session metadata is emitted. Sink errors are swallowed and cannot authorize/bypass validation. Nested failing operations emit before parent wrapper failures, so the FIRST FAIL identifies the earliest rejected traced operation.

No acceptance predicate, query text, target policy, role contract, expected fingerprint, privilege, pool constructor or cleanup ownership changes. Same-session comparison was split into observational steps with the identical original identity/PID/equality predicates. Extra observer parameters are trusted source composition only, not CLI/environment injection. No extra database queries were added.

Known absence of the required registration is not itself a strict structural-readiness failure: this helper verifies structure/authority rather than resolving the pinned application workload. Do not create registration to bypass an unresolved strict readiness gate.

## Open decisions
FIRST_FAILING_READINESS_SUBGATE and actual lower-level cause remain UNRESOLVED until Human trace evidence. Current READINESS stage proves helper pool-object separation passed, but does not prove runtime session identity or backend/target matching. No mutation-based repair is authorized.

## Inconsistencies found
Physical connection and first successful SELECT do not establish runtime identity, full aggregate readiness or Forward Authority. Prior startup five-GUC PASS is valid Human evidence for that session, not independent proof that this strict invocation reached its artifact checks. NATIVE_PROVENANCE helper assertion was not reached when FAIL_STAGE=READINESS.

## Validation performed
Focused strict-helper and dual-pool tests: 93 PASS, including first-failure stages, nested FULL_R3C2 failure ordering, rejected identity/backend/target changes, observer-failure isolation, zero-write policy and cleanup. Affected forward-validator/aggregate/runtime-pool/registration-command/synthetic-config tests: 60 PASS. Build, typecheck, scoped TypeScript and JavaScript lint, diff check and secret literal scan PASS. Existing broader regression evidence reused because decision semantics/query sequence are unchanged. Tests use mocks/synthetic bindings only; no Production or live strict readiness/dry-run execution.

Historical Identity/Audit migrations, generic Identity pool, runtime artifact startup bindings and legacy registration wrapper show no diff. Existing untracked diagnostic assets preserved and not staged.

## Known limitations
Safe category identifies a rejected operation, not raw SQLSTATE or error details. FULL_R3C2 is an aggregate boundary; internal root failure remains subject to existing approved diagnostics. This source work fixes observability, not an unobserved Production condition. A2, Identity014 and prior confirmed team readiness remain preserved; Identity014 rerun and015/016 remain unauthorized.

## Next brief prerequisites
Review the bounded candidate; Human-controlled rebuilt helper trace evidence after separate execution authorization. No Production connection, mutation, Railway action, strict readiness rerun, registration DRY_RUN/actual registration, commit or push performed.
