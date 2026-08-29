# FEAT-016 Implementation Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-017 |
| 버전 | v0.7 |
| 상태 | IN REVIEW |
| 범위 | `EPIC-008` / `FEAT-016` / `DEV-016` / `IMP-016` |
| 기준 | Architecture Bible v1.1 + `DEC-114` / `CR-026` |
| Execution status | `IMPLEMENTED_AND_VERIFIED` |
| Phase 5 status | `CONTRACT_LAYER_RESOLVED` |
| Phase 6 status | `LOGICAL_PERSISTENCE_BOUNDARY_VERIFIED` |
| Phase 7 status | `LIVE_ROLE_AUTHORITY_INTEGRATION_VERIFIED` |
| Phase 8 status | `POLICY_SOURCE_TARGET_WORKFLOWS_VERIFIED` |
| Phase 9 status | `RUNTIME_HTTP_API_015_VERIFIED` |
| Phase 10 status | `UI_006_VERIFIED` |
| Phase 11 status | `UI_036_CONTROLLED_ADMINISTRATION_VERIFIED` |
| Phase 12 status | `FINAL_ADMINISTRATION_INTEGRATION_HARDENING_VERIFIED` |
| F16-R1 status | `DURABLE_ADMINISTRATION_PERSISTENCE_VERIFIED` |
| F16-R2 status | `API_015_EXECUTION_COMPLETENESS_VERIFIED` |
| F16-R3 status | `TRACEABILITY_CLOSURE_VERIFIED` |

## 1. Status reconciliation

Frozen Feature/Developer/Implementation Registry의 primary row `PLANNED`는 logical planning identity를 보존한다. 실행 evidence는 post-freeze overlay와 이 문서가 관리한다.

- SP-001 Role Assignment subset과 해당 test evidence는 유효하다.
- SP-001은 FEAT-016 전체 completion evidence가 아니다.
- Phase 5~12와 F16-R1/R2의 승인된 implementation evidence는 FEAT-016 requirement와 canonical exclusion을 모두 구현 또는 명시적 비소유 범위로 추적한다.
- FEAT-016 implementation coverage는 `IMPLEMENTED_AND_VERIFIED`다. 이는 별도 F16 Final Gate의 release readiness 승인이나 formal feature closure를 대신하지 않는다.
- Frozen Registry의 historical `PLANNED` row와 초기 SP-001 baseline은 변경하지 않고 post-freeze execution overlay로 해석한다.

## 2. End-to-end trace

| Requirement | Decision | Workflow | Entity / Scope | API / UI | Security | Tests | Status |
|---|---|---|---|---|---|---|---|
| `REQ-CONST-006` | `DEC-076/078/082/114` | `WF-012`, cross-cutting `WF-001–012` | Decision History, administration change evidence | `API-015/016`; `UI-006/036` | `SEC-021/022/026` | `TEST-005/034/053`; Phase 5~12, F16-R1/R2 contract, application, durable evidence and integration tests | VERIFIED |
| `REQ-CONST-007` | `DEC-114`; ADR-007 | `WF-001–012` | proposal, approval/rejection, activation, revocation, denial, privileged read evidence | `API-015/016`; `UI-006/036` | `SEC-007/021–023` | `TEST-005/034/037/048/053`; Session/SoD/MFA, durable atomic evidence and composed rejection tests | VERIFIED |
| `REQ-CONST-010` | `DEC-053/114`; ADR-003 | `WF-001–012` | User, Role, Role Assignment, Team/scope, governed policy state | `API-002/015/016`; `UI-006/036` | `SEC-001–010/033` | `TEST-005/034/048/053`; closed operation, Role/Team lifecycle, durable persistence and HTTP/Console tests | VERIFIED |

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

Phase 7은 이 logical live-authority flow와 current Role/approval evidence validation을 구현·검증하여 `F16-GAP-003`을 해소했다. 당시 별도 gap이던 Runtime/HTTP/UI integration은 Phase 9~12에서, durable production repository는 F16-R1에서 후속 해소됐다.

## 7. Persistence and audit boundary

Required logical capabilities:

- Repository Port;
- Unit of Work with atomic state + audit boundary;
- idempotency evidence and same-key/different-intent conflict;
- optimistic concurrency and expected-version enforcement;
- immutable proposal/approval/rejection/activation/revocation/denial/required-read evidence.

No authority mutation is complete if required audit persistence fails. Deterministic in-memory adapters are allowed for development/test only. F16-R1의 `DurableAdministrationUnitOfWork`는 Role Assignment, Role/Policy version, Team/scope, administration decisions, idempotency, revision 및 audit/decision evidence를 Node.js built-in `node:sqlite`에 durable하게 저장한다.

Phase 4 시점에는 physical database, ORM과 migration framework가 `DEFERRED`였다. F16-R1은 승인된 별도 decision에 따라 SQLite file database를 선택했으며 external database dependency, ORM과 migration framework는 추가하지 않았다.

## 8. Console, AI and external boundaries

- `UI-006`: Phase 10에서 API-015 read-only Administration Console로 구현·검증됐다.
- `UI-036`: Phase 11/11B에서 canonical selector/proposal read와 기존 approved mutation operation만 사용하는 controlled administration workflow로 구현·검증됐다.
- Phase 4의 read-only Console 제한은 historical boundary이며, 이후 별도 승인된 Phase 11 controlled-write boundary만 예외다.
- Console은 Repository/UoW를 직접 접근하지 않고 trusted server-side Session과 API-015 HTTP boundary만 사용한다.
- FEAT-016 AI capability is `NONE`; AI cannot approve, activate, revoke, grant, expand scope or bypass MFA/SoD.
- SNS, crawler, external website, rbs-homes, email, messaging, AI provider and connector execution are outside FEAT-016.

## 9. Phase 5 API-015 contract evidence

`apps/api/src/administration-api-contracts.ts`와 `administration-api-validation.ts`가 API-015의 closed command/query surface, Session-derived Actor, human/MFA precondition, two-person proposal evidence, expected version, idempotency fingerprint, safe error/concealment 및 immutable read DTO를 구현한다.

직접 evidence는 `administration-api-contracts.test.ts`와 `administration-api-architecture.test.ts`이며 focused API-015 및 기존 Administration 회귀 30/30, 전체 627/627, lint/typecheck/build/verify, Architecture checksum 153/153, Gitleaks 0, production audit 0 및 independent review Critical/Important/Minor 0/0/0을 통과했다. 상세 결과는 [F16 Phase 5 API-015 Closed Contracts Implementation Report](../reviews/F16_PHASE_5_API_015_CLOSED_CONTRACTS_IMPLEMENTATION_REPORT.md)에 기록한다.

이 Phase 5 evidence 자체는 contract layer만 검증했다. 당시 미완료였던 live authority는 Phase 7, Runtime/HTTP는 Phase 9, UI-006/UI-036는 Phase 10~12, durable state/idempotency와 atomic audit은 F16-R1에서 각각 후속 검증됐다.

## 10. Phase 6 Repository / UoW evidence

`modules/administration/src/administration-persistence.ts`는 Role Assignment, Role, Policy, Team scope, Source governance, Publication Target governance, Proposal, Decision 및 Idempotency를 위한 bounded repository port와 deterministic in-memory adapter를 구현한다. `InMemoryAdministrationUnitOfWork`는 mutation 유형별 state/proposal/decision/idempotency/version bundle을 단일 logical commit으로 묶으며 write 또는 commit 실패 시 rollback-only로 fail closed 한다.

직접 evidence는 `administration-persistence.test.ts`와 `administration-persistence-architecture.test.ts`이다. 구조화된 evidence reference 보존, append-only evidence, original proposer/approver linkage, exact proposal/resource version, operation/resource/status 결속, optimistic concurrency, idempotent replay/collision, scope/copy isolation, Role snapshot hydration 및 forbidden dependency를 검증했다. Focused 60/60, 전체 657/657, lint/typecheck/build/verify, Architecture checksum 153/153, Gitleaks 0 및 independent review READY를 통과했다. 상세 결과는 [F16 Phase 6 Administration Repository / UoW Implementation Report](../reviews/F16_PHASE_6_ADMINISTRATION_REPOSITORY_UOW_IMPLEMENTATION_REPORT.md)에 기록한다.

이 Phase 6 evidence 자체는 logical persistence boundary만 검증했다. 당시 미구현이던 live authority는 Phase 7, Runtime/HTTP/UI integration은 Phase 9~12, durable production adapter는 F16-R1에서 후속 검증됐다. ORM과 별도 migration framework는 도입하지 않았다.

## 11. Phase 7 Live Role Authority evidence

`modules/administration/src/live-assignment-adapter.ts`는 `RoleAssignment.roleId`를 exact current `RolePersistenceRecord.roleId` 및 canonical `roleCode`로 해석하고, ACTIVE Role의 tenant/team scope, version, policy 및 evidence를 검증한다. ACTIVE assignment는 Proposal, independent APPROVED Decision, proposer/approver 분리, exact version 및 activation evidence가 모두 일치할 때만 `AuthorizationService`에 전달된다. Session/body Role 또는 capability claim은 이 read path를 대체하지 못한다.

`modules/authorization/src/authorization-service.ts`는 production live resolver를 매 decision마다 호출하고, applicable ACTIVE assignment만 평가한다. Publication approval/execution authority에 대해 operation-specific SoD conflict가 capability allow보다 우선하며 read/check 작업에는 authority mutation conflict를 확장하지 않는다. Resolver failure, malformed/stale linkage, missing Role, revoked/expired assignment, tenant/team/purpose mismatch 및 insufficient MFA는 fail closed다.

직접 evidence는 `live-assignment-adapter.test.ts`, `live-role-authority-integration.test.ts`, `live-role-authority-architecture.test.ts`이다. Focused Phase 7 15/15, broader Authorization/FEAT-015 security regression 54/54, Phase 5/6 및 Identity regression을 포함한 전체 672/672, lint/typecheck/build/verify, Architecture checksum 153/153, Gitleaks 0, production audit 0 및 independent review Critical/Important/Minor 0/0/0을 통과했다. 상세 결과는 [F16 Phase 7 Live Role Authority Integration Report](../reviews/F16_PHASE_7_LIVE_ROLE_AUTHORITY_INTEGRATION_REPORT.md)에 기록한다.

이 Phase 7 evidence 자체는 live logical authority composition만 검증했다. 당시 미완료였던 API-015 Runtime/HTTP는 Phase 9, UI-006/UI-036는 Phase 10~12, durable production adapter는 F16-R1에서 후속 검증됐다.

## 12. Phase 8 Policy / Source / Target Administration evidence

`apps/api/src/administration-governance-api.ts`는 API-015 command/query contract, Phase 6 logical Repository/UoW 및 module-private-symbol branded Phase 7 live authorization port를 결합한다. Policy, Source Registry governance 및 Publication Target governance는 bounded proposal, independent approval/rejection, successor transition, optimistic version, idempotent replay, append-only decision evidence와 immutable scope-aware read를 제공한다. Source workflow는 connector/crawl을 실행하지 않고 Target workflow는 Publication lifecycle/dispatch/reconciliation을 실행하지 않는다.

직접 evidence는 `administration-governance-api.test.ts`와 `administration-governance-architecture.test.ts`이다. Focused Phase 8 13/13, 영향 회귀 112/112 및 최종 관련 53/53, 전체 685/685, lint/typecheck/build/verify, Architecture checksum 153/153, Gitleaks worktree findings 0, production audit 0 및 independent review Critical/Important/Minor 0/0/0을 통과했다. 상세 결과는 [F16 Phase 8 Policy / Source / Target Administration Report](../reviews/F16_PHASE_8_POLICY_SOURCE_TARGET_ADMINISTRATION_IMPLEMENTATION_REPORT.md)에 기록한다.

이 Phase 8 evidence 자체는 logical application workflow만 검증했다. 당시 미완료였던 Runtime/HTTP는 Phase 9, UI-006/UI-036는 Phase 10~12, physical durable persistence는 F16-R1에서 후속 검증됐다.

## 13. Phase 9 Runtime / HTTP API-015 evidence

`apps/api/src/administration-http-adapter.ts`는 canonical API-015 command와 query를 분리하고 HTTP header의 Session ID만 authoritative authentication input으로 사용한다. Command body와 bodyless GET query는 각각 closed schema로 검증되며 unknown field, body-authored actor/session/role, unsupported operation과 `SET_LEGAL_HOLD`를 거부한다. `apps/api/src/composition.ts`의 `composeAdministrationApi015NodeHttpServer`는 injected `AdministrationGovernanceApplication`과 기존 Node HTTP server를 단일 production composition boundary로 연결한다.

Role Assignment read/list/propose/approve/reject/revoke와 Phase 8 Policy/Source/Target workflow는 동일 application, Phase 6 UoW/idempotency/evidence, Phase 7 live authorization을 재사용한다. 실제 loopback은 command, bodyless GET query, bounded body를 검증하고, composed HTTP rejection matrix는 missing capability, expired/revoked assignment, retired Role, purpose mismatch, wrong tenant/scope, MFA 및 stale authority를 concealment와 no-persistence assertion으로 검증한다. Cross-scope successor lookup은 `NOT_FOUND`로 fail closed한다.

직접 evidence는 `administration-api-contracts.test.ts`, `administration-governance-api.test.ts`, `administration-governance-architecture.test.ts`이다. Focused 51/51, 영향 회귀 96/96, 전체 700/700, lint/typecheck/build/verify, Architecture checksum 153/153, Gitleaks 0 및 fresh independent review Critical/Important/Minor 0/0/0 READY를 통과했다. 상세 결과는 [F16 Phase 9 Runtime / HTTP API-015 Report](../reviews/F16_PHASE_9_RUNTIME_HTTP_API_015_IMPLEMENTATION_REPORT.md)에 기록한다.

Retention Policy와 Legal Hold는 canonical owner에 남고 Phase 9 operation surface에 포함되지 않는다. Phase 9 당시 미구현이던 UI-006/UI-036는 Phase 10~12, physical durable persistence는 F16-R1에서 후속 검증됐다.

## 14. Phase 10 UI-006 Administration Console evidence

Phase 10 당시 `apps/admin-console/src/administration-console-read-adapter.ts`는 trusted server-side Session을 `x-session-id`로 canonical API-015 `LIST_ROLE_ASSIGNMENTS` query에 전달하고, authorized Role Assignment의 bounded field만 immutable Console DTO로 매핑했다. 당시 미지원 proposal/decision list와 canonical resource ID가 없는 Policy/Source/Target read는 fabricated data 없이 `UNAVAILABLE`로 표시했다. Proposal read는 Phase 11B, Decision read/list는 F16-R2에서 후속 구현됐다. `nextCursor`가 있으면 first authorized page의 `Visible` count와 `PARTIAL`만 표시한다.

Phase 10 evidence 자체에서 `apps/admin-console/src/administration-console-http-client.ts`, `main.ts`와 `console-composition.ts`는 credential 없는 loopback HTTP origin, `GET /administration/queries` 및 injected read adapter만 사용했다. 당시 Repository/UoW/legacy state, command endpoint, mutation handler, browser-authored authority와 UI-036 write control은 포함하지 않았다. 이후 별도 승인된 Phase 11/11B가 기존 Console adapter에 API-015 controlled command boundary를 추가했으며 Repository/UoW 직접 접근과 browser-authored authority는 계속 금지한다. `/administration` route는 LOADING, EMPTY, UNAVAILABLE, NOT_AUTHORIZED, ERROR 및 normal data state를 safe rendering한다.

직접 evidence는 `administration-console-http-client.test.ts`, `administration-console-read-adapter.test.ts`, `console-composition.test.ts`, `console-server.test.ts`와 `console-renderer.test.ts`이다. Console focused 31/31, API-015 affected 51/51, 전체 711/711, lint/typecheck/build/verify, Browser acceptance 8/8, Architecture checksum 153/153, Gitleaks worktree 0, production audit 0 및 fresh independent review Critical/Important/Minor 0/0/0 READY를 통과했다. Full audit은 기존 승인된 development-only transitive `brace-expansion` High 4건만 유지하며 신규 미승인 High/Critical은 0이다. 상세 결과는 [F16 Phase 10 UI-006 Administration Console Report](../reviews/F16_PHASE_10_UI_006_ADMINISTRATION_CONSOLE_IMPLEMENTATION_REPORT.md)에 기록한다.

UI-006은 Phase 10에서 `IMPLEMENTED_AND_VERIFIED`로 판정됐다. 당시 미완료였던 UI-036 controlled write는 Phase 11/11B, physical durable persistence는 F16-R1에서 후속 구현·검증됐다.

## 15. Phase 11A Canonical Administration Read Boundaries evidence

`apps/api/src/administration-governance-api.ts`는 기존 `AdministrationGovernanceApplication.list()`와 Phase 6 bounded `listByScope()` repository port를 통해 `LIST_ROLES`, `LIST_TEAM_SCOPES`, `LIST_POLICIES`, `LIST_SOURCE_GOVERNANCE`, `LIST_PUBLICATION_TARGET_GOVERNANCE`를 구현한다. 모든 query는 trusted Session resolution과 `authorizeRead()`를 재사용하고 exact tenant/scope authorization, status filter, bounded cursor pagination, deterministic canonical ID ordering 및 immutable API-015 view를 적용한다. Cursor filtering과 ordering은 동일 `localeCompare` comparator를 사용한다.

Phase 11A에서 `apps/api/src/administration-http-adapter.ts`는 위 다섯 operation을 기존 GET `/administration/queries` closed allowlist에 등록했다. 허용 query는 canonical scope, status, limit 및 cursor로 제한되며 unknown parameter와 unknown operation은 거부된다. `apps/admin-console/src/administration-console-read-adapter.ts`는 injected API-015 handler를 통해서만 selector options를 읽고 ID, status, version, scopeType 및 scopeId만 immutable Console DTO로 반환한다. 이 Phase 11A slice 자체에는 command route나 mutation을 추가하지 않았고, 이후 Phase 11/11B controlled command도 동일 API-015 boundary만 사용한다. Repository/UoW 직접 접근, hardcoded production ID, raw evidence, Source execution 및 Publication execution은 계속 금지한다.

직접 evidence는 `administration-governance-api.test.ts`와 `administration-console-read-adapter.test.ts`이며 architecture regression은 `administration-governance-architecture.test.ts`, `administration-api-contracts.test.ts` 및 `console-composition.test.ts`를 포함한다. Focused 40/40, Phase 5~10 affected 133/133, 전체 722/722, lint/typecheck/build/verify, Architecture checksum 153/153, Gitleaks 0, production audit vulnerabilities 0 및 fresh independent review Critical/Important/Minor 0/0/0 READY를 통과했다. Full audit은 기존 승인된 development-only transitive `brace-expansion` High 4건만 유지하며 신규 미승인 High/Critical은 0이다. 상세 결과는 [F16 Phase 11A Canonical Administration Read Boundaries Report](../reviews/F16_PHASE_11A_CANONICAL_ADMIN_READ_BOUNDARIES_IMPLEMENTATION_REPORT.md)에 기록한다.

Phase 11A evidence 자체는 selector read boundary만 구현했다. 당시 미완료였던 UI-036 form/write action과 command route는 Phase 11/11B, physical durable persistence는 F16-R1에서 후속 구현·검증됐다.

## 16. Phase 11 / Phase 11B UI-036 Controlled Administration evidence

`LIST_ADMINISTRATION_PROPOSALS`는 기존 `AdministrationGovernanceApplication.list()`에서 safe `proposalId`, `resourceType`, `resourceId`, status, scope 및 version을 반환하고, Runtime/HTTP/Console adapter 전체에서 trusted Session, live authorization, tenant/exact-scope filtering 및 immutable DTO를 유지한다. UI-036은 `LIST_ROLES`, `LIST_TEAM_SCOPES`, `LIST_POLICIES`, `LIST_SOURCE_GOVERNANCE`, `LIST_PUBLICATION_TARGET_GOVERNANCE`, `LIST_ROLE_ASSIGNMENTS`와 위 proposal query에서 canonical selector와 mutation identity를 도출한다. `LIST_ADMINISTRATION_DECISIONS`는 Phase 11 workflow에 필요하지 않아 당시 추가하지 않았고 F16-R2에서 closed contract execution boundary로 후속 구현됐다.

기존 `/administration/control` Console flow는 하나의 injected API-015 adapter를 통해 Role Assignment, Policy, Source Governance 및 Publication Target Governance controlled operations를 수행한다. Server-derived Session, live capability/tenant/scope/purpose/MFA, actor-level SoD, expected version, canonical idempotency, append-only evidence 및 logical UoW invariants를 재사용한다. Browser-authored authority, free-text canonical ID, hardcoded production ID, direct Repository/UoW access, Retention/Legal Hold, Source/Publication execution 및 신규 API operation은 없다.

직접 evidence는 `administration-console-http-client.test.ts`, `administration-console-read-adapter.test.ts`, `console-composition.test.ts`, `console-server.test.ts`, `console-renderer.test.ts`, `administration-api-contracts.test.ts` 및 `administration-governance-api.test.ts`다. Focused/affected 83/83, 전체 732/732, lint/typecheck/build/verify, Browser acceptance 12/12, Architecture checksum 153/153, Gitleaks 0, production audit vulnerabilities 0 및 fresh independent review Critical/Important/Minor 0/0/0 READY를 통과했다. Full audit은 기존 승인된 development-only transitive `brace-expansion` High 4건만 유지하며 신규 미승인 High/Critical은 0이다. 상세 결과는 [F16 Phase 11 UI-036 Controlled Write Console Report](../reviews/F16_PHASE_11_UI_036_CONTROLLED_WRITE_CONSOLE_IMPLEMENTATION_REPORT.md)에 기록한다.

UI-036 logical controlled administration boundary는 `IMPLEMENTED_AND_VERIFIED`다. 당시 미완료였던 physical durable production persistence는 F16-R1에서 후속 구현·검증됐다.

## 17. Phase 12 Final Administration Integration / Hardening evidence

`administration-governance-api.test.ts`의 Phase 12 composed test는 실제 Console server, `AdministrationConsoleHttpClient`, API-015 Node HTTP server, `AdministrationGovernanceApplication` 및 Phase 6 UoW를 통과해 Policy proposal을 저장하고 UI-036 canonical proposal/resource selector refresh로 재조회한다. 별도 binding test는 client-authored resource rebinding을 `NOT_FOUND`로 거부하고 original/rebound identity 양쪽의 decision 및 rejected-command idempotency side effect가 0임을 검증한다. Production source 변경은 없다.

기존 Phase 8~11 lifecycle 및 rejection evidence와 함께 Role Assignment, Policy, Source Governance, Publication Target Governance, Session/live authority, tenant/scope/purpose/MFA, expected version, idempotency, append-only evidence, HTTP concealment, canonical selectors 및 Source/Publication execution isolation을 재검증했다. `LIST_ADMINISTRATION_DECISIONS`는 Phase 12 flow에 필요하지 않아 당시 추가하지 않았고 F16-R2에서 후속 구현됐다.

Focused 2/2, affected 105/105, 전체 734/734, lint/typecheck/build/verify, Architecture checksum 153/153, `git diff --check`, Gitleaks 0, production audit vulnerabilities 0 및 fresh independent review Critical/Important/Minor 0/0/0 READY를 통과했다. Full audit은 기존 승인된 development-only transitive `brace-expansion` High 4건만 유지하며 신규 미승인 High/Critical은 0이다. 상세 결과는 [F16 Phase 12 Final Administration Integration / Hardening Report](../reviews/F16_PHASE_12_FINAL_ADMINISTRATION_INTEGRATION_HARDENING_IMPLEMENTATION_REPORT.md)에 기록한다.

Phase 12 logical Administration integration/hardening은 `IMPLEMENTED_AND_VERIFIED`다. 당시 미완료였던 physical durable production persistence는 F16-R1에서 후속 구현·검증됐다. F16 Final Gate는 여전히 별도 release-readiness gate다.

## 18. F16-R1 Durable Administration Persistence evidence

`modules/administration/src/administration-durable-persistence.ts`는 기존 `AdministrationUnitOfWork` contract와 Phase 6 transaction invariant를 유지하면서 Node.js built-in `node:sqlite` 기반 production durable adapter를 제공한다. Governed resource, proposal, decision, evidence, idempotency와 revision은 하나의 `BEGIN IMMEDIATE` transaction에서 commit되며 실패 시 전체 rollback된다. Database write boundary는 revision 및 record version compare-and-swap을 수행하고, decision/evidence/idempotency table은 update/delete trigger로 append-only를 강제한다.

Production composition은 명시적인 file database path가 없거나 memory database가 지정되면 fail closed하며 `InMemoryAdministrationUnitOfWork`로 fallback하지 않는다. 동일 durable repository graph가 API-015 application과 live authorization에 주입된다. Reopen/restart survival, idempotent replay after restart, conflicting fingerprint, stale/concurrent writer, SQLite lock contention, pre-COMMIT child termination, uncertain COMMIT quarantine/reopen, structural/semantic corruption, decisionless status elevation 및 lifecycle evidence/status mismatch가 직접 검증됐다.

직접 evidence는 `administration-durable-persistence.test.ts`, `administration-production-composition.test.ts`, `administration-governance-architecture.test.ts`다. Focused 34/34, Administration affected regression 148/148, 전체 766/766, lint/typecheck/build/verify, Architecture checksum 153/153, Gitleaks 0 및 independent review Critical/Important/Minor 0/0/0 READY를 통과했다. Dependency audit은 F16-R1 registry metadata 전송 승인이 없어 실행하지 않았으며 dependency manifest와 lockfile 변경은 0이다. 상세 결과는 [F16-R1 Durable Administration Persistence Report](../reviews/F16_R1_DURABLE_ADMINISTRATION_PERSISTENCE_IMPLEMENTATION_REPORT.md)에 기록한다.

F16-R1 durable persistence boundary는 `IMPLEMENTED_AND_VERIFIED`다. 이는 FEAT-016 Final Gate 승인이나 R2/R3 시작을 의미하지 않는다.

## 19. F16-R2 API-015 Closed Contract Execution Completeness evidence

기존 closed API-015 contract에 이미 등록됐지만 Application/Runtime/HTTP에서 실행되지 않던 정확히 10개 operation을 기존 단일 경계에 연결했다. Command는 `PROPOSE_ROLE_CHANGE`, `APPROVE_ROLE_CHANGE`, `REJECT_ROLE_CHANGE`, `PROPOSE_TEAM_SCOPE_CHANGE`, `APPROVE_TEAM_SCOPE_CHANGE`, `REJECT_TEAM_SCOPE_CHANGE`이며 Query는 `READ_ROLE`, `READ_TEAM_SCOPE`, `READ_ADMINISTRATION_DECISION`, `LIST_ADMINISTRATION_DECISIONS`다. `LIST_ROLES`와 `LIST_TEAM_SCOPES`의 기존 동작은 변경하지 않았다.

Role/Team proposal과 independent approval/rejection은 Session-derived actor, live authorization, tenant/scope/purpose/MFA, expected version, SoD, canonical idempotency 및 append-only evidence를 재사용한다. Role approval은 canonical policy reference만 갱신하고 identity, role code와 scope를 보존한다. Team approval은 team/organization/scope identity를 보존한다. 두 approval 모두 version을 정확히 1 증가시키며 rejection은 governed state를 변경하지 않는다. Decision read repository는 기존 SQLite schema에서 `findById`와 `listByScope`만 제공하고 safe immutable DTO로 반환한다.

직접 evidence는 `administration-governance-api.test.ts`, `administration-production-composition.test.ts`, `administration-governance-architecture.test.ts`, `administration-persistence.test.ts` 및 `administration-durable-persistence.test.ts`다. F16-R2 focused 8/8, affected 106/106, 전체 774/774, lint/typecheck/build/verify, Architecture checksum 153/153, `git diff --check`, Gitleaks 0 및 independent review Critical/Important/Minor 0/0/0 READY를 통과했다. Production audit은 vulnerabilities 0이며 full audit은 기존 승인된 development-only transitive `brace-expansion` High 4건만 유지하고 신규 미승인 High/Critical은 0이다. Dependency manifest와 lockfile 변경은 0이다. 상세 결과는 [F16-R2 API-015 Closed Contract Execution Completeness Report](../reviews/F16_R2_API_015_CLOSED_CONTRACT_EXECUTION_COMPLETENESS_IMPLEMENTATION_REPORT.md)에 기록한다.

F16-R2 API-015 execution completeness는 `IMPLEMENTED_AND_VERIFIED`다. 이는 FEAT-016 Final Gate 승인이나 F16-R3 시작을 의미하지 않는다.

## 20. Gap status after F16-R3 traceability reconciliation

| Gap | Status | Evidence / next gate |
|---|---|---|
| `F16-GAP-001` execution status conflict | RESOLVED | `DEC-114`, frozen-row execution overlays and SP-001 evidence distinction |
| `F16-GAP-002` ownership conflict | RESOLVED | `DEC-114`, `TRACE-016`, API-015 and Feature overlay |
| `F16-GAP-011` approval/delegation ambiguity | RESOLVED | mandatory two-person and explicit-delegation invariant |
| `F16-GAP-003` live authority | RESOLVED | current Role/Assignment/Proposal/Decision read graph, exact evidence linkage, live activation/revocation 및 deny precedence verified in Phase 7 |
| `F16-GAP-004` durable state | IMPLEMENTED_AND_VERIFIED | production SQLite adapter, reopen/restart survival, fail-closed composition 및 no in-memory fallback verified in F16-R1 |
| `F16-GAP-005` complete API-015 | IMPLEMENTED_AND_VERIFIED | closed contract의 누락 10 operation이 single Application/Runtime/HTTP/durable path에서 verified; no new operation |
| `F16-GAP-006` idempotency | IMPLEMENTED_AND_VERIFIED | durable idempotency, restart replay, conflicting fingerprint rejection 및 atomic rollback verified in F16-R1 |
| `F16-GAP-007` atomic audit | IMPLEMENTED_AND_VERIFIED | governed mutation, append-only decision/audit evidence, idempotency 및 revision의 single-transaction atomicity verified in F16-R1 |
| `F16-GAP-008` Runtime/HTTP | RESOLVED | single application boundary, existing Node server composition, closed command/bodyless-query transport and loopback verified in Phase 9 |
| `F16-GAP-009` UI-006/UI-036 | IMPLEMENTED_AND_VERIFIED | UI-006 read Console, canonical selector/proposal reads 및 UI-036 controlled workflows verified through API-015 |
| `F16-GAP-010` full tests | IMPLEMENTED_AND_VERIFIED | F16-R2 focused 8/8, affected 106/106 및 full 774/774 passed; FEAT-016 Final Gate remains separate |

## 21. Current verified coverage

| Implementation area | Production / contract evidence | Direct validation evidence | Status |
|---|---|---|---|
| Canonical API-015 contract | `administration-api-contracts.ts`, `administration-api-validation.ts` | `administration-api-contracts.test.ts`, `administration-governance-architecture.test.ts` exact closed-surface equality | IMPLEMENTED_AND_VERIFIED |
| Administration application | `administration-governance-api.ts` single command/read/list boundary | Phase 8/9/11A/R2 application tests | IMPLEMENTED_AND_VERIFIED |
| Runtime / Host / HTTP | `administration-http-adapter.ts`, `composition.ts` | Phase 9/R2 HTTP allowlist, dispatch, loopback and production composition tests | IMPLEMENTED_AND_VERIFIED |
| Durable Administration UoW | `administration-durable-persistence.ts`, `administration-persistence-engine.ts` | F16-R1 reopen, rollback, CAS, crash/recovery, append-only and no-fallback tests | IMPLEMENTED_AND_VERIFIED |
| Role Assignment lifecycle | `administration-governance-api.ts`, live assignment adapter | Phase 7/9 proposal, approval, rejection, revoke and live-authority tests | IMPLEMENTED_AND_VERIFIED |
| Role change lifecycle | `PROPOSE/APPROVE/REJECT_ROLE_CHANGE` application path | F16-R2 success, rejection, SoD, stale version and durable HTTP tests | IMPLEMENTED_AND_VERIFIED |
| Team Scope lifecycle | `PROPOSE/APPROVE/REJECT_TEAM_SCOPE_CHANGE` application path | F16-R2 identity, version, rejection and durable HTTP tests | IMPLEMENTED_AND_VERIFIED |
| Policy / Source / Target governance | Phase 8 application workflows | Phase 8 lifecycle/read tests and Phase 9/12 composed tests | IMPLEMENTED_AND_VERIFIED |
| Proposal / Decision reads | `LIST_ADMINISTRATION_PROPOSALS`, `READ_ADMINISTRATION_DECISION`, `LIST_ADMINISTRATION_DECISIONS` | Phase 11B proposal binding and F16-R2 decision read/list tests | IMPLEMENTED_AND_VERIFIED |
| Console UI-006 / UI-036 | injected Console adapter through API-015 HTTP | Phase 10/11/12 browser, selector, mutation and composed tests | IMPLEMENTED_AND_VERIFIED |
| Authorization / isolation | Session-derived actor, live resolver, tenant/scope/purpose/MFA/SoD checks | Phase 7~12 and F16-R2 rejection/no-side-effect tests | IMPLEMENTED_AND_VERIFIED |
| Version / idempotency / atomic evidence | expected version, durable idempotency and single SQLite transaction | Phase 6, F16-R1 and F16-R2 replay/conflict/rollback/evidence tests | IMPLEMENTED_AND_VERIFIED |
| Restart / recovery | file-backed `DurableAdministrationUnitOfWork` | F16-R1 restart/reopen/crash/corruption tests and F16-R2 reopened state assertions | IMPLEMENTED_AND_VERIFIED |
| Execution isolation | Source governance excludes connector execution; Target governance excludes Publication execution | Phase 8 architecture tests, Phase 9 HTTP tests, Phase 11 Console architecture tests | IMPLEMENTED_AND_VERIFIED |
| Retention / Legal Hold | external canonical ownership; absent from API-015 | closed-contract and architecture rejection assertions including `SET_LEGAL_HOLD` | EXPLICITLY_EXCLUDED |

## 22. Next boundary

F16-R3 reconciles the canonical RTM against approved Phase 5~12 and F16-R1/R2 evidence. No implementation gap remains in this matrix; F16 Final Gate may be re-executed only with separate Architecture Owner authorization.

`F16 Final Gate` — `READY_FOR_RETRY`.

Phase 5~12와 F16-R1/R2는 closed API-015 contract, logical/durable persistence, live Role authority, governed workflow, complete Runtime/HTTP execution boundary, UI-006/UI-036 및 final Administration integration/hardening을 검증했다. F16-R3는 이 evidence를 current canonical traceability로 정렬했으며 FEAT-016 formal closure나 Final Gate 실행을 선언하지 않는다.
