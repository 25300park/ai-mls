# REL-002 R3-C0 Binding Authority Matrix — AO Wave 3

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-382 |
| 문서 버전 | v1.0 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / Identity Owner / Administration Owner |
| 기준 Main | `eb95240143ce07beaea8004709443a466ac5b2ac` |

[Contract](REL002_R3C0_WORKLOAD_BINDING_CONTRACT.md), [Evidence/reference format](REL002_R3C0_BINDING_EVIDENCE_MATRIX.md), [Lookup](REL002_R3C0_STARTUP_LOOKUP_CONTRACT.md), [Report](../reviews/REL002_R3C0_CANONICALIZATION_REPORT.md).

## 1. Approved source/owner map

| Binding | Owning domain / source / exact key | Version/status / eligibility | Durable proof/restart property |
|---|---|---|---|
| Principal | Identity; existing PostgreSqlRegisteredServiceWorkloadStore.findByRegistrationId / AsyncRegisteredServiceWorkloadAuthorityLease; registrationId lookup then pinned registrationVersion exact equality | registrationVersion/status; ACTIVE + SERVICE/WORKLOAD/PRODUCTION and exact tenantId/principalId/purpose/audience + DEC-169 validation | existing app_identity registered durable record and canonical injected evidence boundary; no new Identity authority |
| Organization | Organization Data Steward; new approved OrganizationGovernanceRecord logical version/current-eligibility read contract, not implemented adapter; organizationId + organizationVersion reference | organizationVersion/status; exact organization/tenant/pinned version, unique current eligible ACTIVE | record/version is proof; approved future owner persistence must be durable/restart-queryable; not yet implemented |
| Project | Administration; new approved ProjectGovernanceRecord logical version/current read; projectId + projectVersion reference | projectVersion/status; current ACTIVE and exact organization/tenant/containedScopes | record/version proof; new future durable source; containedScopes proves relation only |
| Binding | Identity; new WorkloadStartupBindingRecord; exact ACTIVE selection by registrationId/version, selected bindingId/version | own bindingVersion/status; ACTIVE unique/current with exact workload/principal/tenant and domain/evidence checks | immutable row itself is proof, future durable version/status store; no proof/selection entity |
| Permission | existing RoleAssignment/AuthorizationService/LiveAssignmentResolver | current version/status/effective scope/policy | live execution authority; startup proof is not a grant |

## 2. Exact supported scope dispatch — only four types

Existing interface는 modules/administration/src/administration-async-persistence.ts, record/key/evidence fields는 administration-persistence.ts, actual adapter는 administration-postgresql-persistence.ts의 PostgreSqlAdministrationUnitOfWork다. Existing app_administration.administration_resources의 durable record를 validated rehydration하여 읽는다. 각 find는 실제 interface/property이며 새로 발명한 port가 아니다.

| scopeType | Owner / exact interface / adapter property | Lookup key | Returned exact fields / version / lifecycle | Eligibility predicate | Durable evidence/reference |
|---|---|---|---|---|---|
| TEAM | Administration; AsyncTeamScopeReadRepository.find; PostgreSqlAdministrationUnitOfWork.teamScopes | {tenantId,resourceType:TEAM_SCOPE,resourceId:scopeId} | recordType TEAM_SCOPE; teamId===scopeId; tenantId; version; status PROPOSED/ACTIVE/REVOKED; organizationId | one exact record; ACTIVE; binding tenant/team/org match; Project contains exact TEAM tuple; independent record evidence validation | durable current TeamScopePersistenceRecord; typed evidenceReferences {type,id,version}; canonical administration-scope record/version ref |
| POLICY | Administration; AsyncPolicyReadRepository.find; .policies | {tenantId,resourceType:POLICY,resourceId:scopeId} | recordType POLICY; policyId===scopeId; tenantId; version; status PROPOSED/ACTIVE/REJECTED/REVOKED | one exact record; ACTIVE; exact tenant/id/version; Project contains POLICY tuple; no assumption that policy alone grants permission | durable current PolicyPersistenceRecord + evidenceReferences; record/version ref |
| SOURCE | Administration source-governance authority; AsyncSourceGovernanceReadRepository.find; .sourceGovernance | {tenantId,resourceType:SOURCE_REGISTRY,resourceId:scopeId} | recordType SOURCE_REGISTRY; sourceRegistryEntryId===scopeId; tenantId; version; status DRAFT/UNDER_REVIEW/ACTIVE/PAUSED/BLOCKED/RETIRED | one exact source-governance record; ACTIVE; exact tenant/id/version; Project contains SOURCE tuple; does not authorize provider invocation or replace downstream source checks | durable current SourceGovernancePersistenceRecord + evidenceReferences; record/version ref |
| TARGET | Administration publication-target governance; AsyncPublicationTargetReadRepository.find; .publicationTargets | {tenantId,resourceType:PUBLICATION_TARGET,resourceId:scopeId} | recordType PUBLICATION_TARGET; publicationTargetId===scopeId; tenantId; version; status PROPOSED/ACTIVE/PAUSED/RETIRED | one exact target-governance record; ACTIVE; exact tenant/id/version; Project contains TARGET tuple; channel/provider execution still uses its existing live contracts | durable current PublicationTargetGovernancePersistenceRecord + evidenceReferences; record/version ref |

네 type 모두 binding scopeType/scopeId 및 decoded ref의 type/resourceType/tenant/id/version이 exact match해야 한다. Valid record schema/evidenceReferences/current owner eligibility를 요구하며 first-match/listByScope/tenant-only/wildcard fallback은 없다. Governing scope metadata는 existing owner 계약으로 검증하고 Project identity로 재해석하지 않는다. TEAM organization reference는 independently read Organization과 비교하며 Organization을 도출하지 않는다.

TENANT/ORGANIZATION/generic RESOURCE/unknown type은 startup dispatch NOT_SUPPORTED이며 fail-closed다. OrganizationGovernanceRecord가 organization binding을 증명해도 ORGANIZATION scope 지원을 자동 추가하지 않는다. Generic Scope/PROJECT scope type도 없다. 추가 type 지원은 별도 exact owner source 결정이 필요하다.

## 3. Evidence and implementation classification

Wave 3 evidence는 owner record + canonical record/version ref + current eligibility + 별도 audit lineage다. Scope ref는 current durable owner version을 exact 조회하며 stale/unavailable historic version은 deny한다. 신규 Organization/Project/Binding은 approved logical entity이며 기존 table/adapter/Production data라고 주장하지 않는다. 실제 persistence/read 구현은 별도 승인 대기다. Unresolved authority decisions 0; 최종 문서 closeout은 승인되었으며 별도 runtime/schema/migration 승인 전 구현은 금지한다.
