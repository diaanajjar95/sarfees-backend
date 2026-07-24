# --- Build stage ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Production stage ---
# Uses the Next.js `output: 'standalone'` bundle — a self-contained
# node_modules subset that's ~10x smaller than a full install.
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Standalone server + its trimmed node_modules
COPY --from=builder /app/.next/standalone ./
# Static assets (Next serves these itself in standalone mode)
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3001

CMD ["node", "server.js"]
