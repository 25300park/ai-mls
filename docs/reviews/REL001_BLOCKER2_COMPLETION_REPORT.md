# REL-001 Blocker 2 UI-006 Live Core Data Completion Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-213 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / UI Owner / API Owner / Quality Owner |
| 기준일 | 2026-09-16 |

## 1. Objective

기존 `/administration` UI-006에 API-001 `GET /v1/me`의 live principal을 연결하고, 승인된 네 필드만 read-only로 표시했다. 기존 Session ingress의 `resource.view` 재검증, tenant/scope concealment, 접근성 구조와 전역 readiness 규칙을 유지했다.

## 2. Documents read

- REL-001 Blocker 2 brief와 Architecture Owner 승인 설계
- [Blocker 2 Implementation Plan](../implementation/REL001_BLOCKER2_UI006_LIVE_CORE_DATA_PLAN.md)
- [Blocker 2 Field Mapping Matrix](../implementation/REL001_BLOCKER2_UI006_FIELD_MAPPING_MATRIX.md)
- [Blocker 1 Core Transport Traceability](../implementation/REL001_BLOCKER1_CORE_API001002_TRACEABILITY.md)
- FEAT-020, FEAT-021, REL-001/API-017 traceability matrices

## 3. Files created

- `apps/admin-console/src/core-identity-console-read-adapter.ts`
- `apps/admin-console/src/core-identity-console-read-adapter.test.ts`
- [Blocker 2 Implementation Plan](../implementation/REL001_BLOCKER2_UI006_LIVE_CORE_DATA_PLAN.md)
- [Blocker 2 Field Mapping Matrix](../implementation/REL001_BLOCKER2_UI006_FIELD_MAPPING_MATRIX.md)
- [Blocker 2 Runtime Traceability](../implementation/REL001_BLOCKER2_UI006_RUNTIME_TRACEABILITY.md)
- 이 Completion Report

## 4. Files modified

- Console composition/renderer와 직접 tests
- Staging Console bootstrap, Session ingress regression, integrated runtime E2E
- Master Index, FEAT-020 RTM, FEAT-021 RTM, Blocker 1 traceability, REL-001/API-017 RTM

## 5. Key decisions added

- `CoreIdentityConsoleReadAdapter`는 정확히 `GET /v1/me`만 호출한다.
- Presentation allowlist는 `principalId`, `tenantId`, `roles`, `scopes` 네 필드뿐이다.
- `sessionId`, `principalType`, `expiresAt`, assignment/policy 내부값과 unknown field는 전달하지 않는다.
- API-002 호출은 `0`이며 API-001 성공을 API-002 readiness로 확대 해석하지 않는다.
- Core failure/mismatch/malformed response는 stale API-015 principal/status를 제거하고 UI-006 Core section만 `NOT_AVAILABLE / NOT_READY`로 만든다.
- Core partial failure 전후 Console global readiness는 동일하다.

## 6. Open decisions

- 변경된 runtime artifact로 인해 exact REL-001 candidate fingerprint가 역사적 Blocker 1C candidate와 달라졌다. 이 phase에서는 역사 candidate를 변경하지 않으며 후속 exact-candidate rebuild/reevaluation 승인이 필요하다.
- Live provider는 external account/contract dependency로 차단되어 있고 DEC-162는 `IN_REVIEW`다.
- Fresh dependency audit은 scoped network 승인이 없어 `NOT_RUN`이다.

## 7. Inconsistencies found

독립 리뷰에서 API-001 evidence를 `Core API-001/002` combined readiness로 표시하던 과장, Core 실패 시 stale `currentPrincipal` 보존, global readiness isolation 직접 assertion 누락을 발견했다. API-001 전용 상태, stale-data removal, failure 전후 status equality test로 모두 수정했다.

## 8. Validation performed

| Gate | Result |
|---|---|
| Initial RED | UI-006 live principal 미표시로 예상 실패 확인 |
| Additional RED | malformed `expiresAt`, combined API-001/002 claim, stale principal, readiness isolation 결함을 각각 확인 |
| Focused | `55/55 PASS` |
| Affected Console/Core/Staging | `131/131 PASS` |
| Full regression | `1495/1496`; 유일한 실패는 immutable historical Blocker 1C exact-candidate fingerprint stale signal |
| Lint / typecheck / clean build | PASS / PASS / PASS |
| Architecture checksum | immutable `153/153 PASS`; `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` |
| Gitleaks | current tree `0` |
| Dependency audit | `NOT_RUN` — network not authorized |
| Dependency/lockfile delta | `0` |
| Direct persistence / API-003~010 expansion | `0 / 0` |
| Independent review | initial Critical `0`, Important `4`; all four remediated; fresh re-review Critical `0` / Important `0` / Minor `0` — `READY` |

## 9. Known limitations

- Full regression은 current artifact와 immutable historical candidate fingerprint의 의도된 불일치를 검출한다. Blocker 2 구현 결함은 아니지만 exact-candidate rebuild 전까지 release evidence gate는 GREEN이 아니다.
- UI-006은 API-001 live principal만 표시한다. API-002를 호출하거나 authorization 결과를 중복 투영하지 않는다.
- Push는 `NOT_PERFORMED`이며 Main integration은 별도 승인 전 수행하지 않는다.

## 10. Next brief prerequisites

Architecture Owner closeout 승인에 따라 bounded local commit만 생성한다. Main integration 후 변경된 runtime artifact에 대한 exact-candidate rebuild/acceptance reevaluation이 별도 필요하다. Provider activation, dependency audit, deployment는 계속 별도 승인 대상이다.

## Final Recommendation

`APPROVE_REL001_BLOCKER2_UI006_LIVE_CORE_DATA_ACTIVATION`
