# Decision Rules

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-033 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](00_PROJECT_CONSTITUTION.md) |

## Decision hierarchy

1. Constitution compliance를 확인한다.
2. approved/frozen source-of-truth와 existing Decision/ADR를 확인한다.
3. business objective, security/privacy, data/AI authority와 operational impact를 함께 평가한다.
4. reversible하고 단순한 option을 선호하되 risk를 숨기지 않는다.
5. 결정, dissent, assumption와 downstream trace를 durable record로 남긴다.

## Architecture authority

Architecture Owner와 ARB는 boundary, consistency, technical trade-off와 ADR recommendation에 책임진다. Constitution 또는 User Approval을 단독으로 override하지 않는다. 중요한 architecture decision은 [Decision Register](../00_DECISION_REGISTER.md)에 ID를 가져야 한다.

## Business authority

Business Owner는 product scope, workflow, value, priority와 business risk에 concurrence한다. business urgency는 verification, permission, security/privacy 또는 audit control을 면제하지 않는다. User Approver는 project-level product/architecture candidate를 최종 승인한다.

## Decision classification

| Class | Example | Required route |
|---|---|---|
| Constitutional | authority 또는 `REQ-CONST-*` 변경 | amendment CR + ADR + ARB + all affected review + User Approval |
| Architectural | module/data/AI/integration/deployment boundary | CR + ADR + ARB + affected approval |
| Product/business | MVP scope, workflow, policy | CR/Decision ID + Business/Architecture + User Approval |
| Security/privacy | access, sensitive data, retention, external exposure | Security/Privacy mandatory review; blocking finding 해소 |
| Implementation | approved architecture 내 reversible detail | Development review; ADR 여부 triage |
| Editorial | 의미 불변 정정 | Architecture Owner triage와 patch evidence |

## Conflict resolution

1. [Constitution precedence](00_PROJECT_CONSTITUTION.md#document-precedence)를 적용한다.
2. conflict 대상 Document/Decision/Requirement ID와 version을 기록한다.
3. terminology conflict는 Glossary, authority conflict는 Constitution, process conflict는 Governance로 분류한다.
4. evidence와 alternatives를 ARB에서 검토하고 dissent를 보존한다.
5. 해결되지 않으면 User Approver에게 option/impact를 제시한다.
6. 결정 후 affected document, Decision Register, ADR, trace와 Version History를 갱신한다.

## Exception process

- exception은 convenience가 아니라 bounded, time-limited, risk-owned deviation이다.
- CR에 scope, reason, affected rule, compensating control, owner, expiry, rollback과 validation을 기록한다.
- Constitution mandatory requirement에 대한 exception은 허용되지 않으며 amendment가 필요하다.
- security/privacy exception은 specialist와 User Approver 승인이 필요하다.
- expiry 전 review하지 않으면 자동 종료되고 normal rule로 복귀한다.

## Emergency decisions

emergency는 imminent data loss, credential exposure, active incident 또는 unauthorized publication 위험에만 사용한다. [ARB emergency rule](../00_ARCHITECTURE_REVIEW_BOARD.md#emergency-decision-rule)과 [Urgent Approval Workflow](../00_APPROVAL_WORKFLOW.md#urgent-approval-workflow)를 따른다.

- 최소 reversible action, explicit expiry와 rollback만 허용한다.
- constitutional control, human approval, provenance, audit와 authorization을 우회하지 않는다.
- 1 business day 내 CR/Decision ID, 2 business days 내 retrospective review가 필요하다.
- emergency decision으로 Constitution amendment 또는 frozen release를 승인할 수 없다.

## Approval requirements

| Decision impact | Mandatory approval |
|---|---|
| Constitution | Architecture, Business, affected specialists, User Approver |
| External sharing/publication | Business, Security/Privacy, User-approved policy; record별 authorized human |
| AI authority/provider privacy | Architecture, AI, Security/Privacy, User Approver |
| Data/retention | Architecture, Database, Security/Privacy, Business 영향 시 Business |
| Frozen baseline | ARB recommendation, User freeze approval, Release Owner attestation |

approval은 fixed Document ID/version/candidate와 evidence에 결합한다. candidate가 normative하게 바뀌면 영향받은 approval을 다시 받아야 한다.

## Decision quality criteria

- context와 problem이 검증 가능하다.
- 최소 두 viable alternative 또는 단일 option인 이유가 있다.
- security/privacy, data, AI, operations, cost와 rollback impact가 있다.
- assumption/risk가 register에 연결된다.
- owner, status, target phase와 review date가 있다.
- downstream requirement/test/phase 영향이 trace된다.

## Constitutional bindings

`REQ-CONST-002`, `REQ-CONST-006`–`REQ-CONST-010`을 decision/exception/emergency governance로 구체화한다.

> **OPEN DECISION:** named authority와 delegation matrix는 A1 approval 후 Governance register에 반영해야 한다.
