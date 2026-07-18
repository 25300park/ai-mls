# Identity and Authentication

| 항목 | 값 |
|---|---|
| Document ID | DOC-SEC-003 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security Owner |
| 기준일 | 2026-07-14 |

## Identity model

`User`는 human 또는 service principal의 canonical reference이며 `Role`, `Team`, assignment와 effective period를 분리한다. 개인별 account를 기본으로 하고 shared human account는 금지한다. Identity lifecycle은 requested → proofed → activated → suspended/revoked → retired이며 deprovisioning은 active session, token, assignment와 service credential을 함께 회수한다.

## Authentication flow

1. UI-001/API-001이 principal claim과 authentication evidence를 수신한다.
2. identity status, credential state, required MFA와 risk condition을 검증한다.
3. 성공 시 bounded session과 authentication context를 만들고 API-002가 별도 authorization을 수행한다.
4. 실패는 generic response와 security event를 남기며 identifier existence를 누설하지 않는다.
5. role/team 선택은 authentication 이후이며 권한을 새로 생성하지 않는다.

Authentication success는 approval, Verification, Permission 또는 publication authority가 아니다.

## MFA policy

MFA는 Administrator, Security/Audit, Permission Reviewer, Publication Approver, export/restricted reveal, role/policy change, recovery와 기타 privileged action에 필수다. 일반 내부 human session에도 기본 요구를 권고하며 exact factor/assurance와 enrollment recovery는 `OPEN DECISION`이다. Recovery factor는 primary factor보다 약해서는 안 되고 helpdesk override는 dual control과 audit가 필요하다.

## Password policy

Password를 사용할 경우 long unique secret, compromised-secret rejection, secure reset, throttling와 breach response를 적용한다. 정기적 강제 변경은 risk/evidence 없이 요구하지 않으며 password를 log, prompt, URL 또는 support transcript에 기록하지 않는다. Exact minimum length, history와 rate limit는 future approved standard로 정한다.

## Future SSO

`POST-MVP`: federation/SSO는 external identity claim을 local User/Role/Team/contract scope에 mapping하며 external group만으로 privileged role을 자동 부여하지 않는다. Issuer/audience, lifecycle, logout/revocation, assurance와 incident contract를 승인해야 한다.

## Service identity

각 service/connector/job은 unique non-human identity, single purpose, least privilege, bounded credential와 owner를 가진다. Human interactive login과 approval/verification capability를 금지한다. Credential rotation, workload provenance, API request/correlation ID와 failure isolation을 요구한다.

## Identity proofing and recovery

Human identity proofing 강도는 role risk에 비례한다. Reset/unlock/MFA recovery는 identity proof, independent notification, privileged recovery audit와 session revocation을 포함한다. Administrator가 자신의 recovery/privilege change를 단독 승인할 수 없다.

## OPEN DECISION

Identity provider, authentication protocol, MFA factor, proofing assurance, password numeric parameters와 account recovery SLA는 vendor-neutral security review 후 확정한다.

