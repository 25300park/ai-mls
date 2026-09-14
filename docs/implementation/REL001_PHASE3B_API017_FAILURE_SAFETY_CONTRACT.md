# REL-001 Phase 3B API-017 실패 안전성 계약 검토

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-133 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security Owner / Audit Owner / API Owner |
| 기준일 | 2026-09-14 |
| 기준 commit | `7f7661d791c6268204f2453f6a500e0553cbfab7` |

## 1. 결론

`FAILURE_REFERENCE_SAFETY=BLOCKED`다. Phase 3A의 `NOT_PROVEN`은 보존된 과거 관찰이고, 이번 `BLOCKED`는 안전한 정확한 표현을 정본에서 도출하지 못했기 때문에 내리는 구현 gate 판정이다. 코드가 수정되거나 안전성 검증에 통과한 것이 아니다. `P3A-GAP-013=OPEN DECISION`이다.

## 2. 실제 전달 경로

[JobApi](../../apps/api/src/job-api.ts) 52–55행은 caller의 `failureCode`를 전달한다. [JobService](../../modules/jobs/src/job-service.ts) 279–311행은 상태·worker·version·권한을 검사하지만 실패 문자열 내용에는 `trim().length === 0` 검사만 한다. `trim()` 결과를 저장하는 normalization도 아니다.

같은 입력이 `BackgroundJob.failureCode`와 `SystemErrorReference.code`에 저장되고, 311행의 audit reason 및 495–535행의 `#record()` details에 도달할 수 있다. 현재 저장소는 volatile Map이지만, 이를 그대로 durable 저장으로 옮기면 안전하지 않은 값도 영속화될 수 있다. 실제 durable failure store가 이미 있다는 뜻은 아니다.

`retryableFailureCodes.includes()`는 retry 가능 분류를 계산할 뿐 실패값 allowlist 검증이 아니다. `SystemErrorReference`라는 type 이름, generated ID, category 또는 shared error boundary도 저장값·audit reason의 안전성을 증명하지 않는다.

## 3. 금지 정보별 증명 상태

대상은 최종 persisted 데이터와 runtime-visible DTO, 감사 reason/details, result/failure projection 전체다. [Background Job Contracts](../book-6/11_BACKGROUND_JOB_CONTRACTS.md) Request Model/Audit, [Admin and Audit API](../book-6/10_ADMIN_AND_AUDIT_API.md) Response Model, [Phase 2 최종 RTM](REL001_PHASE2_API016_FINAL_TRACEABILITY_MATRIX.md) §3의 안전 원칙을 적용한다. API-016의 기존 여섯 source 안전성은 API-017의 안전성을 증명하지 않는다.

| 금지 정보 | 현재 검사의 한계 | 증명 상태 |
|---|---|---|
| raw exception | nonblank 문자열이면 내용 차단 근거 없음 | `NOT_PROVEN` |
| SQL/database diagnostic | 승인 vocabulary·diagnostic 제거 규칙 없음 | `NOT_PROVEN` |
| filesystem path | path 검증/제거 근거 없음 | `NOT_PROVEN` |
| credential/token | secret 탐지·allowlist·redaction 근거 없음 | `NOT_PROVEN` |
| provider response | arbitrary provider 내용 차단 근거 없음 | `NOT_PROVEN` |
| prompt/chain-of-thought | 내용 복제·노출을 차단하는 exact 표현 없음 | `NOT_PROVEN` |
| arbitrary stack trace | 구조·길이·내용 제한 근거 없음 | `NOT_PROVEN` |

민감한 예시 문자열을 문서나 fixture에 기록하지 않는다.

## 4. 종결에 필요한 owner 결정

| 요구 | 현재 값/상태 | 승인·검증에 필요한 사항 |
|---|---|---|
| safe failure vocabulary | `UNRESOLVED` | 허용 failure code의 정확한 의미·source; error condition 목록을 자동 채택하지 않음 |
| exact safe representation | `UNRESOLVED` | 불변 참조와 허용 field의 정확한 계약; ID 생성 정책 발명 금지 |
| normalization | `NOT_PROVEN` | 승인된 정규화 방법과 적용 순서 |
| allowlist | `NOT_PROVEN` | 알 수 없는 값의 fail-closed 처리와 허용 vocabulary |
| bounds | `UNRESOLVED` | field/내용 한계값의 승인 source; 숫자 기본값 발명 금지 |
| redaction | `NOT_PROVEN` | 금지 정보가 저장·조회·감사에 도달하지 않음의 근거 |
| audit projection | `UNRESOLVED` | approved intent/event tuple과 reason/details 허용 표현 |
| retry classification | `UNRESOLVED` | 안전 표현과 별개인 retry eligibility 정책; 자동 retry 불허 |

미정인 실패값을 raw fallback, 임의 문자열 치환 또는 새로운 error code로 저장하지 않는다. 표현 계약이 닫히지 않은 runtime mutation/projection 경로는 `BLOCKED`로 남긴다. 이번 단계는 구현·테스트 변경 없이 차단을 기록한다.

## 5. 향후 증명 경계

별도 구현 승인 뒤 negative test는 금지 정보가 caller→job state→durable reopen→API DTO→audit intent→final event의 어느 경계에도 남지 않는지 검증해야 한다. unknown/oversized/malformed 값과 중첩 payload, 안전하지 않은 reason/details도 포함해야 한다. 이는 향후 검증 요구이며 이번에 테스트를 실행했거나 안전성 통과를 주장하는 문장이 아니다.

## 6. 연계

[결정 검토](REL001_PHASE3B_API017_CANONICAL_DECISION_CLOSURE.md) §2 `B-E01/07/09/10/12` · [Operation 준비도](REL001_PHASE3B_API017_OPERATION_READINESS_MATRIX.md) · [감사 매핑](REL001_PHASE3B_API017_AUDIT_MAPPING_MATRIX.md) · [Handler/Worker](REL001_PHASE3B_API017_HANDLER_WORKER_COMPOSITION_DECISION.md) · [DRAFT RTM](REL001_PHASE3_API017_TRACEABILITY_MATRIX.md) · [보고서](../reviews/REL001_PHASE3B_API017_CANONICAL_CLOSURE_REPORT.md)
