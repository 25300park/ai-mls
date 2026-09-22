# REL-002 Phase 2D-0I Railway Build / Runtime Exposure Analysis

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-348 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Operations / Security Owner |
| 기준 Main | `e973c6e66fb53b3cfb0908b777a8af0704f64812` |

## 1. Observed platform behavior

Railway service variables는 일반 build process와 running deployment에 제공된다. Sealed variable은 value read-back을 막지만 builds/deployments에는 제공된다. 따라서 현재 Railpack build 아래에서 “build script가 사용하지 않는다”는 코드 관례만으로 runtime-only를 증명할 수 없다.

Railway Dockerfile build에서는 variable을 build에 사용하려면 해당 stage에 Docker `ARG`를 명시해야 한다. 이 차이를 이용해 runtime secret이 build context에 주입되지 않는 구조를 만든다.

## 2. Required build contract

1. Railway builder는 Dockerfile로 전환한다.
2. Build stage는 기존 `pnpm install --frozen-lockfile` 및 `pnpm run build`를 수행한다.
3. 다음 secret physical variable 이름은 어느 stage에도 `ARG` 또는 `ENV`로 선언하지 않는다.
4. build/test script는 secret reference를 resolve하지 않는다.
5. final runtime image에는 source, `.env`, Railway metadata dump 또는 build cache를 복사하지 않는다.
6. build guard는 secret key presence만 검사하고 value를 출력하지 않은 채 presence 발견 시 실패한다.
7. artifact/layer verification은 known secret key names, PEM header 및 PostgreSQL credential pattern이 없는지 검사한다. 실제 secret value는 검사 입력이나 로그에 사용하지 않는다.

## 3. Runtime-only contract

- Railway가 sealed values를 Production `ai-mls-api` running container에 environment variables로 주입한다.
- `ProductionBootstrap`은 non-secret config와 opaque references만 parse한다.
- exact resolver가 allowlisted reference를 exact physical environment key로 변환한다.
- PostgreSQL pool construction 직전에만 `SECRET_VALUE`를 읽고, typed configuration이나 child root로 복사하지 않는다.
- resolver는 value를 cache, persist, log, fingerprint 또는 return DTO로 노출하지 않는다.
- startup failure는 safe `NOT_READY`만 남기고 listener/worker/provider/DB mutation을 시작하지 않는다.

## 4. Prohibited paths

- Railpack/Nixpacks build에 raw secret value 제공
- Docker `ARG`/`ENV`로 secret physical key 선언
- `railway run`, CLI list, shell 또는 build log를 이용한 value 확인
- shared variable, PR environment, duplicated environment/service로 Production secret 복제
- Vercel variable 또는 browser-prefixed variable로 복제
- pre-deploy migration에서 runtime credential 사용

## 5. Acceptance evidence for later implementation

| Evidence | Required result |
|---|---|
| Dockerfile static contract | secret `ARG`/`ENV` = 0 |
| Build guard | secret physical key presence = 0 |
| Runtime resolver focused tests | exact two mappings PASS |
| Artifact scan | connection string / PEM / secret key leakage = 0 |
| Vercel mapping | Production DB secret/reference = 0 |
| Railway configuration evidence | Production API service scoped + sealed |

## 6. Official sources

- [Using Variables](https://docs.railway.com/variables)
- [Dockerfiles](https://docs.railway.com/builds/dockerfiles)
- [Production project lockdown](https://docs.railway.com/guides/lock-down-production-project)
