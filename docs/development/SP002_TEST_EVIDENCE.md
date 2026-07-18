# SP-002 Test Evidence

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 문서 상태 | DRAFT |
| Sprint | SP-002 |
| 검증 일자 | 2026-07-19 |
| 기준 commit | `7c122fd` |
| Feature | FEAT-004, FEAT-005, FEAT-018 |
| Developer Task | DEV-004, DEV-005, DEV-018 |
| Implementation ID | IMP-004, IMP-005, IMP-018 |
| Test | TEST-004, TEST-014–016, TEST-027, TEST-035, TEST-036, TEST-039, TEST-040 |

이 문서는 [SP-002 Implementation Plan](SP002_IMPLEMENTATION_PLAN.md)의 실행 증거이며 완료 판정은 [SP-002 Completion Report](../reviews/SP-002_COMPLETION.md)에 기록한다.

## 1. 검증 환경

| 도구 | 검증 버전 |
|---|---|
| Node.js | 24.18.0 |
| TypeScript | 6.0.3 |
| pnpm | 11.9.0 |
| npm | 11.16.0 |
| typescript-eslint | 8.64.0 |
| Gitleaks | 8.30.1 |

Docker, database, queue, HTTP framework와 AI provider는 SP-002 검증에 필요하지 않았다.

## 2. Test-first 실행 증거

| 영역 | RED 증거 | GREEN 증거 | 연결 Test |
|---|---|---|---|
| Authorization | 새 action이 `CAPABILITY_DENIED` | scoped read/write/job control과 human-only review 통과 | TEST-027/035/036 |
| Source/Raw evidence | module missing compile failure | active policy, immutable protected evidence, stale/method rejection 통과 | TEST-014/027/036 |
| Background job | module missing compile failure; queued audit outcome mismatch | idempotency, lifecycle, deadline, cancel, successor retry, immutable System Error 통과 | TEST-016/035 |
| AI result validation | module missing compile failure | AI-001/002 closed schema, evidence/version, confidence, prohibited authority 검증 통과 | TEST-039/040 |
| Intake | module missing compile failure | Raw Source/Attachment provenance, validation/quarantine, AI success/failure routing, candidate handoff 통과 | TEST-004/015/016/036 |
| API boundary | adapter missing compile failure; stable domain code mismatch | session-derived actor, API-003/004/017 translation, safe error envelope 통과 | TEST-026/027/035 |

최종 suite는 기존 SP-001 30개 regression과 SP-002 신규 29개를 합한 59개 test다.

## 3. Trace coverage

| Delivery slice | 구현 artifact | 검증 |
|---|---|---|
| FEAT-004 · DEV-004 · IMP-004 | `modules/source`, API-003 adapter | TEST-014/027/036 |
| FEAT-005 · DEV-005 · IMP-005 | `modules/intake`, AI-001/002 validator, API-004 adapter | TEST-004/015/016/027/039/040 |
| FEAT-018 · DEV-018 · IMP-018 | `modules/jobs`, API-017 adapter | TEST-016/035/039/040 |

Workflow evidence는 WF-001 discovery, WF-002 intake, WF-003 AI processing과 provider-neutral job control에 의한 WF-006/010–012 foundation을 포함한다. SP-003 domain object나 connector는 생성하지 않았다.

## 4. 최종 명령과 결과

| 명령 | 결과 |
|---|---|
| `pnpm.cmd lint` | PASS — error/warning 0 |
| `pnpm.cmd typecheck` | PASS — strict TypeScript error 0 |
| `pnpm.cmd test` | PASS — 59/59 |
| `pnpm.cmd build` | PASS |
| `pnpm.cmd verify` | PASS — repository aggregate gate |
| `pnpm.cmd audit --audit-level high` | PASS — known vulnerability 0 |
| `gitleaks detect --source . --config .gitleaks.toml --redact --no-banner` | PASS — actual secret 0, unexplained finding 0 |
| frozen/environment/NAS scope 및 `git diff --check` | PASS — 변경/오류 0 |

## 5. Security evidence

- actor는 request body가 아니라 SP-001 bounded session에서 도출한다.
- source/intake/job operation은 active assignment, resource/team/purpose scope와 canonical action을 검사한다.
- service principal은 bounded capture/job execution만 수행하고 human intake review는 수행하지 못한다.
- raw payload는 저장·audit하지 않고 protected reference, version, fingerprint, classification과 retention metadata만 보존한다.
- combined source/attachment/job data는 최고 classification을 상속한다.
- AI output은 reference/version/checksum, closed schema와 prohibited authority field를 검증하고 실패 시 manual fallback으로 격리한다.
- queued/retry submission audit outcome은 `ACCEPTED`이며 business completion으로 표현하지 않는다.

## 6. 범위와 한계

- 구현은 framework-neutral TypeScript contract와 process-local in-memory adapter다.
- physical database, queue, object storage, HTTP route, AI provider/model/prompt와 numeric threshold는 `OPEN DECISION`이다.
- Candidate Listing은 SP-003 구현을 선행하지 않고 `CandidateDraftPort` handoff reference만 사용한다.
- connector/scraping, publication과 external integration은 구현하지 않았다.

## 7. Rollback

SP-002 기준점은 `7c122fd`이다. rollback은 SP-002 completion commit 전체를 별도 revert하며 persistence/config migration, `.env` 또는 NAS 복구 작업은 필요하지 않다.
