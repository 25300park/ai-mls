# ADR-007: R3-C1 Workload Binding Persistence Boundaries

| 항목 | 값 |
|---|---|
| Document ID | DOC-ADR-007 |
| Version | v0.1 |
| Status | APPROVED |
| Date | 2026-10-02 |
| Decision owner | Architecture Owner |
| Approval evidence | DEC-199 / CR-033; Human/AO APPROVE_NEW_SCHEMA_APP_ORGANIZATION |
| Supersedes | None |

## Context

[R3-C0 Contract](../implementation/REL002_R3C0_WORKLOAD_BINDING_CONTRACT.md)의 세 entity는 독립 authority의 versioned proof다. Organization placement 미결정은 Human/AO의 새 app_organization 승인으로 해소했다. 이번 구현은 persistence foundation이며 startup resolver를 활성화하지 않는다.

## Decision

| Entity | Authority owner | Schema / table | PostgreSQL object owner |
|---|---|---|---|
| OrganizationGovernanceRecord | Organization Data Steward | app_organization.organization_governance_versions | ai_mls_production_migration_operator |
| ProjectGovernanceRecord | Administration | app_administration.project_governance_versions | ai_mls_production_migration_operator |
| WorkloadStartupBindingRecord | Identity | app_identity.workload_startup_binding_versions | ai_mls_production_migration_operator |

Object owner는 기존 기술적 migration executor이며 domain authority를 대체하지 않는다. 신규 domain role 또는 generic governance schema는 만들지 않는다. Schema placement 승인은 DEC-200에 추적하며 아래 implementation 세부 사항은 R3-C1 closeout 검토 대상이다.

각 table의 PK는 id/version이다. Version은 positive safe-integer BIGINT, createdAt은 frozen timestamptz다. Typed evidenceReferences와 Project containedScopes는 JSONB이며 bounded nonempty unique arrays(max 256)로 검증한다. Frozen payload 변경은 새 version을 요구하고 UPDATE/DELETE guard는 owner 자체의 직접 쓰기에도 적용된다. 신규 version은 PROPOSED에서 시작한다. Organization/Project RETIRED와 Binding REVOKED는 terminal이며 timestamp metadata로 terminal row를 바꾸지 않는다. ACTIVE는 lineage당 최대 하나, Binding은 pinned registration tuple당 최대 하나다.

## Referential Integrity

| 관계 | 결정 | 이유 / 검증 |
|---|---|---|
| Project→Organization | logical canonical reference | 서로 다른 owner; Organization current ACTIVE와 exact organizationId/tenantId를 injected async Organization read contract로 검증 |
| Binding→RegisteredServiceWorkload | physical registration_id FK | 동일 Identity ownership, 기존 PK 재사용; immediate NOT DEFERRABLE, ON UPDATE/DELETE NO ACTION; 별도 trigger로 registrationVersion/tenant/principal/identityEvidenceRef/SERVICE/WORKLOAD/PRODUCTION 및 활성화 시 ACTIVE 확인 |
| Binding→Organization | logical canonical record/version reference | owner 분리; organization-governance locator를 exact decode하고 injected reference verifier가 durable row/current eligibility 검사 |
| Binding→Project | logical canonical record/version reference | owner 분리; project-governance locator와 exact tenant/org/containment 검증 계약 |
| Binding→Scope | logical typed owner reference | TEAM/POLICY/SOURCE/TARGET만 매핑; administration-scope locator는 tenant/resourceType/id/version exact; 새 Scope authority/FK 없음 |

## Transaction / Evidence

Async contracts와 각 concrete store가 write authority를 소유한다. 공통 helper는 순수 값 검증과 client lifecycle만 제공한다. 각 store는 기존 PostgreSqlPoolPort를 주입받고 pool/secret를 생성·종료·소비하지 않는다. 먼저 owner persistence에서 exact replay/conflict를 read-only로 판별한다. Replay가 아니면 cross-domain reference/evidence port를 검증한 뒤 owner transaction이 같은 상태를 잠금/CAS로 재검사하고 mutation한다. 이 순서는 external read 장애 중 canonical replay를 보존하고 single-pool(max=1) 중첩 lease deadlock을 피하지만 cross-domain atomic snapshot을 증명하지 않는다. 다음 runtime phase에서 current owner eligibility와 selection을 다시 검증해야 한다.

Identity의 advisory transaction locks는 binding lineage/registration tuple에만 적용하고 key를 정렬해 lock 순서를 고정한다. 전역 lock/pointer table은 없다. Locked row의 expected payload/state CAS, unique indexes로 replacement의 old ACTIVE→REVOKED/new version→ACTIVE를 한 transaction에 commit한다. Exact replay는 NO-OP, conflict는 deny/rollback이다. Ambiguous COMMIT는 client discard와 owning lease quarantine으로 처리하며 자동 retry하지 않는다. BEGIN 실패는 rollback, rollback/release 실패는 quarantine과 normalized UNAVAILABLE로 처리한다. Port의 raw 오류도 정규화한다.

Binding proof는 frozen row 자체이며 bindingEvidenceRef 컬럼/parallel proof table이 없다. auditEvidenceRef는 API-016 lineage 경계일 뿐 Identity authority가 아니다. Binding reference verifier는 R3-C1의 필수 injected read/evidence interface이며 실제 startup port assembly는 NOT_STARTED다. Disposable test의 Scope/Audit fixture를 Production resolver 구현으로 주장하지 않는다.

## ACL / Readiness

Runtime ai_mls_production_runtime은 schema USAGE와 신규 table SELECT/INSERT, mutable status/updated_at 및 Binding audit_evidence_ref의 column UPDATE만 보유한다. Frozen column UPDATE, DELETE/TRUNCATE/DDL/REFERENCES/TRIGGER, ownership/GRANT OPTION/PUBLIC EXECUTE는 허용하지 않는다. Trigger는 invoker이며 search_path=pg_catalog다. Runtime client current_user 검증으로 migration credential 사용을 거부한다.

신규 up artifacts는 role-precondition이 있는 forward-only transaction이며 재적용은 거부한다. 별도 verify artifacts는 read-only로 반복 가능하다. Runtime 자동 migration/DDL/repair/backfill이 없다. R3-C1 aggregate는 한 repeatable-read read-only catalog snapshot에서 세 root의 column/type/constraint/index/trigger/function source/ownership/direct+effective ACL/role 경계가 모두 일치해야 READY다. app_organization inventory는 정확히 한 table이며 추가 object도 deny한다. 기존 schema의 기존 object inventory 검증은 기존 R3-B/Identity gate의 책임이다.

## Consequences / Historical Boundary

새 table은 기존 두 schema의 additive extension이다. Approved migration/R3-B fingerprint/historical evidence/test를 수정하지 않았다. R3-C1 적용 Administration은 기존 9-table R3-B fingerprint를 충족하지 않으므로 기존 aggregate startup은 계속 fail-closed다. 후속 승인 단계가 확장된 schema composition을 명시적으로 처리해야 한다. 이번 READY는 disposable PostgreSQL의 새 persistence foundation만 검증한 결과다. 실제 Production readiness NOT_VERIFIED, deployability BLOCKED다.

## Validation / Follow-up

[Implementation Plan](../implementation/REL002_R3C1_IMPLEMENTATION_PLAN.md), [Completion Report](../reviews/REL002_R3C1_COMPLETION.md)와 focused/disposable tests에 검증을 연결한다. Runtime resolver/listener/workers/Production migration/activation은 구현하지 않는다. Commit/push도 별도 closeout 승인 전 수행하지 않는다.