# BountyHub — CLAUDE.md

## What This System Is

**BountyHub** is a polyglot-persistence, CQRS-based multi-university bounty collaboration platform. Students and staff post bounties (coding, research, design, etc.), others bid and submit solutions, and reputation is tracked across universities.

The architecture strictly separates **write** from **read** paths and uses three databases for distinct purposes.

---

## Architecture at a Glance

```
Frontend (Next.js)  →  Nginx Load Balancer
                            ├── Write Traffic  →  Transaction Service (Node.js, 5 nodes)
                            └── Read Traffic   →  Discovery Service (Node.js, 10 nodes)

Transaction Service  →  PostgreSQL Primary (WAL + ACID writes)
                      →  Redis Event Bus     (publishes state-changed events)

Sync Worker (50 consumers)  ←  Redis Stream   (triggered by state-change events)
                             →  Reads from PostgreSQL Read Replica (WAL async replication)
                             →  Upserts into MongoDB (denormalized documents)

Discovery Service  →  MongoDB Sharded Cluster (secondaryPreferred reads)
                   →  Redis Sorted Sets        (ZINCRBY autocomplete / hot score)
```

---

## Repository Layout

```
BountyHub-main/
├── client/                    # Next.js 14 frontend (React, Tailwind)
│   ├── pages/                 # File-based routing (index, search, leaderboard, bounties/*, profile/*)
│   ├── components/            # BountyCard, Layout, Modal, Pagination, Skeletons
│   ├── hooks/                 # useAuth, useTheme
│   └── lib/api.js             # Axios wrapper for all API calls
│
├── server/                    # Node.js / Express backend (single process, CQRS internally split)
│   ├── prisma/
│   │   ├── schema.prisma      # PostgreSQL schema — source of truth
│   │   └── seed.js            # Dev seed data
│   └── src/
│       ├── config/
│       │   ├── database.js    # Prisma master + read-replica clients
│       │   ├── mongodb.js     # Mongoose connection (replicaSet=rs0, readPreference=secondaryPreferred)
│       │   ├── Document.js    # Mongoose model for denormalized bounty documents
│       │   ├── redis.js       # ioredis master + replica; cacheGet / cacheInvalidate helpers
│       │   └── index.js       # Env config aggregator
│       ├── controllers/       # Express req/res handlers (thin layer)
│       ├── services/
│       │   ├── bountyService.js      # Write path — creates/updates bounties, invalidates cache
│       │   ├── discoveryService.js   # Read path — MongoDB full-text search + secondaryPreferred
│       │   ├── authService.js        # JWT issue + verify
│       │   ├── bidService.js
│       │   ├── submissionService.js
│       │   ├── searchService.js      # Redis ZRANGEBYLEX autocomplete
│       │   ├── commentService.js
│       │   └── userService.js
│       ├── workers/
│       │   ├── syncWorker.js        # Redis stream consumer → PG replica read → MongoDB upsert
│       │   └── lifecycleWorker.js   # Runs every 60s, cancels expired OPEN bounties
│       ├── repositories/      # Prisma queries (use prismaRead for SELECTs, prisma for writes)
│       ├── routes/            # Express routers
│       ├── middleware/        # auth.js (JWT), validate.js, errorHandler.js
│       └── utils/             # AppError, logger (winston), pagination
│
├── nginx/
│   ├── nginx.conf             # Routes /api/* → server:5000, / → client:3000
│   └── Dockerfile             # FROM nginx:alpine
└── docker-compose.yml         # Full stack: PG+replica, Redis+replica, Mongo+replica, server, client, nginx, db-init, catalog-sync-worker
```

---

## Data Layer — Three Databases, Three Roles

### PostgreSQL (Source of Truth)
- **Primary** on port `5432` — all INSERTs, UPDATEs, DELETEs via Prisma `prisma` client
- **Read Replica** on port `5433` — async WAL replication; used by Sync Worker reads and Prisma `prismaRead` client
- ORM: Prisma 5 with `fullTextSearch` preview feature
- Schema: `University → User → Bounty → Bid / Submission / Comment / ReputationLog`
- Shard concept: `university_id` is indexed everywhere; MongoDB shards on it

### Redis (Event Bus + Cache + Search Index)
- **Master** on port `6369` — writes: `SETEX` cache, `XADD` stream events, `ZINCRBY` hot score
- **Replica** on port `6380` — reads: `GET` cache (via `cacheGet`), `ZRANGEBYLEX` autocomplete
- Streams & Consumer Groups: Sync Worker subscribes with a consumer group of 50 workers
- TTL cache: bounty list (30s), search results (60s), sessions/trending (configurable)

### MongoDB (Read Replica / Catalog)
- **Primary** on port `27017`, **Replica** on port `27018` — replica set `rs0`
- Shard key: `university_id`; router via mongos
- Denormalized `Document` model — flat representation of a bounty for fast reads
- All reads use `secondaryPreferred`; writes go to primary automatically
- Connected via single URI with `replicaSet=rs0&readPreference=secondaryPreferred`

---

## CQRS Flow (Step by Step)

**Write path (Transaction Service):**
1. Client POST → Nginx → Transaction Service
2. Service validates + writes to PostgreSQL Primary (Prisma)
3. Service emits `state:changed` event to Redis Stream (`XADD`)
4. Cache invalidated (`bounties:*`, `trending:*`)

**Sync path (Sync Worker — background):**
4. Sync Worker consumer group reads from Redis Stream (`XREADGROUP`)
5. Worker reads full record from **PostgreSQL Read Replica** (shields primary)
6. Worker flattens/normalizes into denormalized document
7. Worker upserts into **MongoDB** (`Document.findOneAndUpdate` with upsert)

**Read path (Discovery Service):**
6. Client GET → Nginx → Discovery Service
7. Redis cache checked first (`cacheGet` via replica)
8. Cache miss → MongoDB `Document.find()` with `secondaryPreferred`
9. Autocomplete → Redis `ZRANGEBYLEX` on sorted set

---

## Key Files to Know

| File | Purpose |
|---|---|
| `server/prisma/schema.prisma` | PostgreSQL schema — edit this to change data model |
| `server/src/config/database.js` | Prisma master/read split — `prisma` for writes, `prismaRead` for reads |
| `server/src/config/redis.js` | Redis master/replica split; `cacheGet`, `cacheInvalidate` |
| `server/src/config/mongodb.js` | Mongoose connection with replica set URI |
| `server/src/config/Document.js` | MongoDB denormalized document schema |
| `server/src/services/bountyService.js` | Write path for bounties |
| `server/src/services/discoveryService.js` | Read path — MongoDB full-text search |
| `server/src/services/searchService.js` | Redis autocomplete (ZRANGEBYLEX) |
| `docker-compose.yml` | All infrastructure — start everything here |

---

## Dev Setup

```bash
# Start all infrastructure + services
docker compose up --build

# Apply Prisma migrations (first time)
docker exec bounty-server npx prisma migrate dev

# Seed database
docker exec bounty-server npm run seed

# Frontend only (local)
cd client && npm install && npm run dev

# Backend only (local, needs .env)
cd server && npm install && npm run dev
```

**Ports:**
- **UI entry point: `http://localhost:8080`** (Nginx — use this for everything)
- Client direct: `http://localhost:3000`
- Server API direct: `http://localhost:5001` (host) → 5000 inside Docker; port 5000 blocked by macOS AirPlay
- PostgreSQL Primary: `localhost:5432`
- PostgreSQL Replica: `localhost:5433`
- Redis Master: `localhost:6369`
- Redis Replica: `localhost:6380`
- MongoDB Primary: `localhost:27017`
- MongoDB Replica: `localhost:27018`

---

## Environment Variables (`server/.env`)

```env
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/bounty_platform
DATABASE_READ_URL=postgresql://postgres:postgres123@localhost:5433/bounty_platform
REDIS_URL=redis://localhost:6369
REDIS_READ_URL=redis://localhost:6380
MONGODB_URL=mongodb://utkarsh:123456@localhost:27017,localhost:27018/bounty_platform?replicaSet=rs0&readPreference=secondaryPreferred&authSource=bounty_platform
JWT_SECRET=your-secret
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

---

## Coding Rules

1. **Writes always go through `prisma` (master), reads through `prismaRead` (replica).** Never use the master client for a SELECT in a repository.
2. **Every write service must call `cacheInvalidate`** after a state-changing operation.
3. **MongoDB writes only happen in the Sync Worker.** Discovery Service is read-only against MongoDB.
4. **Redis event bus is the trigger for all sync.** Do not call MongoDB directly from Transaction Service.
5. **Always include `university_id` in MongoDB queries** — omitting it causes scatter-gather across shards.
6. **No comments explaining what code does.** Only comment the non-obvious why (invariants, workarounds).
7. **No premature abstraction.** Three similar lines is better than a helper that doesn't exist yet.
8. **Validate only at system boundaries** (HTTP routes). Trust internal service calls.

---

## Running Tests / Health Checks

```bash
# Check replication lag on PostgreSQL replica
docker exec bounty-postgres-replica psql -U postgres -c "SELECT now() - pg_last_xact_replay_timestamp() AS lag;"

# Check Redis replication
docker exec bounty-redis-replica redis-cli info replication

# Check MongoDB replica set status
docker exec bounty-mongo-primary mongosh -u root -p root --authenticationDatabase admin --eval "rs.status()"

# Tail sync worker logs
docker logs bounty-server -f | grep -i sync
```
