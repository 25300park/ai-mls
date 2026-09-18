# REL-002 Phase 1F Live Authorization Revalidation Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-296 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security / Authorization Owner |
| 기준일 | 2026-09-18 |
| Decisions | DEC-165, DEC-166, DEC-168, DEC-169 (`APPROVED`) |
| Baseline | `3c2a03ac6787b0323846da6bfa2d3e52c72cc069` |

## 1. Authority boundary

Identity proof와 execution authorization을 분리한다.

- `ProductionServiceIdentityResolver`: registration/lifecycle/tenant/principal/workload assurance proof
- existing Administration-backed `AuthorizationService`: 현재 RoleAssignment/Role/Decision에 기반한 authorization authority
- `SessionAccessCoordinator`: human/request Session ingress 및 live revalidation

새 role, capability, authorization registry 또는 generic `runtime.start` 권한을 추가하지 않는다.

### 1.1 Existing service-session authority 판정

`SERVICE_WORKLOAD_SESSION_AUTHORITY = NOT_FOUND`다. 현재 `AuthorizationService.evaluate()`는 active/expiry/authentication timestamps, family/reference, assurance 및 MFA를 포함한 완전한 `SessionContext`를 요구한다. `RegisteredServiceWorkload`는 이 access-continuity 사실을 소유하지 않으며, repository에는 job/worker를 위한 canonical service Session issuance/resolution path가 없다.

따라서 registration으로 synthetic `SessionContext`를 만들거나 caller timestamp/MFA/session 값을 채워 `evaluate()`를 호출하는 것은 금지한다. Human request의 existing `SessionAccessCoordinator` 경로만 현재 완전하게 재사용 가능하다.

## 2. Service workload revalidation sequence

제안하는 `ProductionWorkloadAuthorizationAdapter`는 composition-only adapter로 다음 순서를 강제한다.

1. trusted `registrationId`로 authoritative registration을 다시 조회한다.
2. `ACTIVE`, `SERVICE`, `WORKLOAD`, tenant/principal/version binding을 검증한다.
3. caller가 제공한 tenant/principal/role/scope를 폐기한다.
4. actual operation의 기존 action/resource/purpose를 사용해 existing authorization policy/live-assignment engine을 호출한다.
5. `ALLOW`일 때만 bounded operation을 진행한다.

Registration proof는 RBAC/scopes를 소유하지 않으며, authorization decision은 registration을 활성화하거나 갱신하지 않는다.

서비스 workload에는 `SessionContext` 대신 DEC-169-approved evidence-backed `WorkloadAuthorizationSubject`를 사용한다. Subject는 registration에서 얻은 `registrationId`, `registrationVersion`, `tenantId`, `principalId`, `SERVICE`, `WORKLOAD` 및 verified evidence references만 포함한다. 기존 `LiveAssignmentResolver`, policy evaluation, action/resource/purpose, audit obligations를 그대로 사용한다. 이 contract는 새 authority가 아니다.

Canonical service Session issuance/resolution contract는 여전히 존재하지 않으며 만들지 않는다. DEC-169 implementation 전에는 service/job/worker revalidation을 수행할 수 없으므로 Phase 1E는 BLOCKED다.

## 3. 실행 경계별 재검증

| 경계 | 필수 재검증 시점 | cache 규칙 |
|---|---|---|
| Production bootstrap | identity/evidence authority availability와 configured registrations 검증 | business execution 권한으로 재사용 금지 |
| Human/API request | 매 request에서 `SessionAccessCoordinator`, 이후 실제 operation authorization | request 간 reuse 금지 |
| One-shot Job | approved `WorkloadAuthorizationSubject` contract로 claim 전, handler side effect/commit 직전 | work unit 밖 cache 금지 |
| Long-running worker | approved workload-subject contract로 각 claim 전, 각 authoritative side effect/commit 직전 | startup decision reuse 금지 |
| Provider-capable call | 별도 activation 승인 후, provider call 직전 | 현재 provider hold 동안 execution 0 |

Registration version/lifecycle 변경, RoleAssignment 철회, MFA/purpose 조건 실패, authority unavailable은 fail closed다. 실패는 listener/worker 전체의 authority를 확대하지 않으며 automatic retry/recovery를 유발하지 않는다.

## 4. Concurrency and TOCTOU

- identity resolution 결과에 `registrationVersion`을 포함한다.
- side effect 직전 동일 registration version과 live authorization을 다시 검증한다.
- revocation과 concurrent execution이 경합하면 stale execution이 성공하지 못해야 한다.
- authorization 결과를 durable business authority나 `ProductionBootstrapContext`에 저장하지 않는다.
- audit evidence에는 decision provenance reference만 기록하며 secret, raw assignment 또는 caller-manufactured authority를 기록하지 않는다.

## 5. Phase 1E salvage 영향

`ProductionServiceIdentityResolver.assertStillActive()`는 재사용한다. Phase 1E의 bootstrap-time registration validation만으로 실행 권한을 충족했다고 보지 않으며, 실제 child root와 job/provider execution boundary에 위 adapter를 연결해야 한다.

`DEC-169`는 evidence binding과 evidence-backed `WorkloadAuthorizationSubject` projection을 기존 authorization engine이 소비하는 bounded contract를 승인한다. 이는 새 authorization authority를 승인하지 않는다. 구현에 새 action/capability가 필요하다고 확인되면 즉시 STOP한다.
