# REL-002 Phase 1C Production Service/Workload Authority Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-283 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security/Identity Owner |
| 기준일 | 2026-09-18 |
| Decision | DEC-165 (`APPROVED`) |
| Baseline | `42d65b9533eecb4cc579859c17bb91ba4f44e70e` |

## 1. 목적

Production에서 `SERVICE`/`WORKLOAD` principal의 신원을 신뢰할 수 있게 증명하는 최소 authority를 정의한다. 이 설계는 [Phase 1 Production Identity Model](REL002_PHASE1_PRODUCTION_IDENTITY_MODEL.md)의 재사용 원칙을 보존하면서, Phase 1B에서 확인된 canonical registration authority 부재를 명시적으로 닫기 위한 제안이다.

## 2. 권고 authority

Canonical recommendation은 Identity domain이 소유하는 `RegisteredServiceWorkload` authority다.

`RegisteredServiceWorkload`는 다음 사실만 소유한다.

- canonical `principalId`;
- `principalType = SERVICE`;
- canonical `tenantId` association;
- `assurance = WORKLOAD` 및 해당 assurance의 검증 상태;
- 기존 vocabulary를 재사용한 `ACTIVE | SUSPENDED | REVOKED` lifecycle status;
- registration version과 immutable identity-evidence reference;
- Production environment 및 workload purpose/audience binding;
- 생성·변경 시각과 audit-safe provenance reference.

이 authority는 role, capability, scope, approval 또는 business authority를 소유하지 않는다.

## 3. Canonical contract

```ts
type RegisteredServiceWorkloadStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

interface RegisteredServiceWorkload {
  readonly principalId: string;
  readonly principalType: "SERVICE";
  readonly tenantId: string;
  readonly assurance: "WORKLOAD";
  readonly status: RegisteredServiceWorkloadStatus;
  readonly environment: "PRODUCTION";
  readonly workloadPurpose: string;
  readonly audience: string;
  readonly registrationVersion: number;
  readonly identityEvidenceRef: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface RegisteredServiceWorkloadAuthority {
  readonly authorityId: string;
  isAvailable(): boolean;
  resolve(principalId: string): Readonly<RegisteredServiceWorkload> | undefined;
}
```

Contract는 immutable read 결과와 fail-closed lookup만 제공한다. 등록·정지·폐기 command 또는 public API는 Phase 1C 범위가 아니다.

## 4. Authentication과 authorization 분리

| Concern | Authority | Phase 1C rule |
|---|---|---|
| identity proof | approved authentication/workload adapter | 어떤 workload가 실행 중인지 증명 |
| service registration/lifecycle | `RegisteredServiceWorkloadAuthority` | 등록, tenant binding, workload assurance, lifecycle만 소유 |
| roles/capabilities/scopes | existing live `AuthorizationService` and administration-backed `RoleAssignment` | 현재 권한을 매 access마다 판정 |
| Session admission | existing `SessionAccessCoordinator` | trusted binding과 live authorization 재검증 |
| audit provenance | existing mutation-time provenance rules | registration reference만 안전하게 연결 |

`RoleAssignment`를 identity registry로 확장하지 않으며 `DurableSessionUnitOfWork`를 장기 registration authority로 사용하지 않는다. Durable Session은 인증된 access continuity를 소유하고 service registration truth를 소유하지 않는다.

## 5. Persistence disposition

`RegisteredServiceWorkload`는 restart 이후에도 동일한 registration/lifecycle truth를 제공해야 하므로 논리적으로 persistent entity가 필요하다. 그러나 Phase 1C는 repository-local table, migration 또는 물리 secret/identity provider를 선택하지 않는다.

따라서 다음을 구분한다.

- New persistent entity: `YES` — canonical identity record가 필요하다.
- New table/schema: `DEFERRED` — Phase 1C는 특정 table/schema를 선택하거나 승인하지 않는다.
- New persistence subsystem: `NO` — 후속 구현은 승인된 Identity persistence adapter를 재사용하거나 별도 AO infrastructure 결정을 받아야 한다.

Production adapter가 durable authority를 제공하지 못하거나 bootstrap 이전에 read-only availability를 증명할 수 없으면 startup은 fail closed한다.

## 6. 금지 데이터와 안전 evidence

다음을 저장하거나 반환하지 않는다.

- credential secret value, API key, token, password;
- provider credential material;
- role, capability, scope assignment snapshot;
- caller-supplied readiness 또는 authority claim;
- raw authentication evidence, stack, path, SQL 또는 environment dump.

허용 evidence는 `authorityId`, `principalId` reference, tenant reference, registration version, lifecycle status, identity evidence reference, validation outcome 및 correlation ID로 한정한다.

## 7. Fail-closed 규칙

- authority unavailable, record missing, non-`ACTIVE`, tenant mismatch, non-`WORKLOAD`, wrong environment/purpose/audience는 service startup을 차단한다.
- 등록이 유효해도 live authorization이 거부하면 실행 권한은 없다.
- registration config나 credential reference는 role/capability를 제조하지 못한다.
- process-local fixture, Development/Staging identity 및 caller-supplied actor fields는 Production authority가 아니다.

## 8. 결정 상태

DEC-165는 2026-09-18 Architecture Owner closeout으로 `APPROVED`되었다. 이 승인은 authority design을 확정하지만 Production identity implementation, physical table/schema 또는 migration을 승인하지 않는다. 구현과 table/schema 선택은 각각 별도 승인이 필요하다.
