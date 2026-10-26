# Handoff widget as a plain container (no Cloudflare). Serves public/ + the same
# Hono routes as src/worker.ts, see src/server.ts.
#
#   docker build -t qiscus-wa-handoff .
#   docker run --rm -p 8080:8080 qiscus-wa-handoff
#
# Web Push (optional): pass the PUBLIC Firebase web config / VAPID key as env,
# e.g. -e FIREBASE_API_KEY=... (see README, "Web Push"). Never a service account.

FROM oven/bun:1.4-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
# Only what src/server.ts needs at runtime is bundled; devDependencies and the
# Cloudflare/Alchemy tooling never reach the final image.
RUN bun install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN bun build src/server.ts --target=bun --outfile=dist/server.js

FROM oven/bun:1.4-alpine
ENV NODE_ENV=production PORT=8080
WORKDIR /app
# public/ already holds the built bundle, room SDK and push scripts (committed);
# rebuild them with `bun run build:vendor` / `bun run build:client`, then rebuild the image.
COPY --from=build /app/dist/server.js ./server.js
COPY public ./public
USER bun
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "const r=await fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/widget.html');process.exit(r.ok?0:1)"
CMD ["bun", "server.js"]
