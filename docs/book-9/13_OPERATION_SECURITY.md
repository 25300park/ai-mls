# Operation Security

| 항목 | 값 |
|---|---|
| Document ID | DOC-OPS-014 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security Owner / Operations Owner |
| 기준일 | 2026-07-14 |

## Operational access

Named human/service identity, scoped role, environment/resource/action/purpose, effective/expiry, MFA/reauthentication와 audit를 요구한다. Production access는 default deny이며 routine read/observe, deploy/change, data/recovery, security/identity와 integration access를 분리한다.

## Administrative access

Administrator는 identity/configuration/platform control을 관리하지만 Verification/Permission/Publication Approval을 자동 상속하지 않는다. Privileged console/API는 approved access path에서만 사용하고 shared/root-like account, direct production data browse와 untracked out-of-band change를 금지한다.

## Privileged operation

Release/deploy/rollback, configuration/flag, role/permission, secret/key, backup/restore, log/export, connector/target, data disposition와 incident break-glass는 strong auth, change/incident, exact scope, reason, independent approval where required, session recording/evidence와 post-validation을 가진다.

## Break-glass

Imminent safety/availability containment에만 사용하며 publication approval bypass에는 사용할 수 없다. Named requester/approver, narrow privilege, short expiry, alert/monitoring, immutable evidence, credential rotation/revocation와 retrospective review를 요구한다.

## Operational audit

Principal/service/session, environment, action/target/version, before/after config/reference, reason/change/incident/release, authorization/approval, result/correlation와 validation을 기록한다. Audit/log access/export와 failed/denied action도 기록하고 secret/raw personal payload를 제외한다.

## Secrets and tooling

Secret/credential/key는 script, shell history, ticket, chat, document, log, pipeline artifact 또는 environment dump에 남기지 않는다. Tool/vendor는 미정이며 어떤 tool도 unique identity, least privilege, approval, audit와 revocation requirement를 낮출 수 없다.

## Operational compliance

Control → operation → evidence → review → finding/remediation trace를 유지한다. Access recertification, environment/config drift, backup/recovery test, log integrity, incident/change/release와 vendor dependency evidence를 risk-based 주기로 review한다. Compliance evidence가 없으면 effective control을 주장하지 않는다.

## Third-party and remote operations

Provider/support access는 contract/purpose, named identity, time-bound scope, supervised/monitored session, data minimization, no onward use와 revocation evidence가 필요하다. Future external operator/federation은 `POST-MVP`다.

## Security review gates

New environment/integration, authority/data classification change, external exposure, key/secret model, backup/DR, privileged automation와 major scaling/release architecture는 Security/Privacy review를 통과해야 한다.

