# syntax=docker/dockerfile:1.7

# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund --legacy-peer-deps

# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.mjs ./next.config.mjs

USER nextjs
EXPOSE 3000
CMD ["npx", "next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
