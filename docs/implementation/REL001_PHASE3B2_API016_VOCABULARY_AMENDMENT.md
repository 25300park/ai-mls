# REL-001 Phase 3B.2 API-016 Vocabulary Amendment

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-142 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / Audit Owner / Security Owner |
| 기준일 | 2026-09-14 |
| Amendment decision | `APPROVED` |

## 1. Purpose and boundary

API-017의 seven applicable audit points를 API-016 final Audit Event vocabulary에 최소 추가하는 approved amendment이다. 이 문서는 event bus, public API, persistence implementation, handler, scheduler, role/capability 또는 business authority를 만들지 않는다.

모든 event는 technical/audit evidence이며 Job state 또는 downstream business truth를 생성하지 않는다. Event는 API-017이 이미 owner-local transaction에서 확정한 mutation의 immutable `v2` intent만 materialize한다.

## 2. Common envelope

모든 승인 event는 다음을 요구한다.

- `source = API-017`
- `targetType = BackgroundJob`
- exact Job identity/version and source intent identity
- stored originating `tenantId` and `scopeRef`; current Session/worker reconstruction prohibited
- stored authorized purpose; default purpose prohibited
- mutation-time trusted principal/provenance snapshot or immutable reference
- `occurredAt = API-017 transition commit chronology`
- `materializedAt = API-016 processing chronology`
- classification = highest Job/input classification; downgrade prohibited
- safe immutable reference/checksum only; raw payload/diagnostic prohibited
- exact replay appends zero; conflicting same source intent fails closed

## 3. Approved event types

| eventType | Canonical meaning | action | Allowed producer | Actor/provenance source | Decision | Outcome | Safe evidence references |
|---|---|---|---|---|---|---|---|
| `JOB_SUBMITTED` | authorized immutable Job was accepted as `QUEUED` | `job.submit` | API-017 control application | initiating principal from mutation-time trusted Session; applicable approval ref separate | `ALLOW` | `ACCEPTED` | input fingerprints/versions, policy/config refs, command identity, correlation |
| `JOB_STARTED` | bounded worker changed exact `QUEUED` version to `RUNNING` for one attempt | `job.start` | API-017 worker boundary | trusted `JOBS_API_017_WORKER` component plus `jobId + attempt`; initiating principal separately referenced | internal admission `ALLOW` | `ACCEPTED` | prior/new version, attempt, component/config ref, chronology |
| `JOB_SUCCEEDED` | exact running attempt committed an immutable validated result | `job.succeed` | API-017 worker boundary | same trusted component and exact attempt | referenced execution admission | `COMPLETED` | result ref/checksum, validation/handler evidence, prior/new version |
| `JOB_FAILED` | exact running attempt committed a trusted normalized failure | `job.fail` | API-017 worker boundary | same trusted component and exact attempt | referenced execution admission | `FAILED` | safe failure evidence ref, normalized classification, prior/new version |
| `JOB_CANCELLED` | authorized control command terminally cancelled a queued/running Job | `job.cancel` | API-017 control application | current control principal from mutation-time trusted Session | `ALLOW` | `COMPLETED` | safe reason ref, expected/prior/new version, correlation |
| `JOB_EXPIRED` | approved deadline predicate terminally expired a queued/running Job | `job.expire` | API-017 control component | trusted `JOBS_API_017_CONTROL` component; no fabricated human actor | deterministic restrictive-rule decision | `COMPLETED` | deadline, policy version, prior/new version, chronology |
| `JOB_RETRY_SUBMITTED` | authorized retry left predecessor immutable and atomically created one successor | `job.retry` | API-017 control application | current control principal; eligibility and applicable approval refs distinct | `ALLOW` plus eligibility result | `ACCEPTED` | predecessor/version, successor ID, command identity, eligibility/policy refs, lineage |

`decision` in technical start/result/fail/expire evidence is not a human business approval. It records the exact internal admission or deterministic rule reference that preceded the already-committed technical transition.

## 4. Failure safety

`JOB_FAILED` permits only:

- `DEPENDENCY_UNAVAILABLE`
- `JOB_RESULT_INVALID`

The code comes from a trusted mapper, not the caller. Unknown internal failure aborts classification/event persistence. Raw exception, stack, SQL/SQLite diagnostic, path, token/credential, provider payload, prompt, chain-of-thought and arbitrary caller string are forbidden in reason, details or reference.

## 5. Principal and scope

Initiating human, applicable approving principal, runtime executor and system component remain distinct references. Runtime executor is never represented as the initiating human. `JOBS_API_017_WORKER` and `JOBS_API_017_CONTROL` are already-approved component identities, not new service accounts or authorization roles.

All events preserve the Job's originating tenant/scope binding. Missing, conflicting or unrecoverable historical binding makes the intent non-materializable and concealed; query filters cannot grant visibility.

## 6. Retry semantics

`JOB_RETRY_SUBMITTED` records predecessor and successor separately. The predecessor remains `FAILED`, its result/failure evidence is unchanged, and a duplicate same retry authorization creates zero additional successor/event. Every new successor command revalidates current authority, eligibility, tenant/scope/purpose, input/deadline and downstream constraints.

Manual successor has `NO_FINITE_MAX_REQUIRED`; this is not automatic retry permission. No scheduler, delay, backoff or loop is introduced.

## 7. Approval effect

Approved new types: `7`. Existing event reuse: `0`. `NOT_APPLICABLE`: `2`. Unknown mappings: `0`.

DEC-151 approval makes required and effective mapping closure `9/9`; the remaining canonical decision count is `0`. Phase 3C remains `NOT_AUTHORIZED` until a separate implementation authorization is recorded.
