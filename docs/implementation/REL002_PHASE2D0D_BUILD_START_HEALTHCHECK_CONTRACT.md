# REL-002 Phase 2D-0D Build / Start / Healthcheck Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-330 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Operations Owner |
| 기준 Main | `bbc6fd92f700f3ec3b12db9f8972c2aa78175536` |

## 1. Railway source/build contract

| Item | Contract | Evidence/status |
|---|---|---|
| Root Directory | repository root `.` | root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` |
| Builder | `REQUIRES_CONFIGURATION` | no committed Railway builder/IaC contract exists |
| Node runtime | exact `24.18.0` | root `package.json#engines.node` |
| pnpm runtime | exact `11.9.0` | `packageManager` and `engines.pnpm` |
| Install | `pnpm install --frozen-lockfile` | deterministic lockfile contract |
| Build Command | `pnpm install --frozen-lockfile && pnpm run build` | root build script cleans then compiles `tsconfig.build.json` |
| Build output | `dist/` | `tsconfig.build.json` |

Builder selection remains `REQUIRES_CONFIGURATION`; Railway default behavior is not promoted to canonical truth by this document.

## 2. Start contract

Canonical startup function is `startProductionRuntime(rawConfiguration, dependencies)`. However the repository contains no Production `main` executable, no root Production start script and no dependency composition that converts Railway variables into `ProductionBootstrapDependencies`.

```text
START_COMMAND = NOT_AVAILABLE / REQUIRES_IMPLEMENTATION
```

An eventual start command must invoke one committed Production executable under `dist/` and that executable must call `startProductionRuntime()` exactly once. It must not invoke Staging Console bootstrap, SQLite composition, migration artifacts or a child root directly.

## 3. Healthcheck contract

The codebase has internal readiness projections, but there is no verified Railway-reachable HTTP health/readiness route owned by the Production entrypoint. Reusing an internal Console route or inventing a path would create false deployment evidence.

```text
RAILWAY_HEALTHCHECK_PATH = NOT_AVAILABLE / REQUIRES_IMPLEMENTATION
```

The future endpoint must be unauthenticated only if separately security-approved, expose no DB/provider/schema detail, return success only after bootstrap and schema compatibility PASS, transition unavailable before shutdown, and remain distinct from business authorization. Until it exists, Railway deployment healthcheck configuration is blocked.

## 4. No-action evidence

This contract performs no Railway deployment/configuration, Supabase connection, migration, Production DB write, listener start, worker start or provider call.

## 5. Related documents

- [Physical Binding Contract](REL002_PHASE2D0D_RAILWAY_SUPABASE_BINDING_CONTRACT.md)
- [Railway Variable Matrix](REL002_PHASE2D0D_RAILWAY_VARIABLE_MATRIX.md)
- [Secret Reference Mapping](REL002_PHASE2D0D_SECRET_REFERENCE_MAPPING.md)
- [Completion Report](../reviews/REL002_PHASE2D0D_COMPLETION_REPORT.md)
