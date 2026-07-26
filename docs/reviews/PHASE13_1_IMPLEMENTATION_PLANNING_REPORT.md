# Phase 13-1 FEAT-015 Implementation Planning Report

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| Brief | Phase 13-1 FEAT-015 Implementation Planning |
| 작성일 | 2026-07-26 |
| Final Recommendation | `APPROVE_IMPLEMENTATION_PLAN` |

## 1. Objective

Architecture Bible v1.1과 frozen canonical registries를 변경하지 않고 `FEAT-015` Publication Execution을 실행 가능한 7개 Stage와 13개 TDD task로 분해했다. Production code, DB schema/migration, API endpoint, worker, queue, event bus 및 실제 FEAT-015 기능은 구현하지 않았다.

## 2. Documents read

- Phase 13-1 FEAT-015 Implementation Planning Brief
- [Glossary](../00_GLOSSARY.md), [Document Governance](../00_DOCUMENT_GOVERNANCE.md), repository `AGENTS.md`
- [Architecture v1.1 Baseline Manifest](../freeze/ARCHITECTURE_V1_1_BASELINE_MANIFEST.md)와 checksum
- [Decision Register](../00_DECISION_REGISTER.md), `DEC-100`–`DEC-112`
- [Canonical RTM](../00_CANONICAL_TRACEABILITY_MATRIX.md), `TRACE-015` 및 supporting trace
- [Publication Registry](../00_PUBLICATION_REGISTRY.md)
- [Workflow Registry](../00_WORKFLOW_REGISTRY.md)
- [API Registry](../00_API_REGISTRY.md)
- [Security Registry](../00_SECURITY_REGISTRY.md)
- [Projection Registry](../00_PROJECTION_REGISTRY.md)
- [Event Registry](../00_EVENT_REGISTRY.md)
- [Operations Registry](../00_OPERATIONS_REGISTRY.md)
- [Test Registry](../00_TEST_REGISTRY.md), [Book 10 Test Registry](../book-10/15_TEST_REGISTRY.md)
- [Requirement Traceability Matrix](../book-10/02_REQUIREMENT_TRACEABILITY_MATRIX.md)
- [Feature Breakdown](../book-12/03_FEATURE_BREAKDOWN.md), [Development Sequence](../book-12/04_DEVELOPMENT_SEQUENCE.md), [Implementation Registry](../book-12/15_IMPLEMENTATION_REGISTRY.md)
- [Publication Model](../book-3/11_PUBLICATION_MODEL.md), [Publication Workflow](../book-5/10_PUBLICATION_WORKFLOW.md), [Publication API](../book-6/09_PUBLICATION_API.md)
- [Screen Specifications](../book-7/05_SCREEN_SPECIFICATIONS.md), [Screen Registry](../book-7/15_SCREEN_REGISTRY.md)
- [Test Strategy](../book-10/01_TEST_STRATEGY.md), [Functional Tests](../book-10/05_FUNCTIONAL_TESTS.md)
- 현재 `apps/api`, `modules`, `packages`, root package/build/runtime configuration과 SP-008 Publication Approval 구현/테스트.

## 3. Files created

1. [Implementation Plan](../implementation/FEAT015_IMPLEMENTATION_PLAN.md)
2. [Implementation Traceability Matrix](../implementation/FEAT015_TRACEABILITY_MATRIX.md)
3. [Task Breakdown](../implementation/FEAT015_TASK_BREAKDOWN.md)
4. [Deferred Decisions](../implementation/FEAT015_DEFERRED_DECISIONS.md)
5. [Test Strategy](../implementation/FEAT015_TEST_STRATEGY.md)
6. [Phase 13-1 Planning Report](PHASE13_1_IMPLEMENTATION_PLANNING_REPORT.md)

## 4. Files modified

없음. 기존 production code, test, schema, runtime configuration, Architecture Bible, canonical registry, governance baseline은 변경하지 않았다.

## 5. Key decisions added

이 Phase는 Architecture Decision을 추가하지 않았다. 다음 reversible implementation recommendation만 계획에 기록했다.

- current code pattern과 맞는 repository/delivery/evidence/event/projection port 및 in-memory test adapter.
- command/query 분리와 provider-neutral delivery boundary.
- production external effect를 durable idempotency/evidence 및 approved adapter 전까지 fail closed.
- internal closed TypeScript contract와 deterministic canonical JSON checksum을 test-level format으로 사용하되 production serialization은 미결정 유지.
- 새 dependency, RoleCode, API ID 또는 canonical state를 만들지 않음.

## 6. Open decisions

| Topic | Status | Planning disposition |
|---|---|---|
| Physical Payload Schema | OPEN DECISION | internal canonical DTO만 추천; provider mapping 미선정 |
| Event Serialization | OPEN DECISION | deterministic test encoding만 추천; production encoding 미선정 |
| Queue | OPEN DECISION | logical port only; production effect enablement gate |
| Event Bus | OPEN DECISION | journal port only |
| Event Store / Production DB | OPEN DECISION | in-memory test adapter only; migration 0 |
| Worker Topology | OPEN DECISION | isolated logical authority boundary만 정의 |
| Runtime SLO | OPEN DECISION | measure-first; numeric target 미설정 |
| Product / Library | OPEN DECISION | current built-ins 우선; product 미선정 |

세부 비교는 [Deferred Decisions](../implementation/FEAT015_DEFERRED_DECISIONS.md)에 있다.

## 7. Inconsistencies found

### Non-blocking historical status

[Canonical RTM](../00_CANONICAL_TRACEABILITY_MATRIX.md)의 `TRACE-015` implementation field와 일부 frozen Book 12 record는 `PENDING ARCHITECTURE OWNER DECISION` 또는 `PLANNED`를 유지한다. 현재 Brief는 Architecture Governance 종료와 Phase 13-1 planning을 명시적으로 승인하므로 계획 작성에는 충돌하지 않는다. 실제 구현 시작 전에는 별도 implementation authorization이 필요하다.

### Runtime version difference

- required: Node.js `24.18.0`
- direct shell `node --version`: `v20.20.2`
- `pnpm.cmd` execution runtime: Node.js `v24.14.0`
- bundled Node binary 확인: `v24.14.0`

따라서 어떤 관측 runtime도 pinned `24.18.0`과 일치하지 않는다. 현재 lint/typecheck/build/test는 모두 통과했으므로 planning baseline blocker는 아니지만, 구현 시작 전 정확한 Node `24.18.0` 실행 환경을 복구해야 한다.

### Repository capability gap

현재 repository에는 DB schema/migration framework, production repository, queue/event bus/event store, worker topology, deployment implementation 및 connector/provider adapter가 없다. 이는 frozen Deferred Decision과 일치하며 architecture conflict가 아니다. Production external effect 활성화는 해당 결정을 별도 승인할 때까지 차단한다.

## 8. Validation performed

### Repository Baseline

| Check | Result |
|---|---|
| Workspace | `D:\04. AI-MLS` — PASS |
| Initial working tree | clean — PASS |
| Branch | `main` — PASS |
| Current HEAD | `4117e60bda0d5bbb2a16642d749efed759e02b94` — PASS |
| Content baseline commit | `426f6de0cdcf8c384f70c3e333f7b6483616bd15` — PASS |
| Manifest primary files | 153 |
| Expected checksum | `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` |
| Recomputed checksum | exact match — PASS |
| pnpm lockfile | present |
| dependency installation | `node_modules` present |

### Toolchain and Quality Gates

| Command / Check | Exit | Result |
|---|---:|---|
| `node --version` | 0 | `v20.20.2`; required version mismatch recorded |
| `pnpm.cmd --version` | 0 | `11.9.0`; internal Node `v24.14.0` warning |
| `pnpm lint` | 0 | PASS |
| `pnpm typecheck` | 0 | PASS |
| `pnpm build` | 0 | PASS |
| `pnpm test` | 0 | PASS — 168 passed, 0 failed, 0 skipped |
| Architecture checksum verification | 0 | PASS — 153 files, checksum match |

`npm.cmd --version`은 sandbox가 `C:\Users\Pc`를 `lstat`하는 과정에서 `EPERM`으로 실패했다. npm은 project execution path가 아니고 approved package manager `pnpm 11.9.0`은 확인됐으므로 planning 결과에는 영향이 없다.

### Scope and Document Validation

- 7 implementation stages 모두 계획에 포함.
- 13 tasks 모두 required field 12개 포함.
- `FEAT-015` canonical IDs와 test mapping 완료.
- production code/schema/migration/API endpoint/worker/queue/event bus 변경 0.
- canonical ID/state/authority 변경 0.
- 문서 간 상대 링크와 required headings는 최종 validation에서 검사.

## 9. Known limitations

- Planning evidence는 runtime implementation PASS를 의미하지 않는다.
- current in-memory pattern은 production durability, multi-process concurrency, backup/restore 또는 DR evidence를 제공하지 않는다.
- actual provider delivery, connector evidence, credential scope 및 callback behavior는 `API-018/019`와 production adapter 승인 전 검증할 수 없다.
- physical route, schema, serialization, queue/event bus/store, worker topology와 numeric SLO는 의도적으로 미결정이다.
- exact Node.js `24.18.0` runtime이 현재 shell에서 활성화되지 않았다.

## 10. Next brief prerequisites

Next Recommended Stage는 별도 승인된 `Phase 13-2 FEAT-015 Implementation`이다. 시작 전 다음을 확인해야 한다.

1. 이 v0.1 implementation plan의 Architecture Owner 승인.
2. exact Node.js `24.18.0` runtime 활성화.
3. clean working tree와 unchanged v1.1 checksum.
4. implementation scope가 logical in-memory adapter까지만인지, production persistence/external effect까지인지 명시.
5. production effect가 범위에 포함되면 `DFD-003/005/006/007/008`에 필요한 별도 승인.

이 보고서 이후 FEAT-015 구현 또는 다음 Brief를 시작하지 않는다.

## Final Planning Summary

| Required report field | Result |
|---|---|
| Final Recommendation | `APPROVE_IMPLEMENTATION_PLAN` |
| Repository Baseline | content `426f6de`; evidence/HEAD `4117e60`; checksum PASS |
| FEAT-015 Scope | Publication aggregate/lifecycle, API-014, WF-010–012, exact authorization, delivery evidence, reconciliation, event/projection/operations/test boundaries |
| Architecture References | `TRACE-015`, `DEC-100`–`112`, PR/WR/AR/SR/PJR/ER/OR/TR |
| Implementation Stages | 7 |
| Task Count | 13 |
| Dependency Summary | sequential critical path `001 → 013`; no FEAT-016+ dependency |
| Deferred Decisions | 8 topics; production selections remain open |
| Test Strategy | canonical 11 `TEST-*` mappings plus domain/API/security/event/projection/operations/regression gates |
| Risks | runtime mismatch, no durable adapter, crash-window/idempotency, external truth ambiguity, role/capability drift |
| Files Created | 6 |
| Files Modified | 0 |
| Verification Results | lint/typecheck/build PASS; tests 168/168 PASS; checksum PASS |
| Commit Status | no commit created; not authorized/requested |
| Next Recommended Stage | Architecture Owner review, then separately authorized Phase 13-2 |
