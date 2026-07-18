# Book 2 — System Architecture Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-ARCH-001 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Purpose

Book 2는 AI MLS의 logical system boundary, container, module, interaction, background work, integration, failure isolation과 evolution을 정의한다. database schema, API endpoint, vendor deployment topology와 production code는 범위 밖이다.

## Navigation

| Document ID | 문서 | Architecture concern |
|---|---|---|
| DOC-ARCH-002 | [System Overview](01_SYSTEM_OVERVIEW.md) | goals, principles, boundary, modules, external/future systems |
| DOC-ARCH-003 | [Context Architecture](02_CONTEXT_ARCHITECTURE.md) | actors, external systems, system/trust boundary |
| DOC-ARCH-004 | [Container Architecture](03_CONTAINER_ARCHITECTURE.md) | logical runtime/data/AI/auth/connector containers |
| DOC-ARCH-005 | [Module Architecture](04_MODULE_ARCHITECTURE.md) | core module purpose, I/O와 dependency |
| DOC-ARCH-006 | [Data Flow Architecture](05_DATA_FLOW_ARCHITECTURE.md) | discovery-to-publication information flow |
| DOC-ARCH-007 | [Event and Job Architecture](06_EVENT_AND_JOB_ARCHITECTURE.md) | queue, job, retry, schedule와 event semantics |
| DOC-ARCH-008 | [Integration Architecture](07_INTEGRATION_ARCHITECTURE.md) | current/future/assumed external boundaries |
| DOC-ARCH-009 | [Failure Isolation](08_FAILURE_ISOLATION.md) | failure scenario, containment, retry와 recovery |
| DOC-ARCH-010 | [Scalability Strategy](09_SCALABILITY_STRATEGY.md) | MVP, growth, enterprise와 extraction criteria |
| DOC-ARCH-011 | [Architecture Decisions](10_ARCHITECTURE_DECISIONS.md) | ADR summary, impact, status와 review trigger |

## Architecture source bindings

- Constitution: `REQ-CONST-001`–`013`
- Business goals: `BG-001`–`BG-006`
- MVP boundary: [Product Scope and Non-Goals](../book-1/08_PRODUCT_SCOPE_AND_NON_GOALS.md)
- personas/workflow: [Target Users](../book-1/03_TARGET_USERS_AND_PERSONAS.md), [Workflow Analysis](../book-1/02_CURRENT_WORKFLOW_ANALYSIS.md)
- quality gate: [Definition of Done](../book-0/08_DEFINITION_OF_DONE.md)

## Decision status

Book 2와 ADR-001–006은 모두 `DRAFT`이며 approval 전 production mandate가 아니다. diagrams는 logical architecture를 설명하며 network/deployment diagram이 아니다.

> **OPEN DECISION:** A3 Architecture Review Board reviewer와 approval disposition을 지정해야 한다.
