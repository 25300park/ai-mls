# Deployment & Operations Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-OPS-001 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Operations Owner / Architecture Owner |
| 기준일 | 2026-07-14 |
| Phase | Phase 10 |

## Purpose

Book 9는 AI MLS의 logical deployment topology, environment/configuration/release, routine operations, observability, resilience, capacity, service objectives, incident/change와 operational security를 정의한다. [Security Registry](../book-8/15_SECURITY_REGISTRY.md)를 상위 보안 기준으로 사용하며 cloud, container orchestrator, CI/CD, infrastructure-as-code 또는 vendor를 선택하지 않는다.

## Mandatory principles

1. deployment/release는 approved change, verification evidence와 auditable promotion 없이 production에 도달할 수 없다.
2. rollback도 authorized release operation이며 security/workflow/audit를 우회하지 않는다.
3. 모든 operational action은 principal/service, scope, environment, reason, change/incident, result와 correlation으로 traceable해야 한다.
4. 모든 backup은 integrity evidence를 가지며 모든 recovery test는 scope/result/finding을 문서화한다.
5. recovery는 revoked/expired Verification, Permission, Approval 또는 publication authority를 자동 복원하지 않는다.
6. operational security는 Book 8의 least privilege, MFA, classification, secret, logging와 incident control을 따른다.

## Document map

| Document ID | 문서 | 책임 |
|---|---|---|
| DOC-OPS-002 | [Deployment Architecture](01_DEPLOYMENT_ARCHITECTURE.md) | logical topology, tiers, workers/storage/services/trust boundaries |
| DOC-OPS-003 | [Environment Strategy](02_ENVIRONMENT_STRATEGY.md) | dev/test/staging/production와 promotion/isolation |
| DOC-OPS-004 | [Configuration Management](03_CONFIGURATION_MANAGEMENT.md) | ownership, secret refs, variables, flags, lifecycle |
| DOC-OPS-005 | [Release Management](04_RELEASE_MANAGEMENT.md) | lifecycle, approval, rollback, evidence, version |
| DOC-OPS-006 | [Operation Runbook](05_OPERATION_RUNBOOK.md) | daily/weekly/monthly/emergency/maintenance duties |
| DOC-OPS-007 | [Monitoring and Observability](06_MONITORING_AND_OBSERVABILITY.md) | health, metrics, alerting, dashboards |
| DOC-OPS-008 | [Backup and Recovery](07_BACKUP_AND_RECOVERY.md) | backup classes/frequency/objectives/integrity/test |
| DOC-OPS-009 | [Disaster Recovery](08_DISASTER_RECOVERY.md) | scenarios, priority, activation/workflow/validation |
| DOC-OPS-010 | [Business Continuity](09_BUSINESS_CONTINUITY.md) | critical services, manual/degraded operation |
| DOC-OPS-011 | [Capacity and Scaling](10_CAPACITY_AND_SCALING.md) | assumptions, resource/performance planning |
| DOC-OPS-012 | [Operational SLA/SLO](11_OPERATIONAL_SLA_SLO.md) | availability/response/recovery targets와 indicators |
| DOC-OPS-013 | [Incident and Change Management](12_INCIDENT_AND_CHANGE_MANAGEMENT.md) | severity, escalation, change/approval/emergency |
| DOC-OPS-014 | [Operation Security](13_OPERATION_SECURITY.md) | operational/admin/privileged access와 audit/compliance |
| DOC-OPS-015 | [Operation Registry](14_OPERATION_REGISTRY.md) | OPS-001–032 cross-phase operational controls |
| DOC-OPS-016 | [Operation Checklist](15_OPERATION_CHECKLIST.md) | deployment/release/rollback/backup/recovery/monitoring/incident/security gates |

## Traceability

`WF-* → Entity → API-* → UI-* → SEC-* → OPS-* → TEST PLANNED → Phase 10`

[Operation Registry](14_OPERATION_REGISTRY.md)가 operational control mapping의 source of truth다. `OPS-*` 행은 implementation, vendor configuration 또는 compliance evidence를 의미하지 않는다.

## Scope

Documentation only. Deployment script, Docker/Kubernetes manifest, Terraform, CI/CD pipeline, cloud resource, executable runbook, production credential와 vendor-specific configuration은 생성하지 않는다.

