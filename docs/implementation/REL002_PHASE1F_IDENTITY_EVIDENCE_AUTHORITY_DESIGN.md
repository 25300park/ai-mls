# REL-002 Phase 1F Identity Evidence Authority Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-295 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Identity / Audit Owner |
| 기준일 | 2026-09-18 |
| Decisions | DEC-165, DEC-167, DEC-169 (`APPROVED`) |
| Baseline | `3c2a03ac6787b0323846da6bfa2d3e52c72cc069` |

## 1. 목적

Phase 1E에서 확인된 `identityEvidenceRef`와 `auditEvidenceRef` 검증 공백을 닫는 최소 authority adapter를 정의한다. 새 evidence store, 새 authentication authority 또는 새 API-016 event vocabulary를 만들지 않는다.

## 2. Repository authority 판정

`CANONICAL_IDENTITY_EVIDENCE_AUTHORITY = PARTIAL`이다.

- API-016에는 append-only final Audit Event authority인 `DurableAuditEventStore`가 존재한다.
- API-016 materializer는 intent identity, chronology, principal provenance 및 tenant/scope를 보존한다.
- 그러나 registered workload의 identity proof를 발급하고 immutable reference로 조회하는 Identity-owned contract가 없다.
- API-016에도 registration evidence를 `registrationId + tenantId + principalId + registrationVersion`에 결속해 검증하는 canonical read port/profile이 없다.
- Staging-only API-016 composition은 Production evidence authority로 승격하지 않는다.

현재 `DurableAuditEventStore` constructor는 writable SQLite를 열고 `PRAGMA journal_mode = WAL` 및 `CREATE TABLE IF NOT EXISTS`/trigger DDL을 실행한다. 따라서 이 class는 pre-gate Production evidence verification에 직접 사용할 수 없다.

따라서 기존 authority는 재사용 가능하지만 두 reference의 교차 결속을 추정하거나 기본값으로 만들 수 없다.

## 3. 제안 adapter

`RegisteredServiceWorkloadEvidenceAuthorityAdapter`는 read-only composition adapter다.

| 입력 | 검증 |
|---|---|
| registration record | `registrationId`, `tenantId`, `principalId`, `registrationVersion`, 두 evidence ref |
| Identity evidence port | immutable identity proof가 동일 registration/version/tenant/principal을 가리킴 |
| API-016 evidence port | final append-only event가 동일 registration/version/tenant/principal을 가리킴 |

성공 조건은 두 authority가 같은 binding을 독립적으로 입증하는 경우뿐이다. missing, malformed, non-final, tenant/principal/version mismatch 또는 unavailable authority는 모두 fail closed다.

Adapter는 다음을 하지 않는다.

- evidence 저장/발급/변경
- 역할·scope·capability 결정
- registration lifecycle 변경
- Audit Event 직접 생성
- processing-time Session/role reconstruction
- v1 intent 보정 또는 기본 provenance 생성

API-016 쪽에는 별도 `ReadOnlyAuditEvidenceQueryPort`가 필요하다. 이 port의 Production adapter는 Phase 2가 provision한 existing schema를 read-only mode로 열고, schema readiness PASS 이후 exact event/reference key로 조회만 한다. 기존 mutating store constructor를 호출하거나 DDL/PRAGMA mutation/repair를 수행하지 않는다. Missing Phase-2 schema 또는 incompatible API-016 schema는 fail closed다.

## 4. 필요한 canonical contract

DEC-169의 approved contract에 따라 구현 전 다음이 명시되어야 한다.

1. Identity-owned immutable registration evidence의 발급 주체와 read-only lookup contract
2. API-016 final evidence 조회 key와 registration binding profile
3. evidence payload의 exact required fields 및 version
4. registration 생성/변경과 evidence persistence의 transaction/lineage 관계
5. evidence가 unavailable일 때의 concealment 및 safe error
6. Phase-2-provisioned API-016 schema에 대한 read-only query adapter와 exact lookup key

새 API-016 event가 필요하다고 판명되면 Phase 1F 범위를 벗어난 별도 Audit Owner/AO 승인이 필요하다. Phase 1F는 event vocabulary를 발명하지 않는다.

## 5. Phase 1E salvage 영향

- `RegisteredServiceWorkload` decoder와 exact binding은 재사용한다.
- `DurableRegisteredServiceWorkloadStore`의 injected verifier seam은 adapter port로 교체/강화할 수 있다.
- canonical adapter가 없는 상태에서 `identityEvidenceRef` 또는 `auditEvidenceRef`를 문자열 존재만으로 신뢰하지 않는다.
- DEC-169가 ratify되고 authority ports가 구현되기 전 Phase 1E Production readiness는 BLOCKED다.

## 6. Decision proposal

`DEC-169 = APPROVED`: 기존 Identity/API-016 authority만 소비하는 read-only registration evidence binding adapter, Phase-2-provisioned read-only API-016 query boundary 및 evidence-backed workload authorization subject projection을 사용한다. 새 authority, writable store, public API 및 event vocabulary는 승인하지 않는다.
