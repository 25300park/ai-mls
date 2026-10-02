# REL-002 R3-C0 Workload Binding Contract — AO Wave 3 Final Revision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-381 |
| 문서 버전 | v1.0 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / Identity Owner / Administration Owner |
| 기준 Main | `eb95240143ce07beaea8004709443a466ac5b2ac` |
| Disposition | FINAL_CANONICALIZATION_DECISIONS_GRANTED; final document closeout APPROVED |

[Authority/source map](REL002_R3C0_BINDING_AUTHORITY_MATRIX.md), [Evidence profile](REL002_R3C0_BINDING_EVIDENCE_MATRIX.md), [Lookup/selection](REL002_R3C0_STARTUP_LOOKUP_CONTRACT.md), [Report](../reviews/REL002_R3C0_CANONICALIZATION_REPORT.md).

## 1. Approved authority and implementation boundary

AO Waves 1–3은 Administration-owned ProjectGovernanceRecord, Identity-owned WorkloadStartupBindingRecord, Organization Data Steward-owned OrganizationGovernanceRecord, typed durable scope owner dispatch 및 current selection Model A를 승인했다. Generic Scope/Evidence authority, 별도 persisted binding proof/current-selection entity를 추가하지 않는다.

Identity RegisteredServiceWorkload + DEC-169는 service-principal authority다. 기존 WorkloadAuthorizationSubject/AuthorizationService/RoleAssignment를 유지하며 startup identity/containment는 live execution permission을 대신하지 않는다. API-016은 audit/history linkage이며 Identity/binding authority가 아니다. DEC-139의 tenant/organization/team 구분, DEC-105/106/107과 WF-010/011/012를 유지한다. Tenant/Team/Railway IDs, 이름/metadata로 domain binding을 추론하지 않는다.

UNRESOLVED_DECISIONS=0; IMPLEMENTATION_READY=YES는 승인된 canonical design의 준비 상태다. Human/AO 최종 closeout 승인으로 DEC-199=APPROVED, CR-033=APPROVED_FOR_IMPLEMENTATION이다. 이번 범위는 문서 closeout만이며 Runtime/schema/migration/ACL 구현은 NOT_STARTED다. 별도 구현 지시 없이 다음 단계를 시작하지 않는다.

## 2. OrganizationGovernanceRecord — Organization Data Steward

| Partition | Exact fields | Semantics |
|---|---|---|
| Frozen per organizationVersion | organizationId, organizationVersion, tenantId, evidenceReferences, createdAt | stable organization identity, own positive safe-integer version, explicit existing isolation dimension, canonical governance evidence refs, original ISO version creation time |
| Mutable governance state | status, updatedAt | owner-controlled audited lifecycle, ISO state-change chronology |

Lifecycle은 PROPOSED/ACTIVE/SUSPENDED/RETIRED, RETIRED terminal이다. 경로는 PROPOSED→ACTIVE/RETIRED, ACTIVE↔SUSPENDED, ACTIVE/SUSPENDED→RETIRED다. Tenant/evidence identity 변경은 새 organizationVersion을 요구하며 frozen payload는 수정하지 않는다. OrganizationId당 current eligible version은 유일해야 한다. Conflicting version/retired authority는 fail-closed이며 future owner store는 current eligibility와 exact version target을 독립적으로 조회해야 한다.

Canonical logical source/key는 organizationId + pinned organizationVersion의 OrganizationGovernanceRecord다. Current owner eligibility에서 exact tenantId/version/status ACTIVE를 검증한다. Versioned row가 proof다. Missing/duplicate/mismatch/PROPOSED/SUSPENDED/RETIRED는 deny한다. 실제 repository는 아직 없으며 approved new source contract를 후속 단계에서 구현한다. 현재 Production source가 구현되었다는 뜻은 아니다.

## 3. ProjectGovernanceRecord — Administration

| Partition | Exact fields | Semantics |
|---|---|---|
| Frozen per projectVersion | projectId, projectVersion, organizationId, tenantId, containedScopes, evidenceReferences, createdAt | own identity/version, explicit organization/tenant membership, bounded unique set of {scopeType,scopeId}, canonical governance evidence refs, original version creation instant |
| Mutable governance state | status, updatedAt | current owner lifecycle and audited change chronology |

Project lifecycle은 PROPOSED/ACTIVE/SUSPENDED/RETIRED, RETIRED terminal이며 최소 경로는 Organization과 같다. Organization/tenant/containedScopes/evidence 변경은 새 projectVersion을 요구한다. ProjectId당 current eligible version은 유일해야 하고 unavailable/conflicting selection은 deny한다. Pinned exact version과 current ACTIVE/org/tenant/containment를 검증하며 historical proof로 retired/ineligible authority를 복원하지 않는다.

containedScopes는 containment만 표현한다. Scope 존재/current eligibility는 respective owner가 증명하며 Project는 scope를 만들거나 permission을 부여하지 않는다. 기존 enum은 유지하되 startup은 source map의 TEAM/POLICY/SOURCE/TARGET만 지원한다. 나머지 type은 deny한다. Project store는 approved logical design이며 구현된 adapter/table이 아니다.

## 4. WorkloadStartupBindingRecord — Identity

| Partition | Exact stored fields | Semantics |
|---|---|---|
| Frozen per bindingVersion | bindingId, bindingVersion, registrationId, registrationVersion, tenantId, principalId, organizationId, projectId, scopeType, scopeId, identityEvidenceRef, organizationEvidenceRef, projectEvidenceRef, scopeEvidenceRef | independent stable binding lineage/version; exact pinned workload tuple; exact principal/tenant/domain tuple; owner record/version references |
| Mutable governance state | status, auditEvidenceRef, updatedAt | lifecycle/current-selection status, final binding lifecycle audit/history lineage only, audited state-change instant |
| Write-once governance chronology | createdAt | original creation instant of this bindingVersion; never mutated after creation |

Stored bindingEvidenceRef를 제거한다. Canonical proof는 (bindingId,bindingVersion)와 row의 frozen payload다. Derived locator workload-startup-binding:{encodedBindingId}:{bindingVersion}는 독립 authority/persisted proof field/duplicate table이 아니다. Encoding/version 규칙은 Evidence Matrix에서 정의한다.

Binding lifecycle은 PROPOSED/ACTIVE/REVOKED; PROPOSED→ACTIVE/REVOKED, ACTIVE→REVOKED, REVOKED terminal이다. Replacement는 새 bindingVersion을 만들며 frozen payload를 수정하지 않는다. Containment-only 변경으로 registrationVersion을 만들지 않는다. Registered workload 변경은 기존 canonical version semantics를 따른다. ACTIVE binding의 registrationId/version/principalId/tenantId는 exact match해야 하며 SERVICE/WORKLOAD/PRODUCTION/purpose/audience는 기존 registration에서 검증한다.

Binding.auditEvidenceRef는 binding lifecycle lineage metadata이며 frozen proof에서 제외한다. RegisteredWorkload.auditEvidenceRef는 기존 DEC-169 registration final linkage 검증을 유지한다. 두 record/role을 혼용하지 않는다. Required lifecycle ref는 durable/restart-queryable해야 하며 metadata 변경은 새 audited lineage를 연결하고 이전 event는 덮어쓰지 않는다.

## 5. Evidence profile — owner record/version plus current eligibility

Organization/Project/Scope proof는 canonical record/version reference로 exact 조회한 authoritative durable owner record와 current eligibility다. Binding proof는 immutable row 자체다. Parallel issuer/authority/store는 필요 없다. EvidenceReferences는 기존 typed {type,id,version}이며 API-016은 history linkage만 제공한다. 기존 Identity proof payload와 DEC-169 검증은 변경하지 않는다.

모든 ref는 exact record/version을 가리키며 durable/restart-queryable해야 한다. Ref 문자열만으로 proof를 인정하지 않는다. 기존 Administration reader는 current validated version을 반환하므로 old pinned version이 조회되지 않거나 eligibility를 잃으면 fail-closed다. Existing historical snapshots를 가정하지 않는다. 신규 Organization/Project/Binding source는 immutable versions와 authoritative current lifecycle을 보존해야 하며 old payload만으로 startup을 허용하지 않는다.

Organization/project/scope mismatch, wrong version/tenant, unverifiable record/ref, missing audit lineage, ineligible lifecycle은 deny한다. Independent reads를 cross-domain atomic snapshot/write transaction으로 표현하지 않는다. Stable current selection/eligibility를 증명할 수 없으면 fail-closed다.

## 6. Selection Model A, concurrency and replay

Config는 registrationId + registrationVersion을 pin한다. Exact tuple의 ACTIVE candidates를 proof filtering 전에 세어 정확히 1개인지 확인한다. Invalid evidence를 이유로 다른 ACTIVE conflict를 숨기지 않는다. Zero/multiple/REVOKED/PROPOSED/stale selection/registration-principal-tenant mismatch는 deny한다. Latest/default/name/Railway fallback이나 pointer record는 없다. 추가 mandatory binding config pin을 도입하지 않고 selected bindingId/version을 capture해 gate PASS 전 unchanged current selection을 재검증한다.

Identity-owned serialized transaction + expected version/state CAS + storage uniqueness로 old ACTIVE→REVOKED/new version→ACTIVE를 atomic publish한다. Unique bindingId/version 및 registration tuple/bindingId당 최대 ACTIVE 1개를 보장한다. Competing activation은 stable registration/lineage key 또는 approved equivalent로 serialize하며 global lock을 추가하지 않는다. Exact version/frozen payload/transition replay는 NO-OP; conflict는 기존 payload/state를 보존하고 deny한다. Required evidence/current eligibility 검증 없는 partial ACTIVE는 금지하며 cross-domain write authority는 추가하지 않는다.

Current state는 durable하므로 재시작 후 records에서 selection을 도출한다. Startup 중 captured binding/current owner versions가 incompatible하게 변경되면 fail-closed하며 latest-version retry를 하지 않는다. 구체 constraint/lock SQL/table/JSON/FK/migration은 후속 별도 승인 범위다.

## 7. Final result / stop

Approved new entities는 OrganizationGovernanceRecord, ProjectGovernanceRecord, WorkloadStartupBindingRecord 세 개다. Supported scopes는 TEAM/POLICY/SOURCE/TARGET이며 나머지는 STARTUP_FAIL_CLOSED다. Wave 3으로 authority 결정은 모두 닫혔다. 아직 없는 physical backing은 후속 구현 작업이며 unresolved authority ambiguity가 아니다.

UNRESOLVED_DECISIONS=0; SCHEMA_CHANGE_REQUIRED=YES; MIGRATION_REQUIRED=YES; IMPLEMENTATION_READY=YES(design ready only). Final recommendation APPROVE_REL002_R3C0_FINAL_CANONICALIZATION. 최종 closeout 승인으로 DEC-199 APPROVED / CR-033 APPROVED_FOR_IMPLEMENTATION을 확정했다. Actual Production NOT_VERIFIED, deployability BLOCKED, listener/workers NOT_STARTED, mutation 0/0/0, commit NOT_CREATED, push NOT_PERFORMED. Runtime/source/schema/migration/ACL/roles/dependencies는 변경하지 않았다.
