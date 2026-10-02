# REL-002 R3-C0 Binding Evidence Matrix — AO Wave 3

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-383 |
| 문서 버전 | v1.0 |
| 상태 | APPROVED |
| 소유 역할 | Identity Owner / Audit Owner / Architecture Owner |
| 기준 Main | `eb95240143ce07beaea8004709443a466ac5b2ac` |

[Contract](REL002_R3C0_WORKLOAD_BINDING_CONTRACT.md), [Authority/source map](REL002_R3C0_BINDING_AUTHORITY_MATRIX.md), [Lookup](REL002_R3C0_STARTUP_LOOKUP_CONTRACT.md), [Report](../reviews/REL002_R3C0_CANONICALIZATION_REPORT.md).

## 1. Approved evidence model

Wave 3의 증명은 authoritative durable versioned owner record + canonical record/version reference + 현재 lifecycle eligibility + 별도 audit lineage이다. 새 통합 Evidence authority나 persisted binding proof를 만들지 않는다. 문자열 reference만으로 READY를 판정하지 않는다. Reference가 가리키는 exact owner record를 조회하고 tuple/version/frozen payload/current status를 검증해야 한다.

| Reference | Authoritative source / role | Exact record/version reference and validation |
|---|---|---|
| identityEvidenceRef | Identity RegisteredServiceWorkload + existing DEC-169 immutable workload proof validation | existing Identity proof ref/profile 유지; registrationId/version/tenantId/principalId/schemaVersion/immutable exact equality; registration's existing final audit validation도 유지 |
| organizationEvidenceRef | Organization Data Steward OrganizationGovernanceRecord | organization-governance:{id}:{version}; exact organizationId/organizationVersion/tenantId, frozen payload 및 current ACTIVE eligibility |
| projectEvidenceRef | Administration ProjectGovernanceRecord | project-governance:{id}:{version}; exact projectId/projectVersion/org/tenant/containedScopes, frozen payload 및 current ACTIVE eligibility |
| scopeEvidenceRef | typed canonical Administration owner record, supported dispatch only | administration-scope:{tenant}:{resourceType}:{id}:{version}; exact typed tenant/resource/id/version, validated current record and ACTIVE eligibility; typed evidenceReferences 유지 |
| binding proof | Identity WorkloadStartupBindingRecord 자체 | (bindingId,bindingVersion) + row의 frozen payload exact equality; derived workload-startup-binding:{id}:{version}는 non-authoritative locator일 뿐 |
| binding.auditEvidenceRef | API-016 binding lifecycle audit/history lineage only | final append-only event가 exact bindingId/version 및 governed lifecycle transition을 가리킴; mutable metadata ref; owner identity/containment proof 아님 |
| registeredWorkload.auditEvidenceRef | existing DEC-169 registration final audit linkage | 기존 ReadOnlyAuditEvidenceQueryPort profile/tuple/final 검증 유지; binding lifecycle audit ref로 대체하지 않음 |

## 2. Canonical reference encoding and exact lookup

위 {id}/{tenant}는 각각 owner identifier의 canonical percent-encoded segment이며 URI-component encoding round-trip이 exact 일치해야 한다. Version은 positive safe integer의 decimal 표현이며 leading zero/default/latest가 없다. Binding derived ref의 논리 형태는 AO의 workload-startup-binding:{bindingId}:{bindingVersion}와 동일하고 escaping만 명시한다. 파싱 실패/다른 prefix/잘못된 type/wildcard/참조 ID와 binding 값 불일치는 fail-closed다. Ref parser는 routing/locator일 뿐 새 authority가 아니다.

Supported scopeType→resourceType mapping은 TEAM→TEAM_SCOPE, POLICY→POLICY, SOURCE→SOURCE_REGISTRY, TARGET→PUBLICATION_TARGET이다. Decoded tenant/id/version 및 binding scopeType/scopeId는 owner read key와 exact match해야 한다. Reference를 generic RESOURCE/다른 scope로 변환하지 않는다.

Organization/Project future owner source는 exact immutable version payload와 authoritative current eligible state를 durable하게 보존해야 한다. Existing scope readers는 current record/version을 반환한다. Pinned old version이 조회되지 않거나 current version과 다르면 deny하며 immutable snapshot 저장/새 history adapter가 존재한다고 주장하지 않는다. Record.evidenceReferences는 existing typed {type,id,version}이며 새 proof authority 저장이 아니다. Scope owner의 존재/eligibility는 Project containedScopes에서 얻지 않는다.

## 3. ACTIVE and restart prerequisites

Identity proof, Organization/Project/Scope owner records, immutable binding row, 모든 required reference 및 separate audit lineage가 independently durable/restart-queryable해야 한다. Unique current ACTIVE binding, current workload/domain lifecycle eligibility와 live authorization도 필요하다. 어떤 source/ref라도 missing/duplicate/mismatched/stale/unavailable/non-final/invalid이면 activation/startup은 fail-closed다. 기존 DEC-169 Identity/evidence contract를 간소화하거나 API-016을 Identity authority로 승격하지 않는다.

BindingEvidenceRef는 stored field에서 제거했다. Binding proof를 다른 store/issuer에서 재발급하지 않는다. Derived locator는 동일 immutable row를 가리키며 payload hash나 순환 self-proof를 생성하지 않는다. Frozen owner refs 변경은 새 bindingVersion을 요구한다. Binding lifecycle audit metadata 변경은 새 immutable final audit event를 연결하며 기존 audit event를 수정하지 않는다.

## 4. Publication, lineage and implementation boundary

Identity-owned activation/replacement transaction은 required owner refs/evidence가 durable하고 검증된 뒤에만 ACTIVE를 publish한다. Old ACTIVE→REVOKED/new version→ACTIVE atomic publication, expected version/state CAS, uniqueness, exact replay NO-OP/conflict fail-closed를 사용한다. Owner records의 독립 검증을 cross-domain atomic snapshot/write transaction으로 표현하지 않는다. 검증 중 current selection/eligibility가 불안정하면 deny한다.

Organization/Project/Binding durable backing은 approved logical implementation requirement이며 현재 구현 존재나 Production READY 증거가 아니다. Existing audit constructor의 SQLite WAL/DDL을 Production pre-gate에 사용하지 않는다. API-016 lifecycle lineage는 기존 canonical audit vocabulary/read contract만 사용하고 owning port에서 tuple/version/final validation을 수행해야 한다; 새 vocabulary가 필요해지면 별도 승인을 요청한다. 새 evidence 권한/parallel table 없이 source 자체로 증명하는 Wave 3 계약으로 이전 source/proof authority 결정을 닫았다. Runtime/schema/migration 구현은 여전히 미승인이다.
