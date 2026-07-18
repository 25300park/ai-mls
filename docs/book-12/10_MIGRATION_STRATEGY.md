# Migration Strategy

| 항목 | 값 |
|---|---|
| Document ID | DOC-ROADMAP-011 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Data Owner / Release Owner |
| 기준일 | 2026-07-15 |

## Scope and principles

Migration은 evidence-preserving governed workflow다. legacy/current system의 verified facts, schema, volume, quality와 owner가 제공되지 않았으므로 exact migration이나 executable script를 정의하지 않는다.

## Legacy migration

1. inventory source/system/owner/legal basis와 authoritative scope.
2. classify record as evidence, candidate, verified, permission, publication 또는 unsupported.
3. profile quality/duplicate/identity/provenance와 retention.
4. approve mapping, exceptions, acceptance와 rollback.
5. rehearse with synthetic/approved masked sample.
6. reconcile counts, fingerprints, authority/state와 audit.

Legacy label을 canonical verified/permission/published state로 자동 승격하지 않는다. evidence가 없으면 candidate/review-required 또는 quarantine로 보수적으로 분류한다.

## Data migration

| Stage | Required controls |
|---|---|
| Extract | least privilege, immutable snapshot/ref, checksum, audit |
| Transform | versioned mapping, deterministic rule, rejected/quarantine output |
| Load | idempotency, ownership/state validation, no direct authority bypass |
| Verify | count/value/relationship/provenance/privacy/status reconciliation |
| Approve | Data/Business/Security owner sign-off at fixed version |

Deletion/retention/legal hold와 backup copy를 포함한 migration scope를 문서화한다.

## Feature migration

manual/current workflow에서 new feature로 이동할 때 cohort/audience, dual-run/read-only/feature flag, training/support, metric와 rollback trigger를 정의한다. old workflow를 제거하기 전에 functional equivalence, data completeness와 operational readiness를 검증한다.

## Rollback

rollback은 code뿐 아니라 data, configuration, external publication와 queued job을 다룬다. destructive step 전에 restorable checkpoint를 만들고 backward compatibility 또는 forward-recovery path를 검증한다. 이미 발생한 external effect는 단순 database rollback으로 해결됐다고 간주하지 않고 reconcile/withdraw한다.

## Acceptance

mapped `TEST-004/010/012/023/048/051–053/056`, migration report, exception disposition, achieved downtime/RPO/RTO와 fresh approval가 필요하다.

> **OPEN DECISION:** legacy sources, actual volumes/quality, migration tooling, coexistence window와 final cutover method.
