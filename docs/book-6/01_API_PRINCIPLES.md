# API Principles

| 항목 | 값 |
|---|---|
| Document ID | DOC-API-002 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Security Reviewer |
| 기준일 | 2026-07-14 |

## Purpose

모든 synchronous API, asynchronous command와 connector contract가 따라야 할 logical conventions를 정의한다. 구체적인 serialization schema와 framework는 범위 밖이다.

## REST conventions and logical endpoints

- Resource-oriented nouns, standard HTTP semantics와 explicit action subresources를 사용한다.
- Read는 safe/idempotent, replace/update는 preconditioned, create/action command는 idempotency policy를 명시한다.
- Logical examples: `GET /v{major}/candidates/{id}`, `POST /v{major}/verifications`, `POST /v{major}/publication-approvals/{id}:decide`.
- Action route는 approval, reconcile, withdraw처럼 단순 CRUD로 의미가 사라지는 workflow command에만 사용한다.
- Status code는 transport outcome이고 business status를 대체하지 않는다.

## Request Model

| Concern | Required logical field/rule |
|---|---|
| Identity | authenticated principal/session/service context; body-supplied actor는 authority 근거가 아님 |
| Trace | `request_id`, `correlation_id`; write에는 `reason`과 source channel |
| Concurrency | update/transition에는 `expected_version` 또는 동등 precondition |
| Retry | retryable write에는 client-scoped `idempotency_key` |
| Time | RFC 3339 UTC boundary representation; business timezone은 별도 context |
| Content | declared version/media contract; unknown critical fields fail validation |

## Response Model

성공 envelope는 resource 또는 command result, canonical ID/version/status, `request_id`, `correlation_id`와 relevant links를 반환한다. 비동기 접수는 `job_id`와 accepted status만 반환하며 완료를 주장하지 않는다. 오류는 [API Error Standard](14_API_ERROR_STANDARD.md)를 따른다.

## Pagination, filtering and sorting

- Collection은 opaque cursor pagination을 기본으로 하고 stable deterministic sort를 사용한다.
- `limit`은 server maximum 이하이며 cursor는 query/filter/sort scope에 묶인다.
- filter/sort allowlist만 허용한다. contact/raw/audit field는 권한과 masking 정책을 별도 적용한다.
- page의 결과는 snapshot consistency level과 `next_cursor`를 표현한다. total count는 보장하지 않으며 제공 시 계산 시점을 표시한다.

## Versioning

Major version은 public contract boundary에 표시하고 additive compatible change는 같은 major에서 허용한다. breaking change, deprecation과 support window는 [API Versioning](15_API_VERSIONING.md)을 따른다.

## Idempotency and identifiers

`request_id`는 한 수신 시도, `correlation_id`는 end-to-end workflow chain, `idempotency_key`는 동일 의도 write의 중복 억제를 뜻한다. 같은 key와 다른 normalized intent는 conflict다. opaque IDs만 API identity로 사용하며 display label이나 external reference를 canonical ID로 간주하지 않는다.

## Business Rules and Authority

API는 [State Transition Rules](../book-5/14_STATE_TRANSITION_RULES.md)의 edge와 guard를 추가하거나 약화하지 않는다. Authentication은 identity만, Authorization은 현재 action/resource/scope allow/deny만 제공한다. human approval endpoint는 verified human principal과 해당 scoped role을 요구하고 AI/service/connector principal을 거부한다.

## Validation

Validation order는 authentication → authorization → contract → identifier/reference → current version/state → business invariant → privacy/data minimization → idempotency → operation acceptance다. 고위험 write는 audit persistence 또는 동등한 fail-closed evidence precondition을 충족해야 한다.

## Audit

모든 write, restricted read, authorization denial, approval, export, connector/job command는 actor, session/service, action, target/version, decision, reason, time, request/correlation/idempotency IDs와 outcome을 기록한다. secret/token/raw sensitive payload는 audit에 복제하지 않는다.

## Error Conditions

validation, authorization, state conflict, stale version, idempotency conflict, rate/size limit, dependency, AI, publication 및 connector 오류는 stable code와 retryability를 갖는다. 내부 stack/provider secret은 노출하지 않는다.

## Related Workflow / Entity / AI Capability

- Workflow: `WF-001`–`012` — all API calls inherit relevant workflow guard.
- Entity: all Book 3 entities; resource별 domain API가 owner다.
- AI: `AI-001`–`007` where declared; otherwise `N/A — deterministic application control`.

