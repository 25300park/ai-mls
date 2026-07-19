# SP-005 Test Evidence

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 문서 상태 | DRAFT |
| Sprint | SP-005 |
| 검증일 | 2026-07-19 |
| 기준 HEAD | `e9469eafc01dfda7f3bd4b9c1536d545da7140b0` |

## 1. Acceptance trace

| Test ID | 구현 증거 |
|---|---|
| TEST-019 | hard eligibility, deterministic weighted ranking, human shortlist review, no downstream authority |
| TEST-031 | `API-010`, active Requirement/exact revision, eligible cohort 100, top-20 review list, stale lifecycle |
| TEST-038 | `UI-024` role action visibility, accessibility metadata, Contact privacy와 server authorization |
| TEST-043 | deterministic score와 tie order: Hard Match, Budget Fit, latest revision, stable UUID |
| TEST-044 | 기존 `AI-006` bounded search interpretation regression과 `API-010` consumer boundary |
| TEST-045 | `AI-005/007` closed schema, provenance, classification, advisory-only validation |
| TEST-054 | Agent review workspace의 ready/empty/stale state와 keyboard/live-region contract |
| TEST-055 | Manager read-only visibility와 privileged action 비노출 |

SP-005에서 11개 test case를 추가하여 전체 suite가 92개에서 103개로 증가했다. fail, skip과 todo는 0개다.

## 2. Required gates

| 명령 | 결과 |
|---|---|
| `pnpm.cmd lint` | PASS — error/warning 0 |
| `pnpm.cmd typecheck` | PASS — TypeScript strict error 0 |
| `pnpm.cmd test` | PASS — 103/103, fail/skip/todo 0 |
| `pnpm.cmd build` | PASS |
| `pnpm.cmd verify` | PASS — lint/typecheck/test aggregate gate |
| `C:\Tools\gitleaks\gitleaks.exe detect --source . --config .gitleaks.toml --redact` | PASS — Gitleaks 8.30.1, `no leaks found` |
| `pnpm.cmd audit` | PASS — `No known vulnerabilities found` |

`pnpm.cmd audit`의 sandbox 실행은 registry access `EACCES`였고 승인된 network context에서 동일 명령을 재실행해 PASS했다. `gitleaks`는 process `PATH`에 없어 기존 승인 설치 위치의 8.30.1 binary를 절대 경로로 실행했다.

## 3. Trace evidence

| Mapping | Implementation evidence |
|---|---|
| FEAT-011 / DEV-011 / IMP-011 | `modules/matching`, deterministic policy, `API-010`, TEST-019/031/043–045 |
| FEAT-021 / DEV-021 / IMP-021 subset | `UI-024` bounded view contract, role visibility, accessibility regression, TEST-038/054/055 |
| WF-006 | request, eligibility, ranking, review, accepted/rejected, stale history |
| AI-005–007 | existing provider-neutral closed-schema validator 재사용; ranking/state authority 없음 |

## 4. Scope and integrity checks

- frozen Architecture Bible, ADR, DoD와 MDR 변경: 0.
- RTM 변경: SP-005 implementation evidence rows만 추가.
- `.env`, NAS, infrastructure 변경: 0.
- `FEAT-012/013`, `API-011/012`, Verification, Permission, Proposal, Publication source artifact: 0.
- `UI-025` behavior와 `UI-026+` 구현: 0.
- provider/model/prompt/numeric confidence threshold 선택: 0.

## 5. Known limitations

- 저장소의 승인된 방식에 따라 process-local in-memory logical contract이며 production persistence와 multi-process locking을 제공하지 않는다.
- AI provider inference를 실행하지 않고 closed-schema advisory result만 검증한다.
- `FEAT-021`은 Architecture Owner 승인에 따라 `UI-024`로 제한되며 application-wide accessibility program은 포함하지 않는다.
