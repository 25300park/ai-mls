# Current Main Exact-HEAD Fresh Integrated Validation Retry Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-120 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-09-05 |
| Brief | Current Main Exact-HEAD Fresh Integrated Validation — Retry |

## 1. Objective

Document ID governance remediation 이후의 정확한 local `main` source HEAD를 변경 없이 fresh 통합 검증했다. 이 보고서는 Architecture Owner baseline 승인 후보의 실행 증거이며 Production 구현, dependency, lockfile, frozen Feature identity 또는 기존 architecture authority를 변경하지 않는다.

## 2. Documents read

- [Current Main Document ID Governance Remediation Report](CURRENT_MAIN_DOCUMENT_ID_GOVERNANCE_REMEDIATION_REPORT.md)
- [Canonical FEAT-016 to FEAT-020 Governance Alignment Report](CANONICAL_FEAT_016_TO_020_GOVERNANCE_ALIGNMENT_REPORT.md)
- [Canonical Traceability Matrix](../00_CANONICAL_TRACEABILITY_MATRIX.md)
- [Master Index](../00_MASTER_INDEX.md)
- [Document ID Rule](../00_DOCUMENT_ID_RULE.md)
- [Architecture v1.1 Baseline Manifest](../freeze/ARCHITECTURE_V1_1_BASELINE_MANIFEST.md)

## 3. Exact baseline and Git integrity

| Evidence | Result |
|---|---|
| Branch | `main` — PASS |
| Validated source HEAD | `e69e3cd8255fc62bf8f35b1662682bba93bdb0ff` |
| `origin/main` | `5d9e945b2aacfd11e6eeb46a32fb6e4c519fc157` |
| Merge base | `5d9e945b2aacfd11e6eeb46a32fb6e4c519fc157` — PASS |
| Source ahead count | `32` |
| Required commits contained | `a657679eeaf5b92ac95173f86a2c5460ff98d813`, `b6d09e70be62b2e55693471ae97b3a2f3c26df5f`, `e69e3cd8255fc62bf8f35b1662682bba93bdb0ff` — PASS |
| Initial working tree | clean |
| Unresolved merge/conflict markers | `0` |
| History direction | forward continuation of `origin/main` — PASS |

Validation Evidence Commit과 Candidate Baseline HEAD는 본 보고서와 필수 index/version evidence를 포함하는 단일 local commit이다. 자기 참조 hash는 문서 본문에 고정하지 않으며 `git log -1`로 식별한다. Architecture Owner Baseline Approval은 `PENDING`이다.

## 4. Governance, Document ID and traceability

| Validation | Fresh result |
|---|---|
| Markdown documents inventoried | `474` |
| Primary Document IDs | `385` |
| Invalid required Document IDs | `0` — PASS |
| Unregistered required canonical IDs | `0` — PASS |
| Duplicate primary Document IDs | `0` — PASS |
| Master Index ID/path mismatches | `0` across `754` linked ID rows — PASS |
| `DOC-DEV-018/019/020` | all REGISTERED |
| Historical Artifact ID metadata | `29` preserved rows |
| Local relative Markdown links | `4,119` checked; broken `0` — PASS |
| Frozen Feature identity | PASS — `TRACE-016–020` meanings preserved |
| Execution-wave attribution | PASS — `DEC-115` / `CR-027` model preserved |
| Feature/Implementation overlays | PASS — no unrelated whole-Feature completion claim |
| Canonical traceability | ALIGNED |

No unresolved canonical attribution conflict, unregistered required document, duplicate canonical registry entry, or FEAT-021 implementation claim was found.

## 5. Architecture checksum and CR-027 delta

The immutable content commit `426f6de0cdcf8c384f70c3e333f7b6483616bd15` produced `153/153` sorted path/blob entries and SHA-256 `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` — PASS.

Current HEAD matched `149/153`; the exact four approved deltas were:

- `docs/00_API_REGISTRY.md`
- `docs/00_CANONICAL_TRACEABILITY_MATRIX.md`
- `docs/00_DECISION_REGISTER.md`
- `docs/00_EVENT_REGISTRY.md`

This list exactly matches the recorded `CR-027` boundary. Additional architecture-scope delta is `0`; immutable checksum evidence was not rewritten.

## 6. Toolchain, install and dependency integrity

| Gate | Result |
|---|---|
| Node | `v24.18.0` — PASS |
| pnpm | `11.9.0` — PASS |
| `pnpm exec node` | `v24.18.0` — PASS |
| `pnpm.cmd install --frozen-lockfile --offline` | exit `0`; already up to date — PASS |
| `package.json` SHA-256 before/after | `666e5cba934be459d0bc0c43635b05a39d33162fe02d0550927f7f706871f9b9` unchanged |
| `pnpm-lock.yaml` SHA-256 before/after | `245e7a25e2b2d4939bf2da84115061e0baf9997d1c5d175f6a32d58f94c22a11` unchanged |
| Dependency/lockfile changes | `0` |

## 7. Fresh executable verification

| Command / scope | Result |
|---|---|
| `pnpm.cmd test` | exit `0`; `982/982` PASS; fail/skipped/todo `0` |
| `pnpm.cmd lint` | exit `0` — PASS |
| `pnpm.cmd typecheck` | exit `0` — PASS |
| `pnpm.cmd build` | exit `0` — PASS |
| `pnpm.cmd verify` | exit `0`; `982/982` PASS — PASS |
| Focused cross-layer integration | `246/246` PASS |

The focused set exercised Administration production composition and durable persistence, API-014/015/018/019 HTTP paths, Publication durable execution/retry/authorization, Connector restart/idempotency/ambiguity, Recovery durable orchestration, Console bounded reads, security events and privacy controls.

## 8. Integrated architecture and security results

| Area | Result |
|---|---|
| FEAT-016 Administration / API-015 / UI-006 / UI-036 | PASS |
| Durable Administration UoW and production composition | PASS |
| Publication API-014 runtime, durable execution and provider isolation | PASS |
| Source / Connector API-018 restart and ambiguity containment | PASS |
| API-019 external evidence and Recovery/Reconciliation | PASS |
| Operations Console bounded read projections | PASS; operational mutation controls `0` |
| Session-derived Actor and live Role authority | PASS |
| SoD, MFA/assurance and two-person governance | PASS |
| Tenant/scope/purpose isolation and concealment | PASS |
| Optimistic concurrency and durable idempotency | PASS |
| Append-only decision/audit/evidence | PASS |
| Source Governance → Source Execution shortcut | `0` |
| Publication Target Governance → Publication Execution shortcut | `0` |
| Operations/Evidence Console mutation paths | `0` |
| Duplicate authoritative Administration/Publication/Connector path | `0` |
| Console → Repository and HTTP → DB shortcuts | `0` |

The exact-head tests confirm proposal records do not hydrate authority, revoked authority remains revoked after durable persistence/recomposition, and Production has no silent in-memory Administration fallback.

## 9. Gitleaks and dependency audits

| Gate | Result |
|---|---|
| Current candidate tree Gitleaks (`--no-git --redact`) | exit `0`; findings `0` |
| Production audit | exit `0`; known vulnerabilities `0`; High `0`; Critical `0` |
| Full audit | exit `1`; High `4`, Critical/Moderate/Low `0` |
| New unapproved High/Critical | `0` |

Full audit findings are the unchanged, previously approved development-only transitive baseline:

| Advisory | Package path family | Severity | Classification |
|---|---|---|---|
| `GHSA-mh99-v99m-4gvg` | `eslint → minimatch → brace-expansion@1.1.16` (`36` paths) | High | previously approved; development-only transitive |
| `GHSA-mh99-v99m-4gvg` | `typescript-eslint → typescript-estree → minimatch → brace-expansion@5.0.7` (`7` paths) | High | previously approved; development-only transitive |
| `GHSA-rgw5-rvv9-x895` | same ESLint `1.x` family (`36` paths) | High | previously approved; development-only transitive |
| `GHSA-rgw5-rvv9-x895` | same typescript-eslint `5.x` family (`7` paths) | High | previously approved; development-only transitive |

No dependency remediation was performed.

## 10. Browser acceptance, security and visual sanity

`pnpm.cmd console:dev` launched `http://127.0.0.1:4173`. Actual browser acceptance passed `13/13`:

1. Dashboard
2. Administration Overview / UI-006
3. Role & Policy Administration / UI-036
4. Publication Operations
5. Publication Revalidation
6. Publication Recovery
7. Publication Audit / History
8. Connector Operations
9. Recovery Cases
10. External Integration Evidence
11. Audit Evidence
12. Projection Status
13. Operations / Health

All routes rendered the expected heading and explicit safe state. Browser-visible forbidden strings for secrets, tokens, Session identifiers, authorization headers, stack traces, filesystem/package paths and raw evidence were `0`; browser warning/error logs were `0`; unsupported form/input/button mutation controls were `0`. UI-036 remained separately labeled `BACKEND AUTHORIZED` and returned a canonical unavailable state when governed selectors were absent.

Desktop `1280×800` and narrow `390×844` checks found horizontal overflow `0`, intact navigation/page shell, single-column narrow content, readable status text, no overlapping controls and a coherent Intranet Console visual system — PASS.

## 11. Independent integrated review

One fresh independent review inspected the exact HEAD after automated, security and browser gates:

- Critical: `0`
- Important: `0`
- Minor: `0`
- Readiness: `READY`

The review independently confirmed durable Administration production composition/live authority, Publication and Connector revalidation/isolation, immutable Recovery identity/evidence, API-018 internal checkpoint control, exact closed Recovery surface, server-derived Console identity and bounded API-014/016/018/019/F19 reads. No contradiction with fresh executable evidence was found.

## 12. Files created

- `docs/reviews/CURRENT_MAIN_EXACT_HEAD_FRESH_INTEGRATED_VALIDATION_RETRY_REPORT.md` — exact-head retry gate evidence.

## 13. Files modified

- `docs/00_MASTER_INDEX.md` — `DOC-REVIEW-120` registration and navigation.
- `docs/00_VERSION_HISTORY.md` — validation evidence version entry.

Production source, dependency manifests and lockfiles: `None`.

## 14. Key decisions added

None. This validation preserves `DEC-115`, `CR-027`, `DT-115`, frozen identity and existing execution-wave attribution.

## 15. Open decisions

- **OPEN DECISION:** Architecture Owner must approve or reject the new Candidate Baseline HEAD before any push.
- **OPEN DECISION:** Dependency Owner retains timing authority for the four approved development-only transitive `brace-expansion` High findings.

## 16. Inconsistencies found

None found across the exact-head Git, governance, Document ID, traceability, architecture, runtime, security and browser scope.

## 17. Validation performed

| Validation | Result |
|---|---|
| Git integrity | PASS |
| Governance alignment / frozen identity | PASS |
| Document IDs / Master Index / links | PASS |
| Architecture checksum / CR-027 delta | PASS |
| Toolchain / frozen install | PASS |
| Full regression / lint / typecheck / build / verify | PASS |
| Cross-layer integration / security / persistence | PASS |
| Gitleaks / audits | PASS under approved risk baseline |
| Browser acceptance / security / visual sanity | PASS |
| Independent review | Critical `0` / Important `0` / Minor `0` — READY |
| Production code changes | `0` |
| Dependency/lockfile changes | `0` |

## 18. Known limitations

- Architecture Owner Baseline Approval remains `PENDING`.
- Local `main` remains ahead of `origin/main`; push is separately authorized and was not performed.
- The four existing development-only transitive High advisories remain accepted but unresolved.
- FEAT-021 was not started.

## 19. Next brief prerequisites

Architecture Owner reviews this exact-head retry evidence and explicitly authorizes the current-main candidate baseline before any push or FEAT-021 work.

## Completion statement

Final Recommendation: `APPROVE_CURRENT_MAIN_EXACT_HEAD_FRESH_INTEGRATED_VALIDATION_RETRY`.

Validated Source HEAD: `e69e3cd8255fc62bf8f35b1662682bba93bdb0ff`.

Architecture Owner Baseline Approval: `PENDING`.

Push: `NOT_PUSHED`.

FEAT-021: `NOT_STARTED`.

Next Recommended Step: `ARCHITECTURE OWNER CURRENT-MAIN BASELINE APPROVAL`.
