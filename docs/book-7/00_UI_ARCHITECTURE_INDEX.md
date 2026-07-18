# UI/UX Architecture Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-UI-001 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Business Owner |
| 기준일 | 2026-07-14 |
| Phase | Phase 8 |

## Purpose

Book 7은 AI MLS의 implementation-independent UI/UX 계약을 정의한다. UI는 [Workflow Index](../book-5/00_WORKFLOW_INDEX.md), [Data Dictionary](../book-3/15_DATA_DICTIONARY.md), [API Registry](../book-6/16_API_REGISTRY.md), [AI Architecture Index](../book-4/00_AI_ARCHITECTURE_INDEX.md)의 authority를 표현하며 새 authority를 만들지 않는다.

## Mandatory principles

1. 모든 screen은 최소 하나의 canonical workflow와 entity에 mapping한다.
2. 모든 user action은 하나 이상의 `API-*` capability를 통해 수행하며 직접 데이터 변경이나 hidden action을 허용하지 않는다.
3. AI interaction은 `AI-*` capability, advisory 성격, confidence/limitation과 human review 경계를 표시한다.
4. UI는 workflow prerequisite, authorization, approval, audit 또는 external reconciliation을 우회하지 않는다.
5. destructive, approval, publication, permission action은 명시적 label, impact, confirmation과 result evidence를 제공한다.
6. UI display state와 canonical business status를 분리하고 canonical status를 숨기거나 더 강한 상태로 오해시키지 않는다.

## Document map

| Document ID | 문서 | 책임 |
|---|---|---|
| DOC-UI-002 | [Information Architecture](01_INFORMATION_ARCHITECTURE.md) | domain, content hierarchy, object context |
| DOC-UI-003 | [Navigation Structure](02_NAVIGATION_STRUCTURE.md) | global/local/task navigation |
| DOC-UI-004 | [User Roles and Dashboards](03_USER_ROLES_AND_DASHBOARDS.md) | role별 landing surface와 scope |
| DOC-UI-005 | [Screen Catalog](04_SCREEN_CATALOG.md) | logical screen inventory |
| DOC-UI-006 | [Screen Specifications](05_SCREEN_SPECIFICATIONS.md) | input/output/action 계약 |
| DOC-UI-007 | [Form Standard](06_FORM_STANDARD.md) | form behavior와 validation |
| DOC-UI-008 | [Search and Filter Standard](07_SEARCH_AND_FILTER_STANDARD.md) | query/filter/sort semantics |
| DOC-UI-009 | [Table and List Standard](08_TABLE_AND_LIST_STANDARD.md) | collection presentation와 bulk action |
| DOC-UI-010 | [Notification and Feedback](09_NOTIFICATION_AND_FEEDBACK.md) | feedback, task, alert 원칙 |
| DOC-UI-011 | [Design System Guide](10_DESIGN_SYSTEM_GUIDE.md) | semantic token/component contract |
| DOC-UI-012 | [Responsive Strategy](11_RESPONSIVE_STRATEGY.md) | viewport와 task continuity |
| DOC-UI-013 | [Accessibility Guide](12_ACCESSIBILITY_GUIDE.md) | WCAG 2.2 AA 목표와 review criteria |
| DOC-UI-014 | [Error and Empty State](13_ERROR_AND_EMPTY_STATE.md) | safe recovery와 disclosure |
| DOC-UI-015 | [UI State Model](14_UI_STATE_MODEL.md) | view state와 business state 분리 |
| DOC-UI-016 | [Screen Registry](15_SCREEN_REGISTRY.md) | `UI-001`–`UI-037` canonical mapping |

## Traceability boundary

`Requirement → WF-* → Entity → API-* → UI-* → AI-*/N/A → TEST PLANNED → Phase 8`

Book 10 이전에는 `TEST-*`를 선발급하지 않는다. 현재 screen별 trace는 [Screen Registry](15_SCREEN_REGISTRY.md)가 관리하고 test placeholder는 `PLANNED — Book 10`으로 기록한다.

## Scope

본 Book은 logical screen, interaction, navigation, design/accessibility 원칙만 정의한다. Figma, wireframe asset, HTML/CSS, component code, executable route, final visual brand와 analytics implementation은 범위 밖이다.

