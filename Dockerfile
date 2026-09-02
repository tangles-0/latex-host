FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat && corepack enable

FROM base AS builder
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV LATEX_DATA_DIR=/storage/.latex
ENV NODE_BROWSE_ROOT=/storage

RUN apk add --no-cache libc6-compat \
  && addgroup -S nodejs -g 1001 \
  && adduser -S nextjs -u 1001 -G nodejs \
  && mkdir -p /storage/.latex \
  && chown -R nextjs:nodejs /storage

ARG IMAGE_VERSION=dev
ENV LATEX_NODE_VERSION="${IMAGE_VERSION}"
LABEL org.opencontainers.image.source="https://github.com/tangles-0/latex-host"
LABEL org.opencontainers.image.version="${IMAGE_VERSION}"

# Next standalone output keeps runtime surface close to Vercel app runtime.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/src/db ./src/db
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

USER nextjs
EXPOSE 3000
CMD ["sh", "./scripts/docker-entrypoint.sh"]
