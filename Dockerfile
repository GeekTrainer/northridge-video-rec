# Build and run the gateway plus all three production department services.
FROM node:24-bookworm-slim AS build

WORKDIR /app

# Copy manifests first so dependency installation remains cacheable.
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY gateway/package.json gateway/package.json
COPY apps/video/package.json apps/video/package.json
COPY apps/music/package.json apps/music/package.json
COPY apps/books/package.json apps/books/package.json
COPY mcp-server/package.json mcp-server/package.json
RUN npm ci

COPY . .
RUN npm run db:reset && npm run build

FROM node:24-bookworm-slim AS production

WORKDIR /app
ENV NODE_ENV=production

# The root start script uses concurrently, so retain the lockfile-resolved
# dependencies in the runtime image.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/gateway ./gateway
COPY --from=build /app/apps ./apps
COPY --from=build /app/shared ./shared
COPY --from=build /app/data ./data
COPY --from=build /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod 0555 docker-entrypoint.sh \
  && chown -R node:node /app

USER node
EXPOSE 3000 3001 3002 3003
ENTRYPOINT ["./docker-entrypoint.sh"]
