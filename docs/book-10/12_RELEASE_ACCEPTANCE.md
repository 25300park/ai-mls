# Release Acceptance

| 항목 | 값 |
|---|---|
| Document ID | DOC-TEST-013 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Quality Owner / Release Owner |
| 기준일 | 2026-07-15 |

## Release checklist

- immutable candidate/version/config/data migration and scope manifest.
- requirement/TEST trace, planned execution와 pass/blocked evidence.
- P0/P1 functional, security/privacy, AI, performance, operational/recovery와 regression results.
- UAT/accessibility sign-off, known limitations/risk/assumption disposition.
- monitoring/alert/runbook, backup/rollback/forward recovery와 owner readiness.
- approval, release notes, communication and post-deploy validation plan.

## Release gate

Quality Owner는 evidence completeness와 blocker를, specialist owners는 domain result를, Business/Release Owner는 risk/outcome을 review한다. Executor/author 단독 승인 금지. Gate result는 ACCEPTED, REJECTED 또는 CONDITIONAL(비-blocking + expiry/retest)이다.

## Blocking criteria

Constitution violation, publication/authority bypass, privilege/privacy/audit/provenance failure, data corruption/loss, unrecoverable migration, failed backup/rollback/monitoring, unresolved SEV-1/2 또는 P0/P1 defect, missing required trace/evidence/sign-off는 blocker다.

## Rollback validation

Previous compatibility, data/authority/audit preservation, config/secret, external publication/connector compensation, job duplicate, monitoring와 post-rollback health를 사전/사후 검증한다. Irreversible effect는 forward recovery/reconciliation으로 명시한다.

## Post-deployment acceptance

Smoke/health/business/security checks, version/config, critical workflow, external dependency, SLO/alert와 observation window를 확인한다. Deployment completion과 release acceptance를 구분한다.

## Evidence

TEST-056과 linked test/defect/UAT/OPS checklist, approver/date, exception/expiry, result와 rollback/incident reference를 보존한다.

