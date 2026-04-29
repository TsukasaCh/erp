# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---------- runner ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache tini openssl \
 && addgroup -g 1001 -S nodejs \
 && adduser  -u 1001 -S nodejs -G nodejs

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist          ./dist
COPY --from=builder --chown=nodejs:nodejs /app/prisma        ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/package.json  ./package.json

USER nodejs
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/index.js"]
