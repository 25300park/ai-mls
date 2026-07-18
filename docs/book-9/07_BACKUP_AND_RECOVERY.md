# Backup and Recovery

| 항목 | 값 |
|---|---|
| Document ID | DOC-OPS-008 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Data/Backup Owner / Operations Owner / Security Owner |
| 기준일 | 2026-07-14 |

## Backup policy

Authoritative structured data, private evidence, audit/history, configuration/policy metadata와 recovery dependency를 protected consistency set으로 백업한다. Queue/cache/projection은 재생성 가능성을 검증하고 required in-flight intent/evidence만 보호한다. Backup은 Phase 9 classification/encryption/access/retention/legal hold를 상속한다.

## Recovery objectives and tiers

다음은 business approval 전 architecture `ASSUMPTION`이며 contractual commitment가 아니다.

| Tier | Scope | Target RPO | Target RTO | Minimum backup/checkpoint frequency |
|---|---|---:|---:|---|
| Tier 0 | authority/audit: Verification, Permission, Approval, Publication, Audit/Status/Decision history | ≤ 15 minutes | ≤ 4 hours | recoverable point at least every 15 minutes; protected daily baseline |
| Tier 1 | core business: source/intake, property/candidate, contact/client/requirement, AI Job/Result | ≤ 1 hour | ≤ 8 hours | recoverable point at least hourly; protected daily baseline |
| Tier 2 | rebuildable search/report/projection and noncritical operational analytics | ≤ 24 hours | ≤ 72 hours | daily or reproducible checkpoint |

Mixed consistency set은 가장 엄격한 tier를 적용한다. Raw evidence loss가 Verification/Publication integrity를 해치면 Tier 0 관계로 승격한다.

## Backup frequency and retention

Frequency는 tier/RPO, change volume, consistency, cost와 verification capacity에 따라 조정한다. Daily completion과 integrity signal을 확인하고 at least one isolated/immutable recovery copy를 유지하는 것을 `ASSUMPTION`으로 한다. Exact full/incremental method, copies/location와 retention period는 `OPEN DECISION`이다.

## Integrity verification

Backup ID/time/scope/version, completeness, authenticity/checksum, encryption/key availability, consistency point와 retention/legal hold metadata를 검사한다. Verification failure는 backup success가 아니며 alert/incident, alternate recovery point와 remediation을 요구한다.

## Recovery workflow

Request/incident → scope/tier/point selection → multi-owner authorization → isolated restore → integrity/security/data/workflow validation → controlled cutover → external reconciliation → observation → temporary copy disposition/closure 순서다.

Restored Verification/Permission/Approval/Publication은 current expiry/revocation, subject version와 external state를 재검사한다.

## Recovery testing

| Test | Minimum cadence assumption | Evidence |
|---|---|---|
| Backup integrity verification | every backup/checkpoint | scope/result/failure/remediation |
| Sample restore | monthly | selected set, duration, integrity/security result |
| Tier 0 service recovery exercise | quarterly | RPO/RTO achieved, authority/reconciliation findings |
| Broad DR rehearsal | at least annually | scenario, roles, communication, continuity/cutover findings |

Cadence는 `ASSUMPTION`; risk/change/incident 후 추가 test가 필요하다. 모든 test는 production external effect를 차단하고 classified data를 최소화한다.

## Failure and exception

Missed/invalid backup은 severity를 평가하고 protected window, alternate copy, recovery exposure와 owner를 기록한다. RPO breach 또는 no-known-good-copy는 incident/escalation 대상이다. Exception은 expiry/compensating control과 Security/Data approval이 필요하다.
