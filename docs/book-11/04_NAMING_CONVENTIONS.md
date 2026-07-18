# Naming Conventions

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-005 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Development Reviewer / Architecture Owner |
| 기준일 | 2026-07-15 |

## Authority

[Repository Naming Convention](../00_NAMING_CONVENTION.md)과 [Glossary](../00_GLOSSARY.md)를 구체화한다. 여기의 이름은 convention example이며 final schema, endpoint 또는 technology 선택이 아니다.

## Convention matrix

| Target | Convention | Example |
|---|---|---|
| Folder | `kebab-case` | `listing-intake` |
| General source/test file | `kebab-case` | `publication-policy.test.ts` |
| UI component file | `PascalCase` | `CandidateReviewCard.tsx` |
| Variable/function/method | `camelCase` | `validatePublicationGate` |
| Class/type/interface | `PascalCase`; interface prefix 없음 | `PublicationDecision` |
| Enum type | singular `PascalCase` | `PublicationStatus` |
| Enum member/constant | `UPPER_SNAKE_CASE` | `APPROVAL_PENDING` |
| Boolean | positive `is/has/can/should` | `hasPublicPermission` |
| Database table | plural `snake_case` | `publication_approvals` |
| Database column | singular `snake_case` | `approved_at` |
| Primary/foreign key | `id`, `<entity>_id` | `permission_id` |
| API resource segment | plural `kebab-case` | `/client-requirements` |
| API path parameter | `{camelCaseId}` | `{requirementId}` |
| JSON field | `camelCase` | `correlationId` |

## Semantic rules

- `Candidate Listing`, `Property`, `Listing Offer`, `Verification`, `Permission`, `Client Proposal`과 `Publication`을 서로 대체해 부르지 않는다.
- business status에는 [Status Dictionary](../book-5/13_STATUS_DICTIONARY.md)의 namespace 값을 사용한다.
- UI-only 상태와 business 상태, verification과 publication 상태를 이름으로 분리한다.
- vendor/product name을 domain class, entity 또는 module name에 고정하지 않는다.
- 약어는 registry/Glossary에 정의된 경우만 사용한다.

## Files, tests and generated artifacts

test file은 대상과 level을 검색 가능하게 연결한다. generated artifact는 source와 generator version을 header/manifest로 식별하며 human-authored file처럼 위장하지 않는다.

## Exception

legacy/external contract 예외에는 owning contract, translation boundary, rationale, expiry와 migration plan이 필요하다. interface는 project-wide 기본으로 `I` prefix를 사용하지 않는다.
