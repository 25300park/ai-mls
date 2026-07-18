# Architecture Review Board

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-022 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |

## Board purpose

Architecture Review Board(ARB)는 중요한 architecture decision과 change request를 일관된 product 원칙, risk, security/privacy, 기술 가능성 및 release 영향에 따라 검토한다. ARB는 사용자 승인을 대체하지 않으며, AI MLS의 human approval 원칙을 우회할 권한이 없다.

## Review frequency

- 정기 review: Architecture Bible 작성 중 최소 각 Brief 완료 시 한 번 또는 격주 중 먼저 도래하는 시점
- gate review: A1, Phase 4, Phase 6, A9, A13, R1, F1 이전/완료 시
- change review: `HIGH`/`CRITICAL` change request 또는 ADR 제출 후 5 business days 이내
- emergency review: 즉시 소집하고 [긴급 결정 규칙](#emergency-decision-rule)에 따라 사후 정식 review

named member가 정해지기 전에는 역할 기반으로 운영하되, 승인 evidence에 실제 reviewer identity를 기록해야 한다.

## Review scope

- [Decision Register](00_DECISION_REGISTER.md)의 신규·대체 decision
- [Change Request Register](00_CHANGE_REQUEST_REGISTER.md)의 `UNDER_REVIEW` 항목
- ADR, Book completion, architecture review 및 release candidate
- product scope, module boundary, data authority, API/integration, AI authority, security/privacy, deployment 또는 UI control 변경
- risk acceptance, invalidated assumption, traceability gap와 open `CRITICAL`/`HIGH` finding
- frozen baseline 변경과 major/minor release recommendation

단순 오탈자와 의미를 바꾸지 않는 patch는 Architecture Owner가 triage할 수 있지만 release evidence와 audit trail은 유지한다.

## Roles

| 역할 | 책임 | 필수 참여 조건 |
|---|---|---|
| Architecture Owner | chair, agenda/record 관리, boundary·consistency·ADR 판단 | 모든 meeting |
| Business Owner | product value, scope, workflow와 business risk 판단 | 모든 normative decision |
| Security Reviewer | security, privacy, contact, credential, audit 및 compliance 영향 판단 | 관련 영향이 있거나 freeze review |
| AI Reviewer | AI authority, validation, provider, confidence와 human review 판단 | AI 영향이 있거나 freeze review |
| Database Reviewer | data model, integrity, provenance, retention와 recovery 판단 | data/database 영향이 있거나 freeze review |
| Development Reviewer | feasibility, dependency, testing, operations와 rollback 판단 | implementation/phase 영향이 있거나 freeze review |
| Document Author | proposal 설명과 evidence 제공 | 자신의 proposal review; voting member 아님 |
| User Approver | 최종 product/architecture 승인 또는 conflict resolution | [Approval Workflow](00_APPROVAL_WORKFLOW.md)가 요구할 때 |

한 사람이 여러 전문 역할을 맡을 수 있으나 proposal author는 자신의 변경을 단독 승인할 수 없다. Security Reviewer의 blocking security/privacy finding을 다른 역할의 vote로 무시할 수 없다.

## Review inputs and outputs

### Required inputs

- CR ID, decision proposal과 필요 시 ADR
- affected Document ID/trace ID/phase/release
- alternatives, risk/assumption, security/privacy 및 rollback 영향
- [Review Checklist](00_REVIEW_CHECKLIST.md) evidence

### Required outputs

- `APPROVE`, `REJECT`, `REVISE`, `DEFER` recommendation
- 참석자, quorum, vote/objection과 rationale
- required approvals, conditions, due owner/date
- Decision Register, Change Request Register, ADR와 review report update

## Decision process

1. Architecture Owner가 제출물 완전성과 conflict를 triage한다.
2. 필요한 specialist가 영향과 blocking finding을 검토한다.
3. board가 alternatives, reversibility, risk와 trace impact를 논의한다.
4. voting rule에 따라 recommendation을 정한다.
5. required approval을 [Approval Workflow](00_APPROVAL_WORKFLOW.md)에 따라 수집한다.
6. register와 evidence를 갱신하고 release inclusion 여부를 기록한다.

## Voting rule

- quorum은 최소 3개의 독립 voting role이며 Architecture Owner와 Business Owner를 반드시 포함한다.
- 영향 분야 reviewer는 quorum에 추가로 반드시 참여한다. 예: AI change에는 AI Reviewer가 필요하다.
- 각 역할은 1 vote이며 한 사람이 여러 역할을 맡아도 1 vote만 행사한다.
- recommendation은 참석 voting role의 단순 과반 찬성과 Architecture Owner·Business Owner의 concurrence가 필요하다.
- security/privacy blocking finding이 있으면 Security Reviewer의 해소 확인 전 approve할 수 없다.
- tie, abstention으로 과반이 없거나 mandatory concurrence가 없으면 `DEFER` 또는 user escalation이다.

## Conflict resolution

1. [AGENTS source-of-truth](../AGENTS.md)와 approved/frozen document precedence를 확인한다.
2. 사실·용어·scope conflict는 evidence와 [Glossary](00_GLOSSARY.md)로 좁힌다.
3. architecture alternative conflict는 ADR에 trade-off를 기록한다.
4. 해결되지 않으면 dissent를 보존하고 User Approver에게 선택지를 제시한다.
5. user decision 후 Decision Register와 영향 문서를 갱신한다. 조용히 기존 결정을 덮어쓰지 않는다.

## Emergency decision rule

긴급 절차는 active incident, imminent data loss, credential exposure 또는 중대한 외부 publication 위험에만 사용한다.

- Architecture Owner와 관련 mandatory reviewer 1인, Business Owner 또는 User Approver의 명시적 승인이 필요하다.
- human publication approval, 미검증 외부 노출 금지, credential 보호, audit 및 source provenance를 우회할 수 없다.
- 가능한 최소 범위·기간의 reversible action만 허용하며 expiry와 rollback을 기록한다.
- CR과 provisional Decision ID를 1 business day 안에 등록한다.
- full ARB retrospective review를 2 business days 안에 수행한다.
- emergency decision만으로 문서를 `FROZEN` 상태나 release baseline에 포함할 수 없다.

> **OPEN DECISION:** named board membership, business day calendar와 quorum 대리 규칙은 A1 review 전에 지정해야 한다.
