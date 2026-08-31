# F17-F Failure / Retry Eligibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 기존 retry policy를 durable execution history 및 현재 authorization에 연결한다.

**Architecture:** 기존 Publication UoW의 execution journal, audit, idempotency와 retry-result contract를 재사용한다. 새 provider/recovery authority를 만들지 않으며 승인된 retry policy 부재는 NOT_ALLOWED이다.

**Tech Stack:** Node.js 24.18.0, pnpm 11.9.0, TypeScript, node:test, 기존 node:sqlite adapter.

**Spec:** Architecture Owner의 F17-F Minimal Implementation Design approval 및 `650befcd-030e-4ab9-b354-c1069f5f300d/pasted-text.txt` Brief.

## Global Constraints

- Main baseline `12c39db5ee41230d748fec24d2771458884fa088`; main untouched.
- 새 API ID/operation, lifecycle state, authority, provider contract, database subsystem 금지.
- UNKNOWN 또는 DISPATCH_STARTED/no receipt는 retry 차단; 이전 attempts/receipts는 immutable.
- 기존 5/5 retry baseline evidence 유지. Full suite는 최종 gate 한 번만 실행.
- F17-F audit 전 별도 network 승인 필요. 한 개 local commit만 허용, push 금지.
- F17-H/F18/F19/F20/F21 NOT_STARTED.

## Inventory / Gap Matrix

| Canonical source | Current implementation | Durable | Executable | Gap / minimum correction |
|---|---|---|---|---|
| DEC-035/107; operations retry contract | `PublicationOperationsRetryPolicy` | No: decision Map | 내부 decide 가능 | durable authority adapter로 현재 history 파생; generic memory cache는 production 권한 근거 제외 |
| Existing result contract | `publication-operations-contracts.ts:145` | decision 비영속 | 5종 결과 존재 | vocabulary 유지 |
| F17-F approved no-policy rule | request count/limit/failure 입력 | No | generic policy 사용 | approved server policy와 durable count만 사용, policy 없으면 NOT_ALLOWED |
| F17-C design §8 | execution journal / durable SQLite | Yes | intent/receipt/disposition read | retry resolver 연결 |
| DEC-105/106; FCR-002/008 | authorization guard / effective approval | current resolver | 기존 checks 실행 | retry 직전 live checks 재사용, old eligibility 재사용 금지 |
| DEC-101/108 | service UNKNOWN → reconciliation | Yes | service containment 있음 | retry 판정에도 suspension/ambiguity 우선 적용 |
| DEC-107/111 | aggregate duplicate attempt guard / idempotency | Yes | existing publish | retry new identity / replay prior result 구별, policy 없는 new retry 차단 |
| F17-E approved normalization | provider normalized result + safe evidence | receipt Yes | service 실행 | 12종 내부 failure 구분 및 safe audit evidence 연결 |
| OPS-032 / F19 boundary | legacy recovery services | mixed | 기존 경로 유지 | F19 workflow 변경 없음 |

## Task 1: Normalized failure boundary

Files: create `modules/publication/src/publication-execution-failure.ts` and `.test.ts`.
Consumes: safe error code or normalized receipt/outcome facts. Produces: `classifyPublicationExecutionFailure(input)` with closed internal categories, no business state/authority.

- [x] RED table: explicit codes and confirmed rejection differ from ambiguous timeout; unknown raw error cannot be reflected.
  ```ts
  assert.equal(classify({ code: "AUTHENTICATION_REQUIRED" }), "AUTHORIZATION_FAILURE");
  assert.equal(classify({ outcome: "UNKNOWN", code: "ETIMEDOUT" }), "AMBIGUOUS_EXTERNAL_OUTCOME");
  ```
- [x] Build then focused node:test; prove missing classifier assertion RED.
- [x] Add deterministic closed classification; focused GREEN.

## Task 2: Durable retry basis / evidence

Files: existing `publication-observability.ts`, `publication-operations-contracts.ts`, `publication-audit-store.ts`; bounded adapter/tests under `modules/publication/src/` if needed.
Consumes: existing UoW/repository/journal and current approved retry policy. Produces: existing 5-value retry decision and append-only safe audit/idempotency evidence in the same UoW.

- [x] RED restart tests: caller count/limit/failure cannot override durable latest receipt; no-policy/rejected/unknown deny; attempt history and evidence survive reopen.
  ```ts
  assert.equal(decision.decision, "NOT_ALLOWED");
  assert.deepEqual(reopened.repository.find(identity)?.attempts, originalAttempts);
  ```
- [x] RED idempotency/version/restart gaps 후 atomicity regression; real durable adapter와 명시적 fault injection/concurrency 사용, alternate mocked store 없음.
- [x] Minimal adapter and evidence validation; GREEN. No second DB/store.

## Task 3: Live execution integration

Files: `publication-service.ts`, `publication-infrastructure.ts`, configuration and directly affected tests.
Consumes: Task 2 decision with current snapshot and existing authorization/effective approval.
Produces: existing publish path with retry guard; no new HTTP operation.

- [x] RED no-policy second attempt, stale authority and reused identity; GREEN regressions cover approval/target/tenant/scope/MFA/SoD and ambiguity after restart.
  ```ts
  assert.equal(providerCalls, 1); // initial dispatch only; blocked retry adds none
  assert.deepEqual(receiptsAfter, receiptsBefore);
  ```
- [x] Minimal existing application integration, current version/revalidation immediately before dispatch; GREEN.
- [x] Approved-policy test-only scenario validates new attempt and immutable previous receipt; production provider remains unavailable.

## Task 4: Final gates / report

- [x] Focused, F17-C/D/E and affected Publication regression: 203/203.
- [x] Final `pnpm.cmd --config.verify-deps-before-run=false --config.update-notifier=false run verify`: PASS, 828/828. Initial full gate 827/828 exposed missing layer inventory; targeted correction verified before necessary final rerun.
- [x] Architecture checksum 153/153, Gitleaks 0, diff check, fresh independent review 0/0/0 READY.
- [x] F17-F audit network approval 후 production/full audit 완료: production 0, 기존 승인 dev-only High 4, 신규 미승인 High/Critical 0.
- [x] Report actual evidence and bounded RTM update; 승인된 단일 local commit으로 보존하고 clean 확인 후 STOP.

## Execution record

- Worktree created on approved base, existing dependencies reused without install.
- Inventory reused from read-only review; original retry baseline 5/5 PASS.
- Tasks are tightly coupled through the existing Publication UoW; execute inline to avoid overlapping source edits. Independent review remains a separate final gate.
- Final local gate와 승인된 audit evidence는 [F17-F Report](../reviews/F17_F_FAILURE_RETRY_ELIGIBILITY_IMPLEMENTATION_REPORT.md)에 기록했다. Main 변경·push·다음 phase 실행은 하지 않는다.
