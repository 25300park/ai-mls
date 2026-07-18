# Audit and History Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-DATA-013 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security/Privacy Reviewer |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Purpose

important action, status transition, decision, approval와 user/job activity를 재구성할 수 있는 append-oriented evidence model을 정의한다. audit/history는 current business record와 application debug log를 대체하지 않는다.

## Entities

| Entity | Purpose | Minimum logical content | Authority |
|---|---|---|---|
| Audit Event | security/business action evidence | event ID/type, actor or job, target type/ID, action, time, result, reason/context, correlation, policy/version | Security/Governance Owner |
| Status History | entity lifecycle transition evidence | entity/version, prior/new state, transition, actor/job, occurred/effective time, reason, precondition result | owning domain + Audit |
| Decision History | human/governance/business disposition | decision type, subject/version, alternatives/context ref, decision, rationale, decision maker, time, supersession | Decision Owner |
| Approval History | approval/rejection/revocation evidence | approval type, exact subject/representation version, approver scope, result, time, rationale, expiry/revocation | Approval Owner |
| User Action | authenticated interaction of audit interest | principal/session context, action category, target, outcome, authorization decision ref | Security Owner |

## Events requiring audit

- authentication success/failure, role/team/permission assignment and revocation
- restricted contact/raw/client access, unmask, export and bulk search
- source policy change, intake, correction, merge/split and duplicate disposition
- AI Job submission/result validation/manual correction
- verification, permission, approval, publication/correction/withdrawal
- retention, legal hold, deletion, archive, recovery and failed jobs
- configuration, integration target and emergency/break-glass action

## Immutability and correction

- existing event meaning is not edited. correction appends a correcting event that references the incorrect event.
- append-oriented does not mean infinite retention; approved retention/archive and legal hold apply.
- tamper evidence, access segregation and external archive choices are physical/security design decisions.
- event time, ingestion time and source-reported time are distinguished where needed.

## Actor model

Actor can be User, authorized service/job or external principal reference. AI model/provider is processing context, not human approver. events record effective role/team/scope where authorization meaning depends on it. shared/unknown actors are prohibited for important actions except explicitly classified external evidence.

## Before/after and payload minimization

- before/after may be field delta, version reference or approved snapshot depending risk.
- secret, raw personal content and full message bodies are not copied by default.
- reason codes use controlled vocabulary plus optional restricted explanation.
- correlation links request, job, decision, publication attempt and error without becoming a public identifier.

## History consistency

- current status must be explainable by ordered valid transitions.
- Status History records attempted/denied transition separately from successful state change.
- Decision History does not replace [Decision Register](../00_DECISION_REGISTER.md); project decisions link to DEC/ADR.
- Approval History distinguishes record verification, data-use permission and publication approval.

## Constraints and capabilities

- `DB-004`: important state is reconstructable from authoritative record plus history.
- `DB-009`: restricted/privileged action has audit evidence.
- audit write failure for publication/privilege/high-risk change fails closed per [Failure Isolation](../book-2/08_FAILURE_ISOLATION.md).
- audit record access/export is itself auditable.

## Retention and privacy

event category별 purpose, minimum period, access class, archive and deletion/pseudonymization policy가 필요하다. personal identifiers may be pseudonymized when accountability purpose permits; legal hold/dispute may suspend deletion without widening access.

> **OPEN DECISION:** audit event taxonomy, exact retention, tamper-evidence mechanism, time synchronization tolerance and field-delta policy.

