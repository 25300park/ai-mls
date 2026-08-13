# FEAT-016 Implementation Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-017 |
| 버전 | v0.1 |
| 상태 | DRAFT |
| 범위 | `EPIC-008` / `FEAT-016` / `DEV-016` / `IMP-016` |
| 기준 | Architecture Bible v1.1 + `DEC-114` / `CR-026` |
| Execution status | `PARTIALLY_IMPLEMENTED_BASELINE` |

## 1. Status reconciliation

Frozen Feature/Developer/Implementation Registry의 primary row `PLANNED`는 logical planning identity를 보존한다. 실행 evidence는 post-freeze overlay와 이 문서가 관리한다.

- SP-001 Role Assignment subset과 해당 test evidence는 유효하다.
- SP-001은 FEAT-016 전체 completion evidence가 아니다.
- FEAT-016은 incomplete이며 `IMPLEMENTED`, `VERIFIED` 또는 `CLOSED`가 아니다.
- 이후 구현은 현재 Role Assignment baseline을 보존하고 확장한다.

## 2. End-to-end trace

| Requirement | Decision | Workflow | Entity / Scope | API / UI | Security | Tests | Status |
|---|---|---|---|---|---|---|---|
| `REQ-CONST-006` | `DEC-076/078/082/114` | `WF-012`, cross-cutting `WF-001–012` | Decision History, administration change evidence | `API-015/016`; `UI-006/036` | `SEC-021/022/026` | `TEST-005/034/053` | PARTIAL BASELINE |
| `REQ-CONST-007` | `DEC-114`; ADR-007 | `WF-001–012` | proposal, approval/rejection, activation, revocation, denial, privileged read evidence | `API-015/016`; `UI-006/036` | `SEC-007/021–023` | `TEST-005/034/037/048/053` | PARTIAL BASELINE |
| `REQ-CONST-010` | `DEC-053/114`; ADR-003 | `WF-001–012` | User, Role, Role Assignment, Team/scope, governed policy state | `API-002/015/016`; `UI-006/036` | `SEC-001–010/033` | `TEST-005/034/048/053` | PARTIAL BASELINE |

Canonical chain:

`Project Constitution → CR-026 → DEC-114/DT-114 → EPIC-008 → FEAT-016 → DEV-016 → IMP-016 → API-015 → UI-006/UI-036 → SEC controls → TEST evidence`

## 3. Canonical ownership

FEAT-016 owns governed administration for:

- User/identity administration references;
- Role and Role Assignment;
- Team/organizational scope;
- Policy administration;
- Source Registry governance state;
- Publication Target governance state;
- Decision History and administration evidence.

Source Registry scope is limited to governance status, policy, proposal lifecycle, review, approval, activation, pause/block/retire where canonically applicable, version, reason and evidence. It excludes ingestion, crawler, parser and connector execution. FEAT-004/API-003 owns approved-policy read and non-authoritative source candidate submission handoff only; the candidate cannot activate policy and all governance decisions remain FEAT-016/API-015 authority.

Publication Target scope is limited to target governance policy, proposal, review, approval and administrative state. It excludes Publication Aggregate/lifecycle/execution, connector dispatch, external-effect confirmation, reconciliation/recovery, FEAT-015 Event Journal and PRJ-002 mutation.

Retention Policy and Legal Hold remain Privacy/Data Governance/Legal/Security authority. Any future API-015 delegation requires an explicit grant from that owning authority and is not core FEAT-016 scope.

## 4. API-015 completion boundary

FEAT-016 completion requires closed operation families for:

1. Role Assignment reads, proposal, independent approval/activation and revocation;
2. Role and Policy reads and governed change lifecycle;
3. Team/organizational scope reads and governed change where canonically required;
4. Source Registry governance reads and administrative policy/status transition;
5. Publication Target governance reads and administrative policy/status transition;
6. administration Decision/evidence references and API-016 history linkage.

Detailed request/response schema, exact operation names and safe error contracts belong to `F16-PHASE-5 — API-015 Closed Contracts`.

## 5. Approval and delegation invariant

Privileged change activation follows:

`proposal → independent review → authorization revalidation → approval → atomic activation`

Mandatory checks are current Session-derived human actor, current live exact-scope authority, MFA/assurance, tenant/team/resource/purpose scope, expected version, reason and current policy state. `PROPOSER != APPROVER`; self-approval and caller-authored authority are prohibited. Proposal is never authority.

Service, AI, connector, scheduler and background-job identities cannot approve or activate human administration authority. Delegation exists only when current canonical authority/policy explicitly represents it; role inheritance or role stacking cannot expand it.

## 6. Live authority gate

The SP-001 baseline keeps AdministrationService assignment state separately from AuthorizationService's construction-time assignment snapshot. A future approved/revoked assignment is incomplete until this flow exists:

`approved/revoked assignment → authoritative repository → live assignment resolver → AuthorizationService decision`

This is mandatory implementation gap `F16-GAP-003`; this document does not implement or mark it complete.

## 7. Persistence and audit boundary

Required logical capabilities:

- Repository Port;
- Unit of Work with atomic state + audit boundary;
- idempotency evidence and same-key/different-intent conflict;
- optimistic concurrency and expected-version enforcement;
- immutable proposal/approval/rejection/activation/revocation/denial/required-read evidence.

No authority mutation is complete if required audit persistence fails. Deterministic in-memory adapters are allowed for development/test. Durable authoritative persistence is required before production completion for Role Assignment, Role/Policy version, Team/scope, administration decisions, idempotency and audit/decision evidence.

Physical database, ORM and migration framework remain `DEFERRED`; this alignment selects none.

## 8. Console, AI and external boundaries

- `UI-006`: future governed administration read/status integration.
- `UI-036`: future controlled administration workflow.
- Current Admin Console remains read-only; no write route is authorized in Phase 4.
- UI-036 mutation support requires a separately approved controlled-write boundary.
- FEAT-016 AI capability is `NONE`; AI cannot approve, activate, revoke, grant, expand scope or bypass MFA/SoD.
- SNS, crawler, external website, rbs-homes, email, messaging, AI provider and connector execution are outside FEAT-016.

## 9. Gap status after alignment

| Gap | Status | Evidence / next gate |
|---|---|---|
| `F16-GAP-001` execution status conflict | RESOLVED | `DEC-114`, frozen-row execution overlays and SP-001 evidence distinction |
| `F16-GAP-002` ownership conflict | RESOLVED | `DEC-114`, `TRACE-016`, API-015 and Feature overlay |
| `F16-GAP-011` approval/delegation ambiguity | RESOLVED | mandatory two-person and explicit-delegation invariant |
| `F16-GAP-003` live authority | OPEN IMPLEMENTATION GAP | mandatory live resolver integration |
| `F16-GAP-004` durable state | OPEN IMPLEMENTATION GAP | repository/UoW; physical adapter deferred |
| `F16-GAP-005` complete API-015 | OPEN IMPLEMENTATION GAP | next Phase closed contracts |
| `F16-GAP-006` idempotency | OPEN IMPLEMENTATION GAP | application/persistence implementation |
| `F16-GAP-007` atomic audit | OPEN IMPLEMENTATION GAP | Unit of Work implementation |
| `F16-GAP-008` Runtime/HTTP | OPEN IMPLEMENTATION GAP | later approved interface/runtime phase |
| `F16-GAP-009` UI-006/UI-036 | OPEN IMPLEMENTATION GAP | read integration then separately approved controlled writes |
| `F16-GAP-010` full tests | OPEN IMPLEMENTATION GAP | direct/integration/security/UAT acceptance |

## 10. Next boundary

The next eligible brief after Phase 4 acceptance is:

`F16-PHASE-5 — API-015 Closed Contracts`

Phase 4 changes governance and traceability only. FEAT-016 production implementation remains not started in this phase.
