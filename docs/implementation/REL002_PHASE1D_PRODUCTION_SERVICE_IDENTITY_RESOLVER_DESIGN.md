# REL-002 Phase 1D Production Service Identity Resolver Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-289 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security/Identity Owner |
| 기준일 | 2026-09-18 |
| Decisions | DEC-165 (`APPROVED`), DEC-167 (`APPROVED`) |
| Baseline | `66599a3b79490952bc53bbbec9193de1ac2a0b0b` |

## 1. 목적

`ProductionServiceIdentityResolver`가 caller의 주장 대신 Identity-owned durable registration으로 Production service identity를 증명하는 최소 read boundary를 정의한다.

## 2. Contract

```ts
interface ProductionServiceIdentityReference {
  readonly registrationId: string;
}

interface ProductionServiceIdentityBinding {
  readonly registrationId: string;
  readonly tenantId: string;
  readonly principalId: string;
  readonly principalType: "SERVICE";
  readonly assurance: "WORKLOAD";
  readonly environment: "PRODUCTION";
  readonly workloadPurpose: string;
  readonly audience: string;
  readonly registrationVersion: number;
  readonly identityEvidenceRef: string;
}

interface ProductionServiceIdentityResolver {
  resolve(
    reference: ProductionServiceIdentityReference,
  ): Readonly<ProductionServiceIdentityBinding>;
}

interface ProductionServiceIdentityRevalidator {
  assertStillActive(binding: ProductionServiceIdentityBinding): void;
}
```

입력은 `registrationId` 하나뿐이다. Expected `environment = PRODUCTION`, `workloadPurpose`와 `audience`는 caller가 아니라 validated `ProductionRuntimeConfiguration`에서 resolver constructor에 주입된다. Caller-supplied tenant, principal, status, assurance, role, scope, capability 또는 readiness는 contract에 존재하지 않는다.

## 3. Resolution sequence

```text
registrationId
→ bounded identifier validation
→ authoritative registration load
→ status = ACTIVE
→ principalType = SERVICE
→ assurance = WORKLOAD
→ environment = PRODUCTION
→ compare purpose/audience with validated consumer configuration
→ derive immutable tenant/principal binding
→ return narrowed identity binding
→ existing AuthorizationService performs live authorization
```

Resolver는 registration existence/lifecycle/assurance와 trusted consumer binding을 증명한다. Authorization request의 purpose/resource/scope는 이 resolver 입력이 아니며, downstream `SessionAccessCoordinator`와 existing live `AuthorizationService`가 계속 판정한다.

Read-only authority lease는 PASS 후 bootstrap이 유지한다. Listener ingress, worker dispatch 및 provider-capable execution 직전에 `ProductionServiceIdentityRevalidator.assertStillActive()`가 registration ID/version/tenant/principal/type/assurance/environment/purpose/audience를 다시 로드·비교한다. `SUSPENDED`, `REVOKED` 또는 version/binding 변경은 새 work를 fail closed한다. 이 revalidation은 role/scope/capability 판정을 대체하지 않는다.

## 4. Fail-closed rules

다음은 동일한 safe unavailable/denied 경계로 실패하며 raw store diagnostic을 노출하지 않는다.

- malformed 또는 unknown `registrationId`;
- authority/table unavailable;
- registration missing;
- non-`ACTIVE` lifecycle;
- non-`SERVICE` principal type;
- non-`WORKLOAD` assurance;
- non-`PRODUCTION` environment 또는 trusted configuration과 다른 purpose/audience;
- malformed tenant/principal/evidence reference;
- row/table contract mismatch;
- lower-environment fixture 또는 process-local object substitution.

## 5. Authorization separation

| Fact | Canonical owner | Resolver behavior |
|---|---|---|
| Registration/lifecycle/assurance/environment/purpose/audience | Identity `RegisteredServiceWorkload` | load, validate and revalidate before new work |
| Tenant/principal binding | Identity registration | derive, never accept from caller |
| Roles/scopes/capabilities | Administration-backed `RoleAssignment` | do not load/store/project |
| Policy/purpose decision | existing `AuthorizationService` | delegate live decision |
| Session continuity/revocation | existing Session authority | do not replace |

A valid binding alone never authorizes listener, worker, provider execution or business mutation.

## 6. Safe evidence

Bootstrap evidence may retain registration ID/version, authority ID, identity evidence reference, outcome and correlation ID. It must not retain a credential, raw proof, role assignment snapshot, secret reference value, SQL, path, stack or environment dump.

## 7. Required test design

Implementation authorization 이후 RED cases는 missing registration, suspended/revoked record, wrong type/assurance, caller tenant/principal override, role/scope field injection, stale registration version, unavailable schema, unsafe diagnostic leakage 및 valid identity + live authorization denial을 포함한다.
