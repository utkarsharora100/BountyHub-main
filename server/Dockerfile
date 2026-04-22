# ─── Server Dockerfile ────────────────────────────────────────
FROM node:20-alpine

# Prisma needs OpenSSL on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies first (better caching)
COPY package.json package-lock.json* ./
RUN npm install

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source code
COPY . .

EXPOSE 5000

# Compose runs schema push + seed in db-init; API containers only wait and serve.
CMD ["sh", "-c", "node scripts/wait-for-read-model.js --seeded && node src/index.js"]
