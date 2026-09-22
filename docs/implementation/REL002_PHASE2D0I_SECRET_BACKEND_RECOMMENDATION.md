# REL-002 Phase 2D-0I Production Secret Backend Recommendation

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-346 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security / Operations Owner |
| 기준 Main | `e973c6e66fb53b3cfb0908b777a8af0704f64812` |
| Decisions | DEC-189 / DEC-190 / DEC-191 |

## 1. 결론

권고 physical backend는 **Railway Production service-scoped sealed variables**다. 단, 현재 Railpack 방식에서 곧바로 secret value를 넣는 것은 승인하지 않는다. 먼저 Dockerfile build isolation을 구현하여 secret variable을 Docker `ARG` 또는 build environment로 전달하지 않는 구조를 증명해야 한다.

| 항목 | 결과 |
|---|---|
| Physical backend | `RAILWAY_SERVICE_SCOPED_SEALED_VARIABLES` — APPROVED |
| Build isolation | `DOCKERFILE_NO_SECRET_ARG` — REQUIRED |
| Runtime consumption | exact `SecretReferenceResolver` allowlist only |
| External secret manager | NOT REQUIRED for the initial bounded database secret scope |
| Current execution | `SECRET_BACKEND_EXECUTION = BLOCKED` |

Railway 공식 문서는 일반 service variables가 build와 runtime 모두에 제공된다고 명시한다. Sealing은 UI/API/CLI에서 값을 다시 읽는 것을 막지만 build availability 자체를 제거하지 않는다. 반면 Railway Dockerfile 문서는 Docker build가 명시적으로 선언한 `ARG`만 Railway variable을 받을 수 있다고 설명한다. 따라서 정책상 “빌드에서 참조하지 않음”이 아니라, **Dockerfile에 secret `ARG`가 존재하지 않음**을 구조적으로 검증하는 조건이 필요하다.

## 2. DEC-186와의 관계

`DEC-186`은 계속 `APPROVED`이며 현재 실행 차단 근거다. `DEC-189`는 `APPROVED`이지만 Docker build isolation이 구현·검증되기 전에는 Railway sealed variable을 실행 가능한 physical secret backend로 사용할 수 없다.

`DEC-189`는 DEC-186의 다음 원칙을 보존한다.

- application configuration에는 `SECRET_REFERENCE`만 존재한다.
- `SECRET_VALUE`는 exact resolver와 PostgreSQL adapter에만 transient하게 전달된다.
- Vercel, browser, Console, child root, log, audit, telemetry visibility는 `0`이다.

변경되는 것은 physical backend 선택뿐이다. Railpack build-visible variable은 계속 금지되고, Docker build에서 제외되는 sealed runtime variable만 bounded exception이 된다.

## 3. 대안 판정

| Option | 판정 | 이유 |
|---|---|---|
| A. Railway Variables directly under current Railpack build | REJECTED | build process가 secret value를 받을 수 있다 |
| A'. Railway sealed variables with Dockerfile isolation | RECOMMENDED | 새 secrets product 없이 build exclusion을 구조적으로 증명 가능 |
| B. Railway reference to external secret manager | DEFERRED | workload identity가 없으면 bootstrap token을 다시 Railway에 저장해야 하며 network/SDK/availability 경계가 추가된다 |
| C. Existing bounded repository secret backend | NOT FOUND | 현재 repository에는 Production runtime secret-value backend가 없다 |

Supabase Vault는 database connection을 얻기 전에 같은 database에 접속해야 하므로 초기 PostgreSQL credential의 physical backend로 사용할 수 없다. Railway OAuth/OIDC user login은 workload identity secret retrieval contract가 아니므로 대체 근거가 아니다.

## 4. 승인 후 실행 상태

- `DEC-189/190/191 = APPROVED`
- `SECRET_BACKEND_EXECUTION = BLOCKED`
- Production connection / DB write / migration / role execution / deployment / secret write = `0`

## 5. 공식 근거

- [Railway Variables](https://docs.railway.com/variables)
- [Railway Dockerfiles — build variables](https://docs.railway.com/builds/dockerfiles)
- [Lock Down a Production Railway Project](https://docs.railway.com/guides/lock-down-production-project)
