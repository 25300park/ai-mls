# REL-002 Phase 2C Post-Migration Verification Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-315 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Identity Owner / Data Owner / Operations Owner |
| 기준일 | 2026-09-18 |

## 1. Immediate read-only verification

Commit 후 새 read-only connection에서 다음을 검증한다.

1. runtime inspector가 `READY`를 반환한다.
2. exact columns, affinity, constraints, indexes, metadata version/fingerprint가 일치한다.
3. migration ledger에 exact migration ID/checksum/contract/version/fingerprint/environment row가 정확히 하나 존재한다.
4. `identity_registered_service_workloads` row count가 `0`이다.
5. unrelated Identity/Session tables와 metadata가 preflight evidence와 일치한다.
6. 같은 candidate 재평가가 no-op으로 분류되고 write/mutation이 `0`이다.

## 2. Negative verification

- missing/extra column, partial index, unexpected trigger/FK, version/checksum drift를 `READY`로 분류하지 않는다.
- Staging/Test/Development database 또는 different database identity를 Production evidence로 사용하지 않는다.
- Identity registration, role/scope/capability, credential, Session 또는 final Audit Event를 migration 결과로 만들지 않는다.

## 3. ProductionBootstrap readiness transition

Schema verification 성공은 schema sub-gate만 `READY`로 만든다. Aggregate bootstrap은 별도 evidence-bound workload registration, live authorization, configuration/secret resolution과 remaining root readiness가 통과할 때까지 `NOT_READY`다.

Migration/post-verification 과정에서 다음 count는 모두 `0`이어야 한다.

- `DurableSessionUnitOfWork` creation
- Production child-root construction/start
- listeners/workers start
- provider execution/network call
- business/domain mutation

## 4. Acceptance and observation

Independent verifier가 exact target/candidate-bound 결과를 승인해야 한다. Verification failure 또는 unknown은 change를 close하지 않고 [Rollback/Failure Policy](REL002_PHASE2C_ROLLBACK_FAILURE_POLICY.md)에 따라 escalation한다. 이 검증은 REL-002 전체 Production readiness 또는 deployment authorization을 부여하지 않는다.
