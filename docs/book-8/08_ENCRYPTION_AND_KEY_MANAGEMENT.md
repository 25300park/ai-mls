# Encryption and Key Management

| 항목 | 값 |
|---|---|
| Document ID | DOC-SEC-009 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security Owner / Operations Owner |
| 기준일 | 2026-07-14 |

## Encryption at rest

Confidential/Restricted canonical data, raw attachment, contact, audit/security log, export, backup, AI payload/result와 secret material은 approved encryption boundary 안에 저장한다. Storage encryption만으로 field/tenant/purpose access control을 대체하지 않는다. Public/Internal도 platform baseline protection을 따른다.

## Encryption in transit

User↔UI/API, service↔service, connector↔boundary, provider/integration, backup/replication와 administration traffic은 peer authenticity, confidentiality와 integrity를 제공하는 approved secure transport를 사용한다. Certificate/protocol/cipher 선택은 vendor-neutral review에서 정하며 insecure downgrade/fallback을 허용하지 않는다.

## Key hierarchy and ownership

Data encryption, signing/integrity, session/token, backup, export와 secret wrapping 목적을 분리한다. Key에는 owner, purpose, environment/data class, lifecycle state, creation/activation/rotation/retirement/destruction, authorized use와 audit를 부여한다. Application data와 key access를 가능한 범위에서 분리한다.

## Rotation principles

Risk, cryptoperiod, personnel/service change, suspected exposure, algorithm/policy change와 incident에 따라 rotate/revoke한다. Rotation은 availability, old-data decrypt/re-encrypt, backup recovery와 external integration compatibility를 검증하며 old key를 무기한 활성 상태로 두지 않는다.

## Secret management principles

Credential/API key/private key/password/token은 source code, repository, document, prompt, log, URL, analytics 또는 일반 configuration에 기록하지 않는다. Secret은 named owner, narrow scope, bounded lifetime, controlled delivery, rotation/revocation와 use audit를 가진다. Human과 service secret을 공유하지 않는다.

## Privileged key operations

Key creation/import/export/recovery/destruction과 high-risk access는 strong authentication, least privilege, dual control where risk requires, reason와 audit가 필요하다. Plaintext secret/key export는 default deny다.

## Failure and recovery

Key/secret 상태가 불명확하거나 integrity/authenticity 검증이 실패하면 protected operation을 fail closed한다. Key loss/compromise recovery는 Incident Response와 Backup/Recovery Security를 따르고 authority/approval을 복원하거나 확대하지 않는다.

## OPEN DECISION

Approved algorithms, key sizes, protocol versions, cryptoperiods, key custody/escrow와 hardware protection tier는 threat/legal/operations review 후 결정한다.

