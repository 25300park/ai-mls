# REL-002 Phase 1 Production Startup Validation Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-281 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture/Operations Owner |
| 기준일 | 2026-09-17 |
| Decision | DEC-164 |

## 1. Invariant

Production startup validation must complete before listener start, worker execution, database mutation or provider execution. Validation is side-effect-free except bounded readiness inspection and emits no secret value.

## 2. Ordered validation

| Order | Validation | Applies to | PASS condition | Failure behavior | Safe evidence |
|---:|---|---|---|---|---|
| 1 | Closed input/schema | all config | plain immutable object, approved keys only | `PRODUCTION_CONFIGURATION_INVALID`; stop | config version if safe |
| 2 | Environment | all | exact `PRODUCTION` | `PRODUCTION_ENVIRONMENT_REQUIRED`; stop | environment |
| 3 | Candidate/config identity | all | approved release candidate and configuration version present | `PRODUCTION_CONFIGURATION_INVALID`; stop | fingerprints/references |
| 4 | Development/test exclusion | all | no development Session, in-memory authority, test adapter or fixture | `UNSAFE_RUNTIME_CONFIGURATION`; stop | safe reason code |
| 5 | Cross-environment exclusion | all references | every reference bound to Production and exact consumer | `CROSS_ENVIRONMENT_REFERENCE_DENIED`; stop | consumer plus outcome |
| 6 | Identity authority | protected runtime | authentication, binding and live authorization adapters ready | `IDENTITY_AUTHORITY_UNAVAILABLE`; stop | adapter IDs/status |
| 7 | Service identities | enabled services/workers | every identity registered for exact purpose/scope | `SERVICE_IDENTITY_INVALID`; affected service cannot start | identity refs/status |
| 8 | Database references | enabled durable components | closed component set; required references present and resolvable | `DATABASE_REFERENCE_UNAVAILABLE`; no DB open/mutation | component/status |
| 9 | Secret-reference shape | secret refs | opaque reference; not secret-looking value/plaintext | `SECRET_REFERENCE_INVALID`; stop | reason only |
| 10 | Mandatory secret availability | exact consumer | resolver reports resolvable for Production consumer | `SECRET_REFERENCE_UNAVAILABLE`; stop/disable optional component | consumer/status |
| 11 | Console identity/origin | Console enabled | trusted Session ingress and approved origin/listener | `CONSOLE_NOT_READY`; Console not started | normalized status |
| 12 | External provider hold | FEAT-022 | adapter stays disabled while DEC-162/163 hold is open | provider remains `NOT_READY` | hold decision refs |
| 13 | Observability safety | all | readiness/error sinks accept safe metadata only | `OPERATIONAL_EVIDENCE_UNAVAILABLE`; fail according to mandatory audit policy | safe code/correlation |
| 14 | Final aggregate | all mandatory checks | all required checks pass in one immutable result | only then permit startup phases | validation fingerprint |

## 3. Action containment matrix

| Action | Before PASS | After PASS |
|---|---|---|
| Open network listener | denied | Phase 3 composition may proceed |
| Start worker/job execution | denied | Phase 3 policy may proceed |
| Open database for mutation | denied | owning component may initialize |
| Execute provider/network call | denied | still requires separate provider/network authorization |
| Render health/readiness | safe `NOT_READY` only | may report validated component state |
| Emit audit/telemetry | safe validation metadata only | normal safe evidence rules apply |

## 4. Required negative cases

- missing/unknown environment;
- Production config using Development/Test/Staging reference;
- extra top-level/nested key;
- missing candidate/config identity;
- development Session or in-memory authority;
- unready authentication/binding/authorization adapter;
- caller-supplied tenant/principal/scope;
- unregistered service/job identity;
- plaintext or secret-looking value where a reference is required;
- unresolved/wrong-consumer secret reference;
- raw reference/value, environment dump, path, SQL or stack in error;
- live FEAT-022 falsely reported ready;
- listener/worker/database/provider side effect before aggregate PASS.

## 5. Result boundary

The validator returns only `PASS` with an immutable validation fingerprint or a stable safe failure code. It does not return secret references/values and does not grant execution or business authority.
