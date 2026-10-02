# R3-C2A Canonicalization Report

Document ID: DOC-REVIEW-265 / 버전: v0.1 / 상태: DRAFT / 소유: Architecture Owner

## 1. Objective

기존 durable source를 우선 inventory하여 세 evidence read 계약을 canonicalize할 수 있는지 판정했다. 결과는 BLOCKED다.

## 2. Documents read

R3-C2A human brief, DEC-169, DOC-DEV-295 Identity Evidence Authority Design, R3-C0 evidence/authority matrix, 기존 Identity/Audit source contracts.

## 3. Files created

[Read contract](../implementation/REL002_R3C2A_DURABLE_EVIDENCE_READ_CONTRACT.md), [Identity matrix](../implementation/REL002_R3C2A_IDENTITY_EVIDENCE_SOURCE_MATRIX.md), [Audit matrix](../implementation/REL002_R3C2A_AUDIT_EVIDENCE_SOURCE_MATRIX.md), [Binding profile](../implementation/REL002_R3C2A_BINDING_AUDIT_PROFILE.md), 이 report. Draft IDs는 검토용이며 Master Index 등록/승인은 아직 수행하지 않았다.

## 4. Files modified

없음. Primary checkout 및 기존 dirty 작업에 접근하여 변경하지 않았다.

## 5. Key decisions added

새 승인 결정 없음. Existing equality/fail-closed 조건만 재사용했다. 신규 physical source/key/event를 승인 없이 발명하지 않았다.

## 6. Open decisions

OD-C2A-1 independent Identity proof durable source/lookup/issuance lineage. OD-C2A-2 registration final-event PostgreSQL source/decoder/vocabulary. OD-C2A-3 binding lifecycle final-event profile/atomic replacement lineage. UNRESOLVED_DECISIONS=3.

## 7. Inconsistencies found

Production readiness에 필요한 독립 proof 및 audit PostgreSQL read 구현 부재. Existing materializer allowlist에 Identity/Binding mapping이 없다. Storage/materialization 확장 없이 exact read 계약을 완료할 수 없다.

## 8. Validation performed

Source/interface/SQL inventory를 대조했다. 테스트 fixture는 구현으로 분류하지 않았다. Runtime/schema/ACL/migration/test 파일 변경 없음. 새 docs의 local links 및 whitespace를 검증 대상으로 한정한다.

## 9. Known limitations

Identity/Audit sources, exact lookup/decoder/finality 및 event mapping은 NOT_CANONICALIZED다. POSTGRESQL_READ_IMPLEMENTATION_EXISTS=PARTIAL (registration/binding owner rows만 존재). NEW_SCHEMA_REQUIRED는 미결정 (existing schema reuse 가능); NEW_MIGRATION_REQUIRED는 기존 없는 PostgreSQL storage를 repository에서 추가할 경우 YES; NEW_EVENT_TYPE_REQUIRED는 미결정 (기존 generic event mapping 재사용 가능성에 AO 검토 필요). Yes/No를 승인 근거 없이 강제하지 않는다. R3C2_IMPLEMENTATION_READY=NO. Production deployability=BLOCKED. Listener/workers/R3-D NOT_STARTED. Commit NOT_CREATED, Push NOT_PERFORMED, Production/Railway/Supabase mutation 0/0/0.

## 10. Next brief prerequisites

AO가 OD-C2A-1/2/3과 신규 table/migration/materialization/event mapping 필요 범위를 승인해야 한다. 그 전 runtime 구현은 중단한다. 기존 approved migration이나 API-016 authority를 재해석하지 않는다.

FINAL_RECOMMENDATION=BLOCK_REL002_R3C2A_DURABLE_EVIDENCE_READ_CANONICALIZATION.

## AO decision update — 2026-10-02

이 절은 위 초기 source inventory의 OPEN DECISION 상태를 최신 Human/AO 결정으로 갱신한다. 기존 구현 부재에 대한 inventory 사실은 유지한다. `CANONICALIZATION_DIRECTION_APPROVED`; 구현은 별도 bounded R3-C2B 승인이 필요하다.

- Identity source: `app_identity.IdentityWorkloadEvidenceRecord`, owner Identity, exact key `identityEvidenceRef`. Independent immutable evidence이며 mutable RegisteredServiceWorkload에서 재구성하지 않는다. Decoder는 `schemaVersion=1`, `immutable=true`, exact registrationId/registrationVersion/tenantId/principalId/ref를 검증한다. Missing/duplicate/unsupported version/mismatch는 fail closed.
- Registration audit source: `app_audit.AuditEvidenceReadRecord`, owner Audit, exact key `auditEvidenceRef`. `final=true` 및 expected source/registration identity/registrationId/version/tenant/principal의 DEC-169 equality를 검증한다. API-016은 Audit/History boundary이며 Identity authority가 아니다.
- Binding audit source/key: 동일 Audit read projection / `auditEvidenceRef`. Exact bindingId/bindingVersion/registrationId/registrationVersion/tenantId/principalId를 요구한다. Envelope는 `final=true`, `sourceDomain=IDENTITY`, `aggregateType=WORKLOAD_STARTUP_BINDING`, `aggregateId=bindingId`, `aggregateVersion=bindingVersion`. ACTIVE는 final activation event, REVOKED는 final revocation event, PROPOSED는 startup 불가. Registration event로 대체하지 않는다.
- Audit projection conceptual fields: auditEvidenceRef/sourceDomain/aggregateType/aggregateId/aggregateVersion/eventType/payloadSchemaVersion/final/tenantId/scopeRef/payload/occurredAt/materializedAt. Unsupported payloadSchemaVersion/malformed payload/duplicate ref는 fail closed. Physical table 이름이나 아직 승인되지 않은 event strings는 이 절에서 발명하지 않는다.
- Approved materialization direction: canonical Audit event/intention → durable PostgreSQL projection. Append-only/deterministic/idempotent; conflicting same-ref payload와 final overwrite 거부; restart-safe independent query; secret payload 및 Production SQLite dependency 금지. New business authority나 cross-domain write ownership을 만들지 않는다.

OD-C2A-1/2의 storage direction은 해소됐다. OD-C2A-3의 owner/envelope/equality는 해소됐지만 required activation/revocation canonical event type existence check는 남는다. Exact physical decoder/payload details는 bounded R3-C2B design에서 approved direction 안에 명시해야 하며 완료된 실행 계약으로 주장하지 않는다.

## Event inventory / implementation stop

`modules/audit/src/enriched-audit-intent-contract.ts`의 approved source/event/action allowlist는 SOURCE_REGISTRY/INTAKE/PROPERTY/LISTING/CONTACT/MATCHING/API-017이며 IDENTITY binding activation/revocation mapping이 없다. `modules/identity/src/workload-startup-binding-postgresql.ts`에는 lifecycle row mutation만 있고 canonical audit event emitter/type/action이 없다. Generic STATE_CHANGED category나 자유 string 필드만으로 exact binding event를 canonicalize하지 않는다.

NEW_EVENT_TYPE_REQUIRED=YES. 별도 AO event-type/action/profile 승인 전 implementation STOP. Event strings를 구현에서 발명하지 않았다. AO가 activation/revocation 및 registration final-event vocabulary/mapping과 replacement lineage를 확정해야 한다. Existing replaceActive가 양쪽 version row에 같은 audit ref를 사용하는데 approved envelope는 단일 aggregateVersion이다. 이를 임의로 완화하거나 같은 event를 두 exact versions의 proof로 간주하지 않는다. Replacement event/ref linkage는 별도 명시적 결정이 필요하다.

POSTGRESQL_READ_IMPLEMENTATION_EXISTS=NO (이 evidence read 계약 기준).
NEW_SCHEMA_REQUIRED=YES (app_audit).
NEW_MIGRATION_REQUIRED=YES.
UNRESOLVED_DECISIONS=2 (event vocabulary/profile, atomic replacement audit ref/version linkage).
R3C2_IMPLEMENTATION_READY=NO.
FINAL_RECOMMENDATION=BLOCK_REL002_R3C2A_DURABLE_EVIDENCE_READ_CANONICALIZATION (direction 승인; final event canonicalization 미완료).

Runtime/schema/migration/ACL implementation 및 Production 실행은 수행하지 않았다. Commit NOT_CREATED; Push NOT_PERFORMED; listener/workers/R3-D NOT_STARTED; Production deployability BLOCKED; Production/Railway/Supabase mutation 0/0/0.

## FINAL canonical event contract — Human/AO approval

이 절이 이전 OPEN DECISION 및 BLOCK disposition을 대체한다. 이전 inventory는 historical evidence이며 현재 미결정으로 해석하지 않는다.

Activation eventType: `WORKLOAD_STARTUP_BINDING.ACTIVATED`. Identity owner; envelope `sourceDomain=IDENTITY`, `aggregateType=WORKLOAD_STARTUP_BINDING`, `aggregateId=bindingId`, `aggregateVersion=bindingVersion`, `final=true`. Required payload: bindingId, bindingVersion, registrationId, registrationVersion, tenantId, principalId, organizationId, projectId, scopeType, scopeId, status=ACTIVE. 모든 값은 canonical binding과 exact match해야 한다.

Revocation eventType: `WORKLOAD_STARTUP_BINDING.REVOKED`. 동일 Identity envelope에 revoked binding의 ID/version을 사용한다. Required payload: bindingId, bindingVersion, registrationId, registrationVersion, tenantId, principalId, status=REVOKED. Replacement에만 optional replacementBindingId/replacementBindingVersion을 허용하며 revoked aggregate identity는 바뀌지 않는다.

Replacement는 TWO_DISTINCT_FINAL_EVIDENCE_RECORDS다. Old auditEvidenceRef는 old version의 REVOKED event, new auditEvidenceRef는 new version의 ACTIVATED event를 가리킨다. 두 ref는 달라야 하고 각각 exactly one final app_audit.AuditEvidenceReadRecord에 해소되어야 한다. 각 projection row는 한 eventType/aggregateId/aggregateVersion만 나타낸다. correlationId 또는 replacementOperationId를 공유해 연결할 수 있지만 ref/aggregate identity는 공유하지 않는다.

Bounded Identity-owned transaction 안에서 current ACTIVE 검증, replacement version 검증/생성, old revoke, new activate, old revocation evidence 및 new activation evidence mapping을 결속하고 atomically commit해야 한다. Partial lifecycle, only-one evidence mapping, shared audit ref는 허용하지 않는다. Exact replay는 IDEMPOTENT/NO-OP; conflicting replay와 모든 tuple/payload/finality mismatch는 FAIL-CLOSED다. Audit 소유 projection materialization과 Identity-owned atomic transaction의 구현 경계는 R3-C2B에서 이 승인 계약을 보존하며 구현해야 한다. Cross-domain write ownership을 Identity로 이전하는 승인으로 해석하지 않는다.

IDENTITY_EVIDENCE_SOURCE=app_identity.IdentityWorkloadEvidenceRecord.
IDENTITY_LOOKUP_KEY=identityEvidenceRef.
REGISTRATION_AUDIT_SOURCE=app_audit.AuditEvidenceReadRecord.
REGISTRATION_AUDIT_LOOKUP=auditEvidenceRef.
BINDING_AUDIT_SOURCE=app_audit.AuditEvidenceReadRecord.
BINDING_AUDIT_LOOKUP=auditEvidenceRef.
BINDING_ACTIVATION_EVENT=WORKLOAD_STARTUP_BINDING.ACTIVATED.
BINDING_REVOCATION_EVENT=WORKLOAD_STARTUP_BINDING.REVOKED.
REPLACEMENT_AUDIT_LINKAGE=TWO_DISTINCT_FINAL_EVIDENCE_RECORDS.
NEW_EVENT_TYPE_REQUIRED=YES — APPROVED.
UNRESOLVED_DECISIONS=0.
R3C2_IMPLEMENTATION_READY=NO (R3-C2B persistence/materialization/read implementation prerequisite).
FINAL_RECOMMENDATION=APPROVE_REL002_R3C2A_DURABLE_EVIDENCE_READ_CANONICALIZATION.

다음 phase는 R3-C2B이며 이번 문서 갱신에서 시작하지 않는다. R3-C2 runtime resolver도 재개하지 않는다.Runtime/schema/migration/ACL変更なし。Commit NOT_CREATED; Push NOT_PERFORMED; Production deployability BLOCKED; Production/Railway/Supabase mutation 0/0/0.
