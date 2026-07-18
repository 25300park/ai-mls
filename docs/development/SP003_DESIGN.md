# SP-003 Design

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 문서 상태 | DRAFT |
| Sprint | SP-003 |
| Objective | property, candidate, duplicate와 advisory AI |
| Feature | FEAT-006, FEAT-007, FEAT-022 |
| Developer Task | DEV-006, DEV-007, DEV-022 |
| Implementation | IMP-006, IMP-007, IMP-022 |
| API | API-005, API-006; API-004/009/010/017 advisory contract only |
| Workflow | WF-002–007 |
| Test | TEST-007/010/013/017/028/039–045 |

## 1. Scope

SP-003은 Property hierarchy와 alias의 안전한 조회·제안·결정, provenance-complete Candidate Listing과 Listing Offer lifecycle, advisory duplicate suggestion과 human-only disposition, provider-neutral AI-001–007 결과 검증·review contract를 구현한다. SP-001의 session/authorization/audit/security와 SP-002의 intake/provenance/job foundation을 재사용한다.

다음은 범위 밖이다.

- production database, queue, object storage, HTTP framework
- named AI provider/model, production prompt, numeric confidence threshold
- SP-004 Requirement lifecycle와 SP-005 Matching application
- verification, permission, publication authority
- frontend application과 external connector

## 2. Architecture

### 2.1 Property module

`modules/property`가 Location → Property → Building → Tower → Floor → Unit reference와 Property Alias를 소유한다. read/search는 scoped projection만 반환하고, canonical 변경은 `DST`의 human decision과 exact version을 요구한다. AI normalization은 proposal만 만들며 master를 직접 변경하지 않는다.

### 2.2 Listing module

`modules/listing`이 Candidate Listing, Listing Offer, Duplicate Group, Decision History를 소유한다. Intake의 `CandidateDraftPort`를 구현해 raw/intake/AI provenance를 보존한다. Candidate authority는 항상 `CANDIDATE`이며 verification/publication 상태를 만들지 않는다. Duplicate AI output은 suggestion만 만들고 `DUR` disposition이 link/merge/separate/needs-evidence를 결정한다.

### 2.3 AI module

`modules/ai`가 AI-001–007의 closed-schema result envelope, input/version/provenance match, classification inheritance, confidence band, validation outcome과 review route를 검증한다. `AIR` review는 accept-as-draft/correct/reject/needs-evidence/escalate만 기록하며 authoritative domain write를 수행하지 않는다. Provider execution과 numeric thresholds는 `OPEN DECISION`으로 유지한다.

### 2.4 API and UI contract boundary

`apps/api`는 API-005/006 framework-neutral adapter만 제공한다. Actor는 body가 아니라 active session에서 파생한다. UI-008/011–018/021/023/024에는 canonical state와 presentation state를 분리하는 immutable view-state projection만 제공하며 frontend를 구현하지 않는다.

## 3. Security and invariants

- 모든 command는 active session, API-002 authorization, purpose, correlation, expected version을 요구한다.
- `DST`, `DUR`, `AIR` authority를 분리하고 service principal의 human decision을 거부한다.
- Property는 `INTERNAL`, Candidate/Offer/Duplicate는 최소 `CONFIDENTIAL_BUSINESS`, AI Result는 highest input classification을 상속한다.
- source/intake/raw/AI reference와 field lineage를 append-oriented evidence로 보존한다.
- AI Result, confidence, duplicate score는 authoritative transition을 일으키지 않는다.
- stale version, closed-schema violation, unsupported claim, unknown/low confidence와 missing evidence는 fail closed 또는 human/manual route로 보낸다.

## 4. Test mapping

| Test | SP-003 acceptance evidence |
|---|---|
| TEST-007 | AI result의 direct authoritative write 거부 |
| TEST-010 | Candidate와 Verification lifecycle 분리 |
| TEST-013 | confidence/limitation과 human review route |
| TEST-017 | duplicate suggestion과 human disposition 분리, lineage 보존 |
| TEST-028 | API-005/006 optimistic concurrency와 duplicate behavior |
| TEST-039–045 | AI-001–007 closed schema, evidence, ambiguity, hard constraint, allowlist search, confidence/hallucination 검증 |

## 5. Deferred mapping

AI-004/005/006은 SP-003에서 schema와 advisory validation contract만 구현한다. Requirement activation은 SP-004, matching/shortlist와 full UI는 SP-005에서 owning domain gate를 통해 연결한다. 이 경계는 SP-003에서 해당 미래 entity를 선구현하지 않기 위한 명시적 deferred 항목이다.
