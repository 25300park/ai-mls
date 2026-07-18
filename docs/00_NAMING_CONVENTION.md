# Naming Convention

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-015 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |

이 문서는 Architecture Bible과 향후 구현에서 사용할 이름의 형식과 의미를 통일한다. domain 용어는 [Glossary](00_GLOSSARY.md), 영구 문서 식별자는 [Document ID Rule](00_DOCUMENT_ID_RULE.md)을 우선한다. 이 규칙은 이름 형식만 정의하며 final database schema나 API endpoint를 확정하지 않는다.

## 공통 원칙

- 이름은 Glossary의 표준 English term을 사용하고 축약어는 널리 합의된 경우만 쓴다.
- 동일 개념은 계층마다 의미를 바꾸지 않는다. 예: `candidate listing`을 `property`로 이름 붙이지 않는다.
- 이름에 status, version 또는 implementation vendor를 불필요하게 고정하지 않는다.
- Boolean은 긍정형 `is_`, `has_`, `can_`, `should_` 또는 이에 대응하는 camelCase를 사용한다.
- 날짜·시각은 의미를 드러내는 `*_at`, 날짜만이면 `*_date`를 사용한다.

## Database

| 대상 | 규칙 | 올바른 예 | 피할 예 |
|---|---|---|---|
| Table | plural `snake_case` | `listing_candidates` | `ListingCandidate`, `listingCandidate` |
| Column | singular `snake_case` | `created_at`, `source_record_id` | `CreatedAt`, `sourceRecordId` |
| Primary key | 기본 `id`; 문맥 밖으로 노출되는 명세에서는 entity-qualified 표현 허용 | `id`, `listing_candidate_id` | `key`, `record_id` |
| Foreign key | singular target + `_id` | `property_id` | `property`, `propertyId` |
| Unique constraint | `uq_<table>_<columns>` | `uq_listing_candidates_source_id` | 자동 생성 의미 불명 이름 |
| Index | `idx_<table>_<columns>` | `idx_listing_candidates_status` | `index1` |

위 이름은 convention example이며 final table/column 또는 constraint를 승인하지 않는다.

## API

- Resource path segment는 plural `kebab-case`를 사용한다: `/client-requirements`.
- Path parameter는 `{camelCaseId}` 형식을 사용한다: `/client-requirements/{requirementId}`.
- JSON field는 `camelCase`, HTTP header는 표준 spelling을 사용한다.
- action을 route에 넣어야 하면 resource semantics로 설명하고 Book 6에서 승인한다. 동사형 임시 endpoint를 convention으로 확정하지 않는다.

## TypeScript

| 대상 | 규칙 | 예 |
|---|---|---|
| Class, type, interface | `PascalCase` | `ListingCandidate` |
| Interface prefix | 기본적으로 prefix 없음; 외부/legacy 충돌 시 `IListingCandidate` 허용 | `ListingCandidate`, optional `IListingCandidate` |
| Function, method, variable | `camelCase` | `findListingCandidates` |
| Enum type | singular `PascalCase` | `ListingStatus` |
| Enum member | `UPPER_SNAKE_CASE` | `REVIEW_PENDING` |
| Constant | `UPPER_SNAKE_CASE` | `MAX_PARSE_RETRIES` |
| Generic parameter | 짧고 의미 있는 `PascalCase` | `TResult` |

## React

| 대상 | 규칙 | 예 |
|---|---|---|
| Component | `PascalCase` | `ListingCandidateCard` |
| Component file | component와 같은 `PascalCase.tsx` | `ListingCandidateCard.tsx` |
| Hook | `use` + `PascalCase` 의미의 `camelCase` | `useListingSearch` |
| Hook file | exported hook와 같은 `camelCase.ts` | `useListingSearch.ts` |
| Context | `PascalCase` + `Context` | `AuthContext` |

## File names

- React component file은 `PascalCase`를 사용한다.
- 일반 source, test, configuration module은 `kebab-case`를 사용한다: `listing-search.service.ts`, `listing-search.test.ts`.
- hook file은 hook 이름과의 검색성을 위해 `camelCase` 예외를 허용한다.
- directory는 `kebab-case`를 기본으로 한다.
- 운영체제별 case 차이로 충돌하는 이름을 만들지 않는다.

## Document naming

| 대상 | 형식 | 예 |
|---|---|---|
| Book directory | `book-<number>` | `book-3` |
| Book document | `<ORDER>_<UPPER_SNAKE_TITLE>.md` | `03_DATABASE_STANDARDS.md` |
| Book identity | `Book <number>`와 permanent Document ID를 함께 표시 | `Book 3 / DOC-DATA-003` |
| Core control document | `00_<UPPER_SNAKE_TITLE>.md` | `00_TRACEABILITY_RULE.md` |
| Completion report | `<BRIEF>_COMPLETION.md` | `A0_5_COMPLETION.md` |
| Review artifact | `<REVIEW>_<UPPER_SNAKE_TITLE>.md` | `R1_OPEN_DECISIONS.md` |

파일의 순서 번호나 경로는 Document ID가 아니다. rename 또는 이동 후에도 [Document ID Rule](00_DOCUMENT_ID_RULE.md)의 ID는 유지한다.

## ADR naming

- 파일명: `ADR-NNN-SHORT-TITLE.md`
- 문서 제목: `ADR-NNN: Short Decision Title`
- 번호는 [ADR register](adr/README.md)의 다음 미사용 순번을 사용하고 재사용하지 않는다.

## Branch naming

형식은 `<type>/<scope>-<short-description>`이다. `type`은 `docs`, `feat`, `fix`, `refactor`, `test`, `chore` 중 하나를 사용한다.

- `docs/a0-5-quality-foundation`
- `feat/listing-intake`
- `fix/publication-authorization`

issue ID가 있으면 scope 앞에 붙일 수 있다. credential, contact 또는 client 정보를 branch name에 넣지 않는다.

## Commit message convention

[Conventional Commits](https://www.conventionalcommits.org/) 형태의 `<type>(<scope>): <imperative summary>`를 사용한다.

- `docs(core): add traceability rules`
- `fix(publication): enforce approval gate`

summary는 English, imperative, 72자 이내를 권장한다. breaking change는 footer에 `BREAKING CHANGE:`와 영향·migration을 기록한다. architecture 결정 변경은 ADR ID를 footer에 연결한다.

## Review 규칙

[Review Checklist](00_REVIEW_CHECKLIST.md)에서 이름의 형식, Glossary 의미 일치, ID와 filename 혼동 여부를 검사한다. 예외는 이유, 범위와 종료 조건을 문서화해야 한다.

> **OPEN DECISION:** interface `I` prefix의 project-wide 사용 여부는 Book 11에서 확정한다. 그 전에는 prefix 없는 형태가 기본이다.
