# REL-001 Phase 5A Console Screen Runtime Mapping

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-223 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | UI/UX Owner / Administration Owner |

## 1. Canonical screen disposition

FEAT-021의 `37 canonical / 6 eligible / 30 dependency-blocked / 1 POST-MVP`를 보존한다. REL-001 Staging Console required set은 기존 eligible six뿐이다. UI-001 Sign In은 approved ingress가 Session identifier를 발급하는 외부 prerequisite이며 이 Console process에 새 login/token UI를 만들지 않는다. UI-034는 supporting status가 존재해도 canonical screen 구현 evidence가 아니므로 계속 blocked다.

| Screen | Route | 목적 | R/W | 역할/권한 | Backing boundary | 현재 구현 | Staging readiness | Provider dependency | blocker |
|---|---|---|---|---|---|---|---|---|---|
| UI-006 | `/administration` | Administrator overview | R | ADM, SEC; scoped privileged read | API-015 및 supporting API-016~019 | `PARTIAL`/eligible | `BLOCKED` | 없음 | Staging composition/session/ports |
| UI-031 | `/publication/operations` | Publication operations status | R | OPS, PUA, MGR, SEC; live scope | API-014/018/019 | `EXECUTABLE` read | `BLOCKED` | real provider 불필요 | Staging composition/session/ports |
| UI-032 | `/publication/revalidation` | expiration/reverification status | R | AGT, SAG, VER, PMR, OPS, SEC | API-014 supporting read; API-011/012 dependencies remain bounded | `PARTIAL`/eligible | `BLOCKED` | 없음 | Staging composition/session/ports; unavailable subdata preserved |
| UI-033 | `/publication/recovery` | exception/reconciliation status | R | OPS, SEC, ADM | API-014/016~019 | `PARTIAL`/eligible | `BLOCKED` | live provider 불필요 | Staging composition/session/ports |
| UI-035 | `/publication/audit` | safe audit/history | R | SEC, ADM, limited MGR; `audit.query` | API-016 with API-014 support | `EXECUTABLE` read | `BLOCKED` | 없음 | scoped durable API-016 read composition |
| UI-036 | `/administration/governance` | controlled administration | controlled R/W | ADM, SEC; backend MFA/SoD/version/idempotency | API-015/016 | `EXECUTABLE` controlled | `BLOCKED` | 없음 | Staging composition/session/API-015 origin |

## 2. Supporting routes

기존 13 route 중 canonical primary screen에 직접 매핑되지 않는 `/`, `/system/projection`, `/system/operations`, `/connector/operations`, `/recovery/cases`, `/integration/evidence`, `/audit/evidence`는 supporting view다. 새 screen identity가 아니며 Phase 5 구현은 기존 route를 보존한다.

## 3. Excluded canonical screens

| Screen | 상태 | 이유 | Phase 5 action |
|---|---|---|---|
| UI-001 | external ingress prerequisite | Session issuance/login semantics는 현재 Console bootstrap 범위 밖 | 새 auth UI 없음; `x-session-id` ingress만 소비 |
| UI-034 | `DEPENDENCY_BLOCKED` | scoped Job collection/read screen contract와 screen evidence가 없음 | `/system/operations`에서 기존 safe readiness만 표시; screen 승격 금지 |
| UI-013 | `DEPENDENCY_BLOCKED` | AI human-review screen lifecycle은 FEAT-021/022 current eligible set 밖 | provider-independent status만 supporting view에 표시 |
| UI-037 | `DEPENDENCY_BLOCKED` | notification projection/screen 없음 | 구현 안 함 |
| UI-007 | `POST_MVP` | frozen disposition | 구현 안 함 |
| 기타 27 | `DEPENDENCY_BLOCKED` | owning backend/workflow 미완료 | Phase 5에서 강제 활성화 안 함 |

## 4. Exact counts

| Metric | Count |
|---|---:|
| Canonical screens | 37 |
| REL-001 required Console screens | 6 |
| Existing eligible/executable screen surfaces | 6/6 |
| Staging-executable screen surfaces | 0/6 |
| Staging bootstrap-blocked required screens | 6/6 |
| Dependency-blocked canonical screens preserved | 30 |
| POST-MVP screens preserved | 1 |
| New screen IDs/routes | 0/0 |

관련 문서: [FEAT-021 RTM](FEAT021_TRACEABILITY_MATRIX.md), [Inventory](REL001_PHASE5A_ADMIN_CONSOLE_STAGING_INVENTORY.md).
