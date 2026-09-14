# REL-001 Phase 3B.2 API-017 Audit Point Inventory

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-140 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Audit Owner / API Owner / Operations Owner |
| 기준일 | 2026-09-14 |
| 기준 commit | `720b1d519427b49a070db52ffe059f113ecf97c2` |

## 1. Scope

[Background Job Contracts](../book-6/11_BACKGROUND_JOB_CONTRACTS.md)의 audit 절이 식별한 9개 point를 그대로 유지한다. REL-001 option C는 claim과 heartbeat를 수행하지 않지만, 두 point를 삭제하거나 다른 point에 합치지 않고 `NOT_APPLICABLE` 판단 대상으로 보존한다.

Tenant/scope는 current worker/Session에서 재구성하지 않는다. Job acceptance transaction에 저장된 originating domain binding과 mutation-time provenance가 유일한 historical source다.

## 2. Exact inventory

| Point | Operation/action | Current state | Resulting state | Actor/authority | Target | Tenant/scope | Decision | Outcome | Purpose | Required evidence | Existing candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| submit | `job.submit` | none | `QUEUED` | live-authorized initiating principal through originating Domain API | new `BackgroundJob` | derived originating domain binding | authorization `ALLOW` required | `ACCEPTED` | stored authorized job purpose | input refs/versions/checksums, policy/config refs, command identity, correlation | none |
| claim | `job.claim` | `QUEUED` | claimed/leased | no actor in option C | `BackgroundJob` | would inherit stored binding | N/A | N/A | stored purpose | lease identity would be required | none |
| start | `job.start` | `QUEUED` | `RUNNING` | trusted `JOBS_API_017_WORKER` component executing accepted work; no business authority | exact job/version/attempt | stored immutable binding | internal admission `ALLOW`; not human approval | `ACCEPTED` | stored purpose | CAS, attempt, executor provenance, policy/config, chronology | none |
| heartbeat | `job.heartbeat` | `RUNNING` | `RUNNING` | no actor in option C | `BackgroundJob` | would inherit stored binding | N/A | N/A | stored purpose | lease/heartbeat evidence would be required | none |
| result | `job.succeed` | `RUNNING` | `SUCCEEDED` | same trusted executor bound to `jobId + attempt` | exact job/version/attempt | stored immutable binding | prior execution admission reference | `COMPLETED` | stored purpose | immutable result ref/checksum, handler evidence, chronology | none |
| fail | `job.fail` | `RUNNING` | `FAILED` | same trusted executor bound to `jobId + attempt` | exact job/version/attempt | stored immutable binding | prior execution admission reference | `FAILED` | stored purpose | safe normalized classification/ref, attempt, chronology | none |
| cancel | `job.cancel` | `QUEUED` or `RUNNING` | `CANCELLED` | live-authorized control principal | exact job/version | stored immutable binding | authorization `ALLOW` required | `COMPLETED` | stored purpose | expected version, safe reason ref, actor/session provenance, correlation | none |
| expire | `job.expire` | `QUEUED` or `RUNNING` | `EXPIRED` | trusted API-017 component applying approved deadline predicate | exact job/version | stored immutable binding | deterministic restrictive rule reference | `COMPLETED` | stored purpose | deadline, policy version, prior/new version, chronology | none |
| retry | `job.retry` | predecessor `FAILED` | predecessor unchanged; successor `QUEUED` | live-authorized control principal | predecessor and successor Jobs | copied immutable originating binding | authorization `ALLOW` plus eligibility decision | `ACCEPTED` | stored purpose | predecessor/version, successor identity, eligibility, authorization, lineage, correlation | none |

## 3. Provenance distinctions

- **Initiating principal:** `SubmitJob`, `CancelJob`, `RetryAsSuccessor`의 trusted Session-derived current actor.
- **Approving principal:** downstream business approval이 필요한 job에서는 immutable approval evidence reference로만 보존한다. API-017 event가 approval을 만들지 않는다.
- **Runtime executor:** approved component identity `JOBS_API_017_WORKER`와 exact `jobId + attempt`. initiating human으로 표시하지 않는다.
- **System component:** deadline evaluation 등 deterministic restrictive work를 수행하는 `JOBS_API_017_CONTROL`; 새 role/capability가 아니다.

`SYSTEM_ADMIN`, `SERVICE_ACCOUNT`, worker role 또는 caller-supplied principal을 만들지 않는다. API-016 principal type이 필요한 technical event는 기존 `SERVICE` type과 trusted component identity를 사용하며 권한은 accepted job/admission evidence에서 온다.

## 4. Failure point

`fail`은 caller-authored `failureCode`를 받지 않는다. Handler의 internal failure를 trusted mapper가 `DEPENDENCY_UNAVAILABLE` 또는 `JOB_RESULT_INVALID`로 정규화한 뒤 opaque safe evidence reference를 생성한다. Unknown/raw diagnostic은 event 또는 intent를 만들지 않고 fail closed한다.
