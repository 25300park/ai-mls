# Data Classification

| 항목 | 값 |
|---|---|
| Document ID | DOC-SEC-006 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Privacy Owner / Security Owner |
| 기준일 | 2026-07-14 |

## Classification model

요청된 four-level classification을 Book 3의 canonical privacy candidate class와 다음처럼 연결한다.

| Level | Canonical value | Meaning | Examples |
|---|---|---|---|
| Public | `PUBLIC_APPROVED` | 공개 승인된 exact representation/field만 | reconciled published field, approved public media |
| Internal | `INTERNAL` | 직원 업무용, external disclosure 불가 | property master metadata, non-sensitive process reference |
| Confidential | `CONFIDENTIAL_BUSINESS` | business harm 또는 contract impact가 있는 제한 정보 | candidate/offer, client requirement, source policy, analytics |
| Restricted | `RESTRICTED_PERSONAL` | 개인 식별·contact·communication·purpose data | Contact Channel, client/contact case evidence |
| Restricted | `RESTRICTED_SECURITY` | credential, role policy, audit/security/incident/recovery evidence | secret reference, audit export, security event, backup control |

`Restricted`는 하나의 handling level이며 Personal과 Security subtype을 유지한다. Public은 source가 public이라는 뜻이 아니라 exact field/version에 publication approval과 reconciliation evidence가 있다는 뜻이다.

## Classification rules

- create/intake 시 provisional class를 부여하고 derivation/combination/output이 더 민감하면 상향한다.
- unknown 또는 mixed content는 가장 높은 plausible class로 처리한다.
- AI input/result, log, export, backup, cache와 notification은 source classification을 상속하고 최소화한다.
- declassification은 named Data/Privacy Owner, exact fields/version, purpose와 evidence가 필요하다.
- label은 authorization을 대체하지 않으며 field-level restriction을 허용한다.

## Handling requirements

| Control | Public | Internal | Confidential | Restricted |
|---|---|---|---|---|
| Default audience | approved public | internal authenticated | assigned/team need-to-know | explicit purpose/assignment |
| UI | exact published representation | authenticated | scoped | masked/minimized; reveal audited |
| Export | public artifact policy | scoped | authorized + audited | privileged approval, bounded file/expiry |
| AI/provider | approved public policy | approved purpose | approved provider/purpose | deny unless explicit privacy/security review |
| Logging | metadata | metadata | minimized metadata | no raw content/secret; tokenized reference |
| Backup | integrity protected | protected | encrypted/restricted | strongest isolation, recovery audit |
| Disposal | release/archive policy | retention policy | verified disposal | privacy/legal/security disposition |

## Retention relationship

Classification은 retention 기간을 단독 결정하지 않는다. Purpose, legal/contract basis, entity lifecycle, dispute/audit need, Legal Hold와 approved Retention Policy가 period/disposition을 결정한다. More restricted data는 필요 이상 오래 보존하지 않으며 backup에도 deletion propagation 또는 documented bounded exception이 필요하다.

## Classification ownership

Data Owner가 initial class를, Privacy Owner가 personal/purpose use를, Security Owner가 security evidence/secret를 승인한다. Classification 변경과 export/publication은 Audit Event/Decision History로 추적한다.

## OPEN DECISION

Exact field-level catalog, retention periods, geographic/data residency requirement와 restricted export threshold는 privacy/legal review 후 확정한다.

