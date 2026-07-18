# UI State Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-UI-015 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Development Reviewer |
| 기준일 | 2026-07-14 |

## Purpose

view rendering/interaction state와 canonical business lifecycle를 분리하여 loading, error, draft와 approval 상태가 authority로 오해되지 않도록 한다.

## UI state namespace

| UI state | Meaning | Allowed transition trigger |
|---|---|---|
| `UI_STATE.INITIAL` | screen context 미해결 | navigation/auth context established |
| `UI_STATE.LOADING` | API response 대기 | success/error/cancel |
| `UI_STATE.EMPTY` | successful authorized query에 표시할 item 없음 | filter/data refresh |
| `UI_STATE.READY` | current response 표시 가능 | edit/action/refresh |
| `UI_STATE.EDITING` | local unsaved changes 존재 | save/discard/conflict |
| `UI_STATE.SUBMITTING` | write acknowledgement 대기 | accepted/success/error/unknown |
| `UI_STATE.REVIEW_REQUIRED` | human review task 표시 | owning API disposition |
| `UI_STATE.APPROVAL_PENDING` | 별도 human approval 결과 대기 표시 | approve/reject/revoke or stale transition |
| `UI_STATE.COMPLETED` | 현재 UI task의 server-confirmed terminal outcome 표시 | navigate/reopen/new task; business state는 별도 |
| `UI_STATE.CONFLICT` | expected/current version 불일치 | compare/reload/reapply |
| `UI_STATE.ERROR` | recoverable/non-recoverable error 표시 | retry/navigation/escalation |
| `UI_STATE.READ_ONLY` | view allowed, mutation 불가 | authorization/state/context change |

## Separation from business state

`UI_STATE.*`는 persistence, workflow gate, authority, audit 또는 API response canonical status가 아니다. 예를 들어 `UI_STATE.READY`인 Publication도 `PUBLICATION.UNKNOWN`일 수 있고, `UI_STATE.REVIEW_REQUIRED`, `UI_STATE.APPROVAL_PENDING`, `UI_STATE.COMPLETED`가 Verification/Permission/Approval/Publication을 부여하지 않는다. 화면은 항상 canonical `AGGREGATE.STATUS`를 별도 표시한다.

## Async state

API acknowledgement와 business completion을 구분한다.

`SUBMITTING → accepted/queued → job running → terminal result → human/reconciliation result`

각 단계는 API-017 또는 domain API의 evidence를 사용한다. tab close/network loss 시 success를 추정하지 않고 idempotency/correlation으로 상태를 조회한다.

## State ownership

Client는 presentation state만 소유한다. Canonical state는 owning API/entity, authorization은 API-002, AI status는 AI Job/Result, external publication state는 API-014 reconciliation evidence가 소유한다.
