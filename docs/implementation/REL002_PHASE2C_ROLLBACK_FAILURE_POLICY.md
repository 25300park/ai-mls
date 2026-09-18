# REL-002 Phase 2C Rollback / Failure Policy

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-314 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Data Owner / Operations Owner / Identity Owner |
| 기준일 | 2026-09-18 |

## 1. Failure classes

| 시점/상태 | 허용 대응 |
|---|---|
| Lock 전 preflight failure | 아무 DB write 없이 abort |
| Transaction 중 artifact/ledger/verification failure | 동일 transaction rollback 후 evidence 기록 |
| Commit 성공 + application incompatibility | v1-compatible prior application rollback 또는 승인된 forward-fix |
| Commit 성공 + schema defect | 새 migration ID/checksum을 가진 governed forward-fix |
| Commit outcome ambiguous | read-only schema + ledger reclassification; blind rerun 금지 |
| Partial/conflicting current state | 자동 repair/overwrite 금지, incident/change escalation |

## 2. Prohibited rollback

다음은 금지한다.

- `identity_registered_service_workloads`, schema metadata 또는 ledger row의 destructive drop/delete/downgrade
- history/checksum을 바꾸어 replay를 성공시킴
- backup restore로 current authority/audit evidence를 조용히 덮어씀
- runtime `CREATE TABLE IF NOT EXISTS` 또는 implicit repair
- identity row seed/reactivation

## 3. Abort conditions

다음 중 하나라도 발생하면 rollback 가능 시 rollback하고 실행을 중단한다.

- target environment/physical binding mismatch 또는 ambiguity
- operator authorization, MFA, SoD, change approval 만료/철회
- backup/restore prerequisite failure
- artifact checksum/contract/version/fingerprint mismatch
- incompatible/unsupported/partial/conflicting state
- competing writer, lock contention/timeout, insufficient capacity
- schema/metadata/ledger/verification mismatch
- identity seed count non-zero
- secret, credential, path, raw SQL/row 또는 unsafe diagnostic exposure

## 4. Recovery and evidence

Failure는 bounded safe error code, execution/change correlation, phase, transaction disposition, safe evidence reference와 next owner를 기록한다. Raw stack/path/SQL/data는 기록하지 않는다. Failed execution은 success로 재분류하지 않으며, later retry는 원인이 닫히고 새 authorization/preflight가 통과한 별도 execution instance다.

## 5. External effects

이 migration은 provider/network/business side effect를 생성하지 않는다. 만약 external effect가 관찰되면 canonical scope breach로 간주하고 즉시 abort/escalate한다.
