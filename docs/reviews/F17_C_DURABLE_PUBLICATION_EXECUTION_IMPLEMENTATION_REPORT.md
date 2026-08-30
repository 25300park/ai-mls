# F17-C Durable Publication Execution Implementation Report

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Development Owner |
| 기준일 | 2026-08-30 |
| Final Recommendation | `APPROVE_F17_C_DURABLE_PUBLICATION_EXECUTION` |

## 1. Objective

승인된 F17-C 설계에 따라 Production Publication persistence, execution intent, dispatch ordering, immutable receipt, audit/event evidence와 idempotency를 Node.js built-in `node:sqlite`에 durable하게 저장했다. `DISPATCH_STARTED` 뒤 authoritative receipt가 없으면 Provider를 다시 호출하지 않고 `RECONCILIATION_REQUIRED`로 fail closed한다.

## 2. Documents read

- [F17-C Durable Publication Execution Design](../implementation/F17_C_DURABLE_PUBLICATION_EXECUTION_DESIGN.md)
- [F16-R1 Durable Administration Persistence Design](../implementation/F16_R1_DURABLE_ADMINISTRATION_PERSISTENCE_DESIGN.md)
- `AGENTS.md`
- 기존 Publication UoW, Aggregate, Application, Coordination, Event 및 authorization contracts

## 3. Files created

- `modules/publication/src/publication-durable-persistence.ts`
- `modules/publication/src/publication-durable-persistence.test.ts`
- `modules/publication/src/publication-execution-journal.ts`
- `modules/publication/src/publication-execution-eligibility.ts`
- `modules/publication/src/publication-execution-eligibility.test.ts`
- `docs/implementation/F17_C_DURABLE_PUBLICATION_EXECUTION_DESIGN.md`
- `docs/reviews/F17_C_DURABLE_PUBLICATION_EXECUTION_IMPLEMENTATION_REPORT.md`

## 4. Files modified

- `modules/publication/src/in-memory-persistence-state.ts`
- `modules/publication/src/index.ts`
- `modules/publication/src/publication-application-contracts.ts`
- `modules/publication/src/publication-application-service.ts`
- `modules/publication/src/publication-command-handlers.ts`
- `modules/publication/src/publication-end-to-end-architecture.test.ts`
- `modules/publication/src/publication-infrastructure.ts`
- `modules/publication/src/publication-infrastructure.test.ts`
- `modules/publication/src/publication-persistence-error.ts`
- `modules/publication/src/publication-service.ts`
- `modules/publication/src/publication-service.test.ts`
- `modules/publication/src/publication-unit-of-work.ts`

## 5. Key decisions added

- Production composition은 explicit file database path를 요구하며 `DurablePublicationUnitOfWork`만 선택한다.
- 빈 path와 `:memory:`는 fail closed하며 Production in-memory fallback은 없다.
- execution begin state, immutable intent, canonical idempotency, audit와 Domain Event는 동일 local transaction에 stage된다.
- Provider invocation 전 append-only `DISPATCH_STARTED`를 durable하게 claim한다.
- Provider 결과는 normalized immutable receipt, aggregate outcome, audit/event evidence와 함께 atomic local transaction에 commit된다.
- `DISPATCH_STARTED`와 receipt 부재는 `RECONCILIATION_REQUIRED`, provider invocation permitted `false`다.
- stable Provider idempotency key는 tenant/publication/command/attempt identity에 결속되며 local idempotency를 대체하지 않는다.
- receipt는 closed safe schema만 허용하며 raw Provider response 같은 unknown field를 거부한다.
- append-only tables는 SQLite trigger로 `UPDATE`/`DELETE`를 거부한다.
- optimistic concurrency는 database revision CAS로 강제한다.

## 6. Open decisions

- Production database path의 deployment-specific 값과 file lifecycle은 F17 runtime deployment configuration에서 제공해야 한다. 누락 시 fail closed한다.
- 실제 Provider adapter, credential 및 Provider-specific idempotency guarantee는 F17-E 범위이며 본 단계에서 구현하지 않았다.
- Reconciliation resolution은 F19 범위로 유지한다.

## 7. Inconsistencies found

- 기존 F15 event-append failure 테스트는 process-local connector result만으로 확정 outcome을 재사용했다. 승인된 F17-C rule에 따라 receipt persistence failure는 ambiguous outcome이며, 테스트를 `RECONCILIATION_REQUIRED`와 redispatch 0으로 정렬했다.
- 기존 architecture layer registry는 durable Publication persistence 파일을 분류하지 않았다. `publication-durable-persistence.ts`와 `publication-execution-journal.ts`만 Persistence layer로 명시하고 `node:sqlite` ownership을 해당 durable adapter 하나로 제한했다.

## 8. Validation performed

| Gate | Result |
|---|---|
| RED evidence | missing durable module `TS2307`; ambiguous restart boundary absent |
| Durable focused | 8/8 PASS |
| Publication affected | 123/123 PASS |
| Full regression | 785/785 PASS |
| Lint | PASS |
| Typecheck | PASS |
| Build | PASS |
| Architecture dependency/cycle test | 5/5 PASS |
| `git diff --check` | PASS |
| Gitleaks | 0 findings |
| Frozen Architecture checksum scope | unchanged files 0; baseline `153/153` preserved |
| Restart blind resend after `DISPATCH_STARTED` without receipt | 0 paths |
| Dependency manifest/lockfile changes | 0 |
| Production audit | PASS — exit `0`, known vulnerabilities `0` |
| Full audit | REVIEWED — exit `1`, 기존 승인된 development-only transitive `brace-expansion` High 4건만 존재 |
| New unapproved High/Critical | 0 |

검증 runtime은 Node.js `v24.18.0`이다. Isolated worktree의 offline dependency installation은 cached `ms@2.1.3` tarball 부재로 완료되지 않아, 승인된 main workspace dependency tree를 junction으로 재사용하고 TypeScript/ESLint/test runner를 직접 실행했다. 외부 dependency download와 dependency/lockfile 변경은 수행하지 않았다.

### Dependency audit evidence

| Command | Exit | Severity / package | Dependency path | Classification | Disposition |
|---|---:|---|---|---|---|
| `pnpm.cmd audit --prod --registry=https://registry.npmjs.org` | 0 | findings 0 | 해당 없음 | Production | PASS |
| `pnpm.cmd audit --registry=https://registry.npmjs.org` | 1 | High / `brace-expansion` 1.x, advisory `GHSA-mh99-v99m-4gvg` | `eslint -> minimatch -> brace-expansion` 계열, 36 paths | Development-only transitive | 기존 승인 상태, 변경 없음 |
| `pnpm.cmd audit --registry=https://registry.npmjs.org` | 1 | High / `brace-expansion` 5.x, advisory `GHSA-mh99-v99m-4gvg` | `typescript-eslint -> @typescript-eslint/* -> minimatch -> brace-expansion` 계열, 7 paths | Development-only transitive | 기존 승인 상태, 변경 없음 |
| `pnpm.cmd audit --registry=https://registry.npmjs.org` | 1 | High / `brace-expansion` 1.x, advisory `GHSA-rgw5-rvv9-x895` | `eslint -> minimatch -> brace-expansion` 계열, 36 paths | Development-only transitive | 기존 승인 상태, 변경 없음 |
| `pnpm.cmd audit --registry=https://registry.npmjs.org` | 1 | High / `brace-expansion` 5.x, advisory `GHSA-rgw5-rvv9-x895` | `typescript-eslint -> @typescript-eslint/* -> minimatch -> brace-expansion` 계열, 7 paths | Development-only transitive | 기존 승인 상태, 변경 없음 |

Full audit findings는 F16 Final Gate baseline에 이미 승인·기록된 lint toolchain의 transitive development dependency와 동일하다. Direct dependency finding, production path, Critical finding 및 신규 미승인 High finding은 각각 0이다. `audit --fix`, dependency update, override, manifest 변경 및 lockfile 변경은 수행하지 않았다.

## 9. Known limitations

- 실제 Provider 또는 sandbox Provider 호출은 구현하지 않았다.
- API-014 Runtime/Host/HTTP 완성은 F17-D 범위다.
- retry eligibility는 F17-F 범위다.
- automatic reconciliation/resolution workflow는 구현하지 않았다.
- 기존 승인된 development-only transitive `brace-expansion` High advisories 4건의 toolchain remediation 시점은 별도 dependency-owner review 대상이다.
- independent review와 전체 F17 hardening은 F17-H에서 수행해야 한다.
- Commit과 Push는 수행하지 않았다.

## 10. Next brief prerequisites

- Architecture Owner가 이 F17-C evidence를 검토한다.
- F17-D는 기존 closed API-014 12 commands + 6 queries만 Runtime/Host/HTTP로 연결해야 한다.
- F17-D production composition은 `createProductionPublicationInfrastructure`와 durable UoW를 authority로 사용해야 한다.
- F17-E 전에는 실제 Provider/credential을 활성화하지 않는다.
- F17-G, F18, F19는 시작하지 않는다.
