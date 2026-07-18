# System Overview

| 항목 | 값 |
|---|---|
| Document ID | DOC-ARCH-002 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Architecture goals

| Goal | Business/constitutional trace | Architecture response |
|---|---|---|
| staff search/shortlist effort 감소 | BG-001, BG-002 | reusable candidate intelligence, matching, background parsing |
| trusted external information | BG-003, REQ-CONST-003/004 | verification, permission, approval gates |
| duplicate/rework 감소 | BG-004 | canonical suggestion + provenance-preserving duplicate review |
| source/outcome trace | BG-005, REQ-CONST-005/007 | source linkage, audit and reporting boundary |
| unauthorized exposure 방지 | BG-006, REQ-CONST-008–010/013 | authorization, connector isolation, fail-closed publication |
| controlled evolution | REQ-CONST-006 | modular boundary, ADR와 extraction criteria |

## Architecture principles

| Principle | Rule |
|---|---|
| Modular Monolith for MVP | core business modules는 한 deployable application boundary 안에서 explicit module contract를 유지한다. |
| Documentation First | approved requirement/flow/decision 없이 implementation architecture를 발명하지 않는다. |
| Architecture First | authority, trust, failure와 integration boundary를 code보다 먼저 정의한다. |
| AI Provider Independence | provider-specific behavior는 AI Provider Layer 뒤에 격리한다. |
| Human Approval | verification, sharing/publication permission와 publication은 authorized human evidence를 요구한다. |
| Connector Isolation | connector는 intake contract만 사용하고 core/private publication function을 우회하지 않는다. |
| Audit First | 중요한 read/change/approval/publication/retention action은 audit semantic을 갖는다. |
| No Direct AI Authority | AI output은 validated suggestion이며 authoritative state를 직접 write하지 않는다. |
| Single Source of Truth | authoritative business state는 Core Backend의 module ownership과 primary data store를 통해서만 변경한다. |
| Future Service Extraction | evidence-based scale/failure/team need가 있을 때 module boundary를 service로 추출한다. |

“Single Source of Truth”는 모든 raw/source/offer를 하나로 합친다는 뜻이 아니다. source record, candidate listing, verified listing, permission와 publication record의 authority를 분리하면서 각 record type의 canonical owner를 하나로 둔다는 뜻이다.

## System boundaries

### Inside AI MLS core

- identity/authorization enforcement
- source policy/registry와 manual intake
- raw source reference/storage control
- AI job orchestration와 output validation
- property/candidate/offer normalization and duplicate review
- contact restriction, client requirement와 matching
- verification, customer proposal, publication approval
- audit, reporting, administration, retention orchestration

### Outside core

- source websites/social/messaging platforms
- AI model providers
- identity provider where externally supplied
- `rbs-homes.com`
- email/SMS/messaging notification provider
- future CRM/accounting/marketing/memory gateway
- future connector/collector runtimes

외부 system은 core authority의 source of truth가 아니며 contract, policy, authentication, validation, retry와 audit boundary를 거친다.

## Core modules

Authentication, Authorization, Source Registry, Manual Intake, Raw Source Store, AI Parsing, Property Normalization, Candidate Listing, Duplicate Detection, Contact Management, Client Requirement, Matching, Verification, Customer Proposal, Publication Approval, rbs-homes Integration, Reporting, Administration, Audit, Retention/Expiration으로 구성한다. 자세한 책임은 [Module Architecture](04_MODULE_ARCHITECTURE.md)에 있다.

## External systems

| System | Relationship | Status |
|---|---|---|
| Source platform/channel | 사람이 approved source를 보고 manual intake | Current logical relationship |
| AI Provider | parsing/normalization/match assistance | ASSUMPTION [ASM-012]: provider/contract 미확정 |
| Identity Provider | authentication identity 제공 가능 | ASSUMPTION [ASM-013]: product 미확정 |
| rbs-homes.com | approved listing publication target | ASSUMPTION [ASM-014]: API 존재/방식 미확정 |
| Notification provider | internal task/status notification | Future/optional |
| Connector runtime | permitted automated intake | POST-MVP |

## Future expansion

- approved website/browser save connector
- AI Memory Gateway for governed reusable context (`POST-MVP`)
- CRM/accounting/marketing integrations
- external broker membership/contribution boundary
- enterprise organization isolation
- event bus and selectively extracted services

모든 expansion은 [Integration Architecture](07_INTEGRATION_ARCHITECTURE.md), CR/ADR와 source/security/privacy review를 요구한다.

## Non-goals

- final database schema, table, endpoint 또는 queue product 정의
- production hosting/network topology
- autonomous Facebook/Viber account control
- AI나 connector에 authoritative/publication authority 부여
- current MVP를 distributed microservices로 선행 분해

## Constitutional compliance

각 authoritative command는 Authentication/Authorization → module validation → audit → state change 순서를 보장한다. external publication은 추가로 valid verification, public-publication permission와 human approval을 검사한다.
