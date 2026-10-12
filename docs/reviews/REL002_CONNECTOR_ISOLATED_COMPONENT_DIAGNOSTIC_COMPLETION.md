# Connector isolated component diagnostic 완료 보고

| 항목 | 값 |
|---|---|
| Version | v0.1 |
| Status | DRAFT |
| Owner | Architecture Owner |
| Date | 2026-10-12 |
| Baseline | 2191943a7816c24a93241ee1154fe6687428fdbe |
| Scope | DIAGNOSTIC IMPLEMENTATION + STATIC TEST ONLY |

## 1. Objective
Connector constraints mismatch의 PG17/PG18 catalog 원인을 입증하거나 기각할 수 있는 isolated capture를 준비했다. 원인을 확정하거나 compatibility를 구현하지 않았다. 실제 PostgreSQL fixture는 실행하지 않았다.

## 2. Documents read
현재 AO brief, [canonical child-root query](../../apps/api/src/child-root-postgresql-readiness.ts), [canonical R3C2 fixture](../../apps/api/src/rel002-r3c2-startup-postgresql.integration.test.ts), Connector001/002 및 historical verifier, [Administration capture](../../scripts/rel002-administration-fixture-capture.mjs), 기존 Publication/R3C1 safety/lifecycle helper를 확인했다. 문서 형식은 기존 completion template을 따른다.

## 3. Files created
- [Connector harness](../../scripts/rel002-connector-fixture-capture.mjs)
- [Focused static tests](../../scripts/rel002-connector-fixture-capture.test.mjs)
- [SELECT-only component diagnostic](../diagnostics/REL002_CONNECTOR_COMPONENT_DIAGNOSTIC.sql)
- 이 완료 보고서

## 4. Files modified
기존 source/migration/verifier/hash/evidence 변경 없음. 기존 untracked evidence/reports를 보존했다. staging/commit/push 없음.

## 5. Key decisions added
Fixture 순서는 Connector001 → Connector002 runtime grants뿐이다. capture stage는 `POST_CONNECTOR_RUNTIME_GRANTS`. 다른 domain migration이나 historical DO verifier를 실행하지 않는다. Diagnostic은 postgres observer로 catalog를 읽으며 runtime effective privileges는 명시된 runtime role을 대상으로 계산한다.

기존 reviewed lifecycle helper를 재사용한다. opt-in은 `REL002_CONNECTOR_CAPTURE_DISPOSABLE=CONFIRMED`; host는 localhost/127.0.0.1, 실제 연결은 127.0.0.1, port5432 거부, major17/18만 허용한다. explicit binary path가 필수다. Production binding/CA/DATABASE_URL을 거부하고 inherited PG 변수를 제거한다. target version/user/database/address/port/data_directory를 mutation 전에 확인한다. pre-existing app schema/ai_mls role을 거부하며 새로 소유한 cluster만 정지한다. Evidence/cluster files는 보존한다.

7개 component serialized material/hash는 immutable child-root SQL에서 추출했다. full constraints와 non-n constraints는 동일한 집계식이며 후자는 오직 `contype='n'`만 제외한다. Columns의 `is_nullable`를 유지한다. owner/comment/inventory/count, environment/data_directory, artifact GUC 존재/값, total/type별 constraint count, n count, NOT NULL column count, non-n rows/validated/definition을 캡처한다. 실제 migration SHA256은 envelope에 별도로 기록하며 GUC를 임의 설정하지 않는다.

Offline comparison은 major17+18, 동일 capture stage/checksum을 요구하며 PG17 full constraints hash와 PG18 non-n hash의 일치 여부 및 component별 일치 여부만 보고한다. 불일치도 false로 보고하며 root cause나 readiness를 자동 승인하지 않는다.

## 6. Open decisions
OPEN DECISION: PG17/PG18 실제 capture 실행은 별도 Human/AO 승인이 필요하다. Root cause 및 forward compatibility 필요 여부는 아직 미확정이다.

## 7. Inconsistencies found
기존 evidence의 constraints expected `256c3fc580fa577b32298aac39a2f67e`와 PG17 observed `462926ec173263014727594215d20d8c`는 불일치한다. Counts/non-n rows 동등성은 아직 캡처되지 않았다. 이전 helper는 변경하지 않고 새 Connector diagnostic의 artifact GUC를 Connector 전용으로 고정했다.

## 8. Validation performed
- Focused static tests: 13 PASS. loopback/major/port/opt-in/Production env 거부, exact ordering, SELECT-only, owned teardown, artifact GUC, comparison false case, sidecar checksum 확인.
- Affected 기존 Administration/Publication/R3C1 harness tests: 47 PASS.
- Syntax checks 및 Typecheck: PASS. Scoped configured child-root source lint: PASS. 전체 repository lint 시도는 Node OOM으로 종료됐다. 새 mjs scripts는 기존 ESLint 대상 밖이므로 node --check로 검증했다.
- git diff --check, secret-literal scan, local links: PASS.
- Connector001 SHA256 `a6a65bd9c779cf047a4261eb11822414fff131708af68b7ee3029cb3cfbe91fd`: sidecar 및 HEAD blob 일치.
- Connector002 SHA256 `884993e84b9b83fa4dcc47c4ccd850bf4ef7dae13b60362460a23e1ab1d4822c`: HEAD blob 일치.
- Historical verifier SHA256 `e4a7e9f82e844fc7738a7a9f0fe8d14a1219154cb8d2496bcb650cdee7cce537`: HEAD blob 일치.
- Historical modules/query/hash와 기존 helper diff 없음.

## 9. Known limitations
Static/mock validation만 수행했다. SQL의 실제 PG17/PG18 실행 결과 또는 semantic equivalence를 주장하지 않는다. Business rows/credentials/Production secrets를 캡처하지 않는다. Production/Railway 작업 없음.

## 10. Next brief prerequisites
명시적인 PG17/PG18 isolated capture 승인과 major별 local binary/port가 필요하다. 이후 동일 checksum/capture stage의 증거를 비교해야 한다. 다음 phase를 시작하지 않았다.
