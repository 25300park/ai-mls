# Database Standards

| 항목 | 값 |
|---|---|
| Document ID | DOC-DATA-004 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Database Reviewer |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

이 표준은 logical model과 향후 physical schema review의 제약이다. SQL syntax, vendor type, DDL 또는 migration을 제공하지 않는다.

## Naming standards

- Entity name은 singular English `PascalCase`, logical attribute는 English `snake_case`를 사용한다.
- primary identifier는 `<entity>_id`, foreign reference는 referenced entity의 `<entity>_id`를 사용한다.
- boolean은 positive predicate(`is_active`)를 사용하고 status와 boolean으로 동일 의미를 중복하지 않는다.
- timestamps는 `_at`, calendar date는 `_date`, duration/expiry는 의미가 드러나는 이름을 사용한다.
- reserved/vendor-specific abbreviation과 의미 없는 `data`, `info`, `misc` container를 피한다.
- canonical entity/attribute 이름은 [Glossary](../00_GLOSSARY.md)와 [Naming Convention](../00_NAMING_CONVENTION.md)에 맞춘다.

## Primary keys and UUID policy

- business entity는 외부 의미가 없는 opaque stable identifier를 가진다.
- UUID 계열 identifier를 우선 제안하되 exact version/generation location은 `OPEN DECISION`이다.
- phone, email, URL, external platform ID, address 또는 composite business value를 primary identifier로 사용하지 않는다.
- identifier는 merge 후 재사용하지 않고 tombstone/supersession으로 redirect한다.
- sequential public exposure, predictability와 index locality trade-off는 physical design review에서 평가한다.

## Foreign keys and reference policy

- logical required relationship은 존재성, lifecycle compatibility와 authority context를 검증한다.
- cross-context reference는 canonical owner의 identifier만 사용하고 cascade behavior를 암묵적으로 전제하지 않는다.
- external reference는 `namespace + external_identifier + observed_at` 의미를 가진다.
- 삭제된 parent의 history child는 approved tombstone 또는 archived reference를 통해 해석 가능해야 한다.

## Timestamp policy

| Timestamp class | Meaning |
|---|---|
| `created_at` | AI MLS record 최초 생성 시각 |
| `updated_at` | current representation의 마지막 authoritative 변경 시각 |
| `observed_at` / `captured_at` | source에서 관찰·접수된 시각 |
| `effective_from` / `effective_until` | policy, permission, role 또는 business state 유효 구간 |
| `verified_at` / `expires_at` | verification 시각과 유효 종료 |
| `deleted_at` / `archived_at` | logical deletion/archive action 시각 |

- 저장 기준은 timezone-aware absolute time이며 user-facing local timezone은 representation concern이다.
- source-reported time와 system-captured time을 분리하고 추정 timezone을 사실처럼 저장하지 않는다.
- trusted server/application boundary가 authoritative system timestamps를 부여한다.

## Soft delete policy

- business entity는 default로 logical deletion marker, actor/reason와 audit evidence를 사용한다.
- soft-deleted record는 일반 query/search에서 제외하지만 authorized recovery/audit에서는 식별 가능하다.
- privacy deletion은 soft delete만으로 완료되지 않는다. retention/legal basis가 끝나면 content 제거·익명화·index purge·backup 처리까지 추적한다.
- immutable audit/provenance를 무기한 보존한다는 뜻이 아니며 별도 policy를 따른다.

## Status and lifecycle policy

- entity마다 허용 state, transition, actor authority, precondition, timestamp, failure behavior를 문서화한다.
- free-text status, 모순되는 다중 status flag와 silent reset을 금지한다.
- current status는 current view이고 Status History가 transition evidence를 보존한다.
- expired, revoked, superseded, deleted는 서로 다른 의미이며 상호 대체하지 않는다.

## Version policy

- mutable authoritative entity는 optimistic concurrency용 logical version과 business revision을 구분한다.
- verification, permission, publication과 AI result는 판단 당시 subject/input version을 참조한다.
- correction은 원 evidence/history를 덮어쓰지 않고 revision/supersession 관계를 남긴다.
- schema version과 entity business version은 별도 concern이며 이 문서에서 schema version을 확정하지 않는다.

## Audit policy

중요 create/update/state/merge/split/access/export/approval/publication/retention action은 actor 또는 job identity, action, target, correlation, occurred time, reason, result와 필요한 before/after reference를 가진다. secret, unrestricted raw/contact content를 audit payload에 복제하지 않는다.

## Logical constraints

| Capability ID | Constraint |
|---|---|
| DB-006 | external publication은 valid Verification, correct Permission와 human approval reference 없이는 존재할 수 없다. |
| DB-007 | Candidate/Offer/Source/Property identity는 분리되고 provenance 없이 합쳐지지 않는다. |
| DB-008 | every retained record는 privacy class와 retention policy/class를 가진다. |
| DB-009 | important state transition과 restricted access는 audit evidence를 가진다. |
| DB-010 | AI Result/Match Result는 advisory authority만 갖고 authoritative transition을 직접 수행하지 않는다. |

## Deferred physical standards

vendor data type, exact UUID version, identifier storage, constraint/index name length, partitioning, collation, locale/search extension, transaction isolation, replication과 backup은 implementation/operations ADR에서 결정한다.

