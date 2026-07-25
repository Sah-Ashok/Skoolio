# =============================================================
#  Skoolio – Backend Dockerfile
#  Stack  : Node 20 + TypeScript + Express
#  Entry  : server.ts  →  dist/server.js
# =============================================================

# -------------------------------------------------------------
# Stage 1: builder  –  compile TypeScript
# -------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Install ALL deps (devDeps needed for tsc / ts-node)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source then compile
COPY . .
RUN npm run build
# Output lands in /app/dist/  (server.js + src/**)

# -------------------------------------------------------------
# Stage 2: runner  –  lean production image
# -------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Compiled JS
COPY --from=builder /app/dist ./dist

# Migrations (available for manual runs if needed)
COPY --from=builder /app/migrations ./migrations

# Non-root user for security
RUN addgroup -S skoolio && adduser -S skoolio -G skoolio
USER skoolio

EXPOSE 5001

CMD ["node", "dist/server.js"]
