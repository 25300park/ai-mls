# AI-MLS Operations Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-053 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Operations Owner / Architecture Owner |
| 기준일 | 2026-07-26 |
| Registry | [Canonical Operations Registry Alignment Candidate](00_OPERATIONS_REGISTRY.md) |

## Canonical OPS identity index

| OPS range | Primary subject | Canonical source |
|---|---|---|
| OPS-001~003 | topology, environment and promotion | DOC-OPS-002/003 |
| OPS-004~006 | configuration, secret/key and flag lifecycle | DOC-OPS-004/014 |
| OPS-007~009 | release evidence, approval and rollback readiness | DOC-OPS-005 |
| OPS-010~011 | recurring service/maintenance review | DOC-OPS-006 |
| OPS-012~015 | monitoring, telemetry, guardrails and alerts | DOC-OPS-007 |
| OPS-016~018 | backup integrity and restore testing | DOC-OPS-008 |
| OPS-019~021 | DR, continuity and degraded mode | DOC-OPS-009/010 |
| OPS-022~024 | capacity, performance and SLI/SLO | DOC-OPS-011/012 |
| OPS-025~027 | incident, normal and emergency change | DOC-OPS-013/014 |
| OPS-028~030 | privileged access, audit and security/privacy review | DOC-OPS-014/016 |
| OPS-031~032 | dependency continuity, retry/reconciliation/isolation | DOC-OPS-002/006/007/010 |

## Category index

| Category | Operations |
|---|---|
| Deployment | OPS-001~003/007 |
| Recovery | OPS-009/018~021/025/032 |
| Monitoring | OPS-010/012~015/022/024/031 |
| Validation | OPS-017/023/030 |
| Maintenance | OPS-004~006/011/016 |
| Operational Governance | OPS-008/026~029 |

## Requested vocabulary lookup

| Capability | Existing canonical coverage | Requested ID status |
|---|---|---|
| Deployment | OPS-003/007/008/026 | CONFLICT — requested OPS-001 is frozen |
| Rollback | OPS-009/025/026 | CONFLICT — requested OPS-002 is frozen |
| Backup | OPS-016/017 | CONFLICT — requested OPS-003 is frozen |
| Restore | OPS-018/019 | CONFLICT — requested OPS-004 is frozen |
| Recovery | OPS-009/018~021/025/032 | CONFLICT — requested OPS-005 is frozen |
| Replay | OPS-018/019/025/032 + EVT-012 | CONFLICT — requested OPS-006 is frozen |
| Rebuild | OPS-018/023/025/032 + PRJ policy | CONFLICT — requested OPS-007 is frozen |
| Monitoring | OPS-010/012~015/022/024/031 | CONFLICT — requested OPS-008 is frozen |
| Health Check | OPS-012/013/024/031 | CONFLICT — requested OPS-009 is frozen |
| Drift Detection | OPS-004/012~014/023/030 | CONFLICT — requested OPS-010 is frozen |
| Validation | OPS-017~019/023/024/030 | CONFLICT — requested OPS-011 is frozen |
| Incident Response | OPS-015/019/025/027 | CONFLICT — requested OPS-012 is frozen |

## Governance lookup

- Authority: [Operations Registry §6](00_OPERATIONS_REGISTRY.md#6-authority-matrix)
- Dependency: [Operations Registry §7](00_OPERATIONS_REGISTRY.md#7-operational-dependency)
- Recovery: [Operations Registry §8](00_OPERATIONS_REGISTRY.md#8-recovery-policy)
- Monitoring: [Operations Registry §9](00_OPERATIONS_REGISTRY.md#9-monitoring-policy)
- Audit: [Operations Registry §10](00_OPERATIONS_REGISTRY.md#10-audit-contract)
- Registry mapping: [Operations Registry §11](00_OPERATIONS_REGISTRY.md#11-registry-mapping)
- Validation: [Operations Registry §12](00_OPERATIONS_REGISTRY.md#12-validation-rules)

## Scope boundary

이 Index는 governance navigation만 제공한다. 운영 자동화, CI/CD, monitoring tool, backup/restore implementation, executable runbook과 FEAT-015를 정의하거나 구현하지 않는다. Final recommendation은 ID/authority conflict 때문에 `MODIFY_AND_REVIEW`다.
