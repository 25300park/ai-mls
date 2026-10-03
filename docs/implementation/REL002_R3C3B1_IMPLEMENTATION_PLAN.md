# REL-002 R3-C3B1 Implementation Plan

> 실행: superpowers:executing-plans. 현재 AO 승인 범위만 직접 구현한다. Commit은 생성하지 않는다.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-394 |
| 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |

**Goal:** concrete provider 없이 Production Human readiness foundation을 검증한다.

**Architecture:** 기존 AuthenticationAdapter와 durable Session decoder, PG_PRODUCTION_POOL을 재사용한다. provider binding이 없으면 Human gate는 BLOCKED_UNCONFIGURED다. revocation readiness는 Session.state의 기존 ACTIVE 판정 경로이며 ledger SELECT를 요구하지 않는다.

**Tech Stack:** TypeScript, node:test, PostgreSQL.

**Spec:** 현재 AO R3-C3B1 결정과 revocation scope clarification; 기존 uncommitted inventory REL002_R3C3A_COMPLETION.md는 별도 보존한다.

## Global Constraints

- concrete provider/config schema, Session issuance, secret resolution, 새 schema/migration/ACL 금지.
- Production/readiness 증명은 disposable PostgreSQL만 사용한다.
- primary checkout, historical fingerprint, 승인 migrations를 보존한다.
- Human gate와 required secrets의 fail-closed 경계를 유지한다.

## Review Focus

- missing/duplicate/unknown binding은 fail-closed한다.
- Staging fallback과 embedded secret reference를 거부한다.
- explicit milliseconds 3개가 없거나 malformed면 거부한다.
- empty Session table은 read-path readiness 실패가 아니다.
- trusted-binding dependency의 존재만으로 실제 Production readiness를 주장하지 않는다.

## Task 1: Binding / freshness contracts

Files: apps/api/src/production-human-identity-contracts.ts 및 직접 test.
Interfaces: ProductionAuthenticationBinding, AuthenticationAdapterRegistration, resolveProductionAuthenticationBinding, parseProductionHumanFreshnessPolicy.

- [x] 실패 테스트: missing/duplicate/unknown/Staging binding, reference shape, explicit policy missing/malformed.
- [x] compiled focused test에서 RED 확인.
- [x] 최소 계약 구현 후 focused GREEN 확인.

## Task 2: Durable read foundation

Files: modules/identity/src/session-postgresql-persistence.ts 및 직접 test; apps/api/src/production-human-identity-composition.ts 및 직접 test.
Interfaces: mutation authority 없는 async Session reader; schema/read ACL probe 및 blocked authentication 결과.

- [x] read failure/empty rows 테스트 RED 및 strict decoder/client cleanup 검증.
- [x] 기존 decoder를 재사용하는 read-only adapter 구현.
- [x] AO classification: 기존 trusted-binding/live authorization 주입 계약만 구현한다. B2/B3 미구성은 BLOCKED이며 새 authority는 없다.
- [x] Focused 10 / disposable 1 / affected 22 PASS; full regression 1795 PASS / authorized historical mismatch 1 / 17 SKIP. Build/lint/typecheck/diff/secret scan PASS.
- [x] 직접 관련 완료 보고서에 증명과 미구성 상태를 기록했다. Independent review APPROVED; commit 없음.

## Execution ledger

- baseline f1da6838aa182dae638b73d26f50da413669a326; 기존 untracked inventory reports 2개 보존.
- AO clarification: identity_session_revocations SELECT 추가 없음. Session.state effective read 사용.
- AO classification: concrete trusted-binding 부재는 B3 prerequisite이며 B1 foundation 완료를 막지 않는다.
- 독립 리뷰 P2: release 실패 raw error를 RED 재현한 뒤 PostgreSqlPersistenceError로 정규화했다. Focused 10 PASS.
- AO closeout authorization: B1의 9개 파일만 한 번 commit한다. 기존 inventory 보고서 2개는 제외하고 보존한다.
