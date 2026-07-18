# Security & Privacy Architecture Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-SEC-001 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security/Privacy Reviewer / Architecture Owner |
| 기준일 | 2026-07-14 |
| Phase | Phase 9 |

## Purpose

Book 8은 AI MLS의 logical security, privacy, authorization, audit, compliance와 recovery control을 정의한다. [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md), [API Registry](../book-6/16_API_REGISTRY.md), [Screen Registry](../book-7/15_SCREEN_REGISTRY.md)의 workflow/authority를 보호하며 vendor, protocol, cipher suite 또는 implementation product를 선택하지 않는다.

## Mandatory principles

1. privilege escalation, workflow/API/authority bypass를 허용하지 않는다.
2. publication은 valid Verification, Permission과 독립 human approval 없이 수행할 수 없다.
3. every privileged action, export와 session은 authenticated principal, scope, reason, correlation과 outcome으로 traceable해야 한다.
4. privacy by default, need-to-know, least privilege와 deny-by-default를 적용한다.
5. AI, service identity, connector와 administrator는 human verifier/approver가 될 수 없다.
6. security failure는 fail closed하며 evidence를 남기고 governed recovery를 따른다.

## Document map

| Document ID | 문서 | 책임 |
|---|---|---|
| DOC-SEC-002 | [Security Principles](01_SECURITY_PRINCIPLES.md) | objectives, Zero Trust, least privilege와 defense in depth |
| DOC-SEC-003 | [Identity and Authentication](02_IDENTITY_AND_AUTHENTICATION.md) | human/service identity와 authentication lifecycle |
| DOC-SEC-004 | [Authorization Model](03_AUTHORIZATION_MODEL.md) | scoped RBAC, future ABAC와 authority separation |
| DOC-SEC-005 | [Permission Matrix](04_PERMISSION_MATRIX.md) | every role/screen/API와 operation grant baseline |
| DOC-SEC-006 | [Data Classification](05_DATA_CLASSIFICATION.md) | Public/Internal/Confidential/Restricted handling |
| DOC-SEC-007 | [Privacy Model](06_PRIVACY_MODEL.md) | purpose, consent, minimization, deletion/legal hold |
| DOC-SEC-008 | [Audit and Compliance](07_AUDIT_AND_COMPLIANCE.md) | audit scope/evidence/trace/compliance principles |
| DOC-SEC-009 | [Encryption and Key Management](08_ENCRYPTION_AND_KEY_MANAGEMENT.md) | encryption/key/secret principles |
| DOC-SEC-010 | [Session and Access Control](09_SESSION_AND_ACCESS_CONTROL.md) | timeout, reauthentication, device/session policy |
| DOC-SEC-011 | [Security Event Model](10_SECURITY_EVENT_MODEL.md) | security-relevant event taxonomy |
| DOC-SEC-012 | [Threat Model](11_THREAT_MODEL.md) | assets, actors, scenarios, mitigations/residual risk |
| DOC-SEC-013 | [Security Logging](12_SECURITY_LOGGING.md) | log category, integrity, privacy, access/review |
| DOC-SEC-014 | [Incident Response](13_INCIDENT_RESPONSE.md) | detection부터 post-incident review까지 |
| DOC-SEC-015 | [Backup and Recovery Security](14_BACKUP_AND_RECOVERY_SECURITY.md) | backup protection와 authorized recovery |
| DOC-SEC-016 | [Security Registry](15_SECURITY_REGISTRY.md) | SEC-001–034 control mapping source of truth |

## Traceability

`REQ-CONST-* → WF-* → Entity → API-* → UI-* → AI-*/N/A → SEC-* → TEST PLANNED → Phase 9`

Test control은 Book 10 전까지 ID를 선발급하지 않는다. Security control definition과 cross-phase mapping은 [Security Registry](15_SECURITY_REGISTRY.md)가 소유한다.

## Scope restrictions

문서상 logical control만 정의한다. IAM, MFA, SIEM, KMS, backup, WAF 또는 endpoint vendor, executable policy, code, infrastructure, database schema와 incident automation은 범위 밖이다.

