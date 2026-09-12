| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-154 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 적용 범위 | FEAT-024-G |

# FEAT-024-G Traceability / Console Read Gap Matrix

## 1. Objective

기존 `/system/operations`와 `ConsoleReadAdapter`를 통해 REL-001/Staging의 release candidate, acceptance manifest, exact-candidate evidence composition 및 promotion handoff 상태를 안전한 read-only projection으로 제공하기 위한 실제 결손과 최소 수정 경계를 기록한다.

## 2. Canonical fixed truth

- `logicalReleaseId = REL-001`
- `targetEnvironment = Staging`
- `acceptanceResult = INCOMPLETE`
- mandatory runtime gaps = `5`
- promotion handoff = `UNAVAILABLE`
- registry mutation, acceptance, promotion 및 deployment 실행 권한 = `0`

## 3. Gap matrix

| Surface | Authoritative source | Current read port | Safe DTO requirement | Authorization / visibility | Current rendering | Gap | Minimum correction |
|---|---|---|---|---|---|---|---|
| Candidate | `Rel001StagingCandidate` | 없음 | exact candidate ID, REL-001, source SHA, artifact fingerprint, Staging, candidate fingerprint, INCOMPLETE, five runtime gaps | existing trusted Session + `PublicationOperations` live read authorization; tenant/team equality | 없음 | candidate truth가 Console에 없음 | injected `ConsoleReleaseTraceReadPort` 결과를 closed validation 후 project |
| Acceptance Manifest | `ReleaseAcceptanceManifest` / durable manifest store boundary | 없음 | manifest ID/fingerprint, exact candidate binding, result, bounded acceptance provenance/ref | 동일 | 없음 | raw domain/store 접근 없이 safe view가 없음 | port가 제공한 immutable safe view만 재구성 |
| Evidence Composition | `ReleaseEvidenceCompositionService` | 없음 | composition fingerprint, exact binding, safe requirement/evidence/readiness refs, runtime gaps | 동일 | 없음 | exact-candidate evidence summary가 없음 | safe bounded projection 및 cross-binding rejection |
| Promotion Handoff | `PromotionHandoffEvidenceService` | 없음 | `AVAILABLE` 또는 `UNAVAILABLE`; available일 때 exact binding과 bounded authority/SoD refs | 동일 | 없음 | INCOMPLETE candidate의 no-handoff truth가 보이지 않음 | `UNAVAILABLE`을 명시하고 action은 노출하지 않음 |
| Console route | existing `/system/operations` | existing `OPERATIONS` branch | 기존 page 유지 | existing server routing | telemetry/readiness/alerts만 표시 | release trace section 없음 | `renderOperations()`에 escaped read-only section 추가 |
| Error/concealment | existing Console safe error/empty conventions | existing adapter catch/concealment | stack/path/SQL/secret/raw diagnostic 없음 | resolver failure, expired/revoked session, tenant/scope mismatch fail closed | bounded error 지원 | release port failure/unsafe DTO 검증 없음 | malformed/unsafe/binding mismatch를 `UNAVAILABLE`로 축소 |
| Accessibility | FEAT-021 primitives | existing semantic sections/tables | labelled section, table headings, textual state, keyboard-safe/no controls | N/A | 기존 Operations 준수 | release trace evidence 없음 | semantic heading/definition/table 구조 재사용 |
| Traceability | FEAT-024 A–F reports | FEAT-024 RTM 미생성 | A–G actual evidence only | governance scope | A–F completion reports만 존재 | unified A–G RTM 없음 | `FEAT024_TRACEABILITY_MATRIX.md` 생성/갱신; H/Final Gate는 미완료 유지 |

## 4. Approved execution path

```text
/system/operations
→ existing Console server
→ existing ConsoleReadAdapter OPERATIONS branch
→ trusted Session resolution
→ live PublicationOperations read authorization
→ injected ConsoleReleaseTraceReadPort
→ closed immutable safe DTO projection
→ existing renderOperations()
```

Console은 persistence store, release aggregate/domain object 또는 registry를 직접 import하거나 mutate하지 않는다.

## 5. RED targets

1. tenant/scope mismatch가 port invocation 전에 conceal되지 않음
2. REL-001 `INCOMPLETE` truth를 표시할 projection이 없음
3. exact candidate/artifact/environment binding validation이 없음
4. runtime gaps 5 및 handoff `UNAVAILABLE`을 표시할 section이 없음
5. unsafe evidence/raw diagnostics를 reject하는 release-trace boundary가 없음
6. release accept/promote/deploy controls가 없음을 직접 증명하는 G test가 없음
7. A–G RTM과 H/Final Gate 미완료 상태 증거가 없음

## 6. Scope protection

새 API, route, role/capability, lifecycle, persistence subsystem, dependency, registry mutation, deployment/promotion side effect를 추가하지 않는다.
