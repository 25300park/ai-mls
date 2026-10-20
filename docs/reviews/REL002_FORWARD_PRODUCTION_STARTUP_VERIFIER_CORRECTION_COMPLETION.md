# REL002 forward Production startup verifier correction

Version: v0.1. Status: IN REVIEW. Baseline: 9e6551171d6c10e85899390d75e21cb6adef2396.

## 1. Objective
Implement the explicit AO-approved forward startup composition correction. Current Production structure must not be rejected by immutable historical 023 Audit001 fingerprints; retain current authority and every later startup gate.

## 2. Documents read
Current Human approval/implementation brief; development operating principles; exact historical-gate decomposition; canonical forward-registration-readiness, startup preparation/main/bootstrap, initial Identity diagnostics, pin resolver, current R3C2C compatibility, affected startup/readiness tests.

## 3. Files created
- `scripts/rel002-forward-startup-verifier.test.mjs`
- This completion report.

## 4. Files modified
- `apps/api/src/forward-registration-readiness.ts`: export the existing borrowed exact-query pool projection as `projectForwardRegistrationPool`; its query transformation and structural acceptance are unchanged.
- `apps/api/src/production-startup-preparation.ts`: choose canonical forward readiness in initial Identity startup and the pin resolver's aggregate recheck; pass the canonical projected borrowed pool to existing initial Identity diagnostics.

All unrelated existing files preserved. No generic infrastructure, registration transaction, migration, historical verifier/fingerprint, ACL, configuration or deployed artifact modified.

## 5. Key decisions added
The approved contract remains `REL002-REGISTRATION-POST-IDENTITY014-AUDIT002-V1`. No alternative Audit hash acceptance or new normalization is introduced. Exact current components and full R3C2 remain mandatory.

Before: Production bootstrap -> preparation.authority.assertSchemaReady -> initial Identity diagnostics -> assertR3C2IdentityBaseReady -> normalized Team query -> historical registration wrapper -> global historical 023 structural fingerprint gate. Pin resolution independently reentered unprojected assertR3C2AggregateSchemasReady.

After: Production bootstrap -> preparation.authority.assertSchemaReady -> validateForwardRegistrationReadiness(runtime pool, exact contract) -> runtime identity -> current forward structure/full R3C2/five bindings/provenance -> separate runtime identity and unchanged current authority catalog predicates -> existing initial Identity diagnostics/base inspection through the same canonical forward projection. Pin resolver aggregate rechecks use validateForwardRegistrationReadiness as well. Later production-main assertRegistrationAggregateSchemasReady already selects that validator and is unchanged.

The reused runtime-safe validator is NOT validateForwardRegistrationAuthority: that other function requires registration-operator authentication and is not invoked here. No registration credentials, extra pool, role switch or authority grant is introduced. Current authority predicates remain role_acl_ok/membership_ok/ownership_ok/registration_acl_ok from the approved forward query, evaluated with its existing runtime identity boundary. Historical Audit001 fingerprint equality is not an authority predicate.

## 6. Open decisions
Commit/deployment/Production execution remain outside this work package. No automatic rollout.

## 7. Inconsistencies found
The pin resolver had a second unprojected aggregate readiness call, so correcting only initial Identity would have left a later historical-gate failure. Both Production-only composition points now select the canonical forward path. No historical/generic consumer was altered.

## 8. Validation performed
- TDD: new projection export test failed before implementation; final focused suite 10 PASS.
- Focused tests use mocked pools/current canonical component contracts: Audit002/Identity014 PG17 material passes without historical Audit001 hash; malformed/missing roots, wrong Team component, false authority and unknown major reject. Actual startup preparation rejects postgres/operator identities before structural/authority queries; missing forward roots reject without legacy gate or writes. Query values, client release and borrowed pool ownership remain intact.
- Affected suite: 107 PASS across production bootstrap/main/child-root registry, aggregate diagnostics, async evidence, forward readiness and operational readiness. Existing tests verify pinned workload and later startup gate ordering/failure/cleanup. An initial single-process test run hit mock-timer/child-process interference; normal process-isolated rerun passed all 107. No test failures remain in that suite.
- Build PASS; typecheck PASS; scoped TypeScript/JS lint PASS; scoped secret scan PASS; git diff --check PASS.
- Historical 023, all Identity/Audit migrations, historical expected fingerprints, generic registration wrapper, registration authority SQL, production-main/bootstrap and pin resolver files have no diff against HEAD.
- No full regression or PostgreSQL fixture executed; no Production access or Railway operation.

## 9. Known limitations
Validation is local unit/composition evidence, not proof of live startup success. The initial phase now runs full canonical forward readiness before repeating the existing diagnostic base inspection; pin aggregate rechecks remain fresh rather than cached. A failure in the earlier canonical check can occur before the legacy detailed Identity diagnostic runs; the existing bootstrap failure handling remains fail-closed. No listener/worker activation is attempted after readiness rejection.

## 10. Next brief prerequisites
Review this exact source/test/report candidate before separately authorizing commit or rollout. Preserve immutable history. Any future Production verification must observe positive current startup progression, pinned registration, human identity, required secrets and worker/runtime activation gates. No registration rerun, Audit002 rollback or ACL adjustment is part of this correction.
