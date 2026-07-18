# Cutover Strategy

| 항목 | 값 |
|---|---|
| Document ID | DOC-ROADMAP-012 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Release Owner / Operations Owner |
| 기준일 | 2026-07-15 |

## Go-live preparation

approved immutable release candidate, migration rehearsal, backup/restore, security/AI/UAT/performance/DR evidence, runbook, monitoring/alert, support roster와 communication plan을 준비한다. exact cutover window는 `OPEN DECISION`이다.

## Cutover phases

| Phase | Action | Gate |
|---|---|---|
| 0. Authorize | scope, owners, candidate, checklist와 stop authority 고정 | approval evidence complete |
| 1. Stabilize | change freeze, dependency/config/secret/backup validation | no blocker, rollback ready |
| 2. Migrate | approved extract/transform/load 또는 no-data path 수행 | reconciliation PASS |
| 3. Activate | internal users/cohort부터 capability enable | auth/audit/monitoring PASS |
| 4. Validate | smoke, workflow, AI, external-state와 business verification | acceptance PASS |
| 5. Expand | approved audience/target로 단계적 확대 | observation gate PASS |
| 6. Close | evidence, incident/deviation, handover와 release record 고정 | Release Owner approval |

## Stop criteria

authentication/authorization/audit failure, data/provenance mismatch, unknown publication state, critical AI/privacy issue, failed backup/rollback, missing monitoring 또는 P0/P1이 발견되면 확대를 중단한다.

## Rollback

named authority가 rollback을 선언한다. traffic/feature disable, job pause, external effect reconcile, application/config rollback, data restore/forward repair와 validation을 순서화한다. rollback 후에도 audit/evidence를 보존하고 재개에는 fresh approval이 필요하다.

## Communication

Business, users, support, operations, security/privacy, data, AI, integration owner와 external partner에 audience-appropriate status를 전달한다. message에는 scope, impact, workaround, next update, privacy/security instruction와 owner를 포함하고 sensitive detail은 제한한다.

## Evidence

timestamped checklist, actor/approver, command/action reference, result, metric, reconciliation, incident/deviation와 final disposition을 `REL-*`에 연결한다.

> **OPEN DECISION:** rollout strategy, cutover window/duration, exact communication channel와 named command roles.
