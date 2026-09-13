# REL-001 Phase 1G-B Audit Dependency Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-077 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Audit Owner / Domain Owners |

API-016 owns durable Audit semantics. Existing synchronous `AuditSink.append()` calls prove required audit interaction but cannot participate in a not-yet-defined durable Core store transaction. A Core store must not copy API-016 tables or invent distributed transactions.

| Store | Required evidence relationship | Current boundary | Classification | Atomicity result |
|---|---|---|---|---|
| Source Registry | proposal/version/history/audit | mutation then process-bound AuditSink | `API016_RUNTIME_DEPENDENCY` | `BLOCKED_AUDIT_ATOMICITY` |
| Intake | state/attachment/review/job-request evidence | mutation then process-bound AuditSink; API-017 separate | `API016_RUNTIME_DEPENDENCY` | `BLOCKED_AUDIT_ATOMICITY` |
| Property | lineage/before-after/audit | mutation then process-bound AuditSink | `API016_RUNTIME_DEPENDENCY` | `BLOCKED_AUDIT_ATOMICITY` |
| Listing | state/history/provenance/decision evidence | mutation then process-bound AuditSink | `API016_RUNTIME_DEPENDENCY` | `BLOCKED_AUDIT_ATOMICITY` |
| Contact | privacy/disclosure/purpose/communication evidence | mutation then process-bound AuditSink | `API016_RUNTIME_DEPENDENCY` | `BLOCKED_AUDIT_ATOMICITY` |
| Client / Requirement | consent/access/revision/job evidence | mutation then process-bound AuditSink; API-017 separate | `API016_RUNTIME_DEPENDENCY` | `BLOCKED_AUDIT_ATOMICITY` |
| Matching | input/ranking/review/stale evidence | mutation then process-bound AuditSink; API-017 separate | `API016_RUNTIME_DEPENDENCY` | `BLOCKED_AUDIT_ATOMICITY` |

## Result

- `API016_RUNTIME_DEPENDENCY`: `7` stores.
- `BLOCKED_AUDIT_ATOMICITY`: `7` stores.
- API-016 implementation, duplicated audit logic and cross-domain/distributed transaction semantics: `0`.

## Phase 1G-C disposition

위 수치는 Phase 1G-B 당시 판정이다. [DOC-DEV-081](REL001_PHASE1GC_AUDIT_ATOMICITY_DECISION.md)의 후속 승인으로 current audit relationship은 resolved `7/7`, blocked atomicity `0`이다. Core는 immutable intent만 owner-local transaction에 기록하며 final Event는 API-016이 소유한다.
