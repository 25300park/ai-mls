# Incident Response

| 항목 | 값 |
|---|---|
| Document ID | DOC-SEC-014 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security Incident Owner / Operations Owner |
| 기준일 | 2026-07-14 |

## Objectives

Security/privacy incident를 신속히 detect, classify, contain, investigate, recover하고 affected authority/data/evidence를 보존한다. Incident urgency가 publication approval, privacy purpose 또는 audit를 우회할 권한을 만들지 않는다.

## Lifecycle

`Detect → Triage/Classify → Contain → Investigate/Eradicate → Recover/Validate → Notify/Close → Post-incident Review`

각 단계는 named Incident Owner, time, action/decision, evidence, affected scope와 next condition을 가진다. Operational tracking은 `EXCEPTION.*` state를 사용하고 incident-specific severity를 별도 기록한다.

## Detection

Security Event, user/provider report, audit anomaly, integrity/availability failure, external notification와 privacy request에서 case를 생성한다. Detector inference와 confirmed fact를 구분하며 evidence를 privacy-safe하게 preserve한다.

## Classification

Severity는 confidentiality/integrity/availability/privacy impact, affected class/volume/users, privilege/publication, persistence, external exposure와 recoverability를 고려한다. Exact severity/SLA/regulatory notification threshold는 `OPEN DECISION`이다.

## Containment

Session/credential revoke, role/service disable, connector/provider suspension, export/publication hold, network/data access restriction와 vulnerable function isolation을 사용할 수 있다. Automation은 restrict만 하며 authority를 생성하지 않는다. Evidence preservation과 business continuity impact를 기록한다.

## Investigation and eradication

Timeline, principal/session/service, data/action scope, root cause, exploited control, persistence와 external effect를 확인한다. Investigation access는 case scope, MFA, need-to-know, chain-of-custody와 audit를 적용한다. Secret rotate, misconfiguration correction, malicious artifact removal와 affected output invalidation을 수행할 수 있다.

## Recovery

Known-good state, key/credential/policy, data integrity, workflow/approval validity, connector/provider trust와 monitoring을 검증한 후 단계적으로 restore한다. Recovery가 stale/revoked authority나 compromised publication을 자동 복원하지 않는다. [Backup and Recovery Security](14_BACKUP_AND_RECOVERY_SECURITY.md)를 따른다.

## Notification and privacy

Internal/external/user/legal notification은 confirmed scope, approved message, minimum disclosure, owner와 evidence를 가진다. Exact legal obligation은 jurisdiction/legal review에 따른다. Unconfirmed personal detail이나 attacker-sensitive control을 불필요하게 공개하지 않는다.

## Post-incident review

Root cause, detection/response gaps, control/test/doc 변경, owner/date, residual risk와 effectiveness verification을 기록한다. DEC/ADR/CR, Security Registry, threat model, runbook와 training에 필요한 변경을 연결한다. 자신의 조치만 단독 승인하여 case를 종결하지 않는다.

