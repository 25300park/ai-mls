# Architecture Assumption Register

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-014 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |

이 register는 architecture 작업을 진행하기 위해 임시로 사용하는 검증 가능한 전제를 기록한다. `ASSUMPTION`은 승인된 decision이 아니며, 검증 전에는 최종 schema, API 또는 technology commitment의 근거로 사용할 수 없다. 위험은 [Risk Register](00_RISK_REGISTER.md), 결정 전환은 [ADR workflow](adr/README.md)를 따른다.

## 상태와 품질 규칙

| Status | 의미 |
|---|---|
| `PROPOSED` | 사용 제안만 있고 아직 검증을 시작하지 않음 |
| `VALIDATING` | owner와 방법이 정해져 검증 중 |
| `VALIDATED` | evidence로 참임을 확인; 필요하면 ADR로 decision 전환 |
| `INVALIDATED` | 거짓으로 확인되어 영향 분석과 대체 계획 필요 |
| `RETIRED` | 더 이상 유효 범위에 필요하지 않음 |

모든 statement는 반증 가능해야 한다. `VALIDATED` 또는 `INVALIDATED` 전환에는 evidence link와 검증일이 필요하며, 가정이 거짓일 때 `HIGH` 이상 영향이면 [Risk Register](00_RISK_REGISTER.md)에 연결한다.

## Assumption register

| Assumption ID | Statement | Reason | Impact if False | Owner | Validation Method | Expected Validation Gate | Status | Evidence / Disposition |
|---|---|---|---|---|---|---|---|---|
| ASM-001 | **ASSUMPTION:** Supabase가 MVP의 primary database service가 될 수 있다. | master brief의 deployment 후보 | vendor/data/operations boundary 재검토 | Architecture Owner | Book 3/8/9 constraints와 option review | D0 entry | VALIDATING | KEEP OPEN; ADR-003/DEC-013과 함께 provider evidence 필요 |
| ASM-002 | **ASSUMPTION:** Next.js가 frontend framework로 유지될 수 있다. | master brief의 권장 후보 | UI/deployment/developer standards 재검토 | Architecture Owner | Book 2/7, hosting, team capability 비교 | D0 entry | VALIDATING | KEEP OPEN; implementation authorization 전 stack decision 필요 |
| ASM-003 | **ASSUMPTION:** AI provider abstraction이 required AI 기능을 provider-independent contract로 지원할 수 있다. | outage와 lock-in 영향 완화 | provider-specific contract 또는 capability 제한 필요 | AI Owner | 최소 두 provider capability 비교 | D0 entry | VALIDATING | KEEP OPEN; ADR-006 원칙은 승인하되 provider evidence는 별도 |
| ASM-004 | **ASSUMPTION:** MVP는 internal use first로 운영된다. | product definition과 외부 노출 제한 원칙 | tenancy/governance/compliance 범위 확대 | Product Approver | Book 0 constitution과 Book 1 scope review | Phase 15 | RETIRED | DEC-010, DEC-088 및 승인된 Book 0/1 baseline으로 decision 전환 |
| ASM-005 | **ASSUMPTION:** 외부 공유 또는 게시 전 manual verification이 항상 가능하다. | AI 승인 금지와 미검증 외부 노출 금지 | workflow 중단 또는 대체 human control 필요 | Product Approver | capacity, SLA, exception workflow review | D0 entry | VALIDATING | KEEP OPEN; staffing/capacity evidence 전 availability를 보장하지 않음 |
| ASM-006 | **ASSUMPTION:** Architecture Owner가 문서 일관성과 release 준비를 책임지는 역할이다. | 초기 governance role 전제 | approval/accountability 불명확 | User Approver | governance role table review | Phase 15 | RETIRED | [Document Governance](00_DOCUMENT_GOVERNANCE.md)의 canonical role definition으로 전환 |
| ASM-007 | **ASSUMPTION:** Book 1 current-state description이 실제 internal workflow를 대표한다. | brief 기반 working model | business priority와 bottleneck 재평가 | Business Owner | staff interview, observation, baseline | D0 discovery | VALIDATING | [Problem Statement](book-1/01_PROBLEM_STATEMENT.md); KEEP OPEN |
| ASM-008 | **ASSUMPTION:** Book 1 workflow model이 company-wide measured fact에 근접한다. | process documentation 필요 | workflow/KPI baseline 조정 | Business Owner | named team observation | D0 discovery | VALIDATING | [Current Workflow Analysis](book-1/02_CURRENT_WORKFLOW_ANALYSIS.md); KEEP OPEN |
| ASM-009 | **ASSUMPTION:** candidate source mix는 broker/owner/developer communication, community channel, website와 internal record로 분산된다. | market-context working model | connector/source priority 조정 | Business Owner | source inventory와 interview | D0 discovery | VALIDATING | [Philippine Market Context](book-1/06_PHILIPPINE_MARKET_CONTEXT.md); KEEP OPEN |
| ASM-010 | **ASSUMPTION:** source별 naming, format, language, terms와 availability 차이로 manual reconciliation이 필요하다. | normalization problem model | normalization scope/KPI 조정 | Business Owner | sample inventory and reconciliation study | D0 discovery | VALIDATING | [Philippine Market Context](book-1/06_PHILIPPINE_MARKET_CONTEXT.md); KEEP OPEN |
| ASM-011 | **ASSUMPTION:** availability, viewing, condition과 permission 확인의 상당 부분이 call/message로 수행된다. | audit/response-delay hypothesis | communication workflow와 audit priority 조정 | Business Owner | staff observation and channel inventory | D0 discovery | VALIDATING | [Philippine Market Context](book-1/06_PHILIPPINE_MARKET_CONTEXT.md); KEEP OPEN |
| ASM-012 | **ASSUMPTION:** AI provider/contract가 required capability를 제공할 수 있다. | logical AI boundary를 유지하기 위한 전제 | capability/provider boundary 조정 | AI Owner | provider and contract review | D0 entry | VALIDATING | [System Overview](book-2/01_SYSTEM_OVERVIEW.md); KEEP OPEN |
| ASM-013 | **ASSUMPTION:** 선택할 identity provider가 required authentication identity를 제공한다. | logical identity boundary를 유지하기 위한 전제 | authentication/deployment boundary 조정 | Security Reviewer | identity option and control review | D0 entry | VALIDATING | [System Overview](book-2/01_SYSTEM_OVERVIEW.md); KEEP OPEN |
| ASM-014 | **ASSUMPTION:** rbs-homes publication integration에 사용 가능한 승인된 API 또는 contract가 존재한다. | logical outbound integration 후보 | manual export 또는 connector boundary 재평가 | Architecture Owner | contract/API/source-policy confirmation | connector implementation gate | VALIDATING | [Integration Architecture](book-2/07_INTEGRATION_ARCHITECTURE.md); KEEP OPEN |

## 관리 절차

1. 새 가정은 다음 미사용 `ASM-NNN`을 받는다.
2. 관련 문서에서는 ID와 statement를 함께 참조하고 가정을 사실처럼 쓰지 않는다.
3. expected phase가 끝날 때 owner는 evidence를 기록하고 status를 전환한다.
4. architecture 선택으로 확정할 필요가 있으면 ADR을 만들며 assumption ID를 context에 연결한다.
5. `INVALIDATED`가 되면 영향받는 requirement와 문서를 [Traceability Rule](00_TRACEABILITY_RULE.md)에 따라 찾아 review한다.

> **OPEN DECISION:** 각 owner 역할의 named assignee는 D0 entry 전에 User Approver가 지정해야 한다. Classification: implementation-blocking; approved documentation baseline에는 non-blocking.
