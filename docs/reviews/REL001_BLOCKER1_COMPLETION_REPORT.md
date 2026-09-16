# REL-001 Blocker 1 — Core API-001 / API-002 Transport Completion Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-211 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | API Owner / Security Owner / Quality Owner |
| 기준 commit | `f5d322f2793ffbeaaac765126c7937835c9b501f` |
| 최종 권고 | `APPROVE_REL001_BLOCKER1_CORE_API001002_TRANSPORT_CLOSURE` |

## 1. Objective

REL-001 Staging acceptance에 필요한 API-001 Read Current Principal과 API-002 Evaluate Capability의 bounded HTTP transport만 구현하고 검증한다.

## 2. Documents read

- Book 6 API Principles 및 Authentication API
- Phase 1A closed contract/Session ingress/Host contract
- Phase 1C/1D Session record, resolution 및 traceability
- Phase 1F bound/transport matrices
- Phase 1H~1L preserved decision artifacts (read-only)
- REL-001 Phase 7 및 Staging acceptance evidence

## 3. Files created

- `apps/api/src/core-identity-authorization-http.ts`
- `apps/api/src/core-identity-authorization-composition.ts`
- `apps/api/src/core-identity-authorization-http.test.ts`
- Blocker 1 Gap Matrix, Plan 및 Traceability
- 이 Completion Report

## 4. Files modified

- `modules/identity/src/session-access-coordinator.ts`와 index/test
- Master Index
- Phase 1D 및 REL-001/API-017 traceability

## 5. Key decisions added

- exact routes는 `/v1/me`와 `/v1/authorization-decisions`뿐이다.
- API-002는 `SessionAccessCoordinator.resolveAuthorizedWithDecision()`가 수행한 동일 live decision을 반환한다.
- Current Principal roles/scopes는 live assignment source에서 투영하며 Session snapshot을 authority로 사용하지 않는다.
- approved bounds를 초과한 input/output은 truncate하지 않고 fail closed한다.
- HTTP adapter의 repository/UoW 직접 접근과 API-003~010 route는 0이다.

## 6. Open decisions

새 canonical transport/authority 결정은 없다. changed Production bytes를 binding할 exact candidate rebuild/re-evaluation은 이 bounded implementation commit 이후 별도 단계로 남는다.

## 7. Inconsistencies found

Phase 7 persistence regression은 `sourceCommitSha=cd620b...`와 그 당시 compiled bytes의 exact manifest ID를 고정한다. Blocker 1B Production 변경 후 current `dist`로 같은 historical SHA를 재-materialize하면 fingerprint가 달라져 fail한다. 예상값을 바꾸면 historical commit-to-bytes binding을 위조하므로 변경하지 않았다.

## 8. Validation performed

| Gate | Result |
|---|---|
| Focused Blocker 1B + Phase 1D coordinator | `25/25 PASS` |
| Affected Session/Auth/Phase 5/6 | `85/85 PASS` |
| Changed-file lint | PASS |
| Typecheck | PASS |
| Clean build | PASS |
| Full regression | `1490/1491 PASS` (sequential runner); approved pre-rebuild exact Phase 7 candidate fingerprint assertion 1 FAIL |
| Failed-gate focused rerun | `0/1 PASS`; same exact-candidate fingerprint mismatch reproduced |
| `git diff --check` | PASS |
| Dependency audit | `NOT_RUN` — not authorized |

## 9. Known limitations

- UI-006 live Core data remains Blocker 2 and is not implemented.
- New transport is not yet rebound into a post-change REL-001 exact candidate.
- Historical Phase 7 identity는 immutable하며 새 implementation commit 기준 candidate rebuild/re-evaluation 전까지 stale 상태다.

## 10. Next brief prerequisites

1. 이 승인된 bounded Blocker 1B change set을 정확히 한 commit으로 고정한다.
2. 해당 immutable commit에서 exact candidate를 rebuild/materialize하되 historical Phase 7 evidence는 변경하지 않는다.
3. candidate-bound test 및 후속 release acceptance gate를 새 candidate identity로 재실행한다.
4. UI-006 Blocker 2는 별도 승인 전 시작하지 않는다.

## Final Recommendation

`APPROVE_REL001_BLOCKER1_CORE_API001002_TRANSPORT_CLOSURE`
