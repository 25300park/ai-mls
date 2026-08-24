# FEAT-016 Implementation Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-017 |
| 버전 | v0.6 |
| 상태 | DRAFT |
| 범위 | `EPIC-008` / `FEAT-016` / `DEV-016` / `IMP-016` |
| 기준 | Architecture Bible v1.1 + `DEC-114` / `CR-026` |
| Execution status | `PARTIALLY_IMPLEMENTED_BASELINE` |
| Phase 5 status | `CONTRACT_LAYER_RESOLVED` |
| Phase 6 status | `LOGICAL_PERSISTENCE_BOUNDARY_VERIFIED` |
| Phase 7 status | `LIVE_ROLE_AUTHORITY_INTEGRATION_VERIFIED` |
| Phase 8 status | `POLICY_SOURCE_TARGET_WORKFLOWS_VERIFIED` |
| Phase 9 status | `RUNTIME_HTTP_API_015_VERIFIED` |

## 1. Status reconciliation

Frozen Feature/Developer/Implementation Registry의 primary row `PLANNED`는 logical planning identity를 보존한다. 실행 evidence는 post-freeze overlay와 이 문서가 관리한다.

- SP-001 Role Assignment subset과 해당 test evidence는 유효하다.
- SP-001은 FEAT-016 전체 completion evidence가 아니다.
- FEAT-016은 incomplete이며 `IMPLEMENTED`, `VERIFIED` 또는 `CLOSED`가 아니다.
- 이후 구현은 현재 Role Assignment baseline을 보존하고 확장한다.

## 2. End-to-end trace

| Requirement | Decision | Workflow | Entity / Scope | API / UI | Security | Tests | Status |
|---|---|---|---|---|---|---|---|
| `REQ-CONST-006` | `DEC-076/078/082/114` | `WF-012`, cross-cutting `WF-001–012` | Decision History, administration change evidence | `API-015/016`; `UI-006/036` | `SEC-021/022/026` | `TEST-005/034/053`; Phase 5 closed contract and architecture tests | PARTIALLY_VERIFIED |
| `REQ-CONST-007` | `DEC-114`; ADR-007 | `WF-001–012` | proposal, approval/rejection, activation, revocation, denial, privileged read evidence | `API-015/016`; `UI-006/036` | `SEC-007/021–023` | `TEST-005/034/037/048/053`; Phase 5 Session/SoD/MFA/error tests | PARTIALLY_VERIFIED |
| `REQ-CONST-010` | `DEC-053/114`; ADR-003 | `WF-001–012` | User, Role, Role Assignment, Team/scope, governed policy state | `API-002/015/016`; `UI-006/036` | `SEC-001–010/033` | `TEST-005/034/048/053`; Phase 5 operation/read DTO tests | PARTIALLY_VERIFIED |

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

Phase 9A는 새 operation을 추가하지 않고 기존 `PROPOSE_ROLE_ASSIGNMENT`를 확장한다. 새 proposal은 `roleAssignmentId` 없이 `expectedVersion = 0`을 사용한다. revoke successor proposal은 기존 ACTIVE `roleAssignmentId`와 exact current version을 사용하고 subject, Role, tenant/scope, team, resource, purpose 및 effective-period 관계를 보존한다. Successor proposal은 기존 `REVOKE_ROLE_ASSIGNMENT` lifecycle에서만 authoritative state 변경으로 이어질 수 있다.

## 5. Approval and delegation invariant

Privileged change activation follows:

`proposal → independent review → authorization revalidation → approval → atomic activation`

Mandatory checks are current Session-derived human actor, current live exact-scope authority, MFA/assurance, tenant/team/resource/purpose scope, expected version, reason and current policy state. `PROPOSER != APPROVER`; self-approval and caller-authored authority are prohibited. Proposal is never authority.

Service, AI, connector, scheduler and background-job identities cannot approve or activate human administration authority. Delegation exists only when current canonical authority/policy explicitly represents it; role inheritance or role stacking cannot expand it.

## 6. Live authority gate

SP-001 baseline의 construction-time assignment snapshot 한계는 Phase 7에서 다음 current read flow로 대체됐다.

`approved/revoked assignment → authoritative repository → live assignment resolver → AuthorizationService decision`

Phase 7은 이 logical live-authority flow와 current Role/approval evidence validation을 구현·검증하여 `F16-GAP-003`을 해소했다. Durable production repository와 Runtime/HTTP/UI integration은 별도 gap으로 유지한다.

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

## 9. Phase 5 API-015 contract evidence

`apps/api/src/administration-api-contracts.ts`와 `administration-api-validation.ts`가 API-015의 closed command/query surface, Session-derived Actor, human/MFA precondition, two-person proposal evidence, expected version, idempotency fingerprint, safe error/concealment 및 immutable read DTO를 구현한다.

직접 evidence는 `administration-api-contracts.test.ts`와 `administration-api-architecture.test.ts`이며 focused API-015 및 기존 Administration 회귀 30/30, 전체 627/627, lint/typecheck/build/verify, Architecture checksum 153/153, Gitleaks 0, production audit 0 및 independent review Critical/Important/Minor 0/0/0을 통과했다. 상세 결과는 [F16 Phase 5 API-015 Closed Contracts Implementation Report](../reviews/F16_PHASE_5_API_015_CLOSED_CONTRACTS_IMPLEMENTATION_REPORT.md)에 기록한다.

이 Phase 5 evidence 자체는 contract layer만 검증했다. Live authority는 후속 Phase 7 evidence에서 별도로 검증됐고 durable state/idempotency, atomic audit, Runtime/HTTP 및 UI-006/UI-036는 완료로 표시하지 않는다.

## 10. Phase 6 Repository / UoW evidence

`modules/administration/src/administration-persistence.ts`는 Role Assignment, Role, Policy, Team scope, Source governance, Publication Target governance, Proposal, Decision 및 Idempotency를 위한 bounded repository port와 deterministic in-memory adapter를 구현한다. `InMemoryAdministrationUnitOfWork`는 mutation 유형별 state/proposal/decision/idempotency/version bundle을 단일 logical commit으로 묶으며 write 또는 commit 실패 시 rollback-only로 fail closed 한다.

직접 evidence는 `administration-persistence.test.ts`와 `administration-persistence-architecture.test.ts`이다. 구조화된 evidence reference 보존, append-only evidence, original proposer/approver linkage, exact proposal/resource version, operation/resource/status 결속, optimistic concurrency, idempotent replay/collision, scope/copy isolation, Role snapshot hydration 및 forbidden dependency를 검증했다. Focused 60/60, 전체 657/657, lint/typecheck/build/verify, Architecture checksum 153/153, Gitleaks 0 및 independent review READY를 통과했다. 상세 결과는 [F16 Phase 6 Administration Repository / UoW Implementation Report](../reviews/F16_PHASE_6_ADMINISTRATION_REPOSITORY_UOW_IMPLEMENTATION_REPORT.md)에 기록한다.

이 Phase 6 evidence 자체는 logical persistence boundary만 검증했다. Physical database, ORM, migration 및 durable production adapter는 선택하거나 구현하지 않았고, live authority는 후속 Phase 7 evidence에서 검증됐으며 Runtime/HTTP/UI integration은 여전히 미구현이다.

## 11. Phase 7 Live Role Authority evidence

`modules/administration/src/live-assignment-adapter.ts`는 `RoleAssignment.roleId`를 exact current `RolePersistenceRecord.roleId` 및 canonical `roleCode`로 해석하고, ACTIVE Role의 tenant/team scope, version, policy 및 evidence를 검증한다. ACTIVE assignment는 Proposal, independent APPROVED Decision, proposer/approver 분리, exact version 및 activation evidence가 모두 일치할 때만 `AuthorizationService`에 전달된다. Session/body Role 또는 capability claim은 이 read path를 대체하지 못한다.

`modules/authorization/src/authorization-service.ts`는 production live resolver를 매 decision마다 호출하고, applicable ACTIVE assignment만 평가한다. Publication approval/execution authority에 대해 operation-specific SoD conflict가 capability allow보다 우선하며 read/check 작업에는 authority mutation conflict를 확장하지 않는다. Resolver failure, malformed/stale linkage, missing Role, revoked/expired assignment, tenant/team/purpose mismatch 및 insufficient MFA는 fail closed다.

직접 evidence는 `live-assignment-adapter.test.ts`, `live-role-authority-integration.test.ts`, `live-role-authority-architecture.test.ts`이다. Focused Phase 7 15/15, broader Authorization/FEAT-015 security regression 54/54, Phase 5/6 및 Identity regression을 포함한 전체 672/672, lint/typecheck/build/verify, Architecture checksum 153/153, Gitleaks 0, production audit 0 및 independent review Critical/Important/Minor 0/0/0을 통과했다. 상세 결과는 [F16 Phase 7 Live Role Authority Integration Report](../reviews/F16_PHASE_7_LIVE_ROLE_AUTHORITY_INTEGRATION_REPORT.md)에 기록한다.

이 evidence는 live logical authority composition만 검증한다. Physical database, durable production adapter, API-015 Runtime/HTTP, UI-006/UI-036 write integration 및 FEAT-016 final acceptance는 완료하지 않는다.

## 12. Phase 8 Policy / Source / Target Administration evidence

`apps/api/src/administration-governance-api.ts`는 API-015 command/query contract, Phase 6 logical Repository/UoW 및 module-private-symbol branded Phase 7 live authorization port를 결합한다. Policy, Source Registry governance 및 Publication Target governance는 bounded proposal, independent approval/rejection, successor transition, optimistic version, idempotent replay, append-only decision evidence와 immutable scope-aware read를 제공한다. Source workflow는 connector/crawl을 실행하지 않고 Target workflow는 Publication lifecycle/dispatch/reconciliation을 실행하지 않는다.

직접 evidence는 `administration-governance-api.test.ts`와 `administration-governance-architecture.test.ts`이다. Focused Phase 8 13/13, 영향 회귀 112/112 및 최종 관련 53/53, 전체 685/685, lint/typecheck/build/verify, Architecture checksum 153/153, Gitleaks worktree findings 0, production audit 0 및 independent review Critical/Important/Minor 0/0/0을 통과했다. 상세 결과는 [F16 Phase 8 Policy / Source / Target Administration Report](../reviews/F16_PHASE_8_POLICY_SOURCE_TARGET_ADMINISTRATION_IMPLEMENTATION_REPORT.md)에 기록한다.

이 evidence는 logical application workflow만 검증한다. Physical durable persistence, Runtime/HTTP, UI-006/UI-036, UAT 및 FEAT-016 final acceptance는 완료하지 않는다.

## 13. Phase 9 Runtime / HTTP API-015 evidence

`apps/api/src/administration-http-adapter.ts`는 canonical API-015 command와 query를 분리하고 HTTP header의 Session ID만 authoritative authentication input으로 사용한다. Command body와 bodyless GET query는 각각 closed schema로 검증되며 unknown field, body-authored actor/session/role, unsupported operation과 `SET_LEGAL_HOLD`를 거부한다. `apps/api/src/composition.ts`의 `composeAdministrationApi015NodeHttpServer`는 injected `AdministrationGovernanceApplication`과 기존 Node HTTP server를 단일 production composition boundary로 연결한다.

Role Assignment read/list/propose/approve/reject/revoke와 Phase 8 Policy/Source/Target workflow는 동일 application, Phase 6 UoW/idempotency/evidence, Phase 7 live authorization을 재사용한다. 실제 loopback은 command, bodyless GET query, bounded body를 검증하고, composed HTTP rejection matrix는 missing capability, expired/revoked assignment, retired Role, purpose mismatch, wrong tenant/scope, MFA 및 stale authority를 concealment와 no-persistence assertion으로 검증한다. Cross-scope successor lookup은 `NOT_FOUND`로 fail closed한다.

직접 evidence는 `administration-api-contracts.test.ts`, `administration-governance-api.test.ts`, `administration-governance-architecture.test.ts`이다. Focused 51/51, 영향 회귀 96/96, 전체 700/700, lint/typecheck/build/verify, Architecture checksum 153/153, Gitleaks 0 및 fresh independent review Critical/Important/Minor 0/0/0 READY를 통과했다. 상세 결과는 [F16 Phase 9 Runtime / HTTP API-015 Report](../reviews/F16_PHASE_9_RUNTIME_HTTP_API_015_IMPLEMENTATION_REPORT.md)에 기록한다.

Retention Policy와 Legal Hold는 canonical owner에 남고 Phase 9 operation surface에 포함되지 않는다. Physical durable persistence와 UI-006/UI-036는 구현하지 않았다.

## 14. Phase 10 UI-006 Administration Console evidence

`apps/admin-console/src/administration-console-read-adapter.ts`는 trusted server-side Session을 `x-session-id`로 canonical API-015 `LIST_ROLE_ASSIGNMENTS` query에 전달하고, authorized Role Assignment의 bounded field만 immutable Console DTO로 매핑한다. Unsupported proposal/decision list와 canonical resource ID가 없는 Policy/Source/Target read는 fabricated data 없이 `UNAVAILABLE`이다. `nextCursor`가 있으면 first authorized page의 `Visible` count와 `PARTIAL`만 표시한다.

`apps/admin-console/src/administration-console-http-client.ts`, `main.ts`와 `console-composition.ts`는 credential 없는 loopback HTTP origin, `GET /administration/queries` 및 injected read adapter만 사용한다. Repository/UoW/legacy state, command endpoint, mutation handler, browser-authored authority와 UI-036 write control은 포함하지 않는다. `/administration` route는 LOADING, EMPTY, UNAVAILABLE, NOT_AUTHORIZED, ERROR 및 normal data state를 safe rendering한다.

직접 evidence는 `administration-console-http-client.test.ts`, `administration-console-read-adapter.test.ts`, `console-composition.test.ts`, `console-server.test.ts`와 `console-renderer.test.ts`이다. Console focused 31/31, API-015 affected 51/51, 전체 711/711, lint/typecheck/build/verify, Browser acceptance 8/8, Architecture checksum 153/153, Gitleaks worktree 0, production audit 0 및 fresh independent review Critical/Important/Minor 0/0/0 READY를 통과했다. Full audit은 기존 승인된 development-only transitive `brace-expansion` High 4건만 유지하며 신규 미승인 High/Critical은 0이다. 상세 결과는 [F16 Phase 10 UI-006 Administration Console Report](../reviews/F16_PHASE_10_UI_006_ADMINISTRATION_CONSOLE_IMPLEMENTATION_REPORT.md)에 기록한다.

UI-006은 `IMPLEMENTED_AND_VERIFIED`다. UI-036 controlled write, physical durable persistence와 FEAT-016 final acceptance는 완료로 표시하지 않는다.

## 15. Gap status after Phase 10

| Gap | Status | Evidence / next gate |
|---|---|---|
| `F16-GAP-001` execution status conflict | RESOLVED | `DEC-114`, frozen-row execution overlays and SP-001 evidence distinction |
| `F16-GAP-002` ownership conflict | RESOLVED | `DEC-114`, `TRACE-016`, API-015 and Feature overlay |
| `F16-GAP-011` approval/delegation ambiguity | RESOLVED | mandatory two-person and explicit-delegation invariant |
| `F16-GAP-003` live authority | RESOLVED | current Role/Assignment/Proposal/Decision read graph, exact evidence linkage, live activation/revocation 및 deny precedence verified in Phase 7 |
| `F16-GAP-004` durable state | OPEN IMPLEMENTATION GAP | logical Repository/UoW verified in Phase 6; physical durable adapter deferred |
| `F16-GAP-005` complete API-015 | RUNTIME_CONTRACT_VERIFIED | Phase 5 closed schemas와 Phase 9 canonical application/HTTP operation surface verified; UI remains separate |
| `F16-GAP-006` idempotency | PARTIALLY_VERIFIED | Phase 9 HTTP replay/collision과 canonical proposal/decision result verified; durable adapter remains open |
| `F16-GAP-007` atomic audit | PARTIALLY_VERIFIED | Phase 9 Role/Policy/Source/Target logical UoW state/evidence/idempotency와 rollback verified; durable atomic audit remains open |
| `F16-GAP-008` Runtime/HTTP | RESOLVED | single application boundary, existing Node server composition, closed command/bodyless-query transport and loopback verified in Phase 9 |
| `F16-GAP-009` UI-006/UI-036 | PARTIALLY_VERIFIED | UI-006 read-oriented Console implemented and browser-verified in Phase 10; UI-036 controlled writes remain open |
| `F16-GAP-010` full tests | PARTIALLY_VERIFIED | Phase 10 Console/API/full 711/711 and Browser 8/8 passed; UI-036/UAT/final acceptance remain open |

## 16. Next boundary

The next eligible brief after Phase 9 acceptance is:

`F16-PHASE-11` — only after separate Architecture Owner authorization.

Phase 5~10은 closed API-015 contract, logical persistence, live Role authority, governed workflow, Runtime/HTTP boundary 및 UI-006 read-oriented Console을 검증했다. FEAT-016은 여전히 incomplete이며 UI-036 및 Phase 11은 시작하지 않았다.
