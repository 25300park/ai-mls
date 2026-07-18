# Book 0 — AI MLS Project Constitution

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-026 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |

## Constitution Summary

mrHOMES AI MLS는 내부 Property Intelligence Platform으로 시작한다. AI는 구조화·추천·설명을 지원하지만 승인 권한을 갖지 않는다. candidate listing은 사람의 verification과 별도 permission 없이는 외부로 나갈 수 없으며, client-sharing permission과 public-publication permission은 분리한다. 모든 중요한 data와 action은 provenance와 audit evidence를 유지한다. connector는 core authority를 우회할 수 없고, architecture 변경은 공개된 governance 절차로 추적한다.

이 Constitution은 사용자의 명시적 지시와 적용 가능한 상위 정책을 제외한 **저장소 내부 최고 project architecture authority**다. 하위 문서, ADR, roadmap, phase brief와 source code는 이를 위반할 수 없다.

## Purpose

이 문서는 AI MLS의 불변에 가까운 product, AI, data, security/privacy, development와 decision 원칙을 규정하여 후속 Architecture Bible과 구현이 서로 다른 전제를 발명하지 않도록 한다. 세부 원칙은 [Mission, Vision, Values](01_MISSION_VISION_VALUES.md)부터 [Definition of Done](08_DEFINITION_OF_DONE.md)까지의 Book 0 문서가 이 Constitution의 위임 아래 구체화한다.

## Scope

적용 대상은 다음과 같다.

- Architecture Bible의 모든 Book, appendix, ADR, review와 release
- 향후 AI MLS core, UI, API, data, AI, security, operations와 test architecture
- manual intake, approved connector/collector 및 `rbs-homes.com` integration boundary
- 내부 사용자, client sharing, public publication과 `POST-MVP` cooperative MLS evolution

이 문서는 final database schema, endpoint, UI design 또는 technology vendor를 선택하지 않는다. 해당 결정은 후속 Book과 ADR에서 이 Constitution의 제약 안에 정의한다.

## Authority

- Constitution은 저장소 내부 architecture 문서 중 가장 높은 규범 authority다.
- lower-level document는 Constitution을 구체화할 수 있지만 약화·면제·재해석할 수 없다.
- 충돌 시 lower-level artifact는 수정 대상이며, 이미 승인됐더라도 Constitution amendment 없이 우선할 수 없다.
- Architecture Review Board(ARB)는 해석 recommendation을 제공하고 User Approver가 project-level conflict를 최종 판단한다.
- emergency decision도 constitutional requirement를 정지시키지 못한다.

현재 문서는 `DRAFT`이므로 [Approval Workflow](../00_APPROVAL_WORKFLOW.md)에 따른 사용자 승인 전까지 frozen authority가 아니다. 승인되면 이 section의 precedence가 효력을 갖는다.

## Document precedence

상위 정책 및 사용자의 최신 명시적 지시를 존중하면서 repository 내부 충돌은 다음 순서로 해결한다.

1. 적용 가능한 platform/system policy와 사용자의 최신 명시적 승인 또는 지시
2. `APPROVED` 또는 `FROZEN` Project Constitution
3. Constitution amendment를 준수하는 approved ADR
4. approved/frozen Architecture Bible 문서
5. approved Master Development Roadmap
6. current phase-specific brief와 completion evidence
7. 기존 source code 및 구현 관행

동일 level에서는 더 구체적이고 최신의 approved artifact를 우선하지만, conflict를 [Decision Register](../00_DECISION_REGISTER.md)와 review report에 기록한다. status가 `DRAFT`인 문서는 approved artifact를 자동 대체하지 않는다.

## Source-of-truth hierarchy

| 대상 | Canonical source | 규칙 |
|---|---|---|
| Constitutional requirement | 이 문서의 `REQ-CONST-*` | 다른 문서가 별도 원칙 ID로 복제하지 않고 참조 |
| 표준 용어 | [Glossary](../00_GLOSSARY.md) | 의미 변경은 review와 version update 필요 |
| Architecture decision | [Decision Register](../00_DECISION_REGISTER.md)와 approved ADR | supersession을 명시하고 과거 기록 보존 |
| Document identity/navigation | [Master Index](../00_MASTER_INDEX.md) | permanent Document ID가 path보다 우선 |
| Change/approval/lifecycle | [Document Governance](../00_DOCUMENT_GOVERNANCE.md) 및 linked controls | evidence 없는 변경·승인 금지 |
| Requirement trace | [Traceability Rule](../00_TRACEABILITY_RULE.md)에 따른 matrix | upstream/downstream 양방향 연결 |

## Mandatory constitutional requirements

이 표가 mandatory principle의 유일한 canonical statement다. Book 0의 다른 문서는 ID를 참조해 적용 방법을 구체화한다. Brief의 “customer sharing permission”은 [Glossary](../00_GLOSSARY.md)의 `client-sharing permission`, “publication permission”은 `public-publication permission`을 뜻한다.

| Requirement ID | Canonical requirement | Minimum measurable evidence |
|---|---|---|
| `REQ-CONST-001` | AI recommends. | AI output contract에 recommendation/advisory 표시가 있고 approval authority가 없음 |
| `REQ-CONST-002` | Humans approve. | 외부 공유·게시 및 authoritative transition에 approver identity/time/evidence 존재 |
| `REQ-CONST-003` | No publication without verification. | publication attempt가 유효한 verification reference 없으면 거부됨 |
| `REQ-CONST-004` | No publication without permission. | public-publication permission/approval reference 없으면 거부됨 |
| `REQ-CONST-005` | No loss of source provenance. | 중요 record가 source record와 transformation lineage로 역추적됨 |
| `REQ-CONST-006` | No hidden architectural changes. | 중요 변경이 CR, decision/ADR, affected document/version과 approval로 추적됨 |
| `REQ-CONST-007` | Every important action is auditable. | 정의된 중요 action에 actor, time, action, target, outcome/correlation evidence 존재 |
| `REQ-CONST-008` | No direct AI authority over production data. | AI output이 validation과 authorized application/human control 없이 authoritative state를 쓰지 못함 |
| `REQ-CONST-009` | No connector bypass. | connector/collector가 core validation, authorization, verification 또는 publication control을 직접 우회하지 못함 |
| `REQ-CONST-010` | No privilege escalation. | role test와 audit가 사용자의 승인 범위를 넘는 action을 차단함 |
| `REQ-CONST-011` | Internal candidate is not a verified listing. | candidate listing과 verified listing의 state/evidence가 분리됨 |
| `REQ-CONST-012` | Verified listing is not a published listing. | verification만으로 publication state가 생성되지 않음 |
| `REQ-CONST-013` | Client-sharing permission is not public-publication permission. | 두 permission이 독립적으로 기록·검사되며 하나가 다른 하나를 암시하지 않음 |

모든 후속 normative requirement는 최소 하나의 `REQ-CONST-*` 또는 명시적 business goal에 연결한다.

## Core philosophy

- 신뢰 가능한 정보가 많은 정보보다 우선한다.
- automation은 human accountability를 강화해야 하며 제거하지 않는다.
- provenance, privacy, security와 auditability는 feature 이후의 보완물이 아니라 설계 입력이다.
- reversible, observable, reviewable change를 선호한다.
- internal candidate discovery와 external authority를 명확히 분리한다.

## Architecture philosophy

- core authority와 external connector/collector failure domain을 분리한다.
- AI provider, external platform과 infrastructure는 replaceable boundary 뒤에 둔다.
- authoritative state change는 deterministic validation, authorization과 audit를 통과한다.
- architecture decision은 [ADR](../adr/README.md), CR, Decision ID와 affected trace로 공개한다.
- MVP는 단순성과 명확한 boundary를 우선하고, scalability는 evidence 기반으로 진화시킨다.

## Product philosophy

- internal-first로 직원의 검색·검토·매칭·verification 품질과 속도를 개선한다.
- 외부에는 verified하고 허용된 정보만 전달한다.
- 고객에게는 빠른 답보다 근거 있고 최신인 답을 우선한다.
- cooperative MLS는 governance와 contribution authority가 준비된 이후의 `POST-MVP` 방향이다.

## Human approval philosophy

human approval은 단순 클릭이 아니라 evidence를 이해하고 책임 있는 결정을 기록하는 control이다. approval 화면·workflow는 source, confidence, verification, permission, conflict와 freshness를 보여야 한다. 승인자는 자신의 role 범위만 승인하며 self-approval과 emergency shortcut은 [Approval Workflow](../00_APPROVAL_WORKFLOW.md)의 제한을 따른다.

## Constitution amendment process

1. [Change Request Register](../00_CHANGE_REQUEST_REGISTER.md)에 `HIGH` 이상 CR을 등록한다.
2. 변경 이유, alternatives, affected `REQ-CONST-*`, Book/trace/release, security/privacy와 rollback 영향을 기록한다.
3. constitutional amendment ADR과 새 Decision ID를 만든다.
4. ARB 전원 review가 아니라도 모든 mandatory affected role의 review와 documented dissent가 필요하다.
5. Business Owner, Architecture Owner, affected specialist와 User Approver의 명시적 승인을 얻는다.
6. 새 major/minor version, Version History, Master Index와 affected documents를 갱신한다.
7. frozen Constitution은 in-place 수정하지 않고 [Release Policy](../00_RELEASE_POLICY.md)에 따라 새 release로 대체한다.

긴급 절차로 amendment를 승인할 수 없다. critical incident에서는 Constitution을 지키는 임시 mitigation만 허용하고 정식 amendment는 정상 workflow로 처리한다.

## Relationship to ADR

- ADR은 Constitution을 구현·해석하는 architecture 선택을 기록한다.
- ADR이 Constitution과 충돌하면 ADR은 승인할 수 없고 amendment가 먼저다.
- Constitution은 특정 technology 선택을 피하며, 선택이 필요할 때 ADR이 alternatives와 consequence를 기록한다.
- superseding ADR도 constitutional compliance와 traceability를 유지한다.

## Relationship to Architecture Bible

Book 1–12는 이 Constitution을 business, system, data, AI, workflow, API, UI, security, operations, test, development와 roadmap 명세로 구체화한다. 각 Book은 관련 constitutional requirement ID, risk/assumption, decision과 test/phase trace를 포함해야 한다. R1은 end-to-end conflict와 coverage를 검증하고, F1은 approved Constitution을 최상위 frozen source로 포함한다.

## Related Book 0 documents

- [Mission, Vision, Values](01_MISSION_VISION_VALUES.md)
- [Product Principles](02_PRODUCT_PRINCIPLES.md)
- [AI Principles](03_AI_PRINCIPLES.md)
- [Data Principles](04_DATA_PRINCIPLES.md)
- [Security and Privacy Principles](05_SECURITY_PRIVACY_PRINCIPLES.md)
- [Development Principles](06_DEVELOPMENT_PRINCIPLES.md)
- [Decision Rules](07_DECISION_RULES.md)
- [Definition of Done](08_DEFINITION_OF_DONE.md)

> **OPEN DECISION:** named User Approver와 Constitution amendment approver/delegate는 A1 approval 전에 지정해야 한다.
