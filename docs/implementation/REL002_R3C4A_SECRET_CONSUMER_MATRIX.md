# REL-002 R3-C4A Secret Consumer Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-398 |
| Version | v0.1 |
| Status | DRAFT |
| Owner | Architecture Owner / Security Owner |

[Inventory](REL002_R3C4A_REQUIRED_SECRETS_INVENTORY.md), [Reference contract](REL002_R3C4A_SECRET_REFERENCE_CONTRACT.md), [Completion](../reviews/REL002_R3C4A_COMPLETION.md). YES/NO는 현재 구성에 한정한다. 미래 worker/adapter의 요구는 미확정이며 현재 NO가 미래 면제를 의미하지 않는다.

| SECRET_PURPOSE / CONSUMER | PATH | REQUIRED_BEFORE_LISTENER | REQUIRED_BEFORE_WORKERS | CURRENT_REFERENCE | CURRENT_VALUE_SOURCE | AUTHORITY_OWNER | PRODUCTION_REQUIRED / activation |
|---|---|---|---|---|---|---|---|
| DB connection bundle / PG_PRODUCTION_POOL | [DB resolver](../../apps/api/src/production-secret-reference-resolver.ts) | YES | YES | railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1 | 승인된 service-scoped sealed process environment; 실제 값 미조회 | Security/Operations secret binding, exact pool consumer | YES / EARLIER_BOOTSTRAP PRE_LISTENER_REQUIRED; R3-C4 제외 |
| DB trust CA / PG_PRODUCTION_POOL | [DB resolver](../../apps/api/src/production-secret-reference-resolver.ts) | YES | YES | railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1 | 승인된 service-scoped sealed process environment; 실제 값 미조회 | Security/Operations trust configuration | YES / EARLIER_BOOTSTRAP PRE_LISTENER_REQUIRED; private key 아님; R3-C4 제외 |
| First-party password verifier / AuthenticationAdapter | [Argon2 wrapper](../../modules/identity/src/first-party-credential-argon2.ts), [Human readiness](../../apps/api/src/production-human-identity-readiness.ts) | NO | NO | FirstPartyCredentialConfigRefV1은 NON_SECRET_CONFIG; startup secret ref 없음 | 요청-private password, DB verifier/salt; startup password resolve 없음 | Identity | NO / 별도 secret·pepper·provider 없음 |
| Session/token signing / SessionService | [SessionService](../../modules/identity/src/session-service.ts), [Production root](../../apps/api/src/production-main.ts) | NO | NO | 없음; opaque Session/refresh references | randomUUID / durable Session record | Identity | NO / 현재 signing/encryption key consumer 없음 |
| Connector/external API credential / API-018 | [Connector composition](../../apps/api/src/connector-production-composition.ts) | NO | NO | 없음 | unavailableConnector, executionAvailable=false | Source / Integration; secret binding은 Security | NO / execution 비활성; 미래 connector별 승인 필요 |
| Third-party integration credential / API-019 | [External composition](../../apps/api/src/external-integration-production-composition.ts), [Evidence application](../../modules/source/src/external-integration-application.ts) | NO | NO | governedBindingRef는 evidence/domain linkage이며 credential 아님 | provider evidence 수신·persistence; HTTP credential adapter 없음 | Source / Integration | NO / 현재 evidence path |
| AI/provider credential / FEAT-022 Production | [Advisory composition](../../modules/ai/src/advisory-production-composition.ts) | NO | NO | 없음 | production-unavailable-v1 | AI / Integration | NO / provider execution unavailable |
| Staging Advisory provider credential / AdvisoryCredentialResolver | [Provider boundary](../../modules/ai/src/advisory-provider-boundary.ts), [REL001 hold](REL001_PHASE4D8_EXTERNAL_PROVIDER_DEPENDENCY_HOLD.md) | NO | NO | credentialRef; historical FEAT022_STAGING_OPENAI_API_KEY | 주입된 Staging resolver; 실제 backend/value 미조회 | AI / Integration / Security | NO / OPTIONAL / DEFERRED; future authorized invocation 직전 resolve |
| Webhook/signing/encryption secret / 현재 5 child roots | [Child registry](../../apps/api/src/production-child-root-registry.ts), [Publication](../../apps/api/src/composition.ts), [Administration](../../apps/api/src/administration-production-composition.ts) | NO | NO | 구성된 reference 없음 | 구성된 secret adapter 없음 | 각 기존 domain; 새 owner 지정 없음 | NO / 현재 startup graph에서 consumer 없음 |
| Worker-specific credential / startWorkers | [Production root](../../apps/api/src/production-main.ts) | NO | NO | placeholder에 manifest 없음 | startWorkers unavailable | 기존 worker composition owner; 구체 consumer 미확정 | UNRESOLVED / POST-MVP 활성화 전 별도 inventory; 현재 활성 consumer 수 0 |
| Infrastructure deployment/monitoring/backup credential | [Phase 1 inventory](REL002_PHASE1_CONFIGURATION_IDENTITY_SECRETS_INVENTORY.md) | NO | NO | 현재 application root에 없음 | deployment executor는 외부 경계; monitoring/backup adapter 미구성 | Operations / Security | NO / 현재 root 제외; 미래 단계 요구 미확정 |

DB physical variable 이름은 위 reference에서 railway-sealed-env:를 제외한 exact 이름이다. connection bundle 내부 password를 별도 secret 환경 변수로 분리하지 않는다. PG_IDENTITY_POOL compatibility는 추가 consumer/pool이 아니다. 현재 등록된 Production LAZY_FEATURE_REQUIRED secret instance는 0개이며, deferred Staging credential 계약의 존재를 Production instance로 집계하지 않는다.

AO는 현재 composition의 RequiredSecretsManifestV1 { schemaVersion: 1, entries: [] }를 승인했다. CURRENT_MANIFEST=EXPLICIT_EMPTY. future worker의 요구 미확정은 현재 unresolved mandatory consumer의 존재를 뜻하지 않는다. 미래 활성화에는 consumer inventory와 승인된 manifest 갱신이 필요하며, empty manifest를 미래 exemption으로 사용하지 않는다.
