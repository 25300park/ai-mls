# Book 1 — Business Strategy Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-BIZ-001 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Purpose

Book 1은 AI MLS가 왜 존재하고 누구를 위해 어떤 business problem을 해결하며, internal Property Intelligence Platform에서 미래 cooperative MLS로 어떻게 진화할지 정의한다. business strategy만 다루며 architecture, database schema, API specification 또는 implementation을 정하지 않는다.

## Strategic thesis

AI MLS의 첫 가치는 더 많은 listing을 모으는 것이 아니라 staff search/review effort를 줄이고, provenance와 human verification을 갖춘 적합한 option을 더 빨리 제시하는 데 있다. 외부 사용은 verification과 별도 permission을 통과한 정보로 제한한다. external broker network와 marketplace는 internal controls, governance와 evidence가 검증된 뒤의 `POST-MVP` 방향이다.

## Book navigation

| Document ID | 문서 | 책임 질문 |
|---|---|---|
| DOC-BIZ-002 | [Problem Statement](01_PROBLEM_STATEMENT.md) | 어떤 business problem과 opportunity가 있는가? |
| DOC-BIZ-003 | [Current Workflow Analysis](02_CURRENT_WORKFLOW_ANALYSIS.md) | 현재 일은 어떻게 흐르고 어디서 막히는가? |
| DOC-BIZ-004 | [Target Users and Personas](03_TARGET_USERS_AND_PERSONAS.md) | 누가 사용·결정·혜택·정보를 제공하는가? |
| DOC-BIZ-005 | [Value Proposition](04_VALUE_PROPOSITION.md) | staff, customer와 business에 어떤 가치가 있는가? |
| DOC-BIZ-006 | [US MLS Comparison](05_US_MLS_COMPARISON.md) | 전통적 cooperative MLS와 무엇이 같고 다른가? |
| DOC-BIZ-007 | [Philippine Market Context](06_PHILIPPINE_MARKET_CONTEXT.md) | local regulation/ecosystem이 어떤 제약과 기회를 만드는가? |
| DOC-BIZ-008 | [Business Model](07_BUSINESS_MODEL.md) | 현재 productivity model과 미래 revenue hypothesis는 무엇인가? |
| DOC-BIZ-009 | [Product Scope and Non-Goals](08_PRODUCT_SCOPE_AND_NON_GOALS.md) | MVP/phase/POST-MVP 경계는 무엇인가? |
| DOC-BIZ-010 | [Success Metrics](09_SUCCESS_METRICS.md) | 가치를 어떤 KPI로 검증할 것인가? |
| DOC-BIZ-011 | [Long-Term Roadmap](10_LONG_TERM_ROADMAP.md) | 1/3/5/10년 outcome horizon은 무엇인가? |

## Business goal source of truth

Book 0의 `BG-001`–`BG-006`을 재발급하거나 재정의하지 않는다. 이 Book은 각 goal의 problem, persona, value, metric과 horizon을 연결한다.

| Business Goal | Strategy coverage |
|---|---|
| `BG-001` search effort 감소 | problem, workflow, value, search time KPI |
| `BG-002` shortlist 시간 단축 | workflow, personas, time-to-shortlist KPI |
| `BG-003` 신뢰성/freshness 향상 | external-use policy, verification/publication KPI |
| `BG-004` duplicate/rework 감소 | workflow bottleneck, duplicate KPI |
| `BG-005` source contribution 이해 | business model, viewing/closing contribution KPI |
| `BG-006` unauthorized exposure 방지 | scope/non-goal, publication accuracy/control KPI |

## Evidence classification

- `CONSTITUTIONAL`: approved Book 0 requirement를 그대로 참조한다.
- `OFFICIAL SOURCE`: law/regulator/standards body의 linked source로 지지된다.
- `ASSUMPTION`: staff interview, baseline 또는 pilot로 검증해야 한다.
- `HYPOTHESIS`: future business/revenue proposition이며 commitment가 아니다.
- `POST-MVP`: current product scope 밖의 future direction이다.

## Constitutional bindings

`REQ-CONST-001`–`REQ-CONST-013`과 [Product Principles](../book-0/02_PRODUCT_PRINCIPLES.md)을 따른다. 특히 speed/revenue objective는 verification, permission, provenance, audit, privacy 또는 human approval을 약화할 수 없다.

> **OPEN DECISION:** Book 1의 named Business Owner와 KPI baseline/target approval date를 지정해야 한다.
