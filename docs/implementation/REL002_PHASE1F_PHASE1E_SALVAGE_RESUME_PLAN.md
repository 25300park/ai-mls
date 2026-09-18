# REL-002 Phase 1F Phase 1E Salvage / Resume Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-299 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-09-18 |
| Baseline | `3c2a03ac6787b0323846da6bfa2d3e52c72cc069` |
| Source evidence | Phase 1E uncommitted isolated worktree; independent review BLOCK |

## 1. 목적

Phase 1E의 검증된 부분을 보존하면서 Critical/Important review findings를 최소 변경으로 닫는 실행 순서를 정의한다. 이 문서는 구현 승인이 아니다.

## 2. Salvage matrix

| Phase 1E item | Disposition | 이유 |
|---|---|---|
| `RegisteredServiceWorkload` record/decoder | REUSE WITH BOUNDED CHANGE | exact identity/lifecycle binding 기반은 유효 |
| durable workload store | MODIFY | canonical evidence adapter와 strict schema contract 필요 |
| `ProductionServiceIdentityResolver` | REUSE/MODIFY | registration-only proof 유효; live auth adapter 연결 필요 |
| bootstrap ordering/context/cleanup | REUSE/MODIFY | gate ordering 유효; actual roots를 지배하지 못함 |
| synthetic five child slots | REMOVE AS CANONICAL EVIDENCE | 실제 root governance 증거가 아님 |
| root persistence `REQUIRE_EXISTING` modes | REUSE | actual builders에서 강제해야 함 |
| SQL fragment compatibility check | REPLACE | versioned exact contract 필요 |
| bootstrap-only authorization | MODIFY/BLOCKED | human Session path 재사용; service/job/worker에는 approved non-Session workload-subject contract 필요 |
| Phase 1E tests | REUSE + AMEND | synthetic success를 actual-root/context/schema/evidence tests로 교체 |

## 3. Resume prerequisites

1. DEC-169-approved evidence binding/read-only API-016 query와 evidence-backed workload authorization subject에 필요한 authority ports가 구현된다.
2. DEC-170-approved actual root governance가 구현된다.
3. DEC-171-approved schema contract/version authority가 구현되고 Phase 2 migration handoff가 명확하다.
4. 기존 AuthorizationService action/resource/purpose와 live assignment policy로 모든 실행 경계를 표현할 수 있음이 확인된다. Service `SessionContext`를 fabricate하지 않으며, 새 capability가 필요하면 STOP한다.
5. Phase 1E dirty worktree의 20-file evidence를 보존하고 별도 승인 없이 reset/rewrite하지 않는다.

## 4. Bounded implementation order

1. RED: forged/missing/mismatched evidence refs가 통과하는 결함
2. evidence adapter 최소 구현
3. RED: incompatible schema/version/index/constraint가 통과하는 결함
4. strict read-only schema checker 최소 구현
5. RED: five actual roots가 context 없이 구성되거나 gate 전 start되는 결함
6. closed actual-root registry 및 prepare/start 분리
7. RED: revoked workload/assignment가 request/job/worker side effect를 수행하는 결함
8. live revalidation adapter wiring
9. Phase 1E focused → affected → full regression → independent review

## 5. Completion gate

- Evidence authority binding: PASS
- Actual roots governed: `5/5`
- Gate 이전 Session UoW/schema mutation/listener/worker/provider: `0`
- Live authorization at every execution boundary: PASS
- Strict schema compatibility: PASS
- Production schema/migration execution by Phase 1: `0`
- new API/role/capability/auth authority: `0`
- Gap 004/005/006: fresh evidence 없이는 계속 BLOCKING

Phase 1E resume는 별도 implementation authorization 이후에만 가능하다. DEC-169~171 approval은 구현 완료나 gap closure를 의미하지 않는다.
