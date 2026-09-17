# syntax=docker/dockerfile:1

FROM --platform=$BUILDPLATFORM oven/bun:1-alpine AS install
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1-alpine AS release
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

COPY --from=install /app/node_modules node_modules
COPY package.json tsconfig.json ./
COPY src src

USER bun
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null 2>&1 || exit 1

CMD ["bun", "run", "src/index.ts"]
