# ── Stage 1: Build Stage ──
FROM node:20-alpine AS builder

WORKDIR /app

# Install native compilation dependencies for bcrypt and pg
RUN apk add --no-cache python3 make g++

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
COPY server.ts ./

RUN npm run build

# ── Stage 2: Production Runtime ──
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install build dependencies for production modules, install production deps, then remove build tools
RUN apk add --no-cache python3 make g++ \
    && apk add --no-cache wget

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force \
    && apk del python3 make g++

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Run as non-root user for container security
USER node

EXPOSE 5000

# Built-in health check using backend /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "dist/server.js"]
