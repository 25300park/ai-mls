# Release Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-ROADMAP-007 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Release Owner / Product Owner |
| 기준일 | 2026-07-15 |

## Release principles

Release는 cumulative approved capability와 evidence bundle이다. Sprint completion, merge 또는 deployment만으로 release가 승인되지 않는다. 모든 release는 [Release Acceptance](../book-10/12_RELEASE_ACCEPTANCE.md)와 [Go-Live Checklist](12_GO_LIVE_CHECKLIST.md)를 적용한다.

## MVP — REL-001

Internal property intelligence baseline이다. governance/identity/security, source/intake/property/candidate/client/requirement, advisory AI/matching, UI, admin/audit/jobs와 current approved manual/CSV integration scope를 포함한다. public publication은 enable하지 않는다.

Exit: mapped Features Ready/Done, no orphan trace, synthetic-data test, role/permission/audit, AI human review, backup/rollback와 internal UAT evidence.

## Beta — REL-002

제한된 audience/target에서 verification, separate permission, proposal/approval, publication delivery/reconciliation와 expiry/recovery를 검증한다. target/source/legal/privacy approval가 없는 integration은 제외한다.

Exit: exact-version human approval, idempotency, unknown-state reconciliation, withdrawal/rollback, privacy/security와 controlled UAT sign-off.

## RC — REL-003

기능 동결 candidate다. Beta의 모든 capability와 fix만 포함하며 migration/cutover rehearsal, full regression, performance/security/AI evaluation, restore/DR와 documentation/operations readiness를 검증한다.

## Production — REL-004

RC의 fresh evidence와 named approval로 go-live한다. monitoring, on-call/hypercare, backup/restore, rollback/cutover communication와 post-deployment verification이 준비돼야 한다.

## Future releases — REL-005

`POST-MVP` planning envelope다. external broker network, additional connectors, API/analytics/marketplace와 scale evolution은 별도 approved Requirement/DEV/Feature/Test와 legal/source/privacy/business gate 전 scope에 포함하지 않는다.

## Promotion and rollback

promotion은 immutable candidate/version/manifest로 수행하며 evidence가 stale하면 재검증한다. authority, data integrity 또는 external state가 불확실하면 promotion을 중단하고 rollback 또는 governed forward recovery를 선택한다.

> **OPEN DECISION:** version numbers beyond logical REL IDs, cadence, rollout strategy, audience/target와 support window.
