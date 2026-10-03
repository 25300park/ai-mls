# REL-002 R3-C4A Secret Reference Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-399 |
| Version | v0.1 |
| Status | DRAFT |
| Owner | Architecture Owner / Security Owner |

[Inventory](REL002_R3C4A_REQUIRED_SECRETS_INVENTORY.md), [Consumer matrix](REL002_R3C4A_SECRET_CONSUMER_MATRIX.md), [Completion](../reviews/REL002_R3C4A_COMPLETION.md).

## 기존 boundary 재사용

[DEC-164 reference model](REL002_PHASE1_SECRET_BOUNDARY_AND_REFERENCE_MODEL.md)의 opaque SECRET_REFERENCE / transient SECRET_VALUE 분리를 재사용한다. generic SecretReferenceResolver는 설계 port이고 현재 구체 구현은 [bounded DB resolver](../../apps/api/src/production-secret-reference-resolver.ts)다. 두 가지를 동일한 실행 구현으로 표시하지 않는다.

현재 approved provider는 **DB에 한정된 Railway service-scoped sealed process environment**다(DEC-189/190). mounted file, external vault, arbitrary environment lookup, 신규 secret manager는 현재 canonical provider가 아니다. 추가 R3-C4 secret provider는 필요하지 않다. implementation에 실제 Railway secret 접근이 필요하지 않으며 fixture/fake boundary로 검증해야 한다.

DB reference/consumer는 matrix의 exact 2개 입력과 PG_PRODUCTION_POOL로 고정한다. PG_IDENTITY_POOL compatibility는 DEC-198의 같은 경계다. DB secret 재해석이나 duplicate consumption은 하지 않는다. FirstPartyCredentialConfigRefV1은 알고리즘 설정이며 SECRET_REFERENCE로 승격하지 않는다. Advisory credentialRef는 기존 Staging feature boundary에만 남긴다.

## 승인된 R3-C4 readiness 계약

**AO 결정 R3C4A-OD-001 — RESOLVED:** 현재 명시적 consumer 집합의 empty manifest가 승인되었다. canonical immutable contract는 RequiredSecretsManifestV1이며 정확한 shape는 다음과 같다.

```text
RequiredSecretsManifestV1 {
  schemaVersion: 1,
  entries: []
}
```

필수 목록의 부재/누락과 의도적으로 승인된 빈 목록은 다르다. 실제 구현 전까지 resolveRequiredSecrets는 기존 FAIL_CLOSED를 유지한다.

후속 R3-C4B의 승인된 구현 범위는 다음과 같다. 이번 문서 갱신에서는 구현하지 않는다.

1. Production composition이 명시적으로 제공한 닫힌 manifest를 검증한다. 누락된 manifest, 알 수 없는 consumer/reference, 미승인 provider activation은 fail closed다. 환경 변수 이름을 스캔하여 목록을 추론하지 않는다.
2. EARLIER_BOOTSTRAP DB는 기존 pool boundary 결과에 의존하며 값을 다시 resolve하지 않는다. additional manifest가 승인된 empty set일 때 추가 secret resolve 없이 해당 gate만 완료한다. 이는 listener/worker 또는 full startup 승인과 다르다.
3. 향후 non-empty manifest는 별도 승인된 consumer/purpose/requiredAt/reference/provider/redaction 계약과 structural validator를 요구한다. 단순 env key 존재는 readiness가 아니다. exact mapping, availability 및 승인된 adapter의 structural validity가 모두 필요하다.
4. PRE_LISTENER_REQUIRED는 listener 전, PRE_WORKER_REQUIRED는 해당 worker activation 전, LAZY_FEATURE_REQUIRED는 승인된 feature invocation 직전 확인한다. OPTIONAL / DEFERRED는 global gate에 넣지 않는다. generic value bag이나 미리 모든 값을 resolve하는 구조를 만들지 않는다.
5. 값은 exact consumer의 transient memory에만 전달한다. 반환값은 현 Promise<void> readiness 경계로 충분하며 secret을 DTO에 넣지 않는다. 값·raw exception/cause·connection URI를 로그, audit, startup report, exception metadata, DB 또는 repository에 기록하지 않는다. 외부 evidence에는 허용된 consumer/environment, reference fingerprint, availability, correlation, safe outcome만 사용한다.

Gate PASS에는 explicit manifest 존재, schemaVersion=1, 명시적 entries 배열 및 entries.length=0, unresolved mandatory consumer 없음, 승인된 composition scope 일치, earlier bootstrap prerequisite의 독립적 충족이 모두 필요하다. 결과는 REQUIRED_SECRETS=READY_EMPTY_MANIFEST, RESOLVED_SECRET_VALUE_COUNT=0, SECRET_RESOLUTION_SIDE_EFFECTS=NONE이다. 이 결과는 구현 후 검증할 계약이며 현재 runtime 상태를 나타내지 않는다.

manifest 누락, unsupported version, malformed shape, entries 누락, unresolved consumer, manifest에 없는 신규 required secret, mandatory secret의 optional 처리, DB bootstrap 실패 은폐는 FAIL-CLOSED다. 부재한 입력에서 entries=[]를 자동 합성하지 않는다. 향후 required consumer는 승인된 architecture/change 절차로 manifest를 갱신하기 전에 startup-active가 될 수 없다.

### R3-C4B 필수 테스트

- explicit valid empty manifest PASS; missing manifest / omitted entries / unsupported version / malformed manifest FAIL.
- empty manifest에서 secret resolver calls=0, external provider calls=0, loaded secret values=0.
- unresolved mandatory consumer FAIL; earlier DB bootstrap failure는 독립적으로 BLOCKED 유지.
- REL001 deferred provider 제외 유지; listener/workers NOT_STARTED.

Reference naming을 문서화하는 것과 실제 값을 읽는 것은 분리한다. reference raw identifier도 공개 DTO/log에 노출하지 않는다. 본 문서에는 허용된 계약 reference/config 이름만 포함한다.

## 변경 금지와 다음 단계

새 provider/credential authority/key management/runtime role/secret DB persistence/schema/migration/Production 접근이 필요해지면 AO로 반환한다. REL001 hold, native async Argon2, single pool, migration credential exclusion, raw DATABASE_URL rejection을 보존한다.

NEW_SECRET_PROVIDER_REQUIRED=NO; NEW_SCHEMA_REQUIRED=NO; NEW_MIGRATION_REQUIRED=NO. UNRESOLVED_DECISIONS=0; R3C4_IMPLEMENTATION_READY=YES. 현재 Production readiness NOT_VERIFIED, runtime Required Secrets FAIL_CLOSED, full startup BLOCKED. 이번 R3-C4A에서 다음 구현이나 commit을 시작하지 않는다.
