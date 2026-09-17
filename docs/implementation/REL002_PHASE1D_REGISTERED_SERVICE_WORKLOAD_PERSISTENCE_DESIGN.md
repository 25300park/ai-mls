# REL-002 Phase 1D Registered Service Workload Persistence Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-288 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security/Identity/Data Owner |
| 기준일 | 2026-09-18 |
| Decisions | DEC-165 (`APPROVED`), DEC-167 (`APPROVED`) |
| Baseline | `66599a3b79490952bc53bbbec9193de1ac2a0b0b` |

## 1. 목적과 결정

[Phase 1C authority design](REL002_PHASE1C_PRODUCTION_SERVICE_WORKLOAD_AUTHORITY_DESIGN.md)을 물리 persistence 구현이 가능한 수준으로 구체화한다. 권고안은 기존 Identity persistence database boundary 안에 별도 Identity-owned table과 store를 두는 것이다.

| 항목 | 결정 |
|---|---|
| Physical boundary | 기존 Identity/Session database boundary 재사용 |
| Logical owner | Identity domain |
| Table | `identity_registered_service_workloads` |
| Store | `DurableRegisteredServiceWorkloadStore` |
| Session UoW 관계 | 같은 물리 boundary를 사용할 수 있으나 별도 store/lifecycle/connection ownership |
| Administration persistence | 사용 금지 |
| Standalone Identity database | 생성 금지 |
| Production migration owner | REL-002 Phase 2 |

이 선택은 새 persistence subsystem을 만들지 않고 Identity truth를 Administration의 RBAC truth 및 Session continuity와 분리한다.

## 2. Canonical lifecycle 재사용 확인

`ACTIVE | SUSPENDED | REVOKED`는 `modules/identity/src/session-service.ts`의 기존 `AuthenticatedIdentity.status`와 Phase 1C `RegisteredServiceWorkloadStatus`에 이미 존재한다. 따라서 DEC-167 제안은 새 lifecycle vocabulary를 추가하지 않고 Identity의 canonical vocabulary를 재사용한다.

Session record의 `ACTIVE | REVOKED | EXPIRED`는 access-continuity lifecycle이며 registration lifecycle을 대체하지 않는다.

## 3. Table contract

Phase 2 migration이 다음 contract와 일치하는 table을 provision해야 한다. Phase 1 구현은 이 DDL을 실행하거나 `CREATE TABLE IF NOT EXISTS`로 보정하지 않는다.

```sql
CREATE TABLE identity_registered_service_workloads (
  registration_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  principal_type TEXT NOT NULL CHECK (principal_type = 'SERVICE'),
  assurance TEXT NOT NULL CHECK (assurance = 'WORKLOAD'),
  environment TEXT NOT NULL CHECK (environment = 'PRODUCTION'),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  workload_purpose TEXT NOT NULL,
  audience TEXT NOT NULL,
  registration_version INTEGER NOT NULL CHECK (registration_version >= 1),
  identity_evidence_ref TEXT NOT NULL,
  audit_evidence_ref TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, principal_id)
);

CREATE INDEX identity_registered_service_workloads_tenant_status_idx
  ON identity_registered_service_workloads (tenant_id, status);
```

DDL은 migration contract 설명이며 실행 승인이 아니다. Timestamp와 reference는 bounded decoder가 canonical ISO-8601/non-empty representation을 검증한다.

## 4. Store contract

```ts
interface RegisteredServiceWorkloadRecord {
  readonly registrationId: string;
  readonly tenantId: string;
  readonly principalId: string;
  readonly principalType: "SERVICE";
  readonly assurance: "WORKLOAD";
  readonly environment: "PRODUCTION";
  readonly status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  readonly workloadPurpose: string;
  readonly audience: string;
  readonly registrationVersion: number;
  readonly identityEvidenceRef: string;
  readonly auditEvidenceRef: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface RegisteredServiceWorkloadAuthorityLease {
  assertSchemaReady(): void;
  findByRegistrationId(registrationId: string):
    Readonly<RegisteredServiceWorkloadRecord> | undefined;
  close(): void;
}

interface RegisteredServiceWorkloadEvidenceVerifier {
  assertIdentityEvidence(reference: string, tenantId: string): void;
  assertAuditEvidence(reference: string, tenantId: string): void;
}

interface DurableRegisteredServiceWorkloadStore
  extends RegisteredServiceWorkloadAuthorityLease {
  create(record: RegisteredServiceWorkloadRecord): void;
  update(
    expectedRegistrationVersion: number,
    record: RegisteredServiceWorkloadRecord,
  ): void;
  close(): void;
}
```

Pre-gate bootstrap에는 read-only `RegisteredServiceWorkloadAuthorityLease`만 제공한다. Lease는 PASS 뒤에도 runtime lifecycle revalidation에 사용되고 bootstrap shutdown에서 닫힌다. Mutation contract는 별도 implementation authorization과 Phase 2 migration 완료 뒤에만 사용할 수 있다.

Store implementation은 `RegisteredServiceWorkloadEvidenceVerifier`를 required dependency로 받는다. 이 port는 새 evidence vocabulary나 store를 만들지 않고 existing canonical Identity/API-016 evidence authority를 확인한다. Canonical backing authority가 repository에서 확인되지 않으면 default resolver를 만들지 않고 implementation을 중단한다.

## 5. Concurrency, identity and integrity

- `registration_id`는 immutable aggregate identity다.
- `(tenant_id, principal_id)` uniqueness는 한 tenant 안에서 canonical service principal 중복을 차단한다.
- Update는 `registration_id`와 expected `registration_version`을 모두 조건으로 하는 CAS이며 성공 시 version을 정확히 1 증가시킨다.
- `tenant_id`, `principal_id`, `principal_type`, `assurance`, `environment`, `identity_evidence_ref`, `created_at`은 update로 교체하지 않는다.
- `identity_evidence_ref`와 `audit_evidence_ref`는 reference만 저장하며 raw evidence, secret, role/scope/capability snapshot은 저장하지 않는다. Create/update 시 existing canonical evidence authority에 대한 injected verifier가 reference existence, tenant binding과 immutable target을 확인한다. Verifier가 없거나 target이 missing/mismatched/mutable이면 fail closed한다.
- Source evidence는 registration row delete와 cascade되지 않는다. Source owner가 evidence를 삭제하거나 inaccessible하게 만들면 subsequent resolution/revalidation은 orphaned authority로 fail closed한다.
- Administration table에 foreign key를 두지 않는다. Authorization linkage는 resolved `(tenantId, principalId)`에 대해 existing live `AuthorizationService`가 authoritative하게 검증한다.
- Missing table, missing index/constraint, malformed row, version conflict 또는 DB diagnostic은 safe fail-closed error로 정규화한다.

## 6. Migration과 startup boundary

REL-002 Phase 2가 schema creation, versioned migration, lock, rollback/recovery 및 rehearsal evidence를 소유한다. Phase 1 bootstrap은 다음만 허용한다.

- 이미 provision된 Identity database를 read-only authority lease로 연다.
- table/column/index/constraint contract가 준비되었는지 read-only 검사한다.
- required registration을 `registrationId`로 조회하고 runtime 동안 lifecycle을 재검증한다.

Phase 2 migration 완료 전 table/schema가 없으면 bootstrap은 fail closed한다. Phase 1 code가 runtime DDL로 이를 생성·수선하는 것은 금지한다.

## 7. 데이터 금지 목록

Store에는 credential value, API key/token/password, provider material, roles, scopes, capabilities, policy result, caller readiness, raw authentication evidence, stack, path, SQL 또는 environment dump를 저장하지 않는다.

## 8. DEC-167 승인 결과

DEC-167 `RegisteredServiceWorkload Physical Persistence Ownership`은 2026-09-18 Architecture Owner closeout으로 `APPROVED`되었다. 이 승인은 physical persistence design을 확정하지만 table/store implementation, Production schema 또는 Phase 2 migration 실행을 자동 승인하지 않는다.
