# REL-002 Phase 2C Migration Preflight Checklist

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-312 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Operations Owner / Data Owner / Security Owner |
| 기준일 | 2026-09-18 |

## 1. 사용 규칙

Checkbox는 evidence가 아니다. 모든 항목은 execution instance ID, exact target binding, named operator, approver, timestamp와 safe evidence reference를 가져야 한다. 하나라도 `FAIL`, `UNKNOWN`, stale 또는 unavailable이면 migration을 시작하지 않는다.

## 2. Target와 authorization

- [ ] `runtimeEnvironment = PRODUCTION`이며 Staging/Test/Development fallback이 없다.
- [ ] logical target가 기존 Identity-owned Production Identity/Session database boundary다.
- [ ] physical database identity reference/fingerprint가 approved Production configuration에 exact하게 결합된다.
- [ ] target binding이 ambiguous하지 않고 path/credential value를 evidence에 노출하지 않는다.
- [ ] named human operator의 trusted Session, MFA freshness, live authorization과 exact change scope가 유효하다.
- [ ] Operations/Data/Security independent approval과 maintenance window가 current다.

## 3. Artifact와 current state

- [ ] migration ID가 `REL002-P2A-IDENTITY-RSW-V1`이다.
- [ ] artifact SHA-256이 `fd31b7376cf6d04102b1c5280b07b02985aefb0ebcf18111cdbdb5a5ead7bb90`이다.
- [ ] contract ID/version/fingerprint가 승인 값과 exact하다.
- [ ] artifact가 identity row seed, credential, role/scope/capability를 포함하지 않는다.
- [ ] read-only state가 `NOT_READY_MISSING_SCHEMA` 또는 exact replay `READY`다.
- [ ] incompatible, unsupported, partial 또는 conflicting ledger state가 없다.

## 4. Recovery와 capacity

- [ ] exact target consistency set의 immutable pre-change backup이 존재한다.
- [ ] backup completeness/authenticity/checksum/encryption/key availability가 검증됐다.
- [ ] isolated non-Production restore rehearsal이 성공했다.
- [ ] restore evidence가 exact target/candidate/artifact에 current하게 결합된다.
- [ ] DB storage/free space와 transaction journal capacity가 migration 및 rollback에 충분하다.
- [ ] rollback/forward-fix owner와 failure communication path가 준비됐다.

## 5. Quiescence와 concurrency

- [ ] listeners, writers, workers, provider-capable runtime이 시작되지 않았거나 정지됐다.
- [ ] `DurableSessionUnitOfWork`와 five Production child roots가 열려 있지 않다.
- [ ] open write transaction과 competing migration executor가 없다.
- [ ] single executor가 `BEGIN IMMEDIATE` lock을 획득할 수 있다.
- [ ] lock timeout/contention 시 자동 retry 없이 abort한다.

## 6. Evidence와 abort

- [ ] execution/change/operator/approval/backup/restore evidence references가 사전 생성됐다.
- [ ] evidence sink가 secret, path, raw SQL, stack, DB row를 저장하지 않는다.
- [ ] abort/ambiguous-commit/read-only reclassification procedure가 준비됐다.
- [ ] post-migration verification owner가 독립적으로 배정됐다.
- [ ] identity seed가 별도 승인 없이는 계속 `0`임을 확인했다.

## 7. Current snapshot

현재 physical target binding, operator execution evidence, backup/restore evidence가 없으므로 이 checklist는 `INCOMPLETE`; controlled execution은 `BLOCKED`다.
