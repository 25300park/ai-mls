# REL-001 Phase 1G-A Transaction / Evidence Boundary Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-072 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Data Owner / Audit Owner |
| 기준 commit | `e2ef82655b3dc8f1ebadbdc2512f9e8492ea0059` |

## 1. Transaction rule

각 store는 자기 aggregate state/history/idempotency만 원자적으로 소유한다. API-016 audit authority 또는 API-017 job truth를 복제하지 않으며 cross-owner atomicity를 주장하지 않는다. 현재 domain services의 `AuditSink.append()`는 durable domain transaction과 결합되어 있지 않으므로 구현 prerequisite가 남는다.

## 2. Boundary matrix

| Store | Owner-local atomic unit already required | Append-only evidence/history | External boundary | Unresolved point | Result |
|---|---|---|---|---|---|
| Source Registry | proposal + policy version/history + command idempotency | proposal/read/policy-handoff evidence | API-016 audit | durable state와 audit reference의 failure ordering | `AUDIT_DEPENDENCY_BLOCKED` |
| Intake | intake mutation + attachments/history + local idempotency | provenance/review/job-request evidence | Raw Source owner, API-017, API-016 | cross-owner refs와 audit append의 durable failure ordering | `AUDIT_DEPENDENCY_BLOCKED` |
| Property | node/alias mutation + lineage/history + local idempotency | before/after and correction lineage | API-016 audit | absent correction-proposal shape; audit linkage ordering | `AUDIT_DEPENDENCY_BLOCKED` |
| Listing | Candidate/Offer/Duplicate mutation + history + local idempotency | provenance and duplicate decisions | Intake/Property refs, API-016 | linked-candidate updates and audit linkage atomicity | `AUDIT_DEPENDENCY_BLOCKED` |
| Contact | privacy mutation + history/DNC + local idempotency | disclosure/purpose/communication evidence | API-016 audit | protected channel material boundary and audit linkage ordering | `AUDIT_DEPENDENCY_BLOCKED` |
| Client / Requirement | Client or Requirement mutation + revision history + local idempotency | consent/access/revision provenance | API-017 handoff, API-016 | audit linkage ordering; job truth remains external | `AUDIT_DEPENDENCY_BLOCKED` |
| Matching | run/results or result mutation + history + local idempotency | exact input/ranking/review/stale evidence | API-017 execution, API-016 | audit linkage ordering; job truth remains external | `AUDIT_DEPENDENCY_BLOCKED` |

## 3. Fail-closed outcome

- Partial authoritative state is prohibited.
- Audit rows cannot be copied into a generic Core database to close atomicity.
- API-017 handoff operations remain deferred.
- Cross-domain transaction blocker count is `0`: no cross-domain atomic transaction is authorized. Instead, unresolved external audit linkage blocks all seven stores.

## 4. Phase 1G-C reconciliation

[DOC-DEV-081](REL001_PHASE1GC_AUDIT_ATOMICITY_DECISION.md)이 owner-local mutation + history/idempotency + immutable audit intent의 single local transaction을 승인했다. API-016 final Event ownership과 no-distributed-transaction 원칙은 유지된다. Current audit relationship disposition은 resolved `7/7`, blocked audit atomicity `0`이다.
