# Architecture and Business Risk Register

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-013 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |

이 register는 mrHOMES AI MLS의 architecture 및 business risk를 식별하고 owner, mitigation과 review 시점을 추적한다. 위험은 결정이나 사실을 대신하지 않으며, 관련 가정은 [Assumption Register](00_ASSUMPTION_REGISTER.md), 변경 결정은 [ADR workflow](adr/README.md)에 연결한다.

## 값 규칙

| 필드 | 허용 값/규칙 |
|---|---|
| Probability | `LOW`, `MEDIUM`, `HIGH` |
| Impact | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| Status | `OPEN`, `MONITORING`, `MITIGATING`, `ACCEPTED`, `CLOSED` |
| Target Version | 최초 완화 목표 version 또는 `TBD` |
| Review Date | `YYYY-MM-DD`; `OPEN`, `MONITORING`, `MITIGATING`에는 필수 |
| Risk Category | `Architecture`, `Security`, `AI`, `Data`, `Business`, `Compliance`, `Infrastructure`, `External Platform` 중 하나 |

`ACCEPTED`는 수용 주체와 근거가 review 기록에 있을 때만 사용하고, `CLOSED`는 검증 증거를 연결해야 한다. `HIGH` probability 또는 `CRITICAL` impact는 Architecture Owner가 다음 review gate 전에 검토한다.

## Risk register

| Risk ID | Title | Description | Probability | Impact | Owner | Mitigation | Status | Target Version | Review Date | Risk Category |
|---|---|---|---|---|---|---|---|---|---|---|
| RISK-001 | Facebook policy changes | Facebook 정책 또는 기술 통제가 바뀌어 승인된 source intake 방식이 중단되거나 비준수 상태가 될 수 있다. | HIGH | HIGH | Compliance Owner | 자동 scraping을 MVP에서 제외하고 source-policy review 및 manual intake fallback을 유지한다. | OPEN | v1.0 | 2026-08-13 | External Platform |
| RISK-002 | Viber access restriction | Viber의 접근 제한으로 향후 collector가 동작하지 않거나 account가 제한될 수 있다. | HIGH | HIGH | Compliance Owner | Viber collector를 `POST-MVP`로 유지하고 구현 전 정책·승인·격리 검토를 요구한다. | OPEN | POST-MVP | 2026-08-13 | External Platform |
| RISK-003 | Duplicate detection failure | 동일 unit 또는 offer를 중복으로 판단하지 못하거나 서로 다른 대상을 병합할 수 있다. | MEDIUM | HIGH | AI Owner | confidence threshold, provenance 보존, human review 및 precision/recall test를 정의한다. | OPEN | v1.0 | 2026-08-13 | AI |
| RISK-004 | Publication without approval | 유효한 verification과 publication approval 없이 외부 게시될 수 있다. | LOW | CRITICAL | Product Approver | 분리된 permission, human approval gate, authorization test와 audit log를 필수화한다. | MITIGATING | v1.0 | 2026-08-13 | Security |
| RISK-005 | Loss of provenance | 정규화·중복 처리 중 source record 또는 변환 계보가 소실될 수 있다. | MEDIUM | CRITICAL | Data Owner | source reference 불변성, retention rule, traceability review와 복구 검증을 요구한다. | OPEN | v1.0 | 2026-08-13 | Data |
| RISK-006 | Database corruption | 저장 계층 손상으로 authoritative record, audit 또는 provenance를 잃을 수 있다. | LOW | CRITICAL | Operations Owner | backup, point-in-time recovery 목표, integrity check와 정기 restore test를 문서화한다. | OPEN | v1.0 | 2026-08-13 | Infrastructure |
| RISK-007 | Mini PC failure | optional collector host 장애가 intake를 중단하거나 core에 장애를 전파할 수 있다. | MEDIUM | MEDIUM | Operations Owner | collector를 core에서 격리하고 queue/retry, health monitoring 및 manual intake fallback을 둔다. | OPEN | v1.0 | 2026-08-13 | Infrastructure |
| RISK-008 | AI provider outage | AI provider 장애나 quota 제한으로 parsing, normalization 또는 matching이 지연될 수 있다. | MEDIUM | HIGH | AI Owner | provider abstraction, bounded retry, queue와 manual review fallback을 설계한다. | OPEN | v1.0 | 2026-08-13 | Architecture |
| RISK-009 | Credential exposure | third-party credential이 prompt, log, source record 또는 repository에 노출될 수 있다. | MEDIUM | CRITICAL | Security Owner | secret store, redaction, least privilege, scanning과 incident response를 요구한다. | MITIGATING | v1.0 | 2026-08-13 | Security |
| RISK-010 | Data retention violation | raw data 또는 contact가 정해진 retention period 이후에도 보존될 수 있다. | MEDIUM | HIGH | Privacy Owner | `retention_until`, deletion job, legal hold 예외와 deletion evidence를 정의한다. | OPEN | v1.0 | 2026-08-13 | Compliance |
| RISK-011 | Unclear business ownership | 검증, 고객 공유 또는 공개 게시 책임자가 불명확해 approval이 지연되거나 우회될 수 있다. | MEDIUM | HIGH | Product Approver | role owner와 대리자를 지정하고 RACI 및 escalation을 Book 0/후속 workflow에 반영한다. | OPEN | v0.2 | 2026-08-13 | Business |

## 관리 절차

1. 새 risk는 다음 미사용 `RISK-NNN`을 받고 삭제하지 않는다.
2. owner는 Review Date까지 probability, impact, mitigation과 status를 검토한다.
3. architecture 변경이 필요한 mitigation은 ADR을 만들고, requirement가 필요한 mitigation은 [Traceability Rule](00_TRACEABILITY_RULE.md)에 따라 연결한다.
4. review 시 [Review Checklist](00_REVIEW_CHECKLIST.md)의 risk 관련 항목을 적용한다.
5. risk가 실제 issue로 발생하면 audit/incident record를 별도로 만들고 이 행에서 참조한다.

> **OPEN DECISION:** 역할별 named owner와 조직의 risk acceptance authority는 Book 0 시작 전에 정해야 한다.
