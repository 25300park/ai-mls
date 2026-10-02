# REL-002 R3-C1 Organization / Project / Workload Binding Persistence Completion Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-264 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner |
| 완료일 | 2026-10-02 |
| Brief | REL-002 R3-C1 — Organization / Project / Workload Binding Schema + Migration + ACL |
| 기준 Main | `d7731a9801afa06bc3956b9991e5de4a8513d382` |

## 1. Objective

R3-C0의 세 canonical record를 각 authority 소유 schema에 versioned persistence로 구현했다. Organization은 신규 `app_organization`, Project는 `app_administration`, Workload binding은 `app_identity`에 배치했다. Runtime resolver, listener, worker, 배포는 활성화하지 않았다.

## 2. Documents read

- Human/AO `APPROVE_NEW_SCHEMA_APP_ORGANIZATION` 결정과 R3-C1 실행 brief
- [R3-C0 Contract](../implementation/REL002_R3C0_WORKLOAD_BINDING_CONTRACT.md)
- [ADR-007](../adr/ADR-007-R3C1-WORKLOAD-BINDING-PERSISTENCE.md)
- [Implementation Plan](../implementation/REL002_R3C1_IMPLEMENTATION_PLAN.md)
- Repository `AGENTS.md`, document governance, glossary, completion template

## 3. Files created

- Organization, Project, Workload binding의 contract/store 모듈
- 세 개의 forward-only PostgreSQL up migration, SHA-256 sidecar, 반복 가능한 verifier
- R3-C1 aggregate readiness와 값/contract/adapter/readiness/disposable PostgreSQL 테스트
- ADR-007, implementation plan, 이 completion report

## 4. Files modified

- [Decision Register](../00_DECISION_REGISTER.md): DEC-200 추가
- [Master Index](../00_MASTER_INDEX.md): ADR/plan/completion 등록
- R3-C1 store 테스트: exact replay, atomic replacement, reference outage, migration-role membership drift 회귀 보강

## 5. Key decisions added

Organization Data Steward의 물리적 persistence boundary는 `app_organization`이다. Project와 Binding은 각각 Administration/Identity schema에 남는다. Project→Organization 및 Binding→Organization/Project/Scope는 logical pinned reference이고, Binding→RegisteredServiceWorkload만 동일 Identity authority 안의 physical FK다. Scope는 `TEAM/POLICY/SOURCE/TARGET`만 허용하며 generic Scope entity를 만들지 않았다.

## 6. Open decisions

없음. Human/AO가 `APPROVE_REL002_R3C1_BINDING_SCHEMA_MIGRATION_ACL`로 R3-C1 closeout을 승인했다. Runtime startup resolver 연결, listener/workers 활성화, Production migration/deploy는 후속 별도 승인 대상이다.

## 7. Inconsistencies found

독립 리뷰에서 migration operator role에 대한 membership 검사가 불완전하고 exact replay가 외부 reference 검증보다 뒤에 있는 결함을 발견했다. TDD 회귀를 추가하고 세 verifier/readiness가 보호 역할의 모든 membership을 거부하도록 변경했으며, store는 read-only replay/conflict 판별 후 외부 검증과 transaction 잠금/CAS를 수행하도록 수정했다.

Full regression의 단일 실패는 기존 immutable historical release-candidate fingerprint 기대값 불일치다. R3-C1 파일이나 동작과 무관하며 brief가 금지한 historical fingerprint refresh/완화는 수행하지 않았다.

## 8. Validation performed

| 검사 | 결과 |
|---|---|
| Focused | 13/13 PASS |
| Disposable PostgreSQL | 9/9 PASS |
| Affected | 59/59 PASS |
| Full regression | 1720 PASS / 1 known unrelated immutable historical fingerprint failure / 14 SKIP |
| Build / Lint / Typecheck | PASS / PASS / PASS |
| Migration SHA-256 | 3/3 sidecar exact match |
| git diff --check / trailing whitespace | PASS / 0 |
| Secret scan | changed scope PASS; repository-wide scan reported 32 pre-existing findings and was not used to claim clean history |
| Independent review | PASS; membership/replay hardening 재검토에서 remaining finding 없음 |

## 9. Known limitations

검증 대상은 전용 disposable PostgreSQL이다. Production readiness와 deployability는 BLOCKED다. 기존 R3-B aggregate schema fingerprint는 이 additive schema 확장을 자동 승인하지 않는다. Runtime resolver activation, Production/Railway/Supabase mutation은 모두 0이다. Commit과 push는 수행하지 않았다.

## 10. Next brief prerequisites

다음 gate는 별도 승인 전 `REL-002 R3-D runtime startup resolver activation` 준비 상태로만 둔다. 후속 단계도 세 authority owner, exact version proof, default-deny readiness 및 별도 Production gate를 보존해야 한다.

최종 recommendation: **APPROVE_REL002_R3C1_BINDING_SCHEMA_MIGRATION_ACL**.
