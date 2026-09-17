# REL-002 Phase 1C Session UoW Ownership Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-285 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Identity/Operations Owner |
| 기준일 | 2026-09-18 |
| Decision | DEC-166 (`APPROVED`) |

## 1. Ownership rule

Production `DurableSessionUnitOfWork`의 lifecycle owner는 `ProductionBootstrap`이다. 개별 API, Console, worker 또는 provider adapter는 Session UoW를 생성·교체·종료하지 않는다.

## 2. Construction boundary

| Stage | Session UoW state | Allowed action |
|---|---|---|
| raw/parsed config | absent | side-effect-free validation only |
| identity/secret validation | absent | read-only authority availability and reference checks |
| gate failed | absent | safe failure and shutdown only |
| gate PASS | eligible for construction | bootstrap creates exactly one Production Session UoW |
| child composition | open | narrowed Session dependencies injected into child roots |
| runtime active | open | existing Session/CAS/revocation semantics apply |
| shutdown/failure unwind | closing/closed | bootstrap closes after dependents stop |

`DurableSessionUnitOfWork` construction before gate PASS is prohibited. Construction count before PASS, DB open count before PASS and schema mutation count before PASS must each remain `0`.

## 3. Dependency sharing

Bootstrap은 raw UoW를 모든 child에 공개하지 않는다. 다음 bounded dependencies만 주입한다.

- `SessionAccessCoordinator`;
- trusted Session binding resolver;
- `SessionService` operations already required by the child;
- live `AuthorizationService`;
- safe readiness/close hooks.

Child roots는 shared Session UoW의 ownership이나 close authority를 획득하지 않는다.

## 4. Identity registration separation

`RegisteredServiceWorkloadAuthority`는 Durable Session과 별도 책임이다.

- Registration authority: service/workload identity proof, tenant binding, lifecycle, assurance.
- Durable Session: authenticated access continuity, expiry, revocation and CAS.
- Authorization authority: live roles/capabilities/scopes and purpose checks.

Registration record를 Session row로 변환하거나 Session을 영구 registration truth로 사용하는 것은 금지한다.

## 5. Shutdown and failure unwind

Bootstrap은 생성 역순으로 종료한다.

1. provider-capable execution path disable;
2. workers stop and drain according to existing bounded semantics;
3. listeners stop accepting new work;
4. child roots close;
5. component persistence/UoWs close;
6. `DurableSessionUnitOfWork` close;
7. secret values/references retained in process memory are released by exact consumers.

중간 child creation 실패 시에도 동일한 reverse-order unwind가 적용된다. Shutdown error는 다음 resource 정리를 막지 않으며 safe normalized evidence만 남긴다.

## 6. Concurrency and authority safety

- Session revocation/CAS/version semantics는 기존 구현을 그대로 사용한다.
- Bootstrap validation fingerprint는 Session authority나 authorization decision을 대체하지 않는다.
- Runtime 중 authority 변경은 live revalidation으로 반영하며 bootstrap PASS를 영구 권한으로 재사용하지 않는다.
- Process-local cache/fixture는 restart 이후 authority가 될 수 없다.

## 7. Scope boundary

이 문서는 ownership과 ordering만 설계한다. Session schema, migration, issuance protocol, role/capability, external identity provider 및 Production datastore를 구현하거나 선택하지 않는다.
