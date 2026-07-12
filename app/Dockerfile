FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS base

# Application build dependencies.
FROM base AS deps
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci

# Build
FROM deps AS builder
COPY app/. .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
ARG GIT_COMMIT=dev
ARG BUILD_TIME=
ENV NEXT_PUBLIC_GIT_COMMIT=$GIT_COMMIT
ENV NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME
RUN npm run build

# Disposable image used by the Docker Compose local-storage contract test.
FROM deps AS storage-smoke
COPY app/. .
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs storage-smoke \
    && mkdir -p /data/uploads \
    && chown -R storage-smoke:nodejs /data
USER storage-smoke
ENTRYPOINT ["./node_modules/.bin/tsx", "scripts/local-storage-smoke.ts"]

# One-shot Prisma migrations for Docker Compose and other job runners.
FROM base AS migrator
WORKDIR /app
COPY app/migrator/package.json app/migrator/package-lock.json ./
RUN npm ci --omit=dev
COPY app/prisma.config.ts ./
COPY app/prisma ./prisma
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir -p /data/uploads && chown -R nextjs:nodejs /data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs LICENSE THIRD_PARTY_NOTICES.md ./licenses/
COPY --chown=nextjs:nodejs docs/THIRD-PARTY-LICENSES.md ./licenses/THIRD-PARTY-LICENSES.md
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/exceljs/LICENSE ./licenses/npm/exceljs-LICENSE
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/unzipper/LICENSE ./licenses/npm/unzipper-LICENSE

USER nextjs
EXPOSE 8080

CMD ["node", "server.js"]
