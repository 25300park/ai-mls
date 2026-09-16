# REL-001 Phase 7 Component Fingerprint Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-242 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Release Owner / Quality Owner |
| 기준일 | 2026-09-16 |

## 1. Canonical algorithm

기존 FEAT-024 알고리즘을 그대로 확장 적용한다. Component는 정렬된 각 파일의 `path\0fileSha256\0fileSize` 행을 LF로 연결해 SHA-256한다. Artifact는 `REL-001\0Staging\0sourceCommitSha\0componentId:componentFingerprint...`을 component ID 순서로 직렬화해 SHA-256한다. `generatedAt`은 logical identity에서 제외된다.

## 2. Exact component results

| Component | Entry point | Files | SHA-256 |
|---|---|---:|---|
| `ADMIN_CONSOLE_STAGING` | `apps/api/src/staging-admin-console-bootstrap.js` | 15 | `9d80cda190f04b3ced88b02a2349f3503592589f5995acb034326f8f938579b2` |
| `API-015_ADMINISTRATION_HTTP` | `apps/api/src/administration-production-composition.js` | 19 | `4a0900d5fbedc3a7889e9679d5b84107f30e68e80760cb2a214966eaf34db5b4` |
| `API-016_AUDIT_RUNTIME` | `apps/api/src/api016-production-composition.js` | 7 | `2cc2cd66f9e86c21f8c5e1a9d860e68aa14d161ad20a848949e2dbafcbc1a5e9` |
| `API-017_JOB_RUNTIME` | `modules/jobs/src/job-staging-composition.js` | 4 | `74d0e47db7c3be636ee98276c33215e8d1daf9115f660334d959ec0a5cc0c599` |
| `CORE_CLIENT_REQUIREMENT_STORE` | `modules/client/src/client-requirement-durable-persistence.js` | 1 | `3f80bec24dd5639b27bd258ce21422cf3f68722177386427f09d0a7209edf928` |
| `CORE_CONTACT_STORE` | `modules/contact/src/contact-durable-persistence.js` | 3 | `2355bbce23473fe8db8efdc5c69b5499e0410a78befd4b8a96e1556cc52a9642` |
| `CORE_INTAKE_STORE` | `modules/intake/src/intake-durable-persistence.js` | 3 | `ae04b5e7b94812d3da85b5eb2e833fcfa06960d9e0560ff9775479ccbba19189` |
| `CORE_LISTING_STORE` | `modules/listing/src/listing-durable-persistence.js` | 3 | `37f75f376d5f6ded5b1ce68f3b732a1b41eb92486ec14503b4853f1dcdbda81e` |
| `CORE_MATCHING_STORE` | `modules/matching/src/matching-durable-persistence.js` | 3 | `e3d79020e7438767acdaa5ed7616525953ba8bf799f2bd2eeeacb6b15d2009c1` |
| `CORE_PROPERTY_STORE` | `modules/property/src/property-durable-persistence.js` | 3 | `77d417c7d869e629ed46670895c548b34d42e508d109570b0e89b7af1da90777` |
| `CORE_SOURCE_REGISTRY_STORE` | `modules/source/src/source-registry-durable-persistence.js` | 3 | `9a826644b9897719af4f294302af04673b6d02d9debaaf3756cc8e4be0c07263` |
| `FEAT-022_ADVISORY_DURABLE_RUNTIME` | `modules/ai/src/advisory-production-composition.js` | 6 | `876f84793e9af8f27f92137cc887f0657dd05f0bd31a737d69b6dbf656672d03` |
| `FEAT-022_PROVIDER_INDEPENDENT` | `modules/ai/src/advisory-readiness-composition.js` | 8 | `2b29188389fcb8b4f030bd3fbdcceaff34db0b1b76dd51afc53a89dfee060bc0` |
| `OPERATIONAL_EVIDENCE_STORE` | `modules/operations/src/durable-operational-evidence-store.js` | 5 | `824034c82046ce3dc529530a49f19eb3c63d27a60a7fe442b409e1062b28c7cb` |
| `OPERATIONAL_READINESS_EVIDENCE` | `modules/operations/src/operational-readiness-evidence.js` | 3 | `47717295bab46d9d1a4e08297c499a3617fec77e109a496270dcd883a09ae1e1` |
| `OPERATIONAL_SECURITY_CONTROLS` | `modules/operations/src/security-privacy-operational-controls.js` | 5 | `df0b075a85923b6f2044b81488d4bf8f0a5b8f04bd58ba2dd63d99bcf0494832` |
| `SESSION_AUTH` | `apps/api/src/staging-session-composition.js` | 6 | `1362516201534db40e32ecb68c6b947ab1e814941c69a28214d1a85cf3e793a9` |
| `STAGING_INTEGRATED_COMPOSITION` | `apps/api/src/staging-integrated-runtime-verification.js` | 1 | `ac477b7d6e420bbc97be51744c14bb49d5693a7c62fb6abb2f028b6004d7b8ec` |

## 3. Candidate identity

| Identity | Value |
|---|---|
| Artifact fingerprint | `0bdee557c89a99491c4b0194e5b3828c6df8772a32706de452896c53fd66f27e` |
| Release candidate ID | `e9244c1df51ef29b2ae61fe0323f05d29d4127f688a5eda2bc8ef10c14f957a2` |
| Candidate fingerprint | `9a74e4d1052998d8603cd9504c256dfaf5264cc02a22bc929384aaf0caaf2a14` |

두 `generatedAt` 값으로 재계산했을 때 세 identity가 모두 같았고, included byte 변경 test는 모두 다른 identity를 만들었다.

Related: [Runtime Closure](REL001_PHASE7_RUNTIME_CLOSURE_INVENTORY.md), [Acceptance Evidence](REL001_PHASE7_ACCEPTANCE_EVIDENCE_REBUILD.md).
