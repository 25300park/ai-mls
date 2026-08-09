# F15-TASK-011A Event Provenance Amendment Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-081 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 작성일 | 2026-08-10 |
| Brief | F15-TASK-011A |

## 1. Final Recommendation

`APPROVE_F15_TASK_011A_IMPLEMENTATION`

Canonical Publication Event contract가 future `PRJ-002`의 Event-only rebuild에 필요한 immutable projection provenance를 보존하도록 확장됐다. 구현과 독립 재검토 결과는 `Critical 0 / Important 0 / Minor 0`이다. `F15-TASK-011`과 `F15-TASK-012`는 시작하지 않았다.

## 2. Baseline

- Branch: `main`
- Baseline/`origin/main`: `a3876fcc01f01d1f0cd0d777adea72d8284ae88d`
- Baseline working tree: clean
- Node.js: `v24.18.0`
- pnpm: `11.9.0`
- Implementation commit: `SELF` — 이 보고서와 구현을 포함하는 단일 local commit
- Commit message: `feat(feat-015): extend event provenance for listing projection`
- Push: `NOT_PUSHED`

## 3. Event Contract Changes

[Publication Event contract](../../modules/publication/src/publication-event-contracts.ts)는 다음 세 projection provenance field를 conditional closed-schema field로 제공한다.

- `publicationVersion`
- `targetReference`
- `channelReference`

`PublicationEventProjectionProvenance`는 accepted `PublicationSnapshot`에서 생성되며 private symbol capability에 `tenantId`, `aggregateId`, `aggregateVersion`을 결속한다. Event 생성 시 이 세 identity/version을 Event input과 exact match하여 unbranded value와 cross-snapshot 이식을 fail closed 처리한다. Capability metadata는 Event envelope에 직렬화되지 않는다.

## 4. Versioning Decision

- `eventSchemaVersion`: `v2`
- `eventContractVersion`: `v2`
- 기존 `v1`을 새 shape로 묵시적으로 재해석하지 않는다.
- required provenance가 없는 새 Event는 `EVENT_PROJECTION_PROVENANCE_INCOMPLETE`로 fail closed한다.
- `aggregateVersion`, `publicationVersion`, `effectiveVersion`, `eventSequence`, schema version과 contract version의 의미를 분리했다.

## 5. Provenance Source

[Publication Event coordinator](../../modules/publication/src/publication-event-coordinator.ts)는 command transaction 안에서 이미 승인된 current `PublicationSnapshot`을 사용한다. `publicationVersion`은 snapshot의 Publication version, `targetReference`는 exact `targetId@targetVersion`, `channelReference`는 exact `channelId`에서 결정된다.

Caller가 전달한 동명 field는 authority가 아니며 무시된다. 다른 genuine snapshot에서 발급된 provenance도 Event tenant/aggregate/version과 다르면 거부된다. `PublicationGovernanceContext`에는 business-state provenance를 추가하지 않아 classification/privacy/consent/audience/purpose/tenant 경계를 유지했다.

## 6. EVT Mapping

| Event | Provenance | 상태 |
|---|---|---|
| `EVT-003 Publication Activated` | exact Publication version 및 Target/Channel binding | EMITTED |
| `EVT-007 Withdrawal Confirmed` | withdrawn external binding | EMITTED |
| `EVT-008 Republish Confirmed` | new Publication version 및 exact Target/Channel binding | EMITTED |
| `EVT-009 Material Change Accepted` | successor/material-change lineage binding | CONTRACT_ONLY |
| `EVT-004~006`, `EVT-010~012` | speculative provenance를 금지하고 field를 생략 | 기존 상태 유지 |

`EVT-009`는 [F15-TASK-010 완료 보고서](F15_TASK_010_DOMAIN_EVENT_JOURNAL_IMPLEMENTATION_REPORT.md)의 승인된 `CONTRACT_ONLY` baseline을 유지한다. 승인된 source trigger가 없으므로 이 amendment에서 business transition이나 trigger를 발명하지 않았다.

## 7. Integrity Changes

provenance가 필요한 Event에서는 세 field가 canonical unsigned Event data에 포함되며 SHA-256 integrity digest 대상이다. `publicationVersion`, `targetReference`, `channelReference` 중 하나라도 변경하면 integrity validation이 실패한다. Event consumer는 Journal Event만으로 해당 값을 읽으며 Aggregate/Repository 재조회가 필요하지 않다.

## 8. Direct Tests

[Publication Event Journal tests](../../modules/publication/src/publication-event-journal.test.ts)에 다음 assertion을 추가했다.

- `EVT-003`의 exact 세 provenance field 및 version separation
- 세 field 각각의 integrity tamper rejection
- missing provenance fail closed
- unbranded caller provenance rejection
- genuine cross-snapshot branded provenance rejection
- `EVT-004`와 `EVT-012`의 speculative provenance omission
- `EVT-007` withdrawn binding과 `EVT-008` republished binding
- `EVT-009` closed contract provenance
- replay가 source Event provenance를 그대로 전달하고 `EVT-012`에는 추가하지 않음
- Event Journal ordering/idempotency regression

Focused result: `22/22 PASS`.

## 9. Regression Results

| Gate | Result |
|---|---|
| `pnpm.cmd install --frozen-lockfile` | PASS — dependency/lockfile 변경 0 |
| `pnpm.cmd lint` | PASS |
| `pnpm.cmd typecheck` | PASS |
| `pnpm.cmd build` | PASS |
| `pnpm.cmd verify` | PASS — `538/538` |
| `pnpm.cmd test` | PASS — `538/538` |
| Architecture checksum | PASS — frozen primary scope 변경 0; `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` |
| Gitleaks | PASS — actual/unexplained findings 0 |
| `pnpm.cmd audit --prod` | PASS — known production vulnerabilities 0 |
| `pnpm.cmd audit` | 실행 완료 — 기존 dev-only transitive `brace-expansion` High 4 advisories, production 적용 0 |
| `git diff --check` | PASS |

전체 audit finding은 ESLint/typescript-eslint toolchain의 transitive development path에만 존재한다. 이 Task는 dependency, manifest 또는 lockfile을 변경하지 않았으며 별도 Architecture Owner dependency remediation 판단을 유지한다.

## 10. Independent Review

- Critical: `0`
- Important: `0`
- Minor: `0`
- Decision: `READY`

초기 review에서 발견된 blanket provenance 적용, caller-minting, cross-snapshot transplant 문제를 수정했다. 최종 review는 conditional Event mapping, identity-bound capability, v2/legacy boundary, integrity, replay preservation, Governance Context separation 및 scope protection을 확인했다.

## 11. Scope Protection

- `PRJ-002` Listing Projection: `NOT_IMPLEMENTED`
- Projection Store/consumer/worker: `NOT_IMPLEMENTED`
- Event Bus/Queue: `NOT_IMPLEMENTED`
- Publication business rule/authorization semantics: 변경 0
- physical persistence: 변경 0
- Architecture/Registry: 변경 0
- `package.json`/`pnpm-lock.yaml`: 변경 0
- `F15-TASK-011`: `NOT_STARTED`
- `F15-TASK-012`: `NOT_STARTED`
- Push: `NOT_PUSHED`

## 12. Next Recommended Task

Architecture Owner가 이 amendment를 승인한 뒤에만 `F15-TASK-011 — PRJ-002 Listing Projection`을 새 Brief로 시작한다. `EVT-009` production source trigger가 필요해지면 기존 `CONTRACT_ONLY` 경계를 별도 승인으로 해소해야 한다.

## 13. Completion Evidence

### Objective

Event-only deterministic Listing Projection rebuild에 필요한 canonical provenance blocker를 제거했다.

### Documents read

- F15-TASK-011A Brief
- `AGENTS.md`
- [Glossary](../00_GLOSSARY.md)
- [Document Governance](../00_DOCUMENT_GOVERNANCE.md)
- [F15-TASK-010 완료 보고서](F15_TASK_010_DOMAIN_EVENT_JOURNAL_IMPLEMENTATION_REPORT.md)
- [Canonical Event Registry](../00_EVENT_REGISTRY.md)
- [FEAT-015 Task Breakdown](../implementation/FEAT015_TASK_BREAKDOWN.md)

### Files created

- `docs/reviews/F15_TASK_011A_EVENT_PROVENANCE_AMENDMENT_REPORT.md`

### Files modified

- `modules/publication/src/publication-event-contracts.ts`
- `modules/publication/src/publication-event-coordinator.ts`
- `modules/publication/src/publication-event-error.ts`
- `modules/publication/src/publication-event-journal.test.ts`

### Key decisions added

- schema/contract `v2`
- provenance-bearing Event를 `EVT-003/007/008/009`로 제한
- accepted snapshot identity/version-bound private capability 사용

### Open decisions

- `OPEN DECISION`: `EVT-009` production source trigger는 승인되지 않았으며 `CONTRACT_ONLY`다.

### Inconsistencies found

- 최종 unresolved inconsistency: 없음

### Validation performed

install, lint, typecheck, build, verify, test, production/full dependency audit, Architecture checksum, Gitleaks, diff validation 및 독립 review를 수행했다.

### Known limitations

- physical Event serialization과 external Event transport는 deferred boundary다.
- full development audit의 기존 `brace-expansion` finding은 별도 dependency remediation 대상이다.

### Next brief prerequisites

Architecture Owner의 F15-TASK-011A acceptance와 별도 F15-TASK-011 authorization이 필요하다.
