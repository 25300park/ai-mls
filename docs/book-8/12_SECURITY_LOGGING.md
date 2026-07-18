# Security Logging

| 항목 | 값 |
|---|---|
| Document ID | DOC-SEC-013 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security Operations Owner / Privacy Owner |
| 기준일 | 2026-07-14 |

## Log categories

| Category | Purpose | Examples |
|---|---|---|
| Authentication | identity/session security | login/MFA/reset/revoke/failure |
| Authorization | allow/deny/policy evidence | action/resource/field decision, role change |
| Privileged business | authority action | Verification, Permission, Approval, Publication, export |
| Administration | policy/configuration change | role/team/source/target/retention/key metadata |
| Application/API | availability/diagnostics | safe request outcome, validation/error category |
| AI | provider/job/output control | capability/version, validation/review, safe metric |
| Connector/integration | boundary activity | authentication, checkpoint, volume, delivery/reconciliation |
| Data/privacy | restricted access/disposition | reveal, export, consent/purpose, deletion/hold |
| Security/incident | detection/response | alert, containment, evidence access, recovery |
| Backup/recovery | resilience evidence | backup, verify, restore request/result |

## Logging rules

Use structured event type/version, trusted time, principal/session/service, action/target reference, decision/outcome, classification, request/correlation와 control/policy version을 기록한다. Log는 domain source record 또는 full audit history를 대체하지 않는다.

## Privacy and redaction

Password, MFA secret, session/token, key, credential, full contact/message/raw attachment, unnecessary client detail와 provider secret을 기록하지 않는다. Identifier는 opaque/tokenized reference를 선호하고 error payload/stack trace는 restricted operational channel로 최소화한다.

## Integrity

Append-oriented ingestion, restricted mutation/deletion, ordering/time source, integrity verification, protected archive/backup와 access audit를 사용한다. Drop/delay/tamper signal을 monitoring하며 correction은 new linked event로 남긴다.

## Retention

Category, purpose, legal/contract requirement, investigation need, data class와 cost에 따라 approved Retention Policy를 적용한다. Security log를 무기한 보존하지 않으며 Legal Hold는 scoped suspension만 제공한다. Exact periods는 `OPEN DECISION`이다.

## Access and export

SEC role의 need-to-know query를 기본으로 하며 domain owner/Manager는 redacted scope만 본다. Log export는 API-016, MFA, reason, field/row scope, watermark/classification, expiry와 audit를 요구한다. Administrator가 자신의 action log를 삭제/수정할 수 없다.

## Review and alerting

Failed authentication, privilege/permission change, restricted access/export, publication, unusual volume, connector/provider failure, log integrity와 recovery를 risk-based 주기로 review한다. Alert threshold는 versioned rule, owner, false-positive handling와 test evidence를 가져야 한다.

## Availability and failure

Logging failure는 privileged action의 risk에 따라 fail closed 또는 local bounded buffer/incident escalation을 적용한다. Verification/Permission/Approval/Publication/export 같은 mandatory audit action은 evidence 없이 성공으로 완료할 수 없다.

