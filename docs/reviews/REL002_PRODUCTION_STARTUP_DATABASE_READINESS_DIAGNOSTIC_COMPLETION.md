# REL002 Production Startup Database Readiness Diagnostic

Version: v0.1
Status: IN REVIEW
Owner: Architecture Owner
Date: 2026-10-19
Baseline: `ec190cb5791e07e474a27d48510c4ef198528d71`

## 1. Objective

Diagnose the masked Production `DATABASE_READINESS_FAILED` boundary and implement bounded safe error propagation within the approved local/source scope. The local diagnostic candidate is validated; the actual subordinate Production cause remains unconfirmed and therefore the overall Production correction task is BLOCKED on Human-controlled evidence.

## 2. Documents read

Current approved root-cause/correction brief; [operating principles](../governance/AI_MLS_DEVELOPMENT_OPERATING_PRINCIPLES.md); [A2 completion](REL002_RUNTIME_ARTIFACT_BINDING_A2_COMPLETION.md); canonical bootstrap, pool, Identity readiness, and local harness sources. Installed node-postgres source confirms `PoolConfig.options` becomes startup packet `data.options`.

## 3. Files created

- [Safe diagnostic tests](../../apps/api/src/production-runtime-database-diagnostics.test.ts).
- [Owned local PG17 verification](../../scripts/rel002-runtime-startup-guc-local.mjs).
- This report. Local evidence is retained outside the repository at `C:/Users/Pc/AppData/Local/Temp/rel002-a2-startup-guc-Tkbv9P/local-guc-evidence.json`.

## 4. Files modified

- [Production pool](../../apps/api/src/production-runtime-pool.ts): bounded first connection/query observations, allowlisted transport codes/SQLSTATE, query SHA256, and first-failure retention before generic error masking.
- [Bootstrap engine](../../apps/api/src/production-bootstrap-engine.ts): distinguish initial authority construction from initial Identity schema readiness; preserve original errors and cleanup.
- [Pool tests](../../apps/api/src/production-runtime-pool.test.ts) and [bootstrap tests](../../apps/api/src/production-bootstrap.test.ts): sanitization, first-failure retention, failing sinks, synchronous/rejected failures, and cleanup.

## 5. Key decisions added

No startup-option, target, TLS, role, ACL, migration, contract, or authority change was justified by existing evidence. Only diagnostic masking was corrected. No raw exception message/name/detail/hint, SQL, parameters, connection material, certificate content, or environment dump is logged. Diagnostics cannot change the underlying success/failure result. A deployment/restart remains a separate Human gate.

## 6. Open decisions

Human must supply a safe subordinate Production failure or separately approve rollout of the diagnostic candidate. The current logs cannot distinguish authentication/transport/startup negotiation, query failure, or catalog/provenance incompatibility. No Production repair or credential change is proposed without evidence.

## 7. Inconsistencies found

`physicalPoolCount=1` is incremented after pool object construction, not after physical authentication. `databaseConnectivity=NOT_CHECKED` means `identityReadVerified()` was not reached. Thus the failure is in initial authority construction or `authority.assertSchemaReady()`, before the pre-listener chain and later aggregate readiness. The safe wrapper code alone cannot establish the exact subordinate failure.

The historical REL-001 expectation remains different from the approved clean-HEAD actual; the candidate retains that actual unchanged and introduces no additional closure impact.

## 8. Validation performed

- Focused startup/pool/configuration/Identity adapter/helper tests: 87 PASS.
- Affected Production startup, registration, and R3C2 tests: 180 PASS / 3 SKIP.
- Local owned PG17.11 verification: PASS; all five settings match and SELECT 1 succeeds on backend PIDs `124520,124520,122824,123656`, distinguishing reuse/replacement/recreation. Owned cluster shutdown PASS; no Production connection.
- The new serialized options exactly equal the previously successful local harness expression and live tested options. SHA256: `d800f001d9e841911a51da9afcd38e275f6391b0b95ad562006b9f6503151197`. Keys and lowercase hexadecimal values require no escaping; timing is physical PostgreSQL startup in both paths.
- REL-001 closure test: 1 PASS; 81 file records and component fingerprints unchanged. Actual remains `aedb6aaa7b3277125d6115ca63d7bf224895a082d3ce81791d2e22bfce701f96`.
- Build, typecheck, scoped lint, script syntax, diff whitespace and secret-literal checks PASS.
- Full regression once after stabilization: 2256 PASS / 1 known historical REL-001 mismatch / 25 SKIP. No additional failing test.
- Identity adapter, historical migrations/verifiers, forward contracts, and strict helper remain unchanged.

## 9. Known limitations

The Production failure was NOT reproduced locally. The local trusted test factory replaces only transport with loopback/non-5432 and disables TLS; canonical startup options are preserved. This proves stock PG17 acceptance and node-postgres propagation, not Supabase-specific parameter policy, Production TLS/authentication, Supabase role topology, or Production catalog/provenance readiness. No full readiness or registration operation ran locally or in Production.

## 10. Next brief prerequisites

Review the stable bounded diagnostic candidate, then obtain Human-controlled safe Production error evidence or separate diagnostic deployment approval. Interpret `PHYSICAL_CONNECTION`, `READINESS_QUERY`, `INITIAL_IDENTITY_AUTHORITY_OPEN`, and `INITIAL_IDENTITY_READINESS` independently; do not infer a migration or secret change from the generic wrapper code. No commit, push, deployment, restart, Railway action, or Production connection was performed.
