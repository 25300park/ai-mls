# Error and Empty State

| 항목 | 값 |
|---|---|
| Document ID | DOC-UI-014 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Security Reviewer |
| 기준일 | 2026-07-14 |

## Purpose

[API Error Standard](../book-6/14_API_ERROR_STANDARD.md)을 사용자가 안전하게 이해하고 복구할 수 있는 UI state로 변환하고, legitimate empty state와 failure를 구분한다.

## Error mapping

| API error class | UI behavior | Recovery |
|---|---|---|
| Validation | field + summary에 safe detail | 입력 수정 후 새 request |
| Authentication | draft 보호 후 sign-in/reauth | API-001; 이전 write 성공 추정 금지 |
| Authorization | prohibited action 제거/deny 설명 | scope/owner 문의; existence leakage 금지 |
| Conflict/stale version | current vs attempted version 표시 | reload/compare/reapply; silent overwrite 금지 |
| Workflow/business | failed prerequisite와 canonical state 표시 | owning workflow task로 이동 |
| AI | advisory unavailable/invalid 표시 | manual/deterministic fallback; authority 영향 없음 |
| Publication/connector | accepted, unknown, failed, reconciled 구분 | API-014/018/019 evidence와 exception flow |
| System | safe message, retryability, correlation ID | retry only when declared; UI-033 escalation |

## Empty states

| Empty type | Meaning | Required content |
|---|---|---|
| First use | 아직 object/task 없음 | purpose와 authorized create/import action |
| No match | query/filter 결과 없음 | active filters, clear/refine action |
| No assignment | scoped queue에 assigned task 없음 | scope/refresh time; 전체 system empty로 표현 금지 |
| Restricted | content 접근 불가 | generic safe explanation; count/identity 비노출 |
| Not applicable | object에 해당 section 없음 | N/A reason, workflow condition |
| Unavailable | dependency/service failure | last known freshness, retry/escalation |

## Mandatory domain states

- **No results:** successful query와 active filters를 표시하고 clear/refine action을 제공한다.
- **No permission:** generic denied state와 legitimate access request/escalation 경로를 제공하되 object existence를 누설하지 않는다.
- **AI unavailable:** manual/deterministic fallback을 제공하고 canonical data/authority를 변경하지 않는다.
- **Publication blocked:** failed Verification/Permission/Approval/freshness prerequisite와 owning workflow link를 표시하며 bypass action을 제공하지 않는다.
- **Validation error:** field와 summary를 연결하고 user input을 보존한다.
- **System error:** safe message, retryability, correlation ID와 UI-033 escalation을 제공한다.

## Safety rules

Client validation과 optimistic UI만으로 write success를 선언하지 않는다. Retry는 idempotency/retryability metadata를 따르고 duplicate decision을 만들지 않는다. Raw exception, stack trace, credential, personal contact 또는 provider payload를 사용자 message에 노출하지 않는다. Correlation ID는 support/audit용으로 제공한다.
