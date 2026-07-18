# Master Development Roadmap Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-ROADMAP-001 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Product Owner / Architecture Owner |
| 기준일 | 2026-07-15 |
| Phase | Phase 13 |

## Purpose

Book 12는 Phase 0–12 Architecture Bible을 implementation-ready logical roadmap으로 변환한다. 이 Book은 code, schema, endpoint, scaffolding, calendar commitment, budget 또는 implementation authorization이 아니다.

## Mandatory principles

1. Architecture가 implementation sequence와 acceptance를 결정한다.
2. approved documentation과 Ready evidence 없는 implementation은 시작하지 않는다.
3. 모든 Feature, Sprint와 Release는 permanent IDs와 tests로 추적한다.
4. 모든 `DEV-*`는 Epic/Feature/Sprint/Release/Implementation에 배정한다.
5. orphan task, feature, implementation, sprint 또는 release를 허용하지 않는다.
6. human approval, authority, audit, provenance, privacy와 external-effect gate를 일정 때문에 약화하지 않는다.

## Document map

| Document ID | 문서 | 책임 |
|---|---|---|
| DOC-ROADMAP-001 | Roadmap Index | navigation, scope와 ID system |
| DOC-ROADMAP-002 | [Implementation Strategy](01_IMPLEMENTATION_STRATEGY.md) | architecture/risk/MVP/POST-MVP strategy |
| DOC-ROADMAP-003 | [Epic Breakdown](02_EPIC_BREAKDOWN.md) | DEV task를 10개 Epic으로 배정 |
| DOC-ROADMAP-004 | [Feature Breakdown](03_FEATURE_BREAKDOWN.md) | Epic을 24개 testable Feature로 분해 |
| DOC-ROADMAP-005 | [Development Sequence](04_DEVELOPMENT_SEQUENCE.md) | requirement-to-test implementation order |
| DOC-ROADMAP-006 | [Sprint Plan](05_SPRINT_PLAN.md) | date-free logical Sprint 0–10 |
| DOC-ROADMAP-007 | [Release Plan](06_RELEASE_PLAN.md) | MVP/Beta/RC/Production/Future gates |
| DOC-ROADMAP-008 | [Dependency Matrix](07_DEPENDENCY_MATRIX.md) | task/epic/module/risk dependency |
| DOC-ROADMAP-009 | [Implementation Traceability](08_IMPLEMENTATION_TRACEABILITY.md) | complete cross-layer trace contract |
| DOC-ROADMAP-010 | [Development Risk Register](09_DEVELOPMENT_RISK_REGISTER.md) | development/technical/architecture/operations risk |
| DOC-ROADMAP-011 | [Migration Strategy](10_MIGRATION_STRATEGY.md) | legacy/data/feature migration와 rollback |
| DOC-ROADMAP-012 | [Cutover Strategy](11_CUTOVER_STRATEGY.md) | go-live preparation, phases, rollback와 communication |
| DOC-ROADMAP-013 | [Go-Live Checklist](12_GO_LIVE_CHECKLIST.md) | architecture/data/security/operations/test/doc/approval gate |
| DOC-ROADMAP-014 | [Post-Go-Live Plan](13_POST_GO_LIVE_PLAN.md) | monitoring, hypercare, issue와 improvement |
| DOC-ROADMAP-015 | [Release Registry](14_RELEASE_REGISTRY.md) | REL-001–005 permanent release identity |
| DOC-ROADMAP-016 | [Implementation Registry](15_IMPLEMENTATION_REGISTRY.md) | IMP-001–024 complete implementation mapping |

## Identifier model

| ID | Range | Meaning |
|---|---|---|
| Epic | `EPIC-001–010` | outcome-oriented capability group |
| Feature | `FEAT-001–024` | testable delivery slice, one primary DEV task |
| Sprint | `SP-000–010` | dependency-ordered logical iteration, no calendar date |
| Release | `REL-001–005` | cumulative approved release candidate/class |
| Implementation | `IMP-001–024` | Feature-to-release planning record |

## Authority

[Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md), [Developer Bible](../book-11/00_DEVELOPER_BIBLE_INDEX.md), [Developer Registry](../book-11/15_DEVELOPER_REGISTRY.md), [Test Registry](../book-10/15_TEST_REGISTRY.md), [Release Acceptance](../book-10/12_RELEASE_ACCEPTANCE.md)와 [Release Management](../book-9/04_RELEASE_MANAGEMENT.md)을 따른다.

## Status

모든 roadmap row는 `PLANNED`이며 approval, staffing, estimate, code existence 또는 release commitment를 의미하지 않는다. `POST-MVP`는 별도 approval 전 implementation 대상이 아니다.
