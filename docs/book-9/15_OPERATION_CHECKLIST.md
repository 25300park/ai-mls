# Operation Checklist

| 항목 | 값 |
|---|---|
| Document ID | DOC-OPS-016 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Operations Owner / Release Owner / Security Owner |
| 기준일 | 2026-07-14 |

## Use rules

각 실행은 checklist instance ID, environment/scope, owner/operator, change/release/incident, start/end, evidence links, exceptions와 final disposition을 가진다. Checkbox 자체가 evidence가 아니며 `N/A`는 이유/approver가 필요하다.

## Deployment checklist

- [ ] Approved change/scope, immutable candidate와 target environment가 일치한다.
- [ ] Environment isolation, configuration/secret references, dependency와 capacity를 검증했다.
- [ ] Required verification/security/privacy/data/AI review evidence가 있다.
- [ ] Backup/recovery/rollback 또는 compensation plan과 owner가 준비되었다.
- [ ] Monitoring/alert/dashboard와 communication/maintenance window가 준비되었다.
- [ ] Authorized operator/MFA/session/change correlation으로 deployment를 수행했다.
- [ ] Health, business workflow, security/audit, version/config와 external effects를 검증했다.
- [ ] Observation/exception/follow-up과 completion evidence를 기록했다.

## Release checklist

- [ ] Release ID/version/manifest/checksum과 included CR/Decision/ADR가 완전하다.
- [ ] Test/compatibility/configuration/data migration/recovery evidence가 current다.
- [ ] Independent approver와 affected specialist sign-off가 있다.
- [ ] Known risk/limitation, release notes, user/support communication이 준비되었다.
- [ ] Deployment, validation, observation와 rollback criteria가 명시되었다.
- [ ] Success/partial/failed/unknown을 구분하고 release close 또는 rollback을 승인했다.

## Rollback checklist

- [ ] Rollback trigger, Incident/Change Owner와 affected scope를 확인했다.
- [ ] Previous artifact/config/data compatibility와 irreversible external effect를 평가했다.
- [ ] Current data/authority/audit를 보존하고 required backup을 확인했다.
- [ ] Authorized operator/approver가 rollback 또는 forward recovery를 선택했다.
- [ ] Data integrity, workflow status, jobs, security, publication/connector reconciliation을 검증했다.
- [ ] Root cause, user impact, residual risk와 new release/change action을 기록했다.

## Backup checklist

- [ ] Tier/scope/consistency point, classification/retention/legal hold가 current다.
- [ ] Backup identity/time, encryption/key, isolation/access와 expected frequency를 확인했다.
- [ ] Completeness/authenticity/integrity verification이 성공했다.
- [ ] Failure/missed window/RPO exposure를 alert·incident·owner에 연결했다.
- [ ] Backup access/action과 retention/disposal evidence를 기록했다.

## Recovery checklist

- [ ] Incident/request, tier/RPO/RTO, restore point와 business impact를 확인했다.
- [ ] Operations/Data/Security approval, MFA와 isolated target을 확인했다.
- [ ] Backup/key integrity와 compromised path/credential isolation을 검증했다.
- [ ] Restore 후 data/object/audit/config/security/workflow consistency를 검증했다.
- [ ] Expired/revoked Verification/Permission/Approval와 publication external state를 재검사했다.
- [ ] Controlled cutover, monitoring, reconciliation, achieved RPO/RTO를 기록했다.
- [ ] Temporary copy/access/secret를 회수하고 finding/next test를 기록했다.

## Monitoring checklist

- [ ] Core/UI/API/data/worker/queue/external/security health coverage가 있다.
- [ ] Technical/business/security/resilience SLI의 source/window/owner가 정의되었다.
- [ ] Alert threshold, severity, runbook, escalation, dedup와 test evidence가 있다.
- [ ] Dashboard access/classification와 personal/secret minimization을 확인했다.
- [ ] Monitoring/log gap 자체에 alert/incident path가 있다.
- [ ] SLO/error budget, noisy/missing signal과 overdue remediation을 review했다.

## Incident checklist

- [ ] Incident ID, severity, owner, scope, timeline과 correlation을 설정했다.
- [ ] Safety/containment, evidence preservation와 required escalation을 수행했다.
- [ ] Communication owner/audience/update cadence를 설정했다.
- [ ] Recovery/rollback/manual continuity action이 승인·감사되었다.
- [ ] Service/data/security/authority/external effect와 monitoring을 검증했다.
- [ ] Closure approver, root cause, corrective action/owner/date와 effectiveness test를 기록했다.

## Security review checklist

- [ ] Operational/admin/service access가 named, least-privileged, scoped, time-bound다.
- [ ] MFA/reauthentication, SoD, approval, break-glass/expiry와 access recertification이 적용된다.
- [ ] Secret/key/config/log/export/backup data가 classification/privacy policy를 따른다.
- [ ] Every privileged/failed action, change/release/recovery와 evidence access가 audited다.
- [ ] Environment/integration/provider/trust boundary와 external support access를 검토했다.
- [ ] Incident/backup/recovery/continuity test finding과 residual risk가 owner/date를 가진다.
- [ ] `SEC-*`와 `OPS-*` mapping, exception/expiry와 Phase 11 test placeholder가 완전하다.

## Completion rule

Blocking item, failed verification, missing approver/evidence, unknown external publication state 또는 unresolved critical security finding이 있으면 checklist를 complete로 표시하지 않는다. Exception은 named authority, bounded expiry, compensating control와 remediation evidence가 필요하다.

