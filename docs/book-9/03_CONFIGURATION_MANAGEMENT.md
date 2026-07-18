# Configuration Management

| 항목 | 값 |
|---|---|
| Document ID | DOC-OPS-004 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Operations Owner / Security Owner / Domain Owner |
| 기준일 | 2026-07-14 |

## Configuration classes

| Class | Examples | Owner |
|---|---|---|
| Runtime | endpoint reference, limits, schedules, non-secret connection metadata | Operations Owner |
| Business policy | source/target policy, freshness, thresholds, workflow flags | Domain/Business Owner |
| Security/privacy | auth/session, classification, export, retention, logging policy | Security/Privacy Owner |
| AI | capability/provider/prompt/schema/evaluation selection | AI Owner + Security/Privacy review |
| Secret/key reference | credential/key identifier, not secret value | Security/Integration Owner |

## Configuration ownership

Every item은 stable name, purpose, type/classification, owner, environment, default/allowed range, version, effective/expiry, change approval, dependency와 rollback value를 가진다. Anonymous/unowned configuration과 silent application default를 production에 허용하지 않는다.

## Secrets policy

Secret value는 repository, documentation, environment dump, log, prompt, release artifact 또는 ordinary variable에 저장하지 않는다. Runtime configuration은 approved secret reference만 가지며 retrieval/use는 unique service identity, least privilege, rotation/revocation와 audit를 따른다.

## Environment variables

Environment variable은 logical delivery mechanism 중 하나일 뿐 source of truth가 아니다. Non-secret, typed, validated, documented item에만 사용하고 absent/invalid/high-risk value는 startup 또는 affected function을 fail closed한다. Secret injection 방식과 product는 정의하지 않는다.

## Feature flags

Flag는 owner, intent, eligible scope, default, prerequisites, start/expiry, audit, metrics, rollback와 removal condition을 가진다. Flag로 authorization/workflow/approval/audit/security control을 우회하거나 schema incompatibility를 숨길 수 없다. Long-lived flag는 policy/configuration으로 재분류하거나 제거한다.

## Configuration lifecycle

`Proposed → Reviewed → Approved → Scheduled → Applied → Verified → Superseded/Retired`를 사용한다. Applied와 verified를 구분하고 failed/unknown은 rollback/containment한다. Config change는 CR/change record, exact before/after checksum/version와 affected OPS/SEC ID를 남긴다.

## Validation and drift

Schema/type/range/reference/compatibility, secret absence, environment boundary, policy conflict와 dependency를 pre-deployment에 검사한다. Runtime drift와 out-of-band change는 alert/incident/change record로 관리한다.

## OPEN DECISION

Canonical configuration registry format, signing/checksum mechanism, dynamic reload class와 flag review cadence는 implementation phase에서 정한다.

