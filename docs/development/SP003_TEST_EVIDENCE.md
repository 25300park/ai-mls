# SP-003 Test Evidence

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 문서 상태 | DRAFT |
| Sprint | SP-003 |
| 검증일 | 2026-07-19 |
| 기준 HEAD | `2c16f839db38be830e8478856dfe940049a7b68f` |

## Acceptance trace

| Test ID | 구현 증거 |
|---|---|
| TEST-007 | AI envelope의 authority/mutation field를 거부하고 domain write와 분리 |
| TEST-010 | Candidate/Offer authority를 `CANDIDATE`/`CANDIDATE_CLAIM`으로 제한하고 Verification/Publication field 미생성 |
| TEST-013 | confidence band별 deterministic human/manual route와 append-only AIR review |
| TEST-017 | AI duplicate suggestion 무효과, DUR human disposition, senior merge guard, evidence/history 보존 |
| TEST-028 | API-005/006 session actor, optimistic concurrency, stable error, idempotency replay/conflict |
| TEST-039 | AI-001 listing parser closed schema와 provenance |
| TEST-040 | AI-002 ambiguity/no-match와 canonical mutation 금지 |
| TEST-041 | AI-003 duplicate relationship/recommendation contract |
| TEST-042 | AI-004 requirement parser advisory schema only |
| TEST-043 | AI-005 hard-constraint outcome와 explanation schema only |
| TEST-044 | AI-006 allowlisted search intent/result class와 deterministic Property search |
| TEST-045 | AI-007 confidence/schema/hallucination/classification/evidence validation |

SP-003에서 17개 test case를 추가하여 repository 전체 test는 59개에서 76개가 되었다.

## Required gates

| 명령 | 결과 |
|---|---|
| `pnpm.cmd lint` | PASS — warning/error 0 |
| `pnpm.cmd typecheck` | PASS — TypeScript strict error 0 |
| `pnpm.cmd test` | PASS — 76/76, fail 0 |
| `pnpm.cmd build` | PASS |
| `pnpm.cmd verify` | PASS — lint/typecheck/test aggregate gate |
| `C:\Tools\gitleaks\gitleaks.exe detect --source . --config .gitleaks.toml --redact` | PASS — Gitleaks 8.30.1, `no leaks found` |
| `pnpm.cmd audit` | PASS — `No known vulnerabilities found` |

`gitleaks`가 process `PATH`에 없어서 승인된 설치 위치의 동일 8.30.1 binary를 절대 경로로 실행했다. `pnpm audit`의 sandbox 실행은 registry access `EACCES`였고 승인된 network context에서 동일 명령을 재실행해 PASS했다.

## Scope and integrity checks

- `git diff --check`: PASS
- frozen Architecture Bible changes: 0
- `.env` changes: 0
- NAS configuration changes: 0
- production DB/queue/storage/framework/provider/model/threshold selection: 0
- SP-004 source artifact: 0
