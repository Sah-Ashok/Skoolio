# =============================================================
#  Skoolio – Frontend Dockerfile
#  Stack  : Node 20 + Next.js 16 (standalone output mode)
# =============================================================

# -------------------------------------------------------------
# Stage 1: deps  –  install dependencies
# -------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# -------------------------------------------------------------
# Stage 2: builder  –  build Next.js app
# -------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are baked in at build time.
# /api works when the browser and API share the same nginx origin.
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build
# Produces: .next/standalone/  .next/static/  public/

# -------------------------------------------------------------
# Stage 3: runner  –  minimal production image
# -------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# next.config.ts  output: "standalone"  creates a self-contained server
COPY --from=builder /app/public            ./public
COPY --from=builder /app/.next/standalone  ./
COPY --from=builder /app/.next/static      ./.next/static

# Non-root user
RUN addgroup -S skoolio && adduser -S skoolio -G skoolio
USER skoolio

EXPOSE 3000

CMD ["node", "server.js"]
