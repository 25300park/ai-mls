# Security and Privacy Principles

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-031 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security/Privacy Reviewer |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](00_PROJECT_CONSTITUTION.md) |

## Least privilege

user, service, AI job, connector와 administrator는 업무에 필요한 최소 action/data만 접근한다. default deny를 사용하고 privileged access는 explicit scope, expiry와 audit를 가진다. connector와 AI identity에는 approval authority를 부여하지 않는다.

## Need-to-know

- contact, client requirement, raw source와 sensitive audit detail은 role과 task context에 따라 제한한다.
- list/search/export에서 field masking을 일관되게 적용한다.
- support/debugging 편의를 이유로 broad production access를 상시 허용하지 않는다.
- access request, temporary elevation과 break-glass는 owner, reason, expiry와 review를 기록한다.

## Audit first

중요 action은 설계 단계에서 audit event와 failure behavior를 정의한다. 최소 대상은 login/failed login, role/permission change, restricted contact access/export, verification, sharing/publication approval, publish/unpublish, retention/deletion, configuration/secret change와 emergency action이다. audit failure가 중요한 state change를 허용할지 차단할지는 risk 기반으로 명시하며 publication/privilege control은 fail closed가 기본이다.

## Encryption principles

- network 전송은 approved transport encryption을 사용한다.
- sensitive data와 backup은 risk에 맞는 at-rest encryption을 사용한다.
- key/secret은 source code, prompt, log 또는 documentation example에 저장하지 않는다.
- key rotation, access, backup/recovery와 compromise response를 정의한다.
- searchable sensitive field가 필요하면 encryption/searchable hash의 leakage trade-off를 security review한다.

구체 algorithm/provider는 Book 8/9와 ADR에서 결정한다.

## Contact information policy

contact는 restricted data다. 목적에 필요한 최소 channel만 저장하고, default UI/API representation은 masking하며, unmask/access/export는 authorized role과 audit를 요구한다. contact를 AI prompt나 external proposal에 포함하려면 purpose, permission, minimization과 retention을 검증한다.

## Authentication principles

- 모든 human user와 privileged machine identity를 고유하게 식별한다.
- shared account를 금지하고 strong authentication/MFA requirement는 risk에 맞게 적용한다.
- session lifetime, revocation, device/risk signal과 recovery를 정의한다.
- third-party credential을 AI MLS prompt나 collector config example에 노출하지 않는다.

## Authorization principles

- server-side authoritative check가 UI visibility보다 우선한다.
- role만이 아니라 action, resource, state, team/scope와 permission evidence를 검증한다.
- self-approval, stale role와 privilege escalation을 차단한다.
- customer sharing과 public publication action은 서로 다른 permission을 검사한다.
- authorization denial과 privileged success를 audit한다.

## Privacy by design

- purpose limitation: 수집 전에 목적과 allowed use를 정의한다.
- minimization: 업무에 필요한 최소 raw/contact/client data만 처리한다.
- transparency: source, AI processing과 external use를 내부 policy에서 설명 가능하게 한다.
- retention/deletion: purpose 종료와 policy expiry에 따른 action을 설계한다.
- privacy review: 새로운 source, AI provider, connector, export와 publication channel 전에 수행한다.
- privacy claim은 legal guarantee로 표현하지 않으며 필요한 legal review를 별도로 기록한다.

## Measurable security/privacy gates

- unauthorized role, self-approval과 privilege escalation test는 항상 거부되어야 한다.
- restricted contact access 100%가 actor, reason/context와 outcome으로 audit되어야 한다.
- repository/prompt/log fixture의 credential scan에 critical finding이 없어야 한다.
- retention/deletion과 backup recovery test evidence 없이는 sensitive-data capability를 release-ready로 표시하지 않는다.
- security/privacy `CRITICAL`/`HIGH` finding이 열려 있으면 approval/freeze할 수 없다.

## Constitutional bindings

`REQ-CONST-002`–`REQ-CONST-010`, `REQ-CONST-013`을 least-privilege, privacy와 audit control로 구체화한다.

> **OPEN DECISION:** data classification, MFA/session baseline, encryption/key standard와 audit retention은 Book 8에서 확정한다.
