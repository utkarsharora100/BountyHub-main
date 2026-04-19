# ─── Client Dockerfile ────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better caching)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

# Build the Next.js app (bake API URL for rewrites)
ENV NEXT_PUBLIC_API_URL=http://server:5000
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
