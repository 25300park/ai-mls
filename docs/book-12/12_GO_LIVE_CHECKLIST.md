# Go-Live Checklist

| 항목 | 값 |
|---|---|
| Document ID | DOC-ROADMAP-013 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Release Owner / Quality Owner |
| 기준일 | 2026-07-15 |

## Use rule

각 item은 `PASS`, `FAIL`, `BLOCKED`, `N/A`와 evidence/owner/time을 가진다. `N/A`에는 rationale와 reviewer가 필요하다. 이 문서는 logical template이며 실제 실행 결과가 아니다.

## Architecture

- [ ] release scope가 approved Requirement/Epic/Feature/DEV/IMP와 일치한다.
- [ ] module/data/API/UI/AI/integration boundary와 ADR/Decision/CR이 current다.
- [ ] breaking/compatibility/dependency와 rollback impact가 승인됐다.

## Database and migration

- [ ] schema/data change와 migration/reconciliation/rollback plan이 review됐다.
- [ ] provenance, authority status, relationship, retention/legal hold와 privacy가 보존된다.
- [ ] backup integrity와 representative restore/migration rehearsal가 PASS다.

## Security and privacy

- [ ] identity/MFA/session/object authorization/SoD와 privileged access가 검증됐다.
- [ ] secret/key/encryption/dependency/vulnerability와 logging/redaction gate가 PASS다.
- [ ] classification, consent/purpose, export/deletion와 incident/privacy communication가 준비됐다.

## Operations

- [ ] immutable candidate/config/manifest와 environment drift 검사가 PASS다.
- [ ] monitoring, alert, dashboard, correlation, runbook/on-call/hypercare가 준비됐다.
- [ ] capacity/SLO/RPO/RTO, backup/DR, rollback와 external reconciliation evidence가 있다.

## Testing

- [ ] mapped `TEST-001–056` applicable execution 결과와 defect disposition이 있다.
- [ ] regression, security, AI, performance, UAT, migration, restore/DR와 smoke test가 PASS다.
- [ ] P0/P1, constitutional blocker, stale evidence와 unapproved waiver가 없다.

## Documentation

- [ ] Architecture Bible, registry, API/UI/AI contract, runbook와 support/user docs가 current다.
- [ ] version/release note/known limitation/debt와 archive/rollback instructions가 연결됐다.
- [ ] Markdown links, IDs, trace와 checksums가 검증됐다.

## Approval

- [ ] Business/Product, Architecture, Development, Quality와 Release approval가 있다.
- [ ] applicable Security/Privacy, Data, AI, Operations, Integration와 User/UAT approval가 있다.
- [ ] go/no-go, stop/rollback authority, delegates와 communication roster가 확인됐다.

## Completion

모든 applicable item PASS와 fresh approval 전에는 go-live하지 않는다. checklist screenshot/claim만으로 evidence를 대체하지 않는다.
