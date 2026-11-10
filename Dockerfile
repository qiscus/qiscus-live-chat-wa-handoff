# Live widget (qiscus/qiscus-live-chat-wa-handoff) on Kubernetes.
# Build context = repo root. src/server.ts serves public/ the same way the
# Cloudflare ASSETS binding does and falls back to the Hono app in src/worker.ts.
# Runtime image holds only the bundled server and public/ — no node_modules,
# no Alchemy, no Cloudflare credentials.
FROM oven/bun:1.4.4 AS build
WORKDIR /src
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY src ./src
RUN bun build src/server.ts --target=bun --minify --outfile=/out/server.js

FROM oven/bun:1.4.4-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /out/server.js ./server.js
COPY public ./public
USER bun
EXPOSE 8080
CMD ["bun", "server.js"]
