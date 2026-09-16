# REL-001 Blocker 3 Fresh Dependency Audit Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-267 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Security Owner / Release Owner |
| 기준일 | 2026-09-16 |

## Exact baseline

| Item | Value |
|---|---|
| Audit HEAD | `05f1b050a87ecb23894cf121f40a2f5f4f6accb5` |
| Exact runtime candidate source | `b7d2a864b8dbed9c6b1f0c7874481035159af886` |
| `package.json` SHA-256 | `666e5cba934be459d0bc0c43635b05a39d33162fe02d0550927f7f706871f9b9` |
| `pnpm-lock.yaml` SHA-256 | `245e7a25e2b2d4939bf2da84115061e0baf9997d1c5d175f6a32d58f94c22a11` |
| Pre/post audit dependency delta | `0` |

`pnpm.cmd audit --prod`와 `pnpm.cmd audit`만 승인된 `registry.npmjs.org` advisory metadata 범위에서 실행했다. 설치, update, fix, publish 및 다른 network 호출은 수행하지 않았다.

## Fresh production audit

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 0 |
| Moderate | 0 |
| Low | 0 |
| Total | 0 |

명령은 exit code `0`과 `No known vulnerabilities found`를 반환했다. 영향을 받는 production package와 advisory ID는 `0`이며 remediation은 필요하지 않다.

## Fresh full audit

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 5 |
| Moderate | 0 |
| Low | 0 |
| Total | 5 |

Full audit은 알려진 High findings 때문에 exit code `1`을 반환했다. 이는 실행 실패가 아니라 아래 development-toolchain advisories의 정확한 보고 결과다.

| Package / installed family | Advisory | Dependency path | Patched version | Classification | Historical comparison |
|---|---|---|---|---|---|
| `brace-expansion@1.1.16` | `GHSA-mh99-v99m-4gvg` | `eslint -> minimatch -> brace-expansion`, 36 paths | `>=1.1.17` | `DEV_ONLY_NON_RUNTIME / ACCEPTED_EXISTING_RISK` | `UNCHANGED` |
| `brace-expansion@5.0.7` | `GHSA-mh99-v99m-4gvg` | `typescript-eslint -> typescript-estree -> minimatch -> brace-expansion`, 7 paths | `>=5.0.8` | `DEV_ONLY_NON_RUNTIME / ACCEPTED_EXISTING_RISK` | `UNCHANGED` |
| `brace-expansion@5.0.7` | `GHSA-rgw5-rvv9-x895` | 동일 `typescript-eslint` toolchain, 7 paths | `>=5.0.9` | `DEV_ONLY_NON_RUNTIME / ACCEPTED_EXISTING_RISK` | `UNCHANGED` |
| `brace-expansion@1.1.16` | `GHSA-rgw5-rvv9-x895` | 동일 ESLint toolchain, 36 paths | `>=1.1.18` | `DEV_ONLY_NON_RUNTIME / ACCEPTED_EXISTING_RISK` | `UNCHANGED` |
| `js-yaml@4.3.1` | `GHSA-2883-xcg3-v3hh` | `eslint -> @eslint/eslintrc -> js-yaml` 및 ESLint transitives, 12 paths | `>=4.3.2` | `DEV_ONLY_NON_RUNTIME / ACCEPTED_EXISTING_RISK` | `UNCHANGED` |

Production/runtime reachability는 `pnpm.cmd audit --prod`의 finding `0`으로 부정된다. 다섯 findings는 [FEAT-022-C Completion](../reviews/FEAT022_C_AI_ADVISORY_RUNTIME_FOUNDATION_COMPLETION.md)과 [FEAT-022 Final Gate](../reviews/FEAT022_FINAL_GATE_REPORT.md)에 기록된 승인 baseline과 동일하다. 신규 미승인 High/Critical은 `0/0`이다.

## Release effect

Fresh Dependency Audit blocker는 `CLOSED`다. 남은 blocker는 `LIVE_AI_PROVIDER_EXECUTION` 외부 account/contract dependency 하나다. 이 audit은 release acceptance를 승인하지 않으므로 `REL-001 INCOMPLETE`, promotion handoff `UNAVAILABLE`, `DEC-162 IN_REVIEW`를 유지한다.

Related: [Finding Disposition](REL001_BLOCKER3_DEPENDENCY_FINDING_DISPOSITION.md), [Completion Report](../reviews/REL001_BLOCKER3_COMPLETION_REPORT.md).
