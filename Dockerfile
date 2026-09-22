# syntax=docker/dockerfile:1
FROM node:24.18.0-bookworm-slim AS build

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.build.json eslint.config.mjs ./
RUN pnpm install --frozen-lockfile
COPY apps ./apps
COPY modules ./modules
COPY packages ./packages
RUN pnpm run build
RUN find dist -type f \( -name '*.d.ts' -o -name '*.d.ts.map' -o -name '*.js.map' -o -name '.tsbuildinfo' \) -delete
COPY Dockerfile .dockerignore ./
RUN node dist/apps/api/src/production-docker-build-contract.js Dockerfile .dockerignore
RUN pnpm prune --prod \
  && find node_modules -type f \( -iname 'README*' -o -name '*.ts' -o -name '*.map' -o -name '*.test.*' \) -delete

FROM node:24.18.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN find /app -type f -exec node dist/apps/api/src/production-image-inspection.js {} +
USER node
CMD ["node", "dist/apps/api/src/production-main.js"]
