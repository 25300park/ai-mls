# REL-002 R3-B8 PG_PRODUCTION_POOL / Aggregate Schema Readiness Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-380 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner |
| Brief | REL-002 R3-B8 |
| 기준 Main | `a6554c09cbac39dd76e1ec8ca81255a16e94ee1d` |

현재 사용자 승인 범위와 [R3-B0 Architecture](REL002_R3B0_POSTGRESQL_ASYNC_PERSISTENCE_ARCHITECTURE.md)의 DEC-198 및 read-only aggregate 계약을 구현했다. [Completion Report](../reviews/REL002_R3B8_COMPLETION_REPORT.md)에서 검증과 한계를 추적한다. Production 배포 또는 실제 Production schema readiness 검증을 승인하거나 수행한 문서가 아니다.

| 요구사항 | 구현 / 증거 | 결과 |
|---|---|---|
| 단일 bootstrap-owned canonical pool | 기존 `production-main.ts`의 `PG_PRODUCTION_POOL` 생성 및 registry의 동일 pool 주입 유지; R3-B7 actual five-domain integration 회귀 | PASS, physical pool 1 |
| DEC-198 compatibility | `PG_IDENTITY_POOL`은 기존 accepted consumer input으로 유지; 각 input의 동일 sealed variable 1회 조회와 physical creation/close 1회 검증 | PASS, duplicate consumption ABSENT |
| Alias 제거 여부 | 승인된 DEC-198은 제거를 별도 verified change로 제한한다. 아직 제거 승인이 없고 resolver의 legacy input 계약이 존재한다. compatibility 유지 필요 | PASS |
| 다섯 root aggregate | `evaluateR3B1ChildRootSchemas`가 기존 단일 catalog SELECT와 승인된 predicate를 재사용; 모두 PASS일 때만 READY | PASS |
| exact schema / ACL / semantics | R3-B1 identity/version/checksum, table/column/constraint/index/trigger/function hash, owner, direct/effective ACL, membership, PUBLIC/grant option 검사 유지 | PASS |
| 독립 / 복수 failure | 개별 다섯 schema 누락 및 복수 version/ACL drift 결과 수집; missing/duplicate malformed evidence fail-closed | PASS |
| Startup 순서 | configuration → canonical pool → identity/service prerequisites → aggregate gate → Session/child roots → 기존 후속 stages | PASS |
| 실패 cleanup / side effect 차단 | aggregate 실패 전에 Session/child root/listener/worker 생성 없음; identity/pool reverse cleanup | PASS |
| 안전한 evidence | overall status, 각 schema의 PASS/FAIL, failingSchemas, SCHEMA_CONTRACT_MISMATCH / READINESS_UNAVAILABLE; bootstrap schemaReadiness 보존 | PASS |
| Runtime repair 금지 | readiness SQL은 read-only catalog SELECT 1회; migration/DDL/grant 없음. 테스트의 migration/drift/restore는 disposable admin에서만 수행 | ABSENT |
| Authority boundary | runtime `ai_mls_production_runtime`, migration-role 전환/DDL 거부; raw DATABASE_URL 거부 및 Production SQLite 경로 차단 회귀 | PASS |
| Historical / schema 보호 | approved migrations 및 immutable historical fingerprint test 수정 없음 | PASS |

검증: Focused 14 PASS, Affected 58 PASS, Disposable PostgreSQL 3 PASS, Full regression 1707 PASS / 1 authorized immutable historical-candidate fingerprint mismatch / 13 SKIP. Build/Lint/Typecheck PASS. 독립 source review APPROVED. Disposable cluster는 stop/remove했고 port 55454는 listener 없음.

API-014/API-015/API-018/API-019/FEAT-022 persistence composition READY. Aggregate schema readiness는 승인된 disposable 계약에서 READY다. Production deployability BLOCKED; identity/service-workload R3-C와 listener/worker activation을 구현하거나 실행하지 않았다. 기존 R3-A dependency classification은 역사적 phase classification으로 유지하며 새로운 deployability 증거로 사용하지 않는다.

Production/Railway/Supabase mutation 0/0/0. Human/AO가 R3-B8 구현·검증 결과를 수락하고 정확히 한 개의 bounded closeout commit을 승인했다. Commit은 승인된 단일 R3-B8 closeout Git 기록을 따른다. Push NOT_PERFORMED. R3-C 또는 후속 phase를 시작하지 않는다.
