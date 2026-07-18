# SP-002 Design

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 문서 상태 | DRAFT |
| Sprint | SP-002 |
| Objective | source, intake와 background job foundation |
| Feature | FEAT-004, FEAT-005, FEAT-018 |
| Developer Task | DEV-004, DEV-005, DEV-018 |
| Implementation | IMP-004, IMP-005, IMP-018 |
| API | API-003, API-004, API-017 |
| Workflow | WF-001–003, WF-006, WF-010–012 |
| Test | TEST-004, TEST-014–016, TEST-027, TEST-035, TEST-036, TEST-039, TEST-040 |

## 1. Scope

SP-002는 active source policy 아래 source proposal/read, immutable raw evidence reference, governed intake state transition과 provider-neutral background job contract를 구현한다. SP-001의 `SessionService`, `AuthorizationService`, `AuditSink`, privacy classification과 safe error boundary를 재사용한다.

다음은 범위 밖이다.

- physical database schema/migration, queue product, object storage와 HTTP framework
- named AI provider/model, production prompt, numeric confidence threshold
- autonomous connector/scraping/account control
- authoritative Property/Candidate/Duplicate/Matching 구현과 SP-003 artifact
- UI implementation, publication delivery와 external integration

## 2. Architecture

### 2.1 Source module

`modules/source`는 `SourceRegistryService`와 `RawSourceStore`를 제공한다. Source proposal은 승인된 policy가 아니며 `ACTIVE` policy snapshot은 injected repository port에서만 읽는다. Raw evidence는 content가 아닌 protected reference, integrity fingerprint, classification와 retention metadata를 immutable snapshot으로 보존한다.

### 2.2 Intake module

`modules/intake`는 `INTAKE.DRAFT`, `VALIDATION_FAILED`, `QUARANTINED`, `VALIDATED`, `AI_REQUESTED`, `REVIEW_REQUIRED`, `CORRECTED`, `CANDIDATE_REGISTERED`, `REJECTED` 전이만 허용한다. 모든 write는 active session, API-002 authorization, expected version, reason/trace와 AuditSink를 요구한다.

Candidate 등록은 SP-003 domain object를 미리 구현하지 않는다. `CandidateDraftPort`로 provenance-complete handoff reference만 생성하며 authority는 `CANDIDATE`로 제한한다.

### 2.3 Background job module

`modules/jobs`는 allowlisted job policy, idempotent submit, lease/start, terminal result/failure, best-effort cancel, bounded successor retry와 deadline expiry를 제공한다. `QUEUED`는 완료가 아니며 late/duplicate result, stale input, unsafe retry와 human authority transition을 거부한다.

AI-001/002 결과 validator는 closed advisory envelope, exact input/version, evidence reference, confidence/review route와 prohibited authority field 부재를 확인한다. Provider 실행과 품질 threshold는 `OPEN DECISION`으로 유지하고 synthetic contract evaluation만 수행한다.

### 2.4 API application boundary

`apps/api`에 API-003/004/017 framework-neutral adapter를 추가한다. Actor는 body가 아닌 bounded session에서 읽고 authentication → authorization → contract/state → privacy/idempotency 순서를 유지한다. 오류는 stable safe envelope로 변환하며 raw payload, internal stack와 provider detail을 반환하지 않는다.

## 3. Security and privacy

- SEC-001/002: every action은 active session과 scoped assignment를 요구하고 default deny한다.
- SEC-006/032: service principal은 approved capture/job execution만 수행하며 source policy, human review 또는 candidate registration을 결정하지 못한다.
- SEC-013/014/015: raw/intake/job classification은 highest plausible class와 purpose를 유지하고 raw content를 audit/API default projection에 포함하지 않는다.
- SEC-021–024: source/intake/job write, denial, retry/failure와 correlation을 privacy-safe audit evidence로 남긴다.
- SEC-031: AI input은 reference/version/minimized projection만 사용하며 output은 advisory이고 validation failure는 manual fallback으로 격리한다.

## 4. Failure and recovery

- stale policy/version은 `SOURCE_POLICY_STALE` 또는 `VERSION_CONFLICT`로 fail closed한다.
- unsafe evidence는 quarantine하며 AI job을 만들지 않는다.
- dependency/provider failure는 job `FAILED`와 manual fallback을 남기고 intake/raw evidence를 보존한다.
- idempotency key가 같은 동일 intent는 기존 job을 반환하고 다른 intent는 `IDEMPOTENCY_CONFLICT`다.
- retry는 explicit successor를 만들며 predecessor와 audit linkage를 보존한다.

## 5. Test design

| Test | SP-002 acceptance evidence |
|---|---|
| TEST-004 | Raw Source → AI Job/Result → candidate draft handoff provenance 보존 |
| TEST-014 | active source/method/purpose만 discovery/intake 허용 |
| TEST-015 | intake validation, quarantine, correction과 candidate registration authority 분리 |
| TEST-016 | AI job failure가 manual fallback을 보존하고 authoritative success를 만들지 않음 |
| TEST-027 | API-003/004 authorization, stale policy/version, safe error와 trace |
| TEST-035 | API-017 idempotency, lifecycle, cancel, successor retry, late result와 audit |
| TEST-036 | service/connector identity가 policy와 human review를 우회하지 못함 |
| TEST-039 | AI-001 closed advisory schema, evidence/confidence/unsupported claim rejection |
| TEST-040 | AI-002 ambiguity/no-match 보존과 canonical mutation rejection |

## 6. Compatibility and rollback

SP-001 public contract를 additive하게 확장하며 기존 TEST-005/006/009/026/034/046–049/053을 regression으로 유지한다. rollback은 한 개의 SP-002 completion commit revert이며 persistence/config migration은 없다.
