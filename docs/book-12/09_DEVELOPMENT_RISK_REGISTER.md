# Development Risk Register

| 항목 | 값 |
|---|---|
| Document ID | DOC-ROADMAP-010 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Development Owner / Risk Owner |
| 기준일 | 2026-07-15 |

## Rating

Likelihood와 Impact는 `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`을 사용한다. 이 register는 project-wide [Risk Register](../00_RISK_REGISTER.md)를 대체하지 않고 implementation planning view를 제공한다.

## Registry

| Risk ID | Class | Risk | Likelihood | Impact | Affected scope | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| RISK-DEV-001 | Development | stack/tooling 미결정으로 scaffold 재작업 | HIGH | HIGH | SP-000, all DEV | architecture/ADR approval 후 physical setup | Architecture Owner | OPEN |
| RISK-DEV-002 | Architecture | module boundary 침식과 cross-storage access | MEDIUM | CRITICAL | EPIC-003–009 | dependency enforcement, review, contract tests | Architecture Owner | OPEN |
| RISK-DEV-003 | Security | authorization/SoD bypass | MEDIUM | CRITICAL | EPIC-002/007/008/010 | deny tests, object scope, independent security review | Security Owner | OPEN |
| RISK-DEV-004 | Data | provenance loss, duplicate/incorrect migration | MEDIUM | CRITICAL | EPIC-003/004, migration | immutable evidence, rehearsal, reconciliation/rollback | Data Owner | OPEN |
| RISK-DEV-005 | Privacy | production personal/raw data in dev/test/log | MEDIUM | CRITICAL | all | synthetic-first, masking validation, log redaction/scans | Privacy Owner | OPEN |
| RISK-DEV-006 | AI | hallucination/schema drift or authority escalation | HIGH | HIGH | EPIC-006 | versioned schema/evaluation, confidence, human review/fallback | AI Owner | OPEN |
| RISK-DEV-007 | Integration | source/target contract or external state unknown | HIGH | CRITICAL | EPIC-007/009 | policy approval, idempotency, reconciliation, disable path | Integration Owner | OPEN |
| RISK-DEV-008 | Quality | incomplete automation/environment/threshold | HIGH | HIGH | all releases | TEST trace, staged evidence, blocker policy | Quality Owner | OPEN |
| RISK-DEV-009 | Operations | SLO/RPO/RTO/load assumptions unvalidated | HIGH | HIGH | REL-003/004 | baseline measurement, restore/DR/load rehearsal | Operations Owner | OPEN |
| RISK-DEV-010 | Release | rollback/cutover failure or data divergence | MEDIUM | CRITICAL | REL-002–004 | reversible migration, rehearsal, stop criteria | Release Owner | OPEN |
| RISK-DEV-011 | Governance | named owner/approver or decision evidence missing | HIGH | HIGH | all Ready/release gates | assign roles, durable approval and expiry | Governance Owner | OPEN |
| RISK-DEV-012 | Scope | POST-MVP capability enters MVP silently | MEDIUM | HIGH | EPIC-009/REL-005 | explicit scope tags, CR/approval, disabled boundary | Product Owner | OPEN |

## Review

Sprint planning, release promotion, architecture/incident/change review에서 applicable risk를 갱신한다. `CRITICAL` untreated risk는 Ready/Release blocker이며 schedule로 accept하지 않는다.

## Escalation

risk realization은 defect/incident/change record와 affected trace를 연결한다. mitigation이 architecture를 바꾸면 ADR을 요구한다.
