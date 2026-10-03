# REL-002 R3-C4A Required Secrets Inventory

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-397 |
| Version | v0.1 |
| Status | DRAFT |
| Owner | Architecture Owner / Security Owner |
| Baseline | 8741a060198897cba1edd01f07c8620f7b13dd80 |

## 범위와 결론

격리 worktree의 현재 Production composition만 조사했다. 실제 secret 값, 환경 변수 내용, Railway 또는 Production 상태는 조회하지 않았다. [Consumer matrix](REL002_R3C4A_SECRET_CONSUMER_MATRIX.md), [Reference contract](REL002_R3C4A_SECRET_REFERENCE_CONTRACT.md), [Completion](../reviews/REL002_R3C4A_COMPLETION.md)을 함께 적용한다.

현재 composition에서 **R3-C4가 추가로 resolve할 필수 secret은 0개**다. 이는 현재 관찰된 consumer 집합이며 모든 미래 worker/feature가 secret 없이 실행된다는 계약은 아니다. DB connection bundle과 CA certificate 입력 2개는 별도 EARLIER_BOOTSTRAP 범위다. CA certificate는 password가 아닌 보호된 trust material이다.

| 집계 | 현재 R3-C4 추가 입력 수 |
|---|---:|
| REQUIRED_SECRET_COUNT | 0 |
| PRE_LISTENER_SECRET_COUNT | 0 |
| PRE_WORKER_SECRET_COUNT | 0 |
| LAZY_FEATURE_SECRET_COUNT | 0 |

이 집계는 이미 처리되는 DB 입력 2개와 구성되지 않은 미래 credential을 제외한다. 알려진 Staging Advisory credentialRef 계약은 deferred candidate이며 활성 Production instance가 아니다.

**AO 결정 R3C4A-OD-001 — RESOLVED:** 명시적 immutable RequiredSecretsManifestV1 { schemaVersion: 1, entries: [] }와 bounded gate 성공 의미가 승인되었다. manifest 부재는 empty manifest와 다르다. UNRESOLVED_DECISIONS=0, R3C4_IMPLEMENTATION_READY=YES. 현재 source의 fail-closed 동작은 변경하지 않았으며 구현은 R3-C4B 범위다.

## resolveRequiredSecrets 추적

[ProductionBootstrapDependencies](../../apps/api/src/production-bootstrap.ts)는 configuration을 받는 Promise<void> callback을 정의한다. 반환되는 value bag이나 downstream secret output은 없다. [Engine](../../apps/api/src/production-bootstrap-engine.ts)은 configuration/reference 검증, pool 생성, Identity/service workload 검증, Human readiness 이후 이 callback을 기다린 뒤 bootstrap context와 aggregate readiness 및 child roots를 진행한다.

[production-main.ts](../../apps/api/src/production-main.ts)에서 validateMandatorySecretReferences는 no-op이고 resolveRequiredSecrets는 unavailablePromise로 항상 실패한다(현재 line 203/224). callback 분류는 EXTERNAL_PREREQUISITE이다(line 50). 구체적인 secret manifest/config list는 없다. startWorkers도 unavailable 경계다(line 267). 미래 worker가 필요로 할 credential은 이번 조사로 확정할 수 없다.

순서는 configuration → DB pool/Identity readiness → service workload gate → Human gate → Required Secrets → bootstrap context → aggregate schema readiness → Session/5 child roots → listener → workers다. listener/workers는 시작하지 않았다.

## 기존 계약 재사용

- [Phase 1 secret boundary](REL002_PHASE1_SECRET_BOUNDARY_AND_REFERENCE_MODEL.md), DOC-DEV-280 / DEC-164: NON_SECRET_CONFIG / SECRET_REFERENCE / SECRET_VALUE 분리, 내부 consumer allowlist, provider-neutral SecretReferenceResolver 설계. 실제 generic 구현으로 오인하지 않는다.
- [Phase 1 inventory](REL002_PHASE1_CONFIGURATION_IDENTITY_SECRETS_INVENTORY.md), DOC-DEV-277: 조건부 secret class는 실제 필수 consumer 등록과 다르다.
- [DB variable mapping](REL002_PHASE2D0I_SECRET_REFERENCE_VARIABLE_MAPPING.md), DOC-DEV-349 / DEC-190: exact sealed reference 2개.
- [DB backend recommendation](REL002_PHASE2D0I_SECRET_BACKEND_RECOMMENDATION.md), DOC-DEV-346 / DEC-189: Docker build 격리 조건의 Railway service-scoped sealed environment backend.
- [Decision register](../00_DECISION_REGISTER.md), DEC-198: PG_PRODUCTION_POOL canonical, PG_IDENTITY_POOL은 같은 pool/secret boundary의 compatibility 입력이다.
- [REL-001 provider hold](REL001_PHASE4D8_EXTERNAL_PROVIDER_DEPENDENCY_HOLD.md), DOC-DEV-219: OpenAI Staging live activation의 외부 prerequisite는 유지한다.

## DB와 Authentication

[production-secret-reference-resolver.ts](../../apps/api/src/production-secret-reference-resolver.ts)는 exact environment mapping을 소비하고 DB URI/runtime role/TLS/CA를 검증하여 pool을 생성한다. raw DATABASE_URL, 임의 reference/version/fallback은 허용되지 않는다. 이 단계는 resolveRequiredSecrets보다 앞선다. DATABASE_SECRET_OWNERSHIP=EARLIER_BOOTSTRAP. R3-C4 재소비, 두 번째 pool, migration credential 사용은 금지다.

[First-party Argon2 wrapper](../../modules/identity/src/first-party-credential-argon2.ts)는 async Argon2id와 persisted salt/derived key를 사용한다. 요청 password와 저장된 verifier는 보호 대상이지만 startup secret reference가 아니다. pepper, signing key, external auth credential은 추가하지 않는다. [SessionService](../../modules/identity/src/session-service.ts)의 session/family/refresh reference는 idFactory로 생성하며 현재 Production root는 randomUUID를 주입한다. generic ReferenceAuthenticationEvidence.credentialReference는 interface 입력이며 선택된 first-party adapter의 startup secret 요구가 아니다.

## 활성화 경계와 제한

현재 API-018 executionAvailable=false, API-019 evidence application은 provider 호출 adapter를 구성하지 않으며 Advisory Production adapter는 unavailable이다. readiness/persistence READY를 external execution 승인으로 해석하지 않는다. deployment/monitoring/backup의 미구성 class도 현재 application startup secret에 포함하지 않는다. future 활성화는 해당 consumer와 reference 계약을 별도 승인한 뒤 재조사해야 한다.

Runtime/source 변경 NONE. Required Secrets FAIL_CLOSED, full startup BLOCKED, Production readiness NOT_VERIFIED. R3-D NOT_STARTED. 실제 접근, secret resolve, schema/migration/role 변경 및 commit/push 없음.
