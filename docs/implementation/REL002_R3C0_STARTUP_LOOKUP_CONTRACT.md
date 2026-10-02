# REL-002 R3-C0 Startup Lookup Contract — AO Wave 3

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-384 |
| 문서 버전 | v1.0 |
| 상태 | APPROVED |
| 소유 역할 | Identity Owner / Architecture Owner |
| 기준 Main | `eb95240143ce07beaea8004709443a466ac5b2ac` |

[Contract](REL002_R3C0_WORKLOAD_BINDING_CONTRACT.md), [Authority/source map](REL002_R3C0_BINDING_AUTHORITY_MATRIX.md), [Evidence/ref format](REL002_R3C0_BINDING_EVIDENCE_MATRIX.md), [Report](../reviews/REL002_R3C0_CANONICALIZATION_REPORT.md).

## 1. Approved selection Model A

Startup config는 registrationId + registrationVersion을 pin한다. Existing registrationId read 후 exact version을 검사하고 같은 tuple의 ACTIVE binding candidates를 읽는다. Proof filtering 전에 정확히 1개여야 한다. Zero/multiple ACTIVE는 deny하며 불량 evidence로 다른 ACTIVE conflict를 숨기지 않는다. PROPOSED/REVOKED/registration-principal-tenant mismatch는 fail-closed다. Highest/latest/default/name/Railway fallback 및 separate current-selection record는 없다.

Resolver가 선택한 bindingId/bindingVersion과 frozen payload를 capture하고 gate PASS 전 같은 current ACTIVE selection과 exact equality를 재검증한다. Concurrent replacement로 captured version이 stale해지면 deny하며 최신 version을 자동 선택해 재시도하지 않는다. Config에 별도 mandatory binding version을 추가하지 않는다. Reviewed expected organization/project/scope와 owner refs는 independently queried owner records와 일치해야 하며 config 문자열 자체는 authority가 아니다.

## 2. Concurrency / idempotency / restart

Identity-owned serialized transaction + version/state CAS + storage uniqueness로 unique bindingId/version, at most one ACTIVE per registration tuple 및 per bindingId를 보장한다. Stable lineage/registration serialization 또는 approved equivalent를 사용한다. Replacement는 old ACTIVE revoke와 new version ACTIVE를 atomic commit한다. Required evidence/current eligibility 검증 없는 partial ACTIVE publication은 금지한다.

Exact version/payload/transition replay는 canonical NO-OP이고 conflicting replay는 fail-closed다. Immutable payload는 in-place 수정하지 않는다. Current selection은 durable lifecycle에서 재시작 후 다시 도출하며 cache/pointer/derived ref의 self-assertion을 믿지 않는다. Unstable current authority/read consistency는 deny한다. Cross-domain write ownership/global lock/new transaction abstraction을 추가하지 않는다. 구체 SQL/DDL/lock 구현은 후속 별도 승인 범위다.

## 3. Proposed implementation's canonical startup order

1. 기존 Production configuration/reference/required registrations 검증; provider=false, canonical PG/VERIFY_FULL/timeouts/applicationName; raw DATABASE_URL/SQLite/localhost/.env/dev-test fallback 거부.
2. Bootstrap-owned PG_PRODUCTION_POOL 1개를 기존 sealed connection/CA resolver로 생성한다. DEC-198 alias는 추가 pool/secret consumer를 만들지 않는다.
3. 기존 Identity schema/authority 및 exact pinned workload 검증: ACTIVE/SERVICE/WORKLOAD/PRODUCTION, exact principal/tenant/purpose/audience, DEC-169 Identity proof와 registration audit linkage.
4. Model A current ACTIVE binding selection; canonical registrationId/version/principalId/tenantId exact equality; immutable row 자체가 binding proof이며 bindingEvidenceRef stored field는 없다.
5. OrganizationGovernanceRecord exact organization/tenant/version/current ACTIVE, ProjectGovernanceRecord exact project/org/tenant/version/current ACTIVE/containedScopes, typed scope owner record/ref/version/current ACTIVE를 independently 검증한다. TEAM/POLICY/SOURCE/TARGET 외 type은 deny한다. Project는 containment만 증명한다.
6. 모든 required owner record/ref와 별도 binding lifecycle audit lineage가 durable/restart-queryable이고 현재 eligibility가 충족되어야 한다. Binding audit ref를 registration evidence로 대체하지 않는다.
7. Existing WorkloadAuthorizationSubject와 live RoleAssignment/AuthorizationService로 기존 승인된 action/resource/purpose 권한을 재검증한다. Deny/unknown mapping/unavailable은 fail-closed.
8. Stable captured binding selection/owner eligibility 재검증 후 explicit non-secret startup gate PASS. 이어 동일 pool의 R3-B8 aggregate schema gate를 통과해야 downstream composition이 eligible하다. NOT_READY는 normalized evidence 유지와 cleanup을 수행한다.
9. R3-C0/R3-C는 listener/workers를 실제 시작하지 않는다. R3-D activation은 별도 승인 대상이며 disposable READY는 실제 Production 검증이 아니다.

## 4. Failure / cleanup / final boundary

Missing/duplicate binding, stale binding/current selection, mismatched workload/version/principal/tenant/org/project/scope, invalid/unverifiable record/ref/audit lineage, inactive registration/project/org/scope, unsupported type 및 live denial은 fail-closed다. Checked-out client는 owner가 release하고 startup 실패 시 기존 reverse cleanup과 bootstrap pool exactly-once close를 유지한다. Secret values/refs/connection strings/raw CA/driver SQL/path/stack/provider material은 evidence/log에서 제외한다. Schema repair/migration/grant/seed/provider execution은 없다.

UNRESOLVED_DECISIONS=0. IMPLEMENTATION_READY=YES는 design-ready 의미다. 최종 문서 closeout은 승인되었다. 별도 runtime/schema/migration authorization 전 implementation NOT_AUTHORIZED. New entities는 OrganizationGovernanceRecord/ProjectGovernanceRecord/WorkloadStartupBindingRecord 세 개뿐이며 generic Scope/Evidence/selection entity는 없다. Final recommendation APPROVE_REL002_R3C0_FINAL_CANONICALIZATION.
