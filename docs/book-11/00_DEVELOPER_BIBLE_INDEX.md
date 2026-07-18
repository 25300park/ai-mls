# Developer Bible Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-001 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Development Reviewer / Architecture Owner |
| 기준일 | 2026-07-15 |
| Phase | Phase 12 |

## Purpose

Book 11은 승인된 Architecture Bible을 추적 가능하고 검토 가능한 구현으로 전환하기 위한 development governance를 정의한다. 이 Book은 application code, repository scaffolding, executable configuration 또는 implementation commitment가 아니다.

## Mandatory principles

1. Documentation과 architecture approval 없이 implementation을 시작하지 않는다.
2. Requirement, Workflow와 Test가 없는 code change는 허용하지 않는다.
3. 모든 module과 dependency direction을 문서화한다.
4. 모든 commit은 `DEV-*`, requirement와 test evidence로 추적한다.
5. AI/Codex generated code는 human review와 동일한 quality gate를 통과한다.
6. Architecture가 implementation 관행보다 우선한다.
7. 권한, audit, provenance, privacy와 human approval control을 우회하지 않는다.

## Document map

| Document ID | 문서 | 책임 |
|---|---|---|
| DOC-DEV-001 | Developer Bible Index | navigation, scope와 mandatory principles |
| DOC-DEV-002 | [Development Principles](01_DEVELOPMENT_PRINCIPLES.md) | development philosophy와 delivery posture |
| DOC-DEV-003 | [Repository Structure](02_REPOSITORY_STRUCTURE.md) | logical repository zones와 ownership |
| DOC-DEV-004 | [Coding Standards](03_CODING_STANDARDS.md) | formatting, errors, logs와 dependencies |
| DOC-DEV-005 | [Naming Conventions](04_NAMING_CONVENTIONS.md) | code/data/API identifier rules |
| DOC-DEV-006 | [Folder and Module Rules](05_FOLDER_AND_MODULE_RULES.md) | module boundaries와 dependency direction |
| DOC-DEV-007 | [Git Workflow](06_GIT_WORKFLOW.md) | commit, PR, review와 merge |
| DOC-DEV-008 | [Branching and Release](07_BRANCHING_AND_RELEASE.md) | branch, tag와 version policy |
| DOC-DEV-009 | [Development Traceability](08_DEVELOPMENT_TRACEABILITY.md) | requirement-to-commit-to-test chain |
| DOC-DEV-010 | [Code Review Guide](09_CODE_REVIEW_GUIDE.md) | architecture/security/performance review |
| DOC-DEV-011 | [Definition of Ready](10_DEFINITION_OF_READY.md) | development entry gate |
| DOC-DEV-012 | [Definition of Done — Development](11_DEFINITION_OF_DONE_DEVELOPMENT.md) | development exit gate |
| DOC-DEV-013 | [Technical Debt Policy](12_TECHNICAL_DEBT_POLICY.md) | debt registration, approval와 resolution |
| DOC-DEV-014 | [Documentation Rules](13_DOCUMENTATION_RULES.md) | implementation-linked documentation upkeep |
| DOC-DEV-015 | [Code Generation Policy](14_CODE_GENERATION_POLICY.md) | Codex/AI-assisted coding governance |
| DOC-DEV-016 | [Developer Registry](15_DEVELOPER_REGISTRY.md) | permanent `DEV-*` work-package trace |

## Authority and related sources

- [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md)
- [Development Principles](../book-0/06_DEVELOPMENT_PRINCIPLES.md)
- [Definition of Done](../book-0/08_DEFINITION_OF_DONE.md)
- [Naming Convention](../00_NAMING_CONVENTION.md)
- [Traceability Rule](../00_TRACEABILITY_RULE.md)
- [Test Registry](../book-10/15_TEST_REGISTRY.md)

## Scope status

모든 문서는 `DRAFT`다. `DEV-*` row의 `PLANNED`는 구현 승인이나 착수를 뜻하지 않으며 Phase 13 roadmap과 F1 freeze 이후 별도 development authorization이 필요하다.
