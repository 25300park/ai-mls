# REL-002 Phase 2C Backup / Restore Prerequisites

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-313 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Data/Backup Owner / Operations Owner / Security Owner |
| 기준일 | 2026-09-18 |

## 1. Protected consistency set

Target table은 shared Identity/Session database boundary에 속하므로 backup은 단일 table export가 아니라 exact pre-change database consistency set을 보호해야 한다. Identity metadata, migration ledger와 Session/identity authority records의 transaction-consistent state를 포함한다.

## 2. Backup prerequisites

필수 evidence:

- backup ID/reference, exact target database identity reference, environment `PRODUCTION`
- immutable consistency timestamp와 migration candidate/artifact checksum binding
- completeness, authenticity/checksum, encryption과 key availability
- classification, retention, legal hold와 access-control evidence
- named operator/approver와 backup result

Backup path, credential, key, raw row 또는 personal/secret payload는 문서/로그에 기록하지 않는다. Verification failure, stale backup 또는 target mismatch는 backup success가 아니다.

## 3. Restore verification

Migration 전 승인된 backup을 isolated, non-routable, non-Production target에 복원한다. Restore rehearsal은 다음을 증명해야 한다.

1. backup decrypt/open 및 database integrity 검사 성공
2. exact pre-change schema/metadata/ledger와 unrelated Identity/Session data의 일관성
3. authority records와 append-only evidence의 손상 없음
4. Production listener/worker/provider/credential use 없음
5. measured duration과 recovery owner/evidence reference

단순 backup 생성이나 checksum만으로 restore capability를 주장하지 않는다.

## 4. Freshness와 exception

Backup/restore evidence는 exact target, exact migration candidate와 approved window에 current해야 한다. Repository는 exact freshness duration을 정의하지 않으므로 임의 TTL을 만들지 않는다. Data/Operations/Security owner가 window에 대한 currentness를 승인하지 않으면 `UNKNOWN`으로 fail closed한다.

No-known-good-copy, failed restore, unavailable key, inconsistent target 또는 unresolved integrity finding에는 exception으로 migration을 진행하지 않는다.

## 5. Current state

Phase 2C에서는 backup 또는 restore를 실행하지 않았다. Current exact-target backup/restore evidence는 `NOT_AVAILABLE`; controlled migration gate는 `BLOCKED`다.
