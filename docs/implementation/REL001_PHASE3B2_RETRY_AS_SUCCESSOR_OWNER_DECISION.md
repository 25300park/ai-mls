# REL-001 Phase 3B.2 RetryAsSuccessor Owner Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-143 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / Operations Owner / Domain Owners |
| 기준일 | 2026-09-14 |
| Decision | `NO_FINITE_MAX_REQUIRED` |

## 1. AO decision

Manual `RetryAsSuccessor`는 finite numeric ceiling을 요구하지 않는다. `RETRY_NUMERIC_DECISION=CLOSED`다.

이 결정은 generic retry-all, automatic retry, scheduler, delay, backoff 또는 retry loop를 승인하지 않는다. Future automatic retry는 exact attempt ceiling, delay/backoff, policy owner와 scheduling semantics를 별도 amendment로 승인해야 한다.

## 2. Mandatory eligibility

매 successor command는 다음을 모두 current authoritative state에서 다시 검사한다.

- predecessor is exactly `FAILED`
- safe normalized classification is `DEPENDENCY_UNAVAILABLE`
- predecessor/result/evidence and input binding are unchanged
- current initiating principal authority
- tenant/scope/purpose and concealment
- applicable MFA/SoD/approval where owning workflow requires them
- input/reference/version/checksum freshness
- deadline and downstream current eligibility
- expected predecessor version
- same authorization/idempotency replay conflict

하나라도 실패하면 successor creation, audit intent와 downstream invocation은 모두 `0`이다.

## 3. Lineage and replay

- Each accepted retry creates a distinct immutable successor `jobId`.
- Predecessor remains `FAILED` and is never reopened or overwritten.
- Same retry command identity + same canonical fingerprint returns the same successor.
- Same command identity + different fingerprint returns `IDEMPOTENCY_CONFLICT`.
- A predecessor has at most one successor per accepted authorization identity.
- A later retry requires a new authorization identity against the current failed successor.
- A completed successful Job cannot be retried or reopened.

An unbounded theoretical lineage does not authorize an execution loop: every edge requires a separate human/control authorization and live eligibility. Operations policy may disable manual retry for a job type without changing this identity rule.

## 4. Audit

The event records the failed predecessor, new successor, retry authorization, eligibility decision, initiating principal and applicable approval reference. It never models retry as mutation of the predecessor. Exact replay creates zero duplicate successor and zero duplicate final event.

## 5. Result

| Metric | Result |
|---|---|
| retry numeric unresolved | `0` |
| automatic retry | `0 / NOT_AUTHORIZED` |
| scheduler | `0` |
| retry loop | `0` |
| delay/backoff | `NOT_APPLICABLE` |
| predecessor reopening | `0` |
