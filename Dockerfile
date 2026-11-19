FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
RUN test -n "$NEXT_PUBLIC_SITE_URL" && npm run build

FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends clamav clamav-freshclam ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 minhlab && useradd --uid 10001 --gid minhlab --create-home minhlab \
    && mkdir -p /app/.next/cache /var/lib/minhlab/private-files /var/lib/minhlab/purge-journal \
    && chown -R minhlab:minhlab /app /var/lib/minhlab
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 MINHLAB_ENV_FROM_PROCESS=true
# CLI workers transpile TypeScript, so the existing typescript dependency is retained.
COPY --from=builder --chown=minhlab:minhlab /app/node_modules ./node_modules
COPY --from=builder --chown=minhlab:minhlab /app/.next ./.next
COPY --from=builder --chown=minhlab:minhlab /app/public ./public
COPY --from=builder --chown=minhlab:minhlab /app/src ./src
COPY --from=builder --chown=minhlab:minhlab /app/scripts ./scripts
COPY --from=builder --chown=minhlab:minhlab /app/database ./database
COPY --from=builder --chown=minhlab:minhlab /app/package.json /app/package-lock.json /app/next.config.mjs ./
USER minhlab
EXPOSE 3000
CMD ["npm", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
