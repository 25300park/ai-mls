# REL-001 Phase 4C Application Service Traceability

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-194 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / AI Reviewer / API Owner |
| 기준일 | 2026-09-15 |

## 1. Static execution paths

| Job type | Handler | Application port/service | Capability/schema | 검증 evidence |
|---|---|---|---|---|
| `AI_LISTING_PARSE` | `Ai001ListingParseJobHandler` | `Ai001ListingParseApplicationPort` / `Ai001ListingParseApplicationService` | `AI-001` / listing-parser v0.1 | `advisory-job-integration.test.ts` |
| `AI_REQUIREMENT_PARSE` | `Ai004RequirementParseJobHandler` | `Ai004RequirementParseApplicationPort` / `Ai004RequirementParseApplicationService` | `AI-004` / requirement-parser v0.1 | same |
| `AI_MATCHING` | `Ai005MatchingJobHandler` | `Ai005MatchingApplicationPort` / `Ai005MatchingApplicationService` | `AI-005` / matching-result v0.1 | same |

## 2. Boundary preservation

API-017 runtime은 durable Job의 tenant/scope, immutable input reference, correlation 및 initiating-principal evidence를 `JobExecutionContext`에 복사한다. 각 handler는 한 capability-specific port만 보유하며 provider/model/prompt/credential을 선택하지 않는다. Application service는 승인된 capability/prompt/version binding과 기존 `AdvisoryRuntime`을 사용하고 canonical validator를 통과한 advisory reference/checksum/evidence만 반환한다.

Provider success는 `reviewRequired=true`, `authority=ADVISORY`를 변경하지 않는다. Domain mutation, business approval, generic capability selector, service locator 및 current Session reconstruction은 `0`이다.

## 3. Failure and replay

Provider/runtime unavailable은 기존 Job `DEPENDENCY_UNAVAILABLE`, invalid canonical output은 `JOB_RESULT_INVALID`로만 정규화된다. Raw provider exception은 API-017로 전달되지 않는다. 동일 Job/attempt identity replay는 기존 durable advisory idempotency 결과를 반환하며 provider 재호출은 `0`이다.
