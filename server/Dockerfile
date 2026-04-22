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

# API container should only run the server process.
CMD ["node", "src/index.js"]
