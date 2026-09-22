# REL-002 Phase 2D-0I Secret Backend Threat / Risk Comparison

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-347 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security / Privacy Owner |
| 기준 Main | `e973c6e66fb53b3cfb0908b777a8af0704f64812` |

## 1. 비교 기준

평가 기준은 build exposure, runtime blast radius, bootstrap credential, network dependency, rotation, auditability, Vercel exclusion 및 기존 `SecretReferenceResolver` 재사용 여부다.

| Risk | Current Railpack variable | Docker-isolated sealed Railway variable | External secret manager |
|---|---|---|---|
| Malicious/compromised build step reads secret | HIGH | LOW — no secret `ARG` | LOW if workload identity exists |
| Value recoverable from UI/API/CLI | MEDIUM | LOW — sealed | backend-specific |
| Runtime process environment visibility | HIGH | MEDIUM | LOW/MEDIUM depending on fetch/cache |
| Bootstrap credential required | none | none | HIGH unless workload identity exists |
| New network failure mode | none | none | HIGH |
| New dependency/SDK | none | none | likely required |
| Rotation operational complexity | MEDIUM | MEDIUM | MEDIUM/HIGH |
| Existing resolver compatibility | PARTIAL | HIGH | requires new adapter |
| Vercel/browser isolation | service scoping required | service scoping + sealed boundary | backend policy required |

## 2. 주요 위협과 통제

| Threat | Required control | Failure result |
|---|---|---|
| Build script or dependency exfiltrates secret | Docker build에 secret `ARG`/`ENV` 금지; build guard로 presence 검증 | build/deploy BLOCKED |
| Secret copied into artifact/layer | multi-stage Docker build; secret injection 0; artifact inspection | deploy BLOCKED |
| Wrong service/environment receives secret | Production `ai-mls-api` service-scoped sealed variables only; shared/PR/Vercel 금지 | startup/configuration BLOCKED |
| Caller selects arbitrary env key | exact two-reference closed mapping | resolver FAIL_CLOSED |
| Child root reads `process.env` directly | resolver-only consumption; static/import boundary tests | startup/review BLOCKED |
| Secret appears in log/error/readiness | existing sanitizer plus secret-key/value canary tests | release BLOCKED and credential rotation |
| Stale credential remains active | successor rotation runbook and explicit old credential revocation | readiness remains NOT_READY |
| Platform administrator changes sealed value | staged change review, deployment provenance and reference fingerprint evidence | acceptance BLOCKED |

## 3. Residual risk

Railway runtime environment variables are process-wide. Application code cannot provide OS-level isolation between modules in one Node process. The bounded acceptance relies on one trusted Production process, exact resolver consumption, no child-root environment access, sealed platform visibility, and strict logging/redaction tests.

If AO requires hardware-backed workload identity, per-secret network policy, dynamic leases, or module-level process isolation, this recommendation is insufficient and an external secrets manager with a separately approved Railway workload identity contract is required.

## 4. Recommendation

현재 bounded scope에서는 Docker-isolated sealed Railway variables가 가장 작은 변경이다. Current Railpack direct value storage는 차단하고, external manager는 workload identity 계약이 생길 때까지 도입하지 않는다.
