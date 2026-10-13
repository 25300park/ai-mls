# REL002 Local Target and Readiness Seam Completion

Version: v0.1
Status: DRAFT
Owner: Architecture Owner
Baseline: `979fb5cb673c60424b286fc99380f7e76e5aeba8`

## 1. Objective

Implement the approved local target-policy and readiness-only seams. This phase authorizes implementation and mocked validation only. No PostgreSQL fixture, provisioning, registration dry-run, actual registration, Production connection, Railway action, commit or push was performed.

## 2. Documents read

- Human-approved implementation brief supplied in this task.
- [Dual-pool runner completion](REL002_REGISTRATION_DUAL_POOL_RUNNER_COMPLETION.md).
- [Forward registration validator](../../apps/api/src/forward-registration-readiness.ts).
- [Existing owned fixture safety model](../../scripts/rel002-r3c1-fixture-capture.mjs).

## 3. Files created

- [Local target capability](../../scripts/rel002-local-registration-target.mjs).
- [Local target tests](../../scripts/rel002-local-registration-target.test.mjs).
- [Readiness-only tests](../../modules/identity/src/registration-operational-readiness.test.ts).
- This completion report.

## 4. Files modified

- [Dual-pool orchestration](../../tools/production/registration-dual-pool.ts): shared exact session comparison, separate borrowed-pool readiness API, independent pool cleanup helper. Production target checks and existing command boundaries remain strict.
- [Forward validator](../../apps/api/src/forward-registration-readiness.ts): bounded evidence-returning reuse; the existing void-returning API delegates to the same gates.

## 5. Key decisions added

The production runner/CLI does not import or accept the disposable capability. Only the separately called readiness API accepts a trusted target-validator dependency. Its default is PRODUCTION_STRICT; it never chooses policy from endpoint, TLS state, environment or failure.

LOCAL_OWNED_DISPOSABLE requires explicit opt-in, a trusted new-cluster creation receipt, real temporary directory checks, exact administrative data_directory verification, loopback, explicit non-5432 port, selected major 17/18, database postgres and postmaster start binding. The opaque capability is retained in a WeakMap, supports explicit revocation, and rechecks administrative identity before use. The administrative connection is harness-supplied; operational roles receive no extra catalog privilege. Local TLS policy is explicitly non-TLS on loopback only.

Production connection bindings, DATABASE_URL, inherited PG configuration and non-allowlisted environment fields are rejected. No secret values are logged or included in results.

Readiness borrows pools, releases clients, invokes the existing full R3C2/provenance/structural and forward authority gates, and returns frozen evidence. It does not construct a registration command, inspect business records, acquire an advisory mutation lock or request execution authority. Provenance is reported as its actual accepted result. Artifact and R3C2 receipts are produced only after their enforcing aggregate gate succeeds. Original driver errors are replaced with the existing safe UNAVAILABLE error.

The current runner still owns physical pools and retains fresh runtime/authority checks before inspection, external EXECUTE authorization, quiescent-window confirmation and existing atomic/replay/rollback semantics.

## 6. Open decisions

Separate approval is required for implementing/executing the future live operational fixture and its test-owned provisioning. Historical017 may be reused once locally; historical022 is not applicable to the post-Audit002 fixture. Identity015/016 remain excluded.

## 7. Inconsistencies found

Full regression retains the documented immutable REL-001 durable-release manifest mismatch: actual `aedb6aaa7b3277125d6115ca63d7bf224895a082d3ce81791d2e22bfce701f96`, expected `7fef924f0178d732ca4a1bd4ee5c83c0eea7a5dafb8b1a2a28747784bbe5c659`. It was not repaired or rebaselined.

## 8. Validation performed

- Focused readiness-only: 24 PASS.
- Local target/capability static and mocked-control tests: 12 PASS.
- Existing dual-pool: 48 PASS; selected affected forward/registration tests: 26 PASS. These compiled tests are also included in final regression.
- Final compiled regression: 2244 PASS / 1 documented historical mismatch / 25 SKIP. Disposable PostgreSQL opt-in explicitly disabled.
- Build, typecheck, scoped TypeScript lint and JavaScript syntax checks: PASS.
- Historical migrations/verifiers, legacy wrapper and previous catalog compatibility modules unchanged.
- No PostgreSQL server execution. Local capability tests used mock control clients and test-owned temporary filesystem directories only; those tests cleaned up only their own directories.

## 9. Known limitations

Operational positive cases remain mocked; no live role, membership, ACL, TLS or backend identity proof is claimed. Creation receipts, control clients and injected validators are trusted-code dependencies. The capability prevents accidental misuse; it does not defend against malicious code in the same process. The readiness-only API is not an SQL sandbox for arbitrary injected validators. Canonical validators issue read-only catalog queries. A readiness result is evidence, never a reusable execution-authority token.

## 10. Next brief prerequisites

Review this bounded implementation before commit. Obtain separate authorization for a new owned local fixture, test-owned current-forward provisioning, direct runtime/registration authentication and readiness-only capture. Stop before registration dry-run or actual registration; preserve all historical artifacts and unrelated evidence.
