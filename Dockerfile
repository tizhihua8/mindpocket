# ============================================
# MindPocket Web - Single Service Docker Build
# ============================================

FROM node:22-alpine AS builder

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@10.9.0 --activate

WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm rebuild bcrypt

ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER=true

RUN pnpm --filter @repo/types build && \
    cd apps/web && npx next build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DOCKER=true
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Keep a minimal workspace copy so the same container can bootstrap the DB
# before starting the standalone Next.js server.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules /workspace/node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web /workspace/apps/web
COPY --from=builder --chown=nextjs:nodejs /app/packages /workspace/packages
COPY --from=builder --chown=nextjs:nodejs /app/package.json /workspace/package.json
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-lock.yaml /workspace/pnpm-lock.yaml
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-workspace.yaml /workspace/pnpm-workspace.yaml
COPY --chown=nextjs:nodejs --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
