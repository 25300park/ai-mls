# REL-002 Phase 1G Phase 1E Salvage Classification

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-301 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-09-18 |
| Baseline | `04a9720b248dbd30fe1877b48b448ab35a8d0227` |

## 1. 목적

Phase 1E의 유효 구현을 재사용하고 DEC-169/170/171에 어긋나는 부분만 최소 수정한다. 원본 Phase 1E worktree는 변경하지 않았다.

## 2. 분류

| 구성요소 | 분류 | Phase 1G 처리 |
|---|---|---|
| bounded durable stores의 `REQUIRE_EXISTING` 모드 | REUSE | runtime DDL 없이 prepared schema만 연다 |
| `RegisteredServiceWorkload` / durable read-only store | MODIFY | exact version/fingerprint/structure checker와 evidence adapter를 결속한다 |
| `ProductionServiceIdentityResolver` | MODIFY | 두 evidence reference를 포함한 immutable binding을 만든다 |
| `ProductionRuntimeConfiguration`, startup gate, bootstrap context | REUSE | canonical `startProductionRuntime()` ordering과 cleanup을 유지한다 |
| synthetic five-slot child roots | REMOVE | 실제 API-014/015/018/019/FEAT-022 factory registry로 교체한다 |
| Phase 1E historical completion 문서 | DEFER | historical worktree에 보존하고 Phase 1G evidence로 대체한다 |

## 3. 구현 경계

- Identity/API-016 read ports를 소비하는 `RegisteredServiceWorkloadEvidenceAuthorityAdapter`만 추가했다. canonical authority는 계속 `PARTIAL`이다.
- `WorkloadAuthorizationSubject`는 registration/evidence binding만 포함하며 role/scope/capability는 포함하지 않는다.
- existing `AuthorizationService`의 live assignment/policy engine을 workload 평가에도 재사용한다.
- API-017의 existing `JobExecutionAdmissionPort`에 canonical `job.execute` workload adapter를 연결하고 claim/result-commit 경계에서 live revalidation한다.
- Identity-owned schema contract/version/fingerprint를 exact read-only checker가 검증한다.
- actual root registry는 다섯 factory를 explicit `PRODUCTION` + `REQUIRE_EXISTING`으로 호출하고 `ProductionBootstrapContext`를 요구하며, 5개 준비가 끝난 뒤 host/listener activation을 허용한다.

## 4. 보존 경계

Migration execution, runtime schema creation, public API, role/capability, auth/evidence authority, dependency, credential, provider/network 및 infrastructure 변경은 모두 `0`이다. Phase 2가 migration owner이며 Production schema는 아직 `NOT_READY_PHASE2_REQUIRED`다.
