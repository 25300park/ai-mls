# Security Tests

| 항목 | 값 |
|---|---|
| Document ID | DOC-TEST-008 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security/Privacy Reviewer / Quality Owner |
| 기준일 | 2026-07-15 |

## Authentication

Valid/invalid/MFA/reset/recovery/throttling/lock/revoke/deprovision/service identity와 generic failure disclosure를 검증한다. Shared account/credential leakage와 stale session을 거부한다.

## Authorization and permission

16 role profiles × resource/team/purpose/assignment/state/action의 allow/deny, field masking, role stacking, self-approval, admin/manager inheritance, service/AI authority와 object enumeration을 검증한다. UI hidden control 없이 API-002/owning API deny를 확인한다.

## Session

Idle/absolute expiry, refresh/revoke, concurrent/device/risk, fixation/replay, role change, step-up/reauth와 logout을 검증한다. Timeout 후 pending write를 success로 간주하지 않는다.

## Audit

Privileged/failed/denied/read-reveal/export/approval/publication/config/recovery action에 identity/session/action/target/version/reason/result/correlation가 있는지, tamper/correction/access/export/log-gap을 검증한다.

## Privacy

Classification, purpose/consent/basis, minimization/masking, cross-role leakage, export scope/expiry, AI/provider payload, notification/log, deletion/legal hold와 non-production data isolation을 검증한다.

## Security operations

Secret absence, encryption boundary, key rotation/revoke metadata, alert/containment, break-glass expiry, access recertification, incident evidence와 backup/recovery authorization을 검증한다. Exact cryptographic scanner/tool은 범위 밖이다.

## Acceptance

SEC-001–034 coverage, TEST-009/026/034–037/046–049/051–053, no unresolved P0/P1 security/privacy defect와 independent reviewer evidence가 필요하다.

