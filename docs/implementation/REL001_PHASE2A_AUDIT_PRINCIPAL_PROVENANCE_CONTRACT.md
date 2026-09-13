# REL-001 Phase 2A Audit Principal Provenance Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-110 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security/Governance Owner / Audit Owner |
| 기준 commit | `e5a2cfc9a17cdb20c0c3db1e79e3184e7a09052f` |

## 1. Authority boundary

`actorId` is an immutable subject locator, not sufficient principal provenance. Caller-authored actor, principal type, role, capability, team, Session or MFA claims are never authoritative. String shape must not distinguish HUMAN from SERVICE.

## 2. Required trusted provenance

A materializable intent must bind an immutable trusted provenance reference that can establish, at the mutation chronology:

- principal ID and `HUMAN | SERVICE` type;
- bounded role/team/assignment evidence required by the existing `AuditPrincipal` contract;
- Session reference when applicable;
- tenant/scope and source evidence identity.

Resolution must use durable Identity/Authorization evidence, not process-local state or current caller input. Live state may govern access to the event but cannot rewrite historical principal truth.

## 3. Fail-closed cases

Missing provenance, actor mismatch, conflicting tenant/scope, unprovable principal type or unresolvable immutable evidence reference rejects materialization without changing the source intent or final store.

## 4. Closure status

The trust rule is resolved, but the seven current Phase 1G intent shapes contain only `actorId` and no universally sufficient immutable principal evidence binding. Principal provenance is therefore `BLOCKED` pending an Audit/Security Owner-approved source-intent extension or existing authoritative evidence mapping for every producer.
