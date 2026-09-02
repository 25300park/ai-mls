# F18-F Restart / Idempotency / Ambiguity Hardening Design

| 항목 | 값 |
|---|---|
| Version | v0.1 |
| Status | APPROVED |
| Baseline | `66ca4633323866a440faac00a6157082702cab5d` |
| Branch | `codex/f18-f-restart-idempotency-hardening` |
| Scope | F18-F only |

## 1. 목적

F18-B/C/D/E에서 구현한 Connector, API-018 및 API-019 durable boundary가 process restart, exact replay, conflicting replay, crash window와 ambiguous outcome에서 기존 canonical authority를 유지하도록 검증하고 보강한다. 새로운 business semantics, recovery workflow 또는 provider capability는 추가하지 않는다.

## 2. 승인된 canonical principle

`ACCESS TO PRIOR HISTORY != AUTHORITY TO EXECUTE AGAIN`을 적용한다.

- Exact replay는 새로운 execution request가 아니다.
- Prior durable result를 반환하기 전 Application의 authenticated/trusted actor or job identity, tenant, scope/team visibility 및 concealment 검사는 반드시 통과해야 한다.
- Exact replay에는 current Source/Connector live execution admission을 다시 사용하지 않는다.
- New invocation identity에만 F18-B current live admission을 적용한다.
- Durable `EXECUTION_STARTED` without authoritative final result는 restart 후에도 `AMBIGUOUS / RECONCILIATION_REQUIRED`이며 blind rerun하지 않는다.
- Replay는 lease를 갱신하거나 checkpoint를 다시 advance하거나 Source/Connector를 reactivate하지 않는다.

## 3. Hardening inventory

| Path | Durable authority | Current coverage | Exact gap / action |
|---|---|---|---|
| Source admission | Current Source/Connector snapshots and Authorization decision | Blocked admission creates zero effects | New execution revalidation regression을 restart context에서 보강 |
| Connector lease | `connector_leases`, scope revision | Reopen persistence, conflict, release, expiry | Reopen 후 expiry/conflict/history 보존 matrix 보강 |
| Invocation intent | `connector_invocations: PREPARED` and evidence sequence 1 | Intent persistence covered | Crash window B를 명시적으로 검증 |
| Execution started | `raw_state=EXECUTION_STARTED`, evidence sequence 2 | Restart projects `AMBIGUOUS`; zero blind resend covered | Live admission drift 상태의 exact ambiguous replay가 현재 ordering에서 blocked되는 defect |
| Final result | `connector_results`, invocation terminal state | Durable result and append-only coverage | Live admission drift 상태의 exact completed replay가 현재 ordering에서 blocked되는 defect |
| Invocation idempotency | `connector_idempotency` | Same-process replay and restart conflict covered | Trusted-access-preserving replay-before-admission ordering 필요 |
| Checkpoint | `connector_checkpoints` | Atomic success, failure/ambiguity no-advance | Completed replay after reopen duplicate advance 0 및 crash window D 보강 |
| API-018 technical records | Durable technical state/idempotency/evidence | Closed HTTP and durable record tests | HTTP restart/retry matrix 보강 |
| API-019 mapping | `ext_mappings`, append-only conflict evidence | Stable mapping/conflict covered | Mapping/conflict evidence reopen continuity 보강 |
| Provider observation | `ext_observations`, `ext_idempotency` | Restart replay/conflict covered | API-018 → API-019 composed restart replay 보강 |
| Integration Contract | `ext_contracts` | Suspension survives reopen | Both compositions reopen 후 suspended ingress containment 보강 |
| Technical reconciliation | `ext_evidence`, idempotency | Business binding unchanged | Reopen 후 proof/history and F19 handoff preservation 보강 |
| Safe response/evidence | Closed parser and safe DTO reconstruction | Unsafe input/result tests covered | Reopened durable records의 safe DTO projection 보강 |
| Process-local authority | Production compositions inject durable UoWs | No F18 production Map/Set authority found | Architecture assertion으로 count 0 고정 |

## 4. 선택한 접근

기존 coordinator와 durable stores를 재사용하는 최소 hardening을 선택한다.

검토한 대안:

1. **Selected — replay/new-execution split in the existing coordinator.** 기존 Application access boundary와 UoW를 유지하며 ordering defect만 수정한다.
2. **Rejected — tests only.** 승인된 replay ordering defect를 해결하지 못한다.
3. **Rejected — separate recovery/replay orchestrator.** 새 subsystem과 F19 semantics를 암묵적으로 도입한다.

## 5. Execution ordering

```text
Application trusted access / isolation / concealment
→ durable idempotency lookup
   ├─ exact replay
   │  → prior authoritative final result or durable AMBIGUOUS
   │  → connector / lease / checkpoint / execution mutation = 0
   ├─ conflicting invocation identity or fingerprint
   │  → IDEMPOTENCY_CONFLICT
   │  → connector / mutation = 0
   └─ no prior invocation identity
      → current F18-B live admission
      → lease
      → durable intent
      → EXECUTION_STARTED
      → connector
      → atomic durable result / evidence / checkpoint
```

Application의 existing session-derived authentication, tenant/scope/body binding, authorizer 및 concealment가 durable history access를 보호한다. Coordinator는 이 검사를 복제하거나 새로운 authorization engine을 만들지 않는다.

## 6. Production change boundary

초기 production 변경은 `modules/source/src/connector-execution-coordinator.ts`의 ordering에만 제한한다.

- Existing trusted `admissionInput`에서 durable lookup scope를 구성한다.
- Existing `findIdempotency()`와 `findInvocation()`을 재사용한다.
- Exact match면 `resultFrom()`으로 반환한다.
- `invocationId` 또는 fingerprint mismatch면 existing `IDEMPOTENCY_CONFLICT`를 사용한다.
- Prior identity가 없을 때만 `SourceIngestionAdmissionGate.evaluate()`를 호출한다.

다른 production 파일은 RED test가 별도의 concrete invariant defect를 입증할 때만 최소 수정한다. Schema, API operation, lifecycle vocabulary와 persistence architecture는 변경하지 않는다.

## 7. Failure and crash-window behavior

| Window | Required behavior |
|---|---|
| Before durable intent | Connector call 0; authoritative execution record 0 |
| After intent, before `EXECUTION_STARTED` | Intent preserved; no blind execution; current admission is required for any separately authorized new execution |
| After `EXECUTION_STARTED`, before result | Durable `AMBIGUOUS`; replay call 0; checkpoint unchanged |
| After connector response, before local commit | Transaction failure leaves `EXECUTION_STARTED`; restart returns `AMBIGUOUS`; no blind rerun |
| After durable success | Exact replay returns prior result; connector call 0; checkpoint duplicate advance 0 |
| After checkpoint commit | Checkpoint/version survives restart |

External connector call과 SQLite transaction을 atomic으로 표현하지 않는다. Ambiguous external effect는 F19 handoff 대상이며 F18-F가 해소하지 않는다.

## 8. Test design

TDD는 다음 순서를 사용한다.

1. Exact completed replay + current admission blocked → prior result, call 0.
2. Exact ambiguous replay + current admission blocked → `AMBIGUOUS`, call 0.
3. Conflicting fingerprint → `IDEMPOTENCY_CONFLICT`, call 0.
4. Wrong tenant/scope through Application boundary → concealed/forbidden, prior result not exposed.
5. New invocation + blocked admission → `BLOCKED`, call 0.
6. New invocation + eligible admission → normal path.
7. Lease, crash windows, checkpoint atomicity/restart matrix.
8. API-018 HTTP replay/restart matrix.
9. API-019 mapping, observation, suspension, conflict evidence and reconciliation restart matrix.
10. Reopened safe DTO and process-local authority architecture assertions.

각 test는 먼저 기존 코드에서 실행한다. Expected RED가 확인된 defect만 production correction으로 전환한다. 이미 invariant를 만족하는 test는 coverage evidence로 기록하며 speculative source change를 만들지 않는다.

## 9. Verification

Credit-efficient order:

1. F18-F focused tests
2. F18-C durability regression
3. F18-D API-018 regression
4. F18-E API-019 regression
5. F18-B admission regression
6. ambiguity/restart matrix
7. affected F17 regression
8. affected regression
9. full suite once
10. lint, typecheck, build, verify
11. Architecture checksum, `git diff --check`, Gitleaks

Dependency audit은 F18-F-scoped network approval 전에는 실행하지 않는다.

## 10. Explicit exclusions

- New API-018/API-019 operation: 0
- New schema or persistence subsystem: 0
- New lifecycle or mapping state: 0
- Business reconciliation or recovery: 0
- Real connector/provider/network/credentials: 0
- API-014/API-015 ownership changes: 0
- F18-G/F18-H/F19 implementation: 0

## 11. Completion evidence

완료 시 `docs/reviews/F18_F_RESTART_IDEMPOTENCY_AMBIGUITY_HARDENING_IMPLEMENTATION_REPORT.md`에 focused/affected/full verification, architecture/security gates, source/main/worktree 상태와 unresolved blocker를 기록한다. Commit과 push는 별도 Architecture Owner 승인 전까지 생성하거나 수행하지 않는다.
