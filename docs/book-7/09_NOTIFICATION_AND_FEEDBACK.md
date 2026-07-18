# Notification and Feedback

| 항목 | 값 |
|---|---|
| Document ID | DOC-UI-010 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner / Security Reviewer |
| 기준일 | 2026-07-14 |

## Purpose

사용자 action, assigned task, warning, approval, job와 external reconciliation 결과를 적시에 전달하되 authority나 성공을 과장하지 않는 feedback 원칙을 정의한다.

## Feedback classes

| Class | Example | Persistence | Rule |
|---|---|---|---|
| Inline | field validation, disabled reason | context lifetime | action 가까이 구체적으로 표시 |
| Transient | draft saved, copy complete | short | critical decision evidence로 사용 금지 |
| Task | assigned review, reverify request | until disposition | source object/workflow/API link 필수 |
| Warning | expiring authority, stale version | until resolved/expired | consequence와 owner 표시 |
| Critical | publication unknown, security/operational exception | governed acknowledgement | System Error/Audit evidence와 recovery link |
| Completion | API operation accepted/finished | evidence dependent | accepted, running, succeeded, reconciled를 구분 |

## Required scenarios

- **Success:** server-confirmed result, affected object/status와 next step을 표시한다.
- **Warning:** stale/expiring/partial condition과 consequence, owner, action deadline을 표시한다.
- **Error:** safe cause category, retained user input, retryability와 correlation ID를 표시한다.
- **Background job:** queued/running/terminal 상태와 API-017 result link를 구분한다.
- **Approval:** request, approved, rejected, revoked를 exact subject/version 및 authority와 연결한다.
- **Review:** assignment, requested evidence와 human disposition을 approval과 구분한다.
- **AI recommendation:** capability, advisory label, confidence/limitation와 human review action을 표시한다.

## Delivery and privacy

UI-037은 source entity를 복제하지 않는 scoped projection이다. Notification은 최소 정보만 포함하고 restricted contact/raw content/credential을 포함하지 않는다. Recipient scope가 변경되면 access를 재평가하며 deep link에서도 API-002를 검사한다.

## Async and AI feedback

Queued/accepted는 완료가 아니다. Job status는 API-017, external result는 API-014/018/019 reconciliation evidence를 사용한다. AI result notification은 capability, advisory label, validation/review 필요와 limitation을 표시하며 verified/approved로 표현하지 않는다.

## User control

Read/acknowledge와 business disposition은 별개다. Preference는 informational notification에 적용할 수 있지만 mandatory security, approval, expiration와 exception evidence를 제거하지 않는다. Exact channel/frequency는 `OPEN DECISION`이며 Phase 8에서 구현하지 않는다.
