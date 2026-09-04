# F18-C Durable Connector Lease / Invocation / Checkpoint Foundation Implementation Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-103 |
| Historical Artifact ID | DOC-REV-F18-C-001 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Development Owner |
| 기준일 | 2026-09-01 |
| Brief | F18-C — Durable Connector Lease / Invocation / Checkpoint Foundation |

## 1. Objective

F18-B의 authoritative admission을 보존하면서 Connector lease, invocation intent/history, `EXECUTION_STARTED`, idempotency, normalized technical result/evidence 및 checkpoint를 Node.js built-in `node:sqlite`에 durable하게 저장하는 최소 bounded foundation을 구현했다.

**Final Recommendation:** `APPROVE_F18_C_DURABLE_CONNECTOR_FOUNDATION`

## 2. Documents read

- `docs/implementation/F17_C_DURABLE_PUBLICATION_EXECUTION_DESIGN.md`
- `modules/publication/src/publication-unit-of-work.ts`
- `modules/publication/src/publication-durable-persistence.ts`
- `modules/administration/src/administration-durable-persistence.ts`
- `docs/reviews/F18_SOURCE_CONNECTOR_RUNTIME_INVENTORY_GAP_REPORT.md`
- `docs/reviews/F18_B_SOURCE_INGESTION_ADMISSION_BOUNDARY_COMPLETION.md`
- F18-C current implementation Brief

## 3. Files created

- `modules/source/src/connector-durable-persistence.ts`
- `modules/source/src/connector-durable-persistence.test.ts`
- `modules/source/src/connector-invocation-port.ts`
- `modules/source/src/connector-execution-coordinator.ts`
- `modules/source/src/connector-execution-coordinator.test.ts`
- `docs/superpowers/plans/2026-09-01-f18-c-durable-connector-foundation.md`
- `docs/reviews/F18_C_DURABLE_CONNECTOR_FOUNDATION_IMPLEMENTATION_REPORT.md`

## 4. Files modified

- `modules/source/src/index.ts`: Connector persistence, invocation port 및 coordinator export만 추가했다.

F18-A/F18-B에서 보존 중인 기존 미커밋 파일은 reset, restore 또는 discard하지 않았다.

## 5. Key decisions added

- **Durable Lease: PASS.** Exact tenant/scope/source/connector binding, owner, acquire/expiry/status/version을 저장한다. Active scope conflict, explicit release, expiry 및 reacquire를 검증했다.
- **Durable Invocation: PASS.** Stable invocation identity, lease, idempotency key, input fingerprint/reference/version, Source policy version 및 Connector version을 저장한다.
- **Durable Idempotency: PASS.** Same key/same fingerprint는 durable prior result를 replay하고 connector invocation을 반복하지 않는다. Same key/different fingerprint는 `IDEMPOTENCY_CONFLICT`로 fail closed한다.
- **Durable Checkpoint: PASS.** Authoritative `SUCCEEDED` 결과에서만 expected-version CAS로 advance한다. Failed 및 ambiguous execution의 advance count는 0이다.
- **Ordering: PASS.** Durable intent commit → durable `EXECUTION_STARTED` claim → injected Connector invocation → local atomic result/evidence/idempotency/checkpoint commit 순서를 실행 중 assertion으로 검증했다.
- **Restart Preservation: PASS.** Lease, intent, result, idempotency, checkpoint 및 evidence가 close/reopen 후 보존된다.
- **`EXECUTION_STARTED` Ambiguity: PASS.** Receipt/result가 없는 started invocation은 reopen 후 `AMBIGUOUS` 및 `RECONCILIATION_REQUIRED`로만 노출된다.
- **Blind Rerun Paths: 0.** Same invocation replay 및 restart ambiguity 모두 connector reinvocation 0을 assertion으로 검증했다.
- **F18-B Admission Preservation: PASS.** Coordinator는 caller-authored decision을 받지 않고 injected `SourceIngestionAdmissionGate.evaluate()`를 직접 호출한다. `BLOCKED`이면 lease/invocation/checkpoint/evidence/call이 모두 0이다.
- **Bounded ownership: PASS.** Connector 전용 bounded UoW가 기존 F16/F17 SQLite durability pattern을 재사용하며 API-014/015 store 또는 공용 generic persistence subsystem을 만들지 않는다.

## 6. Open decisions

- **OPEN DECISION:** F18-D에서 API-018 Runtime/Host/HTTP composition과 production database path injection을 별도로 승인해야 한다.
- **OPEN DECISION:** F18-E에서 실제 connector/provider contract, destination policy, credential model 및 provider-specific sanitization을 별도로 결정해야 한다.
- **POST-MVP / F19:** `AMBIGUOUS` outcome의 reconciliation resolution은 구현하지 않았다.

## 7. Inconsistencies found

- Canonical ownership 충돌, 새 API operation 필요, 새 Source lifecycle state 필요 또는 기존 API-014/API-015 ownership 변경 필요는 발견되지 않았다.
- pnpm wrapper는 isolated worktree에서 dependency 상태 검사를 시도하며 비승인 registry 접근이 필요했다. 설치/네트워크를 사용하지 않고 현재 main workspace의 동일 승인 Node/TypeScript/ESLint toolchain을 직접 사용했다. Manifest와 lockfile은 변경되지 않았다.

## 8. Validation performed

| 검증 | 결과 |
|---|---|
| Focused F18-C | 15/15 PASS |
| F18-B + affected Source/Authorization/API | 49/49 PASS |
| Full regression | 854/854 PASS |
| Lint | PASS |
| Typecheck | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Dependency / Lockfile Changes | 0 |
| Provider / Network / Credentials | 0 |
| Checkpoint Advance on Failed Execution | 0 |
| Checkpoint Advance on Ambiguous Execution | 0 |
| Production Process-local Authority | 0 |
| Real Provider Activation | 0 |

Dependency audit는 F18-C 범위에서 필요하지 않았고 별도 network 승인을 요청하거나 실행하지 않았다.

## 9. Known limitations

- API-018 Runtime/Host/HTTP는 `NOT_STARTED`이다.
- API-019 expansion은 `NOT_STARTED`이다.
- F19 reconciliation은 `NOT_STARTED`이다.
- 실제 provider/connector, credential, destination/network activation은 0이다.
- Production composition은 F18-D 범위이므로 이 단계에서는 process-local production authority를 등록하지 않았다.

## 10. Next brief prerequisites

- Architecture Owner가 본 F18-C evidence를 검토하고 승인해야 한다.
- F18-D는 별도 승인 전 시작하지 않는다.
- Main workspace: `clean`
- Isolated worktree: F18-A/B/C review change set 때문에 의도적으로 `dirty`
- Commit: `NOT_CREATED`
- Push: `NOT_PERFORMED`
- Unresolved Blockers: `0`
