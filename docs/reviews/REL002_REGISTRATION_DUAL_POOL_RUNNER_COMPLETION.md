# REL002 Registration Dual-Pool Runner Completion

Version: v0.1
Status: DRAFT
Date: 2026-10-13
Baseline: `67bf551f747cc3f6b6d2e86c7d9df998acf9ed01`

## 1. Objective

Implement approved dependency model C: independent runtime structural readiness and registration transaction authority. No Production access, provisioning, live registration dry-run, execution, commit or push.

## 2. Documents read

- Human brief: `APPROVE_REL002_REGISTRATION_DUAL_POOL_RUNNER_IMPLEMENTATION_RETRY`.
- [Approved forward validator completion](REL002_FORWARD_REGISTRATION_VALIDATOR_COMPLETION.md).
- Canonical registration runner, manifest parser/atomic command, forward validators, Production configuration/pool contracts and related tests.
- Test-driven development and verification-before-completion skill instructions.

## 3. Files created

- [Dual-pool composition](../../tools/production/registration-dual-pool.ts).
- [Focused tests](../../modules/identity/src/registration-dual-pool.test.ts).
- This report.

## 4. Files modified

- [Human runner](../../tools/production/register-service-workload.ts): validate both existing sealed connection configurations before opening pools; select exact forward validators and dual-pool composition; output safe counts/status only.
- [Identity atomic command](../../modules/identity/src/register-service-workload.ts): optional explicit readiness dependency, replacing the legacy authority check only when supplied, and final validation after BEGIN/advisory lock before replay inspection or writes. Existing default legacy authority and all write/replay/rollback logic remain unchanged.

## 5. Key decisions added

- Exact forward contract remains `REL002-REGISTRATION-POST-IDENTITY014-AUDIT002-V1`.
- Runtime pool authenticates as `ai_mls_production_runtime`; registration pool as `ai_mls_production_registration_operator`. Current and session identities must agree. The existing four connection/CA bindings are reused; no new secret or raw DATABASE_URL fallback.
- Runtime uses the canonical Production configuration parser/pool options; both connections require the approved direct host/database/port and certificate verification. Server observations additionally require SSL, matching database OID, server address/port, cluster start/version/database, and distinct backend PIDs. Same pool objects are rejected before registration leases are taken.
- Initial full forward structural validation completes before creating the registration pool. Fresh structural validation repeats before transaction replay inspection and any INSERT, including full R3C2, Identity provenance and five artifact bindings. Registration identity and forward topology/ACL authority are independently revalidated.
- Both runtime and registration query paths reject SET/RESET ROLE commands, including LOCAL/SESSION and batched role switching, before driver invocation.
- Dry-run composition retains REPEATABLE READ READ ONLY and models three intended writes with zero actual writes. Exact replay remains NO_OP; partial/conflicting replay remains rejected.
- EXECUTE has no default authorizer and no env/CLI approval shortcut. Trusted external composition must supply fresh Human and quiescent-window confirmation at entry and again under the existing advisory lock. No reusable readiness token is issued.
- Both original pools are independently closed in finally, even when either close fails. Cleanup failure suppresses success. Driver errors are never printed.

## 6. Open decisions

External Human execution/window authority is intentionally not supplied by this implementation. Actual registration requires a separately authorized operational phase. No execution approval is created here.

## 7. Inconsistencies found

Full regression retains the previously documented immutable REL-001 durable-release manifest fingerprint mismatch: actual `aedb6aaa7b3277125d6115ca63d7bf224895a082d3ce81791d2e22bfce701f96`, expected `7fef924f0178d732ca4a1bd4ee5c83c0eea7a5dafb8b1a2a28747784bbe5c659`. No historical hash was changed.

## 8. Validation performed

- TDD initial build failed because the new dual-pool module did not exist; implementation then passed its target/session and authorization tests.
- Focused dual-pool: 48 PASS. PG17/PG18 role-present composition and positive authority are mocked only.
- Affected registration/R3C2/forward suites: 75 PASS / 1 SKIP, independently included in final full regression.
- PG17.11 forward structural integration: 18 PASS; evidence `C:/Users/Pc/AppData/Local/Temp/rel002-forward-registration-KfIzNP/result.json`.
- PG18.4 forward structural integration: 18 PASS; evidence `C:/Users/Pc/AppData/Local/Temp/rel002-forward-registration-VIx7oq/result.json`.
- Both owned clusters stopped; no registration role was created. These real fixtures validate structure, not live dual-pool operational authority.
- Full regression: 2220 PASS / 1 previously documented historical mismatch / 25 SKIP.
- Build, typecheck, scoped lint, diff check and candidate secret-literal scan: PASS.
- 022/023, historical registration ACL/wrapper, forward validator and prior compatibility modules unchanged versus baseline.
- 022 SHA256: `52cd6a2bcfc28fe9f15b73e3e0ce94e9aad232ba936214a19a9d041a58e02a5c`.
- 023 SHA256: `46a2fc069d0bdb1b55c745c793f2f043cb6bc07f1d061a949d6889a23e6bf653`.
- Existing unrelated untracked diagnostics/evidence/reports were preserved. Only a stale generated copy of this task's relocated test was removed from ignored dist output to avoid duplicate regression execution.

## 9. Known limitations

No real dual-pool Production smoke or registration transaction was performed. Synthetic URI fixtures are in-memory only and never connect; no operational credential was created or changed. Runtime sessions must already carry the approved five artifact bindings; missing bindings fail closed rather than being fabricated by the runner.

Runtime and registration checks use separate sessions and are not one common snapshot. Final validation rejects observed changes before writes, but cannot prove that concurrent changes never happen afterward. External quiescent-window authority remains mandatory. SQL snapshot/catalog authority checks do not replace that operational constraint.

## 10. Next brief prerequisites

Review the bounded implementation candidate. Do not stage, commit, push, provision roles, execute a live dry-run or perform actual registration without the separately scoped Human/AO action. Historical evidence and authority remain immutable.

Production/Railway activity, registration provisioning, live registration dry-run, actual registration, commit and push: NONE.
