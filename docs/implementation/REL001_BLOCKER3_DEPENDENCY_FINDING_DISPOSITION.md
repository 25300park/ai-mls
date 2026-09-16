# REL-001 Blocker 3 Dependency Finding Disposition

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-268 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Security Owner / Dependency Owner / Release Owner |
| 기준일 | 2026-09-16 |

## Classification basis

- Production audit Critical/High는 `0/0`이다.
- Full audit High `5`는 모두 direct development dependencies `eslint` 또는 `typescript-eslint` 아래의 transitive toolchain path다.
- production bundle/runtime dependency path는 audit에서 보고되지 않았다.
- 기존 AO 승인 상태는 `brace-expansion` High 4와 `js-yaml` High 1의 `DEVELOPMENT_TOOLCHAIN_ONLY / BOUNDED_ACCEPTED_RISK`다.
- 이 phase에서 dependency remediation, override 또는 lockfile mutation은 승인되지 않았다.

## Finding disposition

| Finding | Runtime reachability | Build/test-only evidence | Existing mitigation | Disposition |
|---|---|---|---|---|
| `brace-expansion` / `GHSA-mh99-v99m-4gvg` / 1.x | production `0` | ESLint toolchain only | untrusted expansion input을 production에서 처리하지 않음; production audit clean | `ACCEPTED_EXISTING_RISK` |
| `brace-expansion` / `GHSA-mh99-v99m-4gvg` / 5.x | production `0` | typescript-eslint toolchain only | 동일 | `ACCEPTED_EXISTING_RISK` |
| `brace-expansion` / `GHSA-rgw5-rvv9-x895` / 5.x | production `0` | typescript-eslint toolchain only | 동일 | `ACCEPTED_EXISTING_RISK` |
| `brace-expansion` / `GHSA-rgw5-rvv9-x895` / 1.x | production `0` | ESLint toolchain only | 동일 | `ACCEPTED_EXISTING_RISK` |
| `js-yaml` / `GHSA-2883-xcg3-v3hh` | production `0` | ESLint configuration toolchain only | application/runtime YAML parsing path가 아님; production audit clean | `ACCEPTED_EXISTING_RISK` |

## Remediation boundary

Patched versions는 존재하지만 upgrade 영향은 ESLint/typescript-eslint dependency tree 및 lockfile 재해석을 요구한다. 이는 Blocker 3 evidence-only 범위 밖이며 별도 Dependency Owner maintenance task로 남긴다. Silent waiver는 없으며 High `5`를 full-audit High `0`으로 표현하지 않는다.

## Decision

| Gate | Result |
|---|---|
| Production Critical / High | `0 / 0` |
| Approved dev-only High | `5` |
| New unapproved High / Critical | `0 / 0` |
| Requires release-blocking remediation | `NO` |
| Dependency/lockfile mutation | `0` |
| Fresh Dependency Audit blocker | `CLOSED` |

Related: [Fresh Audit Report](REL001_BLOCKER3_FRESH_DEPENDENCY_AUDIT_REPORT.md), [FEAT-023 Traceability](FEAT023_TRACEABILITY_MATRIX.md), [FEAT-024 Traceability](FEAT024_TRACEABILITY_MATRIX.md).
