# Administration isolated component diagnostic 완료 보고

- 버전: v0.1
- 상태: DRAFT
- 기준 HEAD: `a817090cd39272136461ee96386f6c6d67cbd6d9`
- 범위: diagnostic implementation 및 static test only

## 1. Objective
Administration child-root constraints mismatch의 PG17/18 catalog 원인 입증 또는 기각에 필요한 격리 capture를 준비한다. 원인을 확정하거나 compatibility를 구현하지 않는다.

## 2. Documents read
현재 AO brief, Administration001/002/003 및 historical verifier, Organization001, canonical R3C2 fixture, child-root readiness 및 기존 Publication/R3C1 fixture helper를 확인했다.

## 3. Files created
- [Harness](../../scripts/rel002-administration-fixture-capture.mjs)
- [Focused tests](../../scripts/rel002-administration-fixture-capture.test.mjs)
- [SELECT-only diagnostic](../diagnostics/REL002_ADMINISTRATION_COMPONENT_DIAGNOSTIC.sql)
- 이 보고서

## 4. Files modified
기존 source/migration/verifier/evidence 변경 없음. 기존 untracked 파일을 보존한다.

## 5. Key decisions added
최소 fixture 순서는 Administration001 → Administration002 runtime grants → Administration003이다. Administration003에는 Organization table FK 또는 Organization001 precondition이 없으므로 Organization/Identity/Audit 등 다른 migration은 포함하지 않는다. capture stage는 `POST_ADMINISTRATION003_RUNTIME_GRANTS`다.

기존 committed R3C1 lifecycle/safety helper를 재사용한다. explicit opt-in은 `REL002_ADMINISTRATION_CAPTURE_DISPOSABLE=CONFIRMED`, host는 localhost/127.0.0.1, major는17/18, port5432는 금지다. 실제 연결은127.0.0.1로 고정하고 inherited PG 변수는 child 환경에서 제거한다. 모든 기존 app schema/ai_mls role을 거부하며 target identity를 mutation 전에 검증한다. owned cluster만 정지하고 파일은 보존한다.

7개 material은 immutable child-root source에서 정확히 추출한다. runtime ACL도 child-root의 `aclexplode` 집계식을 사용한다. columns/constraints/indexes 및 나머지 component의 serialized material/hash, total/type별 constraint count, `n` count, NOT NULL column count, non-`n` hash/rows를 캡처한다. 환경 및 data_directory, owner/comment/inventory, artifact GUC 값/존재 여부를 별도로 기록하며 GUC를 설정하지 않는다. metadata 관찰자는 postgres이며 runtime effective privileges는 명시된 runtime role을 대상으로 계산한다.

## 6. Open decisions
PG17/PG18 실제 fixture 실행과 capture 비교는 별도 승인 필요. binary 경로 및 port도 그 단계에서 명시한다.

## 7. Inconsistencies found
기존 aggregate evidence는 full constraints hash만 제공하므로 non-`n` 동등성은 아직 입증되지 않았다. 이번 단계에서도 실제 DB query를 실행하지 않았다.

## 8. Validation performed
Focused11 PASS, affected Publication/R3C1 harness36 PASS(합계47). mjs syntax 및 repository typecheck/lint PASS. git diff --check 및 신규 파일 whitespace/secret literal scan PASS. Administration001/003 승인 sidecar SHA 일치 및 Administration historical migration/verifier/child-root/R3C1 source의 HEAD 대비 변경 없음 확인 PASS.

## 9. Known limitations
실제 fixture/Production 연결 없음. SQL 실행 결과와 PG17/18 동등성은 미검증이다. SQL은 catalog metadata만 조회하며 application rows를 조회하지 않는다. standalone historical verifier를 실행하지 않는다. harness는 기존 Publication의 metadata SQL template 및 R3C1 safety helper에 의존한다. 신규 mjs는 syntax/focused tests로, repository TypeScript는 lint/typecheck로 검증했다.

## 10. Next brief prerequisites
실행 승인 후 `--execute-fixture --host=127.0.0.1 --port=<non5432> --major=17|18 --bin=<approved-local-Windows-bin>`으로 각 새 cluster를 캡처한다. 현재 `DO_NOT_EXECUTE_YET`이다. 이후 `--compare-captures <PG17 capture.json> <PG18 capture.json>`은 stage/major/migration SHA가 일치할 때만 PG17 full constraints와 PG18 non-`n` hash를 비교한다. 불일치 시 이미 기록한 non-`n` rows로 원인을 비교한다. historical expected hash는 변경하지 않는다.
