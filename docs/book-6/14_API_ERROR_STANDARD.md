# API Error Standard

| 항목 | 값 |
|---|---|
| Document ID | DOC-API-015 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Security Reviewer |
| 기준일 | 2026-07-14 |

## Purpose

모든 API/job/connector가 사용하는 stable, safe, actionable error envelope와 category를 정의한다. 오류 응답은 internal stack, credential, unmasked contact/raw content 또는 provider secret을 노출하지 않는다.

## Logical Endpoints

독립 error endpoint는 없다. 모든 logical endpoint가 이 standard를 사용한다. `error_id`로 내부 incident를 상호 참조할 수 있으나 public arbitrary error lookup은 제공하지 않는다.

## Request Model

오류 발생 request는 `request_id`, `correlation_id`, authenticated context와 relevant operation precondition을 가진다. Client가 debug/stack detail level을 요청해도 authorization 없이 반환하지 않는다.

## Response Model

```text
error: {
  code, category, message,
  request_id, correlation_id,
  retryable, retry_after?,
  target?, field_errors[]?,
  current_version?, current_status?,
  error_id?, documentation_ref?
}
```

이는 documentation-only logical shape이며 JSON Schema/OpenAPI가 아니다. `message`는 안전한 human-readable summary, `code`는 stable machine contract다. Field error는 canonical field path와 reason code를 사용하고 rejected sensitive value를 echo하지 않는다.

## Error categories

| Category | Example codes | Retry posture |
|---|---|---|
| Business Errors | `STATE_TRANSITION_INVALID`, `PREREQUISITE_NOT_MET`, `EVIDENCE_INSUFFICIENT`, `VERSION_CONFLICT` | 입력/state refresh 또는 human action 후 |
| Validation Errors | `REQUEST_INVALID`, `FIELD_REQUIRED`, `REFERENCE_INVALID`, `FILTER_NOT_ALLOWED` | corrected request only |
| Authorization Errors | `AUTHENTICATION_REQUIRED`, `FORBIDDEN`, `SCOPE_DENIED`, `REAUTHENTICATION_REQUIRED` | credential/scope change only; blind retry 금지 |
| AI Errors | `AI_INPUT_NOT_ALLOWED`, `AI_RESULT_INVALID`, `AI_CONFIDENCE_REVIEW_REQUIRED`, `AI_PROVIDER_UNAVAILABLE` | policy/fallback/job guidance에 따름 |
| Publication Errors | `APPROVAL_REQUIRED`, `PUBLICATION_UNKNOWN`, `DELIVERY_FAILED`, `RECONCILIATION_REQUIRED` | false success 금지; reconcile/approved retry |
| Connector Errors | `CONNECTOR_NOT_APPROVED`, `CONTRACT_VERSION_UNSUPPORTED`, `CHECKPOINT_CONFLICT`, `BATCH_PARTIALLY_REJECTED` | item/contract-specific |
| Reliability Errors | `DEPENDENCY_UNAVAILABLE`, `RATE_LIMITED`, `TIMEOUT`, `IDEMPOTENCY_CONFLICT` | explicit retry metadata에 따름 |

## Business Rules

HTTP success 안에 hidden failure를 넣지 않는다. Batch partial acceptance는 item별 disposition과 overall non-success/partial status를 명확히 한다. Authorization denial은 resource 존재 여부를 불필요하게 유출하지 않는다. `UNKNOWN` external state는 error/recovery 상태이지 성공이 아니다.

## Authority

Domain Owner가 domain code semantics를, Architecture/Security Owner가 global namespace와 disclosure policy를 관리한다. Connector/provider message를 그대로 public code/message로 사용하지 않는다.

## Validation

등록된 category/code, status mapping, retryability, required trace IDs, safe message, field path, no sensitive echo와 current-state evidence를 검사한다. 새 stable error code는 [API Registry](16_API_REGISTRY.md) 또는 approved extension에 등록한다.

## Audit

고위험 business/authorization/publication/connector error는 error ID, internal cause reference, actor/job, target, outcome와 trace IDs를 기록한다. Repeated denial/rate/replay는 security signal로 연결한다.

## Error Conditions

이 문서 자체의 contract 위반은 `ERROR_CONTRACT_INVALID`, `ERROR_CODE_UNREGISTERED`, `SENSITIVE_ERROR_DETAIL_BLOCKED`로 내부적으로 처리하며 원래 domain failure를 숨기지 않는다.

## Related Workflow

`WF-001`–`012`; 특히 `WF-012` Exception and Recovery가 retry/escalation/closure를 소유한다.

## Related Entity

System Error, Audit Event, Status History, AI Job, Publication.

## Related AI Capability

`AI-001`–`007`의 failure를 표현하지만 error classification/authority는 `N/A — deterministic control`이다.

