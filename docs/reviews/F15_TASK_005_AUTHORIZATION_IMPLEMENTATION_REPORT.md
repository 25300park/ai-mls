# F15-TASK-005 Authorization Implementation Completion Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-075 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 완료일 | 2026-08-03 |
| Brief | F15-TASK-005 — Authorization, SoD and Live Revalidation |

## 1. Final Recommendation

`APPROVE_F15_TASK_005_IMPLEMENTATION`

F15-TASK-005의 session-derived Actor, command-specific authorization, actor-level SoD, live prerequisite revalidation, immutable authorization evidence 및 mutation-before guard가 구현되었다. F15-TASK-006 이후 범위는 시작하지 않았다.

## 2. Baseline Commit

`9706fa008f72d13c05583a1622c1e53618ccaf9b` (`main`, `origin/main`과 일치)

기존 Phase 13-15 validation 문서와 테스트의 미커밋 변경은 폐기하지 않고 보존했다.

## 3. Implementation Commit

`SELF` — 이 보고서와 구현을 포함하는 단일 local commit이다. exact hash는 commit 완료 후 Architecture Owner 제출 결과에 기록한다.

## 4. Commit Message

`feat(feat-015): implement publication authorization guard`

## 5. Files Created

- `modules/publication/src/publication-authorization.ts`
- `modules/publication/src/publication-authorization.test.ts`
- `modules/publication/src/publication-authorization-test-support.test.ts`
- `docs/reviews/F15_TASK_005_AUTHORIZATION_IMPLEMENTATION_REPORT.md`

기존 untracked Phase 13-15 report/test는 본 Task에서 새로 설계한 산출물이 아니며 보존 대상으로 취급했다.

## 6. Files Modified

- Authorization capability/policy: `modules/authorization/src/authorization-service.ts`, `authorization-service.test.ts`
- Application boundary: `publication-application-contracts.ts`, `publication-application-error.ts`, `publication-command-handlers.ts`, `publication-application.test.ts`
- Interface/Transport safe error: `publication-interface-presenter.ts`, `publication-interface-validation.ts`, `publication-interface.test.ts`, `publication-transport-response-mapper.ts`, `publication-transport.test.ts`
- HTTP boundary: `publication-http-request-mapper.ts`, `publication-http-adapter.test.ts`
- Infrastructure/Runtime/exports: `publication-infrastructure-configuration.ts`, `publication-infrastructure.ts`, `publication-infrastructure.test.ts`, `publication-runtime-contracts.ts`, `publication-runtime-registry.ts`, `publication-runtime.test.ts`, `index.ts`
- Regression composition fixtures: `publication-composition.test.ts`, `publication-executable.test.ts`, `publication-host.test.ts`, `publication-node-http-server.test.ts`, `publication-presentation.test.ts`
- Evidence navigation: `docs/implementation/FEAT015_TRACEABILITY_MATRIX.md`, `docs/00_MASTER_INDEX.md`, `docs/reviews/README.md`

## 7. Guard Architecture

모든 create/modify command는 단일 `executeModificationBoundary()`를 통과한다. 순서는 application context validation → Session authentication → 기본 scope/capability/MFA/reason 검사 → 권한 확인 후 필요한 current snapshot read → live binding/SoD/version 검사 → authorization evidence → idempotency → Unit of Work → Domain → repository/audit commit → idempotency result이다. 인증/인가 거부는 Unit of Work와 Domain 실행 전에 종료되며 capability 거부는 restricted resource 조회 전 종료된다.

`SessionResolver`, authorization evaluator, live-context resolver는 injected read-only port다. resolver/evaluator 실패는 safe deny로 변환되며 Publication state를 변경하지 않는다.

## 8. Session-Derived Actor

HTTP에서는 `x-session-id`만 Session 식별자로 수용한다. body의 `sessionId`, `roles`, `capabilities`는 제거된다. 호환용 `PublicationExecutionContext.actorId`와 Domain command actor는 authorization authority로 사용하지 않고, resolved `SessionContext.principalId`로 교체한 후 Domain, persistence 및 application audit에 전달한다.

resolver 부재, session ID 부재, 미해석, revoked/expired/inactive 또는 timestamp-invalid Session은 `AUTHENTICATION_REQUIRED`로 fail closed한다.

## 9. Command Authorization Matrix

다음 11개 command는 서로 다른 bounded capability를 사용한다: create, initial execution begin, execution resolve, withdrawal request/resolve, active operation begin, republish begin, reconciliation resolve, supersede, terminate, suspension/resume. OPS에만 해당 capability를 등록했고 모두 privileged human-authority action으로 MFA, documented reason 및 audit obligation을 유지한다.

MGR, ADM, SEC, AIR, EXT 및 SVC identity는 role 이름만으로 Publication human authority를 상속하지 않는다.

## 10. Live Revalidation

current tenant/team/purpose/resource scope와 exact Approval, Verification, Permission, subject/revision, Representation/version/checksum, Target/version, Channel, audience, policy version 및 aggregate version을 독립적인 live context로 검증한다. aggregate creation boolean은 authorization authority로 사용하지 않는다. malformed/expired prerequisite와 resolver failure는 deny다.

## 11. Segregation of Duties

resolved Session Actor가 Approval requester/decision actor, Representation creator/editor, Verifier, Permission decision actor 또는 evidence submitter와 동일하면 `SEPARATION_OF_DUTIES_DENIED`다. role stacking은 actor identity 충돌을 우회하지 못한다.

## 12. MFA and Reason

모든 command-specific Publication action은 기존 AuthorizationService의 privileged/human authority policy에 등록했다. MFA가 없으면 `MFA_REQUIRED`, documented reason이 없으면 `REASON_REQUIRED`로 안전하게 거부된다.

## 13. Authorization Evidence

`InMemoryPublicationAuthorizationEvidenceStore`는 classified `RESTRICTED_SECURITY` immutable snapshot을 append-only로 보존한다. decision ID는 aggregate/correlation/command/actor/decision/reason/check timestamp의 deterministic tuple이다. raw payload, credential, secret, provider body 및 restricted contact 정보는 포함하지 않는다.

성공과 거부 모두 actor, scope, exact prerequisite references, policy, version, timestamp 및 correlation evidence를 기록한다. 동일 evidence 재기록은 idempotent하고 conflicting identity는 거부된다.

## 14. Error Contract

승인된 safe vocabulary를 Application → Interface → Transport 경계에서 보존한다: `AUTHENTICATION_REQUIRED`, `AUTHORIZATION_DENIED`, `PURPOSE_SCOPE_DENIED`, `MFA_REQUIRED`, `REASON_REQUIRED`, `SEPARATION_OF_DUTIES_DENIED`, `APPROVAL_NOT_EFFECTIVE`, `VERIFICATION_NOT_EFFECTIVE`, `PERMISSION_NOT_EFFECTIVE`, `BINDING_MISMATCH`, `POLICY_VERSION_STALE`, `PUBLICATION_VERSION_CONFLICT`.

내부 policy detail, actor conflict role, provider payload 및 stack trace는 외부 응답에 노출되지 않는다.

## 15. Direct Test Results

- `publication-authorization.test.ts`: 35/35 direct guard subtests PASS.
- `authorization-service.test.ts`: command capability/MFA/reason 및 senior/AI/connector/service prohibition PASS.
- `publication-application.test.ts`: body actor 무시, authentication-before-mutation, authoritative failure audit PASS.
- stale Session/policy/Approval/Verification/Permission/Target/Channel/checksum/version, SoD role stacking 및 dependency failure를 assertion으로 검증했다.

## 16. Integration/E2E Results

- Composition success는 forged body actor를 무시하고 Session Actor를 Domain transition과 repository state에 기록한다.
- Composition SoD denial은 safe code를 Transport까지 유지하고 repository/audit/idempotency state가 변하지 않음을 검증한다.
- HTTP request mapper는 header Session만 전달하고 body session/role/capability claim을 제거한다.
- 기존 real Node HTTP loopback 및 12-layer architecture tests가 회귀 없이 통과했다.

## 17. Full Test Results

`pnpm.cmd verify`와 독립 `pnpm.cmd test`에서 전체 449/449 PASS를 각각 확인했다. fail/cancelled/skipped/todo는 모두 0이다.

| Gate | Result |
|---|---|
| Node / pnpm Node | `v24.18.0` / `v24.18.0` PASS |
| `pnpm.cmd install` | PASS; dependency와 lockfile 변경 0 |
| `pnpm.cmd lint` | PASS; warning 0 |
| `pnpm.cmd typecheck` | PASS |
| `pnpm.cmd build` | PASS |
| `pnpm.cmd verify` | PASS; 449/449 |
| `pnpm.cmd test` | PASS; 449/449 |
| Gitleaks | PASS; actual/unexplained secrets 0 |

## 18. Dependency Audit Results

| Command | Exit | 결과 |
|---|---:|---|
| `pnpm.cmd audit --prod` | 0 | known production vulnerabilities 0 |
| `pnpm.cmd audit` | 1 | 승인된 기존 development-only `brace-expansion` high advisory 2개; 43 transitive dev paths |

전체 audit findings는 동일 advisory `GHSA-mh99-v99m-4gvg`이며 vulnerable ranges `<1.1.17` 및 `>=4.0.0 <5.0.8`이다. direct dependency가 아니고 ESLint/typescript-eslint toolchain의 transitive development dependency다. dependency, manifest 및 lockfile 변경은 0이다.

## 19. Architecture Checksum

153개 frozen primary architecture scope checksum은 `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778`로 baseline과 일치한다.

## 20. Independent Review

독립 review의 최초 결과는 Critical 0, Important 5였다. resource 존재 여부 노출 가능성, Approval audience 누락, Publication policy exact-version 누락, denial evidence 저장 실패 시 safe error 손상, 공개 pre-auth 우회 표면을 모두 수정한 후 재검토했다. 최종 결과는 Critical 0, Important 0, Ready `Yes`이다.

## 21. Scope Protection

- Domain lifecycle/materiality rule 변경 0.
- Repository, Unit of Work, idempotency semantic 변경 0.
- database/ORM/migration/event/projection/connector/UI 구현 0.
- JWT/OAuth/cookie/session storage 등 authentication technology 추가 0.
- frozen Architecture/Registry 변경 0.
- F15-TASK-006~012 구현 0.

## 22. Traceability Update

`FEAT015_TRACEABILITY_MATRIX.md`의 F15-TASK-005 evidence row만 production/test/runtime/verification evidence와 `IMPLEMENTED_AND_VERIFIED`로 갱신한다. F15-TASK-006~012의 상태는 변경하지 않는다.

Canonical 연결은 `DEC-105/106/107`, `WF-010/011/012`, `API-014`, `SEC-001/002/004/006–015/021/032`와 F15-TASK-005 test evidence다.

## 23. Remaining Risks

- 전체 dependency audit의 기존 development-only `brace-expansion` advisory는 승인된 risk disposition에 따라 유지된다. production audit는 clean이다.
- physical persistence 및 production SessionResolver wiring technology는 승인되지 않은 deferred boundary이며 이번 Task에서 결정하지 않았다.
- authorization evidence는 현재 승인된 in-process logical infrastructure를 사용한다. physical durability 결정은 별도 승인 대상이다.

## 24. Next Recommended Task

Architecture Owner가 본 Task를 승인한 후 별도 Brief로 F15-TASK-006을 검토한다. 본 작업에서는 시작하지 않는다.

## 25. Push Status

`NOT_PUSHED`

## Completion statement

본 보고서는 F15-TASK-005만 다룬다. Architecture Owner 승인 전 다음 Task를 시작하지 않는다.

## Completion Template Coverage

1. Objective: session-derived Actor 기반 Publication authorization boundary 구현.
2. Documents read: 현재 Brief, AO Amendment, `AGENTS.md`, FEAT-015 planning/traceability/security 및 Phase 13 baseline 문서.
3. Files created: 5절 참조.
4. Files modified: 6절 참조.
5. Key decisions added: 새 Architecture Decision 없음. 승인된 AO Amendment를 구현 증거로 반영.
6. Open decisions: 없음. physical persistence와 production SessionResolver technology는 기존 deferred boundary로 유지.
7. Inconsistencies found: 독립 review의 Important 5건을 구현 범위 안에서 해소.
8. Validation performed: install, lint, typecheck, build, verify, test, dependency audit, architecture checksum, diff validation.
9. Known limitations: 23절 참조.
10. Next brief prerequisites: Architecture Owner의 F15-TASK-005 승인 및 별도 F15-TASK-006 Brief.
