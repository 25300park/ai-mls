# FEAT-015 Test Strategy

| 항목 | 값 |
|---|---|
| 버전 | v0.1 |
| 상태 | DRAFT |
| Test framework | Node.js built-in `node:test`, `node:assert/strict` |
| Execution | TypeScript build 후 `dist/**/*.test.js` 실행 |

## 1. Test Objective

`FEAT-015`가 exact current authority와 evidence 없이는 외부 효과를 만들지 않고, external outcome을 추측하지 않으며, immutable history/idempotency/classification/provenance를 보존하는지 검증한다. Test와 test fixture는 business authority를 갖지 않는다.

## 2. Test Layers

| Layer | Planned files | 핵심 검증 |
|---|---|---|
| Domain contract | `modules/publication/src/publication-contracts.test.ts` | closed vocabulary, immutable values, classification/version roles |
| Aggregate | `publication-aggregate.test.ts` | `PUB-TR-001`–`020`, suspension, materiality, lineage |
| Repository | `publication-repository.test.ts` | optimistic concurrency, append-only history, idempotency, tenant scope |
| Application/Workflow | `publication-service.test.ts` | `WF-010/011`, dispatch guard, lifecycle, exact evidence |
| Reconciliation/Recovery | `publication-reconciliation.test.ts` | `WF-012`, unknown/negative/conflicting evidence, independent resolution |
| API contract | `apps/api/src/publication-api.test.ts` | `API-014`, session Actor, safe errors, command/query and UI view boundary |
| Event | `publication-event-journal.test.ts` | `EVT-003`–`012`, identity/order/version/replay restriction |
| Projection | `listing-projection.test.ts` | `PRJ-002`, apply/drift/stale/rebuild/cutover/no-authority |
| Operations/Security | `publication-observability.test.ts` 및 service/API tests | redaction, audit, MFA/SoD, retry/recovery/incident behavior |
| Regression/Conformance | existing repository tests + architecture checksum | SP-001–008 security contracts, frozen baseline unchanged |

## 3. Canonical Acceptance Mapping

| Test ID | Measurable acceptance criteria | Planned evidence |
|---|---|---|
| `TEST-002` | non-current/non-effective Verification이면 create/dispatch/recover가 거부되고 state/decision audit가 증가하지 않음 | service/API negative tests |
| `TEST-003` | active exact `PUBLIC_PUBLICATION` Permission이 없거나 scope/audience가 다르면 거부 | service/API negative tests |
| `TEST-004` | source/provenance identity/version/classification/checksum이 Publication→Attempt→Event→Projection에서 유지 | end-to-end in-memory integration test |
| `TEST-008` | Connector/AI/Event/Projection/worker가 direct Publication transition을 호출하거나 authority를 생성할 수 없음 | compile/runtime port and authorization tests |
| `TEST-011` | Verification 생성/결정만으로 Publication이 생성·활성화되지 않음 | boundary regression |
| `TEST-012` | `CLIENT_SHARING` Permission 또는 Proposal sharing은 public publication authority가 아님 | permission/approval integration negative test |
| `TEST-023` | accepted/timeout/unknown/confirmed/negative evidence가 각각 correct state와 reconciliation을 생성 | workflow + evidence tests |
| `TEST-024` | expired/stale Verification, Permission, Approval, target/channel policy는 current command/recovery를 차단 | clock-controlled revalidation tests |
| `TEST-025` | retry는 safe policy/idempotency를 따르고 recovery/replay는 current authorization을 재검사하며 side effect를 재생하지 않음 | failure/recovery tests |
| `TEST-033` | API-013 effective Approval과 API-014 delivery/reconciliation/lifecycle ownership이 분리 | API composition/integration regression |
| `TEST-049` | audit/log/event/incident evidence는 complete, immutable, redacted하며 secret/contact data 0 | security/observability tests |

## 4. Mandatory Scenario Matrix

### Positive

- exact current binding으로 `READY → EXECUTION_PENDING → ACTIVE`.
- confirmed withdrawal로 `ACTIVE → WITHDRAWAL_PENDING → WITHDRAWN`.
- same-intent republish는 새 Approval/authorization/command/attempt를 사용.
- non-material correction은 같은 Publication의 새 append-only version.
- independent resolver가 sufficient evidence로 reconciliation을 종료.
- `PRJ-002`가 event sequence를 적용하고 deterministic rebuild 후 동일 결과 생성.

### Negative

- missing/stale Verification, Permission, Approval, representation checksum, target/channel/policy version.
- requester/approver/executor, executor/evidence submitter/resolver conflict와 role stacking.
- human MFA/reason 누락, stale/inactive session, wrong purpose/team.
- AI, connector, projection, event, generic service 또는 scheduler의 business decision 시도.
- material correction을 in-place mutation으로 처리하는 시도.
- client-share Permission을 public Permission으로 사용하는 시도.
- restricted contact/credential/raw payload가 error/log/audit details에 포함되는 시도.

### Boundary and Concurrency

- `expiresAt` 직전/동일/직후.
- expected aggregate version N/N-1/N+1.
- same idempotency key + same fingerprint versus changed fingerprint.
- same external observation ID, duplicated callback, missing sequence, out-of-order event.
- candidate current flag/successor transition, target/channel status flip, policy version flip.
- maximum safe retry count, deadline equality, suspension/resume/recovery 경계.

### Failure and Recovery

- connector rejected, timed out, returned malformed/ambiguous receipt, delayed callback.
- command intent persisted 후 dispatch 전 failure, dispatch 후 confirmation 전 failure.
- external object exists but local outcome unknown; external object absent; conflicting observations.
- replay/rebuild 중 event gap/checksum/classification drift.
- recovery Actor authorization revoked between incident and replay.

## 5. Security Assertions

- authorization result는 default deny이고 UI allowed action과 독립적으로 server에서 검사한다.
- Actor는 request body가 아니라 session에서 파생한다.
- privileged human command는 MFA와 documented reason을 요구한다.
- audit event는 actor, target/version, action, purpose, policy version, outcome, timestamp, correlation을 가진다.
- denied command는 state transition, delivery attempt 또는 decision event를 만들지 않는다. Denial audit는 policy에 따라 별도로 남긴다.
- audit/event/history는 append-only이며 correction은 원본을 참조하는 새 record다.
- classification은 source 중 최고 등급을 상속하며 projection/event에서 낮아지지 않는다.
- safe error는 stable code와 generic message만 반환한다.
- external connector는 credential reference만 받고 credential value를 domain payload에 포함하지 않는다.

## 6. Event and Projection Assertions

- Event ID는 immutable하고 aggregate ID/version/sequence/timestamp/schema/contract version을 가진다.
- aggregate-local sequence는 단조 증가하며 global ordering을 가정하지 않는다.
- replay는 Approval, Publication command, external effect 또는 notification을 생성하지 않는다.
- projection record는 source aggregate/event/projection versions와 rebuild generation을 기록한다.
- duplicate event는 idempotent, gap/out-of-order/checksum/classification drift는 fail closed한다.
- rebuild는 isolated generation에서 검증 후 atomic cutover하며 current aggregate를 변경하지 않는다.

## 7. Execution Gates

구현 중 task-level:

```powershell
pnpm build
node --test dist/modules/publication/src/<target>.test.js
pnpm lint
pnpm typecheck
```

Sprint completion:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify
gitleaks detect --source . --config .gitleaks.toml --redact
pnpm audit
```

Expected result:

- exit code `0` for every mandatory command.
- test failure `0`, mandatory skip `0`.
- lint warning/error `0`.
- actual secret `0`, unexplained finding `0`.
- known dependency vulnerability `0`.
- frozen architecture checksum unchanged.

## 8. Evidence Policy

구현 완료 evidence는 command, UTC timestamp, tool/runtime version, exit code, pass/fail/skip count, failing test/error code, commit hash를 기록한다. Planning 문서의 mapping은 runtime PASS evidence가 아니며, 실제 결과가 생성되기 전 상태는 `PENDING`으로 유지한다.

## 9. Stop Conditions During Implementation

- canonical lifecycle/authority/ID 변경 필요.
- production external effect에 durable idempotency/evidence guarantee를 제공할 수 없음.
- required security test를 통과시키기 위해 guard를 약화해야 함.
- actual/unexplained secret 또는 해결 불가능한 vulnerability 발견.
- P0/P1 defect, baseline checksum mismatch 또는 FEAT-016+ dependency 발생.

## 10. Related Documents

- [Implementation Plan](FEAT015_IMPLEMENTATION_PLAN.md)
- [Traceability Matrix](FEAT015_TRACEABILITY_MATRIX.md)
- [Task Breakdown](FEAT015_TASK_BREAKDOWN.md)
- [Deferred Decisions](FEAT015_DEFERRED_DECISIONS.md)
- [Phase 13-1 Report](../reviews/PHASE13_1_IMPLEMENTATION_PLANNING_REPORT.md)
