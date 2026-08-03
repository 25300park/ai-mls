# F15-TASK-009 API and UI Contracts Implementation Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-F15-009 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Implementation Owner |
| 적용 범위 | F15-TASK-009 |
| 기준일 | 2026-08-03 |

## 1. Final Recommendation

`APPROVE_F15_TASK_009_IMPLEMENTATION`

API-014 command/query logical boundary, UI-031/032/033/035 bounded View Contract, mandatory composition registration과 direct/composed evidence를 구현했다. `F15-TASK-010`은 시작하지 않았다.

## 2. Baseline Commit

`f8d128b93a218a5402cabc14bc74275085d97975` (`main`, implementation 시작 시 `HEAD = origin/main`)

## 3. Implementation Commit

`SELF` — 이 보고서와 구현 evidence를 포함하는 단일 local completion commit. 최종 hash는 commit 생성 후 제출 결과에 기록한다.

## 4. Commit Message

`feat(feat-015): implement api-014 and publication view contracts`

## 5. Files Created

- `apps/api/src/publication-api-contracts.ts`
- `apps/api/src/publication-api-error-mapper.ts`
- `apps/api/src/publication-api.ts`
- `apps/api/src/publication-view-contracts.ts`
- `apps/api/src/publication-api.test.ts`
- `docs/reviews/F15_TASK_009_API_AND_UI_CONTRACTS_IMPLEMENTATION_REPORT.md`

## 6. Files Modified

- `apps/api/src/composition.ts`
- `apps/api/src/index.ts`
- `apps/api/src/contact-client-api.test.ts`
- `apps/api/src/matching-api.test.ts`
- `apps/api/src/permission-api.test.ts`
- `apps/api/src/proposal-approval-api.test.ts`
- `apps/api/src/verification-api.test.ts`
- `docs/implementation/FEAT015_TRACEABILITY_MATRIX.md` — `F15-TASK-009` evidence row only

기존 API composition regression은 명시적인 `composeApiModulesBeforePublication()`로 유지하고, canonical `composeApiModules()`는 API-014 infrastructure를 필수로 요구하도록 분리했다.

## 7. API-014 Operation Matrix

| 구분 | Operation | 위임 경계 |
|---|---|---|
| Command | `CREATE_PUBLICATION`, `PUBLISH_PUBLICATION` | F15-TASK-006 Publication Coordination |
| Command | `CORRECT_PUBLICATION`, `SUSPEND_PUBLICATION`, `RESUME_PUBLICATION`, `REQUEST_WITHDRAWAL`, `RESOLVE_WITHDRAWAL`, `REPUBLISH_PUBLICATION`, `SUPERSEDE_PUBLICATION`, `TERMINATE_PUBLICATION` | F15-TASK-007 Lifecycle Coordination |
| Command | `RESOLVE_RECONCILIATION`, `RECOVER_PUBLICATION` | F15-TASK-008 Reconciliation/Recovery |
| Query | `GET_PUBLICATION` | bounded canonical Publication read |
| Query | `GET_PUBLICATION_OPERATIONS_VIEW` | UI-031 |
| Query | `GET_PUBLICATION_REVALIDATION_VIEW` | UI-032 |
| Query | `GET_PUBLICATION_RECOVERY_VIEW` | UI-033 |
| Query | `GET_PUBLICATION_AUDIT_VIEW` | UI-035 / `audit.query` |

## 8. Command/Query Separation

`PublicationApiCommandService`와 `PublicationApiQueryService`를 분리했다. Command는 승인된 F15-TASK-006~008 service만 호출하며 Aggregate method나 repository mutation shortcut을 사용하지 않는다. Query는 Session과 current policy를 재검증한 뒤 repository/audit/authorization evidence의 read boundary만 사용한다.

## 9. Session-derived Actor Integration

Request body `actorId`, roles, capabilities와 caller-provided authority는 authoritative input이 아니다. Command는 기존 F15-TASK-005 guard/`SessionResolver`가 반환한 current Session Actor를 사용한다. Query도 동일 configured resolver를 사용하며 resolver 부재, session 누락/만료/폐기는 `AUTHENTICATION_REQUIRED`로 fail closed한다.

## 10. Safe Error Contract

API-owned closed error vocabulary를 정의했다. Allowlisted Domain/Application error만 유지하고 unknown error는 `INTERNAL_API_ERROR`로 sanitize한다. `PUBLICATION_STATE_INVALID`는 `INVALID_PUBLICATION_STATE`로 명시적으로 매핑하며 stack, class name, internal path를 반환하지 않는다.

## 11. Inaccessible-resource Concealment

Cross-tenant, cross-team, wrong-purpose, read-policy denial과 inaccessible resource는 safe `NOT_FOUND`로 conceal한다. UI-035는 broad `resource.view`가 아니라 current `audit.query` decision을 요구한다.

## 12. UI-031 Contract

Publication lifecycle/suspension/version/target/channel/prerequisite summary와 advisory `availableActions`를 immutable하게 반환한다. OPS human, MFA, scope, live binding, policy version, SoD와 current Domain state를 모두 반영한다. Suspended READY/ACTIVE/WITHDRAWN에서는 Domain-invalid external-effect actions를 제거한다.

## 13. UI-032 Contract

Approval, Verification, Permission, policy와 binding의 bounded status만 제공한다. Stale prerequisite는 `revalidationRequired`와 action suppression으로 나타내며 query 자체는 revalidation이나 authority reactivation을 수행하지 않는다.

## 14. UI-033 Contract

Reconciliation case/attempt/outcome category, manual-review flag와 reference count만 제공한다. Raw provider/connector evidence는 노출하지 않으며 query는 resolve/recover side effect를 만들지 않는다.

## 15. UI-035 Contract

현재 결과는 Event Journal이 아니라 `PUBLICATION_AUDIT_HISTORY`로 정확히 표시한다. Lifecycle/attempt/reconciliation/audit history를 bounded immutable tail로 반환한다. Internal audit tuple ID는 deterministic SHA-256 기반 opaque public ID로 변환하고 arbitrary `failureReason`은 `COMMAND_FAILED`로 redaction한다. Actor field는 current `audit.query` policy가 허용한 경우에만 포함한다.

## 16. Role-aware Action Derivation

Action derivation은 deterministic pure read logic이다. Read-only, Manager, Administrator, Service/AI/Connector identity가 human Publication authority를 자동 상속하지 않는다. Approver, verifier, Permission decision-maker와 evidence submitter conflict는 action을 suppress한다. UI action은 advisory이며 command-time authorization을 대체하지 않는다.

## 17. Composition Registration

`composePublicationApiModule()`은 기존 `PublicationInfrastructure` identity를 그대로 재사용한다. Canonical `composeApiModules()`는 `publicationInfrastructure`를 필수로 요구하고 누락 시 fail fast하며, returned graph에는 non-optional `publication` module이 존재한다. SessionResolver, authorization guard, repository, Unit of Work, audit와 idempotency component를 복제하지 않았다.

## 18. Direct API Test Results

28/28 PASS. Create/publish/lifecycle/reconciliation delegation, Session Actor, closed-schema validation, safe errors, optimistic concurrency, idempotency replay/conflict, persistence/audit, exact state mapping과 concealment를 실제 assertion으로 확인했다.

## 19. View Contract Test Results

UI-031/032/033/035의 immutable/bounded/redacted output, policy-derived action set, stale/non-mutating behavior, audit authority와 opaque history evidence를 직접 검증했다.

## 20. Integration/E2E Results

동일 composed dependency graph에서 valid create가 authoritative Session Actor로 aggregate version을 1회 증가시키고 immutable success audit를 생성함을 확인했다. 이어서 updated bounded view, denied command의 state 불변, 동일 persisted Publication에 대한 unauthorized query concealment와 response non-leak을 확인했다.

## 21. Total Test Results

514/514 PASS, skipped mandatory test 0.

## 22. Verification Results

| Gate | 결과 |
|---|---|
| `pnpm.cmd install` | PASS — exit 0, dependency/lockfile 변경 0; registry update metadata warning만 존재 |
| `pnpm.cmd lint` | PASS — warning 0 |
| `pnpm.cmd typecheck` | PASS |
| `pnpm.cmd build` | PASS |
| `pnpm.cmd verify` | PASS — 514/514 |
| `pnpm.cmd test` | PASS — 514/514 |
| `git diff --check` | PASS |

## 23. Architecture Checksum

PASS — primary frozen scope 153/153, SHA-256 `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778`가 baseline과 일치한다. Frozen Architecture/Registry 변경은 0이다.

## 24. Gitleaks

PASS — `gitleaks detect --source . --config .gitleaks.toml --redact`, actual/unexplained findings 0.

## 25. Dependency Audits

- `pnpm.cmd audit --prod --registry=https://registry.npmjs.org`: PASS, production vulnerabilities 0.
- `pnpm.cmd audit --registry=https://registry.npmjs.org`: REVIEWED, 이전 승인된 dev-only transitive `brace-expansion` advisories 2 High만 존재한다. Direct dependency finding은 0이며 dependency/manifest/lockfile은 변경하지 않았다.

## 26. Independent Review

초기 review findings는 lifecycle-invalid actions, audit metadata redaction, error mapping, read authority granularity, composition fail-fast와 acceptance evidence 부족이었다. 각 finding에 direct regression assertion과 최소 production/composition 수정을 적용했다.

최종 threshold:

- Critical: 0
- Important: 0
- Commit readiness: READY

## 27. Scope Protection

Aggregate business rule, F15-TASK-005~008 inner semantics, repository/UoW/idempotency/audit semantics는 변경하지 않았다. Event Journal, EVT-003~012, Projection, Operations retry/degraded mode, database/ORM/migration, frontend framework와 HTTP URL/framework를 구현하지 않았다.

## 28. Traceability Update

[FEAT-015 Traceability Matrix](../implementation/FEAT015_TRACEABILITY_MATRIX.md)의 `F15-TASK-009` row만 `IMPLEMENTED_AND_VERIFIED`로 갱신했다. `F15-TASK-010`~`012` row는 변경하지 않았다.

## 29. Remaining Risks

- Persistence는 승인된 in-process logical foundation이며 physical database는 deferred다.
- F15-TASK-010 Event Emission, F15-TASK-011 Projection, F15-TASK-012 Operations/Observability는 미구현 상태다.
- 전체 audit의 dev-only transitive `brace-expansion` 2 High는 승인된 baseline exception이며 production dependency vulnerability는 0이다.

## 30. Next Recommended Task

Architecture Owner가 이 단일 local commit과 evidence를 승인한 후 별도 Brief로 `F15-TASK-010`을 검토한다. 현재 Task에서 시작하지 않는다.

## 31. Working Tree Status

Completion commit 직후 clean 상태를 확인한다. Temporary/probe/build artifact는 commit 대상에 포함하지 않는다.

## 32. Push Status

`NOT_PUSHED`

## Governance Completion Notes

1. Objective: API-014와 UI-031/032/033/035 contract implementation 및 evidence 완성.
2. Documents read: Task Brief, FEAT015 task/traceability, API/Workflow/Security/Decision/Screen Registry, Glossary, Document Governance, completion template.
3. Files created: §5 참조.
4. Files modified: §6 참조.
5. Key decisions added: 없음. DEC-104~108을 구현 evidence로 사용했다.
6. Open decisions: physical persistence, Event Journal/Projection runtime, operations engine과 HTTP URL/framework는 기존 deferred boundary 유지.
7. Inconsistencies found: 최종 독립 재검토 기준 0.
8. Validation performed: §18~26 참조.
9. Known limitations: API-014는 logical API이며 production HTTP route/frontend는 범위 밖이다.
10. Next brief prerequisites: Architecture Owner의 F15-TASK-009 acceptance와 별도 F15-TASK-010 authorization.
