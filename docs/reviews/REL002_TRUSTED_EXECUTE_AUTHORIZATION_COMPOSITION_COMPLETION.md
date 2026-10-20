# REL002 trusted one-shot registration EXECUTE composition

Status: IN REVIEW. Version: v0.1. Baseline: `737f957b631cdfcfbf266790f11afa5ed728e48d`.

## 1. Objective

Implement the Human-approved exact-scope wrapper without executing Production registration. Implementation readiness does not authorize future execution.

## 2. Documents read

- [Development operating principles](../governance/AI_MLS_DEVELOPMENT_OPERATING_PRINCIPLES.md).
- [Canonical manifest](../implementation/REL002_R3G1B4_PRODUCTION_WORKLOAD_REGISTRATION_MANIFEST.json).
- Current Human design approval and attached work package.
- Existing canonical runner, dual-pool orchestration, Identity command, Audit participant, pinned-workload diagnostic, and directly related tests.

## 3. Files created

- `scripts/rel002-production-workload-registration-execute.mjs`
- `scripts/rel002-production-workload-registration-execute.test.mjs`
- This completion report.

## 4. Files modified

None. Generic CLI, dependency factory, Identity/Audit transactions, manifest, historical artifacts and previous diagnostics remain unchanged. Existing unrelated untracked files are preserved.

## 5. Key decisions added

The wrapper accepts no CLI arguments. It fixes the manifest absolute path relative to its own module location, not the shell working directory. SHA256 is pinned to `557e11e6c1846e02a26e7fee748028d12f662b7bf13634ca3ccad3df4dc594a1`; byte changes, including line-ending changes, fail closed. The full parsed manifest tuple is independently pinned.

Only this wrapper consumes `REL002_REGISTRATION_HUMAN_AUTHORIZED=YES` and `REL002_REGISTRATION_QUIESCENT_WINDOW_CONFIRMED=YES`. They are non-secret Human assertions, not authentication credentials or reusable generic CLI authority. Production credentials still use the existing canonical private environment bindings. DATABASE_URL and local target overrides are rejected.

The injected callback permits exactly two successful calls, named `BEFORE_POOLS` and `IN_TRANSACTION_BEFORE_INSPECTION`. Both re-read/check manifest bytes and tuple, compare the callback's complete manifest argument, and recheck both confirmations. A denied call poisons that invocation; additional calls are rejected. Existing dual-pool call sites enforce the actual ordering. Reports are held until the canonical runner, including cleanup, returns successfully and both checkpoints have completed. No automatic retry is introduced.

## 6. Open decisions

Actual Production registration remains unauthorized. Human must separately approve execution and confirm a quiescent window. No pre-execution catalog query was run.

## 7. Inconsistencies found

None in the approved boundary. Generic CLI `--execute` remains unauthorized because its default dependencies intentionally have no callback; only this bounded composition supplies one.

## 8. Validation performed

- TDD: initial missing-module failure, then 25 focused tests PASS.
- Injected dependencies/pools only. Real dual-pool orchestration tested for wrong-scope rejection before pool creation and second-checkpoint denial inside the transaction, rollback before inspection/writes, and both pool closures.
- Negative coverage: missing/blank/incorrect/partial Human assertions, ID/version/tenant/purpose/extra-field drift, wrong manifest bytes, changed file at second checkpoint, withdrawn confirmation, third callback, incomplete callback sequence, unsafe premature output, and forbidden target overrides.
- Affected registration/dual-pool/operational-readiness/pool tests: 95 PASS, including unchanged dry-run behavior and default factory without execute authorization.
- Build PASS; typecheck PASS; scoped lint PASS; secret scan PASS; `git diff --check` PASS. New files also checked for whitespace errors.
- Generic runner, dual-pool implementation, Identity command, and manifest have no diff against HEAD.

## 9. Known limitations

No live DB, credential, catalog, transaction or registration verification was performed. Local assertions cannot establish current Production absence or quiescence. Two callback invocations are distinguished by the canonical runner's unchanged call order, not a new generic checkpoint API. This is a one-invocation composition, not a persistent approval service.

The three inserts remain in one transaction: registered workload, immutable Identity evidence, final Audit event. Exact replay is NO_OP/0 writes; conflicting/partial evidence rejects. Normal pre-COMMIT failure rolls back. COMMIT acknowledgement failure has UNKNOWN outcome; cleanup failure can occur after successful COMMIT. Any failed invocation requires durable-state inspection before retry, never automatic retry.

## 10. Next brief prerequisites

### Pre-execution Human gate

Require a reviewed committed source boundary and fresh strict-readiness/dry-run evidence appropriate to the execution window. Repeat the previously supplied SELECT-only catalog check. Require all five counts to be zero: `target_registration_count`, `version_1_count`, `tenant_principal_registration_count`, `identity_evidence_count`, `audit_evidence_count`. Any nonzero count stops first-creation execution for reconciliation. Do not rerun migrations or provision roles.

### Proposed future invocation — NOT EXECUTED; separate execution approval required

Use Node 24.18.0, current compiled build, the existing private canonical Production environment, and no DATABASE_URL/local overrides. Never print the private environment.

```powershell
Set-Location 'D:\04. AI-MLS\.worktrees\rel002-r3c2-runtime-startup'
$env:REL002_REGISTRATION_HUMAN_AUTHORIZED = 'YES'
$env:REL002_REGISTRATION_QUIESCENT_WINDOW_CONFIRMED = 'YES'
try {
  node scripts/rel002-production-workload-registration-execute.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Execution unsuccessful; inspect durable state before retry.' }
} finally {
  Remove-Item Env:REL002_REGISTRATION_HUMAN_AUTHORIZED -ErrorAction SilentlyContinue
  Remove-Item Env:REL002_REGISTRATION_QUIESCENT_WINDOW_CONFIRMED -ErrorAction SilentlyContinue
}
```

Expected first-creation receipt: command REGISTER_SERVICE_WORKLOAD, mode EXECUTE, result CREATED, DRY_RUN NOT_REQUESTED, EXPECTED_WRITES 3, ACTUAL_WRITES 3, executionRole ai_mls_production_registration_operator. A NO_OP receipt requires reconciliation rather than claiming first creation.

### Prepared post-registration read-only verification

1. Repeat the bounded five-count check; each count must be one. This includes the registration-ID count and tenant/principal count, rejecting extra matching registrations/versions. Do not assert global table counts; unrelated legitimate records are outside this scope.
2. Under runtime authority, run the existing [pinned-workload diagnostic](../diagnostics/REL002_PINNED_WORKLOAD_READ_ONLY_DIAGNOSTIC.sql). Require all presence/version/purpose/audience/ACTIVE SERVICE WORKLOAD and evidence checks to pass.
3. Compare all three scoped records to the manifest: exact registration ID/version, tenant/principal, purpose/audience, SERVICE/WORKLOAD/PRODUCTION/ACTIVE, evidence references; registration created_at=updated_at; Identity schema_version=1/immutable=true and complete tuple; Audit source IDENTITY, aggregate REGISTERED_SERVICE_WORKLOAD, event REGISTERED_SERVICE_WORKLOAD.REGISTERED, version 1, payload_schema_version=1, final=true, exact tenant/scope and expected payload. Audit occurred_at must equal registration created_at; materialized_at must be valid and not precede occurred_at. No unrelated application rows need be exposed.
4. Resolve the exact version-1 pin using the canonical runtime `PostgreSqlRegisteredServiceWorkloadStore.findByRegistrationId()` path with its existing durable evidence verifier and startup purpose/audience/version acceptance. A SELECT-only metadata diagnostic is supplemental and is not a substitute for this runtime evidence verification. No listener start, deployment, registration reexecution or mutation is authorized by this verification plan.

Stop after reporting; no Production connection, mutation, dry-run, actual registration, deployment, commit or push occurred.
