# REL-001 Phase 4B Timeout / Retry / Fallback Decisions

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-179 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | AI Reviewer / Operations Owner |
| 기준일 | 2026-09-15 |

## 1. Separation

Provider invocation timeout/retry/fallback는 API-017 Job lifecycle와 별도다. Existing `RetryAsSuccessor` remains `MANUAL ONLY / NO_FINITE_MAX_REQUIRED`; it cannot authorize an in-call provider retry.

## 2. Decision matrix

| Decision | Canonical evidence | Result |
|---|---|---|
| provider timeout owner | FEAT-022 provider/runtime owner | CLOSED |
| exact timeout value | no approved numeric value | `OWNER_DECISION_REQUIRED` |
| common vs capability-specific | no approved choice | `OWNER_DECISION_REQUIRED` |
| provider retry allowed | Book 4 permits only safe bounded retry conceptually; REL-001 rule absent | `OWNER_DECISION_REQUIRED` |
| maximum attempts | no approved value | `OWNER_DECISION_REQUIRED` |
| retryable failures/backoff | no approved classification or delay | `OWNER_DECISION_REQUIRED` |
| provider/model fallback | no approved compatible provider/model set | `OWNER_DECISION_REQUIRED` |

`NONE` is the recommended conservative retry/fallback disposition for REL-001 if the owner determines these features are unnecessary. It is not recorded as approved because no owner decision supplies that value.

## 3. Timeout failure boundary

Until an exact timeout is approved, no provider invocation may begin. If a later approved adapter times out, the adapter must discard raw diagnostics and return FEAT-022's existing safe unavailable failure; the Job layer may receive only the existing safe mapping.

## 4. Disposition

- provider timeout: `OWNER_DECISION_REQUIRED`
- provider retry/fallback: `OWNER_DECISION_REQUIRED`
- automatic API-017 retry: `0`
- Production implementation authorization: `NO`
