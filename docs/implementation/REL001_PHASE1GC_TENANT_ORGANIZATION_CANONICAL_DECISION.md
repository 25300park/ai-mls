# REL-001 Phase 1G-C Tenant / Organization Canonical Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-079 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Security Owner / Data Owner |
| 기준 commit | `e2ef82655b3dc8f1ebadbdc2512f9e8492ea0059` |

## 1. Canonical decision

`OPTION B — SEPARATE TENANT ENTITY`를 채택한다.

- Tenant는 최상위 security/data-isolation identity이다.
- Organization은 별도 business entity이며 `Organization != Tenant`이다.
- Team은 Tenant 내부의 subordinate operational scope이며 `Team != Tenant`이다.
- `organizationId` 또는 `teamId`로 `tenantId`를 암묵적으로 추론하지 않는다.
- 기존 `tenantId`, `organizationId`, `teamId` 구분을 authoritative structure로 보존한다.

## 2. Store binding

| Store | Canonical binding | Authoritative derivation | Fail-closed rule |
|---|---|---|---|
| Source Registry | `DIRECT_TENANT_BOUND` | Source record의 immutable tenant binding | caller tenant와 불일치하면 거부 |
| Intake | `DERIVED_TENANT_BOUND` | canonical Source / Raw Source ownership | parent chain 부재·불일치 시 거부 |
| Property | `SYSTEM_BOUND` | canonical master identity | Property 존재만으로 tenant 권한을 부여하지 않음 |
| Listing | `DERIVED_TENANT_BOUND` | canonical Intake / Source chain | chain 부재·충돌 시 거부 |
| Contact | `DIRECT_TENANT_BOUND` | Contact record의 immutable tenant binding | Organization affiliation은 business metadata/reference일 뿐 authority가 아님 |
| Client / Requirement | `DIRECT_TENANT_BOUND_WITH_DERIVED_REQUIREMENT` | Client는 direct; Requirement는 canonical Client ownership에서 derive | Client chain 부재·충돌 시 거부 |
| Matching | `DERIVED_TENANT_BOUND` | Requirement / Candidate binding | input chain 부재·충돌 시 거부 |

## 3. Property boundary

Property는 `SYSTEM_BOUND` canonical master이다. tenant별 commercial/listing ownership은 Source, Intake, Listing 관계가 소유한다. Property master identity를 tenant별로 복제하지 않으며 Property 접근 가능성은 tenant authorization을 뜻하지 않는다.

## 4. Isolation invariants

- generic tenant inference: `0`.
- Team→Tenant equivalence: `0`.
- Organization→Tenant equivalence: `0`.
- conflicting derived tenant chain은 deterministic fail-closed이다.
- cross-tenant access/mutation 허용 경로: `0`.

Related: [Phase 1G-A Binding Matrix](REL001_PHASE1GA_TENANT_SCOPE_BINDING_MATRIX.md), [Phase 1G-B Binding Matrix](REL001_PHASE1GB_STORE_TENANT_BINDING_MATRIX.md), [Store Policy Mapping](REL001_PHASE1GC_STORE_POLICY_MAPPING.md).
