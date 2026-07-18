# Security Event Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-SEC-011 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security Operations Owner |
| 기준일 | 2026-07-14 |

## Purpose

Security-relevant activity를 Audit Event/System Error/Status History와 연결하는 logical event taxonomy를 정의한다. Event는 business workflow state를 대체하지 않는다.

## Event envelope

Event ID/type/version, event/observed time, principal/service/session, role/team, source/component, action/target/version, classification/purpose, decision/outcome/severity, request/correlation, related WF/API/UI/AI/SEC, evidence reference와 privacy-safe context를 포함한다.

## Required events

| Event family | Minimum triggers | Severity basis | Owner |
|---|---|---|---|
| Login | success, logout, session issue/revoke/expire, MFA/reset | identity risk | Security Owner |
| Failed authentication | invalid, throttled, locked, recovery failure | frequency/context/privilege | Security Operations |
| Permission change | role/team/grant/revoke/policy/assignment/exception | privilege impact | Security + Business Owner |
| Verification | request/assign/decision/revoke/expire/reverify | external-use impact | Verification Owner |
| Publication | approval decision, delivery, unknown/failure, correction/suspend/withdraw | public exposure | Publication + Security Owner |
| Export | request/allow/deny/generate/access/expire/revoke | class/volume/audience | Data/Privacy Owner |
| Administrative | identity, source/target, retention/key/secret/backup policy action | blast radius | Administration/Security Owner |
| AI/provider | restricted input attempt, validation failure, provider/prompt/model policy change | data/decision impact | AI + Security Owner |
| Connector/job | authentication, checkpoint, unusual volume, retry/replay, isolation failure | boundary impact | Integration/Operations Owner |
| Suspicious activity | impossible/unusual context, enumeration, mass access/export, repeated deny, tamper signal | likelihood + impact | Security Operations |

## Detection and disposition

Event는 observed facts와 detector inference를 분리한다. Correlation은 principal/session/device/resource/time/volume를 사용하되 privacy-minimized다. Disposition은 `EXCEPTION.*` lifecycle과 Incident Response를 사용하며 event severity가 guilt 또는 business truth를 의미하지 않는다.

## Notification and automation

High-risk event는 named owner에게 bounded alert를 생성하고 affected session/action을 fail closed 또는 suspend할 수 있다. Automation은 Permission/Verification/Approval을 생성하지 않고 containment만 수행한다. Exact threshold/rule는 `OPEN DECISION`이다.

## Integrity and privacy

Raw credential, full contact/message, private key, token 또는 unnecessary payload를 event에 포함하지 않는다. Correction은 append-only reference로 수행하고 event access/export도 audit한다.

