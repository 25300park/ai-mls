# Folder and Module Rules

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-006 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Development Reviewer |
| 기준일 | 2026-07-15 |

## Module boundaries

module은 하나의 business capability, primary owner, public contract와 data authority를 가진다. 내부 model과 storage detail은 숨기고 application/API/UI/worker는 public use-case contract로만 호출한다.

## Dependency direction

| From | May depend on | Must not depend on |
|---|---|---|
| Application/composition | module public contracts, platform adapters | module internals, direct storage |
| Feature/domain module | own domain, approved shared contracts | UI, transport, vendor SDK, other module internals |
| UI | API/client contract, presentation utilities | database, secret, server-only policy |
| Adapter/integration | port contract, external SDK | domain authority ownership |
| Shared | stable cross-cutting primitive | feature-specific workflow/state |
| Test support | public contract, approved test seam | production credential/data |

Dependency cycle은 허용하지 않는다. cycle 발견 시 shared extraction보다 ownership 또는 contract boundary를 먼저 재검토한다.

## Feature modules

Feature module은 workflow/use case, domain policy, contract, validation와 test를 함께 소유한다. verification, permission, publication, audit와 provenance는 convenience helper로 우회하지 않는다.

## Shared modules

shared 승격 조건은 최소 두 개의 실제 consumer, 안정된 의미, 단일 owner, compatibility/test policy다. `common`, `utils`, `helpers`와 같은 무제한 dumping folder를 만들지 않는다.

## Isolation principles

- connector, AI provider, notification와 external publication failure를 core transaction과 격리한다.
- adapter는 idempotency, timeout, retry, circuit/open state와 reconciliation contract를 따른다.
- AI output은 validated advisory result로만 domain에 들어오며 authoritative write를 수행하지 않는다.
- module은 다른 module database/table을 직접 읽거나 쓰지 않는다.

## Boundary changes

public contract, authority, ownership, dependency direction 또는 deployability 변경은 CR과 architecture review가 필요하며 significant change는 ADR로 추적한다.

> **OPEN DECISION:** approved stack 이후 exact module/package enforcement와 dependency graph validator를 선택한다.
