# syntax=docker/dockerfile:1

FROM node:22-slim AS base
# OpenSSL is required by Prisma's query engine.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# ---- Install dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# ---- Build the Next.js app (standalone output) ----
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
# Public origin(s) for the Server-Action check. Baked in at build time because
# Next serializes next.config into the standalone output. Passed by compose from
# the ALLOWED_ORIGINS env (a GitHub Actions secret in CI); empty for local builds.
ARG ALLOWED_ORIGINS=""
ENV ALLOWED_ORIGINS=$ALLOWED_ORIGINS
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm exec prisma generate
RUN pnpm run build

# ---- Migrator: lightweight image with the Prisma CLI + schema ----
# Used by the one-shot "migrate" compose service to sync the DB schema.
FROM base AS migrator
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
CMD ["pnpm", "exec", "prisma", "db", "push", "--skip-generate", "--accept-data-loss"]

# ---- Runtime image ----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next standalone output bundles only the traced files it needs.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
