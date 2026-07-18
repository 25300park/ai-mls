# Release Management

| 항목 | 값 |
|---|---|
| Document ID | DOC-OPS-005 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Release Owner / Operations Owner |
| 기준일 | 2026-07-14 |

## Release lifecycle

`Plan → Build Candidate → Verify → Approve → Schedule → Deploy → Validate → Observe → Close/Rollback`

Candidate는 immutable version/identity, included change/CR/Decision, dependency/config/data impact와 evidence manifest를 가진다. Deploy success와 release close를 구분한다.

## Release approval

Architecture/Business/Operations owner와 affected Security/Privacy/Data/AI reviewer의 sign-off를 risk에 따라 요구한다. Production executor가 자신의 release를 단독 승인하지 않는다. Publication/authority control 변경은 Security + Business approval을 mandatory로 한다.

## Verification gate

필수 scope/acceptance, link/trace, automated/manual test placeholder, configuration/schema compatibility, security/privacy review, backup/rollback readiness, monitoring/alert와 runbook update가 있어야 한다. Evidence가 missing/failed/stale이면 production promotion을 중단한다.

## Rollback policy

Rollback은 approved previous compatible artifact/config 또는 forward recovery를 선택하는 governed change다. Data migration/external effect/secret/key/publication이 irreversible하면 simple rollback으로 표현하지 않고 compensation/reconciliation plan을 사용한다. Rollback 후 current authority와 data integrity를 재검사한다.

## Release evidence

- release ID/version, candidate checksum/manifest와 environment
- scope, CR/Decision/ADR, included/excluded change
- verification and approval evidence, approver/date
- configuration/data/security/privacy/AI impact
- deployment actor/time/result/correlation
- health/business/security validation, observation window
- rollback/forward recovery outcome와 incident links

## Version policy

Application/release version은 immutable하고 semantic impact를 설명한다. API/schema/prompt/config/data migration version을 혼합하지 않고 compatibility matrix로 연결한다. Documentation release는 [Release Policy](../00_RELEASE_POLICY.md)를 따른다. Exact application version format은 `OPEN DECISION`이다.

## Release strategies

Phased exposure, parallel candidate, in-place replacement 등은 vendor-neutral options다. 어떤 전략도 environment gate, approval, audit, health validation 또는 rollback readiness를 생략할 수 없다. Exact strategy는 change risk/capability evidence에 따라 선택한다.

## Emergency release

Emergency도 named Incident/Change Owner, scope, minimum verification, Security/Business approval as applicable, backup/rollback, audit와 time-bound exception을 요구한다. 사후 full review, documentation/registry update와 access revocation을 정해진 기한 내 완료한다.

