# Session and Access Control

| 항목 | 값 |
|---|---|
| Document ID | DOC-SEC-010 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security Owner |
| 기준일 | 2026-07-14 |

## Session lifecycle

`requested → authenticated → active → reauthentication-required → suspended/revoked → expired/closed` logical lifecycle를 사용한다. Session은 principal, authentication time/assurance, active role/team, device/risk reference, issued/last-active/absolute expiry와 trace ID를 가진다. Session state는 business state가 아니다.

## Timeout

Idle timeout과 absolute lifetime을 사용하고 risk/role/data class에 따라 더 짧게 제한할 수 있다. Timeout 전 accessible warning과 draft preservation을 제공하되 approval/publication/restricted data를 offline/local success로 남기지 않는다. Exact durations는 `OPEN DECISION`이다.

## Re-authentication

Restricted reveal/export, role/policy/credential change, Permission/Publication approval, recovery, break-glass, suspicious context와 stale assurance에 step-up reauthentication/MFA를 요구한다. Reauthentication은 authorization/SoD/workflow prerequisite를 대체하지 않는다.

## Device trust

Device posture는 risk input이며 trusted label만으로 grant를 확대하지 않는다. Unknown/high-risk device는 deny, read-only, restricted masking 또는 step-up obligation을 적용할 수 있다. Device identifier는 personal/security data로 최소 수집·보존한다.

## Concurrent sessions

Role risk, device, geography/context와 incident에 따라 concurrent session을 제한하거나 notify/revoke한다. Privileged/security/admin session은 더 엄격한 정책을 적용한다. Exact count는 `OPEN DECISION`; 모든 session은 개별 revocation과 audit가 가능해야 한다.

## Token/session handling

Session secret은 URL/log/storage에 노출하지 않고 audience/scope/lifetime/binding을 제한한다. Refresh/revocation은 identity/role/session change를 반영하며 obsolete token으로 revoked privilege를 유지할 수 없다. CSRF/replay/fixation 등 session threat에 대한 control은 Threat Model과 연결한다.

## Access control enforcement

UI navigation마다 scope를 표시하고 deep link/refresh/write마다 API-002와 owning workflow가 재검사한다. Access denial은 sensitive existence를 누설하지 않으며 deny/privileged allow를 audit한다. Logout/revocation은 relevant active session과 credential successor를 무효화한다.

