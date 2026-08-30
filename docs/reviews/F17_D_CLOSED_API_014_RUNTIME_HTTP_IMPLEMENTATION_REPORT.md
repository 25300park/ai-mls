# F17-D Closed API-014 Runtime / Host / HTTP Implementation Report

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Development Owner |
| 기준일 | 2026-08-31 |
| Final Recommendation | `APPROVE_F17_D_CLOSED_API_014_RUNTIME_HTTP` |

## Completion Gate Summary

| Required evidence | Result |
|---|---|
| Status | APPROVE |
| Canonical Operations | 18/18 |
| Commands | 12/12 PASS |
| Queries | 6/6 PASS |
| Runtime Registration | PASS — 18/18 |
| Host Registration | PASS — 18/18 |
| HTTP Boundary | PASS — 18/18 |
| Session-derived Actor | PASS |
| Authorization / Isolation | PASS |
| Closed Schemas | PASS |
| Safe Error / Concealment | PASS |
| F17-B Eligibility Preservation | PASS |
| F17-C Durability Preservation | PASS |
| Blind Resend Paths | 0 |
| Real Provider Activation | 0 |
| New API Operations | 0 |
| Focused Tests | 11/11 PASS |
| Affected Regression | 74/74 PASS |
| Total Tests | 796/796 PASS |
| Lint / Typecheck / Build / Verify | PASS |
| Architecture Checksum | 153/153 PASS |
| `git diff --check` | PASS |
| Gitleaks | 0 findings |
| Production Audit | 0 vulnerabilities |
| Full Audit | 기존 승인된 development-only transitive High 4건만 존재 |
| New Unapproved High/Critical | 0 |
| Independent Review | Critical 0 / Important 0 / Minor 0 — READY |
| Unresolved Blockers | 0 |
| Report | `docs/reviews/F17_D_CLOSED_API_014_RUNTIME_HTTP_IMPLEMENTATION_REPORT.md` |
| Commit | `PENDING_SINGLE_LOCAL_COMMIT` — actual hash는 commit 후 Architecture Owner에게 보고 |
| Push | `NOT_PERFORMED` |
| F17-E/F | `NOT_STARTED` |

## 1. Objective

기존 closed API-014의 12 commands와 6 queries를 새 operation 또는 authority 추가 없이 `Node HTTP Server → HTTP Adapter → existing Host → existing Runtime → PublicationApi → F17-C Durable Publication UoW` 단일 경로로 연결했다. Production composition은 explicit durable database path가 없으면 fail closed하며 in-memory persistence로 fallback하지 않는다.

## 2. Documents read

- Architecture Owner가 제공한 F17-D Brief
- [F17-C Durable Publication Execution Design](../implementation/F17_C_DURABLE_PUBLICATION_EXECUTION_DESIGN.md)
- [F17-C Durable Publication Execution Implementation Report](F17_C_DURABLE_PUBLICATION_EXECUTION_IMPLEMENTATION_REPORT.md)
- [FEAT-015 Traceability Matrix](../implementation/FEAT015_TRACEABILITY_MATRIX.md)
- `AGENTS.md`
- 기존 API-014 contracts, `PublicationApi`, Runtime, Host, Node HTTP, F17-B eligibility와 F17-C durable execution contracts

## 3. Files created

- `apps/api/src/publication-api-http-adapter.ts`
- `apps/api/src/publication-api-http-runtime.test.ts`
- `apps/api/src/publication-api-runtime-adapter.ts`
- `modules/publication/src/publication-runtime-canonical-api-port.ts`
- `modules/publication/src/publication-canonical-api-runtime.test.ts`
- `docs/implementation/F17_D_CLOSED_API_014_RUNTIME_HTTP_IMPLEMENTATION_PLAN.md`
- `docs/reviews/F17_D_CLOSED_API_014_RUNTIME_HTTP_IMPLEMENTATION_REPORT.md`

## 4. Files modified

- `apps/api/src/composition.ts`
- `apps/api/src/index.ts`
- `apps/api/src/publication-api-error-mapper.ts`
- `modules/publication/src/index.ts`
- `modules/publication/src/publication-application-host.ts`
- `modules/publication/src/publication-composition-root.ts`
- `modules/publication/src/publication-runtime.ts`
- `modules/publication/src/publication-runtime.test.ts`
- `docs/implementation/FEAT015_TRACEABILITY_MATRIX.md`

## 5. Key decisions added

- API-014 operation registry는 기존 `PUBLICATION_API_COMMAND_OPERATIONS` 12건과 `PUBLICATION_API_QUERY_OPERATIONS` 6건만 사용한다.
- HTTP surface는 `POST /api/publication/commands`와 `POST /api/publication/queries` 두 closed route만 소유한다.
- body의 `sessionId`는 제거하며 authoritative Session ID는 `x-session-id` header에서만 전달한다. body actor/role/capability는 authority를 생성하지 않는다.
- Runtime은 immutable structural canonical API port 하나를 주입받고 Host/Composition은 동일 port로만 위임한다.
- Production composition은 `createProductionPublicationInfrastructure`로 생성한 동일 durable infrastructure를 `PublicationApi`, Runtime/Host와 HTTP server가 공유한다.
- unknown route/operation, malformed request/response와 backend-authored error detail은 safe closed error로 정규화한다.
- `CONNECTOR_OUTCOME_UNKNOWN`은 외부 effect가 증명되지 않은 canonical 상태를 보존하도록 API-014 `RECONCILIATION_REQUIRED`로 안전하게 매핑한다.
- `DISPATCH_STARTED` 후 authoritative receipt가 없는 restart는 provider 재호출 없이 `RECONCILIATION_REQUIRED`를 반환한다.

## 6. Open decisions

- 실제 Provider adapter, credential과 provider-specific activation은 F17-E 범위다.
- retry eligibility는 F17-F 범위다.
- reconciliation resolution/recovery workflow는 F19 범위다.
- Console status/mutation은 본 단계에서 구현하지 않았다.

## 7. Inconsistencies found

- 최초 architecture regression은 새 Runtime API port가 기존 layer allowlist에서 Domain으로 오분류된 문제였다. 파일을 `publication-runtime-canonical-api-port.ts`로 명확히 분류하고 Runtime contract allowlist를 정렬해 dependency bypass 없이 해소했다.
- 독립 검토에서 HTTP adapter가 backend-authored error message/code를 그대로 serialize할 수 있는 Important finding 1건을 발견했다. closed error-code allowlist와 canonical safe message reconstruction을 추가한 뒤 direct regression을 통과해 해소했다.
- `pnpm.cmd verify`의 최초 실행은 shared worktree junction의 `node_modules`를 pnpm이 자동 purge/install하려 하면서 비대화형 환경에서 중단됐다. dependency를 변경하지 않고 `--config.verify-deps-before-run=false`로 자동 purge/install만 비활성화해 동일 repository verify script를 성공적으로 실행했다.

## 8. Validation performed

| Gate | Result |
|---|---|
| RED evidence | missing canonical Runtime/HTTP modules 및 safe-error leakage assertion 실패를 각각 확인 |
| F17-D focused | 11/11 PASS |
| API-014 / F17-B / F17-C affected | 74/74 PASS |
| Runtime / Host / architecture focused | 26/26 PASS |
| Full regression / Verify | 796/796 PASS; fail/cancelled/skipped/todo 0/0/0/0 |
| Lint | PASS |
| Typecheck | PASS |
| Build | PASS |
| Verify | PASS — `pnpm.cmd --config.verify-deps-before-run=false run verify` |
| `git diff --check` | PASS |
| Gitleaks | 0 findings |
| Architecture checksum | PASS — 153/153; `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` |
| Closed operation registry | commands 12/12; queries 6/6; total 18/18 |
| Runtime / Host / HTTP execution matrix | 18/18 PASS |
| Session-derived authorization / concealment | PASS |
| Durable Production UoW / missing configuration | PASS / fail closed |
| Restart blind resend | provider calls 0 |
| New API ID / operation / authority | 0 / 0 / 0 |
| Real Provider / credential activation | 0 / 0 |
| Dependency manifest/lockfile changes | 0 |
| Independent re-review | READY — Critical 0 / Important 0 / Minor 0 |

검증 runtime은 Node.js `v24.18.0`, pnpm `11.9.0`이다.

### Dependency audit evidence

| Command | Exit | Severity / package | Dependency path | Classification | Disposition |
|---|---:|---|---|---|---|
| `pnpm.cmd audit --prod` | 0 | findings 0 | 해당 없음 | Production | PASS |
| `pnpm.cmd audit` | 1 | High / `brace-expansion` 1.x, `GHSA-mh99-v99m-4gvg` | `eslint -> minimatch -> brace-expansion` 계열, 36 paths | Development-only transitive | 기존 승인 상태, 변경 없음 |
| `pnpm.cmd audit` | 1 | High / `brace-expansion` 5.x, `GHSA-mh99-v99m-4gvg` | `typescript-eslint -> @typescript-eslint/* -> minimatch -> brace-expansion` 계열, 7 paths | Development-only transitive | 기존 승인 상태, 변경 없음 |
| `pnpm.cmd audit` | 1 | High / `brace-expansion` 1.x, `GHSA-rgw5-rvv9-x895` | `eslint -> minimatch -> brace-expansion` 계열, 36 paths | Development-only transitive | 기존 승인 상태, 변경 없음 |
| `pnpm.cmd audit` | 1 | High / `brace-expansion` 5.x, `GHSA-rgw5-rvv9-x895` | `typescript-eslint -> @typescript-eslint/* -> minimatch -> brace-expansion` 계열, 7 paths | Development-only transitive | 기존 승인 상태, 변경 없음 |

Production Critical/High는 0이다. Full audit findings는 기존 승인된 lint toolchain의 development-only transitive advisories 4건과 동일하며 신규 미승인 High/Critical은 0이다. `audit --fix`, dependency update, override, manifest 또는 lockfile 변경은 수행하지 않았다.

## 9. Known limitations

- 실제 Provider 또는 sandbox Provider adapter는 구현하지 않았다.
- API-014 path는 F17-E Provider integration을 선행 구현하지 않는다.
- 자동 retry 및 reconciliation resolution은 구현하지 않았다.
- 기존 승인된 development-only `brace-expansion` High advisories 4건은 별도 dependency-owner remediation 대상이다.
- F17-E, F18, F19는 시작하지 않았다.
- Push는 수행하지 않았다.

## 10. Next brief prerequisites

- Architecture Owner가 본 F17-D evidence를 검토한다.
- F17-E는 fail-closed/unavailable/test/sandbox Provider boundary만 구현하며 실제 credential을 활성화하지 않는다.
- F17-F는 durable failure와 retry eligibility만 구현하고 F19 reconciliation workflow를 구현하지 않는다.
- F17-G Console status integration은 승인된 deferred 상태를 유지한다.
- F17-E/F/H 또는 F18/F19는 별도 승인 전 시작하지 않는다.
