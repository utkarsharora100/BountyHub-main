# BountyHub — Database Architecture

BountyHub uses three databases with distinct, non-overlapping roles. This is a deliberate polyglot-persistence design driven by CQRS (Command Query Responsibility Segregation): writes and reads travel separate paths and are served by different stores optimised for each workload.

---

## Overview

```
                           ┌─────────────────────────────────────────┐
                           │              Client (Next.js)            │
                           └──────────────────┬──────────────────────┘
                                              │
                                        Nginx :8080
                                    ┌─────────┴─────────┐
                               Writes (POST/PATCH)    Reads (GET)
                                    │                      │
                           ┌────────▼──────┐    ┌─────────▼────────┐
                           │  Transaction  │    │   Discovery      │
                           │   Service     │    │   Service        │
                           └──────┬────────┘    └──────────────────┘
                                  │                   ↑        ↑
                      ┌───────────┼──────────┐        │        │
                      │           │          │     Redis     MongoDB
                  PostgreSQL   Redis      Redis    (cache)  (catalog)
                  (Primary)  (XADD event) (cache)
                      │           │
              WAL replication     │ XREADGROUP
                      │           │
                 PostgreSQL     Sync Worker
                 (Replica)      (background)
                      │           │
                      └─────► MongoDB
                           (upsert catalog)
```

---

## 1. PostgreSQL — Source of Truth

**Ports:** Primary `5432`, Read Replica `5433`  
**ORM:** Prisma 5 (`prisma` client for writes, `prismaRead` for reads)  
**Container names:** `bounty-postgres-master`, `bounty-postgres-replica`

### Purpose

PostgreSQL holds the authoritative, normalised record of every entity. Any data here is correct by definition. Other databases are derived from it.

- All INSERTs, UPDATEs, DELETEs go to the **primary** via the `prisma` Prisma client.
- The **read replica** handles: (a) Sync Worker reads when rebuilding MongoDB, (b) `prismaRead` client for any PostgreSQL-backed reads.
- Replication is async WAL streaming — the replica may lag slightly, which is acceptable for sync and reporting queries.

### Schema

| Table | Key Columns | Purpose |
|---|---|---|
| `universities` | `id`, `name`, `country` | University registry |
| `users` | `id`, `email`, `university_id`, `role`, `reputation` | Auth + identity |
| `bounties` | `id`, `title`, `description`, `status`, `reward_points`, `created_by`, `deadline` | Bounty lifecycle |
| `bids` | `id`, `bounty_id`, `bidder_id`, `status` | Who wants to solve a bounty |
| `submissions` | `id`, `bounty_id`, `submitted_by`, `submission_link`, `status` | Work submitted against a bounty |
| `comments` | `id`, `bounty_id`, `user_id`, `content` | Discussion thread per bounty |
| `reputation_log` | `id`, `user_id`, `points`, `reason` | Audit trail for reputation changes |

### Indexes

Compound indexes are designed around the actual query shapes, not individual columns:

| Table | Index | Query it serves |
|---|---|---|
| `bounties` | `(status, reward_points DESC)` | Trending: `WHERE status='OPEN' ORDER BY reward_points DESC` |
| `bounties` | `(status, created_at DESC)` | Default list: `WHERE status=? ORDER BY created_at DESC` |
| `bounties` | `(status, deadline)` | Lifecycle worker expiry sweep |
| `bids` | `(bounty_id, created_at DESC)` | Bids for a bounty in order |
| `submissions` | `(bounty_id, created_at DESC)` | Submissions for a bounty in order |
| `comments` | `(bounty_id, created_at DESC)` | Comment thread for a bounty |
| `reputation_log` | `(user_id, created_at DESC)` | Reputation history for a user |
| `users` | `(reputation DESC)` | Leaderboard |

### Rules

- **Never use the `prismaRead` client for writes** — it points at the replica which is read-only.
- **Never use the `prisma` (master) client for SELECT queries** in repositories — routes unnecessary traffic to the primary.

---

## 2. MongoDB — Read Catalog

**Ports:** Primary `27017`, Replica `27018`  
**Replica set:** `rs0`  
**Read preference:** `secondaryPreferred` (reads go to replica when available)  
**Container names:** `bounty-mongo-primary`, `bounty-mongo-replica`  
**Collection:** `bounty_catalog`  
**Shard key:** `university_id`

### Purpose

MongoDB stores a **denormalised, flat snapshot** of every bounty — including creator info, bid count, and submission count — so the Discovery Service can serve list/search responses in a single query with no JOINs.

It is a read replica of PostgreSQL, not an independent store. It should never be written to directly by application code. All writes happen via the Sync Worker.

### Document Shape (`BountyCatalog`)

```js
{
  bounty_id:        Number,   // PK from PostgreSQL
  university_id:    Number,   // shard key — include in every query
  title:            String,
  description:      String,
  category:         String,
  status:           String,   // 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  reward_points:    Number,
  deadline:         Date,
  creator: {
    id:         Number,
    name:       String,
    reputation: Number,
    university: String,
  },
  bid_count:        Number,
  submission_count: Number,
  skills:           [String],
  createdAt:        Date,     // auto (Mongoose timestamps)
  updatedAt:        Date,
}
```

### Indexes

| Index | Purpose |
|---|---|
| `{ university_id: 1 }` | Targeted shard routing — avoids scatter-gather across shards |
| `{ title: 'text', description: 'text' }` | Full-text search via `$text` operator in Discovery Service |

### Rules

- **Always include `university_id` in queries** — omitting it forces a scatter-gather across all shards.
- **Only the Sync Worker writes here.** The Discovery Service is strictly read-only against MongoDB.
- Documents are upserted (`findOneAndUpdate` with `upsert: true`) so re-running the sync is idempotent.

---

## 3. Redis — Event Bus + Cache + Search Index

**Port:** `6369`  
**Client:** ioredis  
**Container name:** `bounty-redis`

Redis serves three completely separate responsibilities, each using a different data structure.

### 3a. HTTP Cache (`GET` / `SETEX`)

Caches JSON-serialised API responses to avoid hitting MongoDB or PostgreSQL on hot read paths.

| Key pattern | TTL | Contents |
|---|---|---|
| `bounties:list:{json-params}` | 600s | Paginated bounty list response |
| `bounties:detail:{id}` | 300s | Single bounty detail |
| `bounties:trending` | 600s | Top-10 open bounties by reward |
| `search:{query-hash}` | 600s | Full-text search results |

Cache is **warmed on startup** by `cacheWarmer.js` so the first user request to the default list and trending endpoints always hits cache.

Cache is **invalidated by pattern** (`cacheInvalidate('bounties:*')`) after every write operation in `bountyService.js`.

**Important:** The shared `redis` client instance is used only for cache operations (non-blocking `GET`/`SETEX`/`DEL`/`KEYS`). The Sync Worker uses a **separate dedicated connection** (`streamRedis`) for `XREADGROUP BLOCK` so the blocking stream call never queues cache reads on the shared connection.

### 3b. Event Bus (Redis Streams — `events:bounty`)

After every bounty write, the Transaction Service publishes an event onto the `events:bounty` stream:

```
XADD events:bounty * type state:changed data {"id":42,...}
```

The Sync Worker reads from this stream via a consumer group (`sync-workers`) using `XREADGROUP BLOCK 5000`. On each event it:
1. Reads the full bounty record from the PostgreSQL read replica.
2. Builds the denormalised document.
3. Upserts it into MongoDB `bounty_catalog`.
4. ACKs the message (`XACK`).

This decouples the write path from the MongoDB sync — PostgreSQL writes are never slowed by MongoDB latency.

### 3c. Autocomplete Search Index (Sorted Sets)

Two sorted sets power the search autocomplete:

| Key | Type | Purpose |
|---|---|---|
| `search:terms` | Sorted set (all scores = 0) | Lexicographic prefix scan via `ZRANGEBYLEX` |
| `search:suggestions` | Sorted set (score = frequency) | Popularity-ranked suggestions, capped at 1000 |

When a user types in the search box, `ZRANGEBYLEX search:terms "[react" "[react\xff" LIMIT 0 8` returns up to 8 prefix-matching terms in O(log N). Popularity tracking increments scores in `search:suggestions` so frequently searched terms surface higher.

Both sets are populated at startup by `cacheWarmer.js` with 1,000+ pre-seeded terms extracted from bounty titles.

---

## 4. CQRS Data Flow

### Write Path

```
1. Client POST /api/bounties
2. Nginx → Transaction Service (Express)
3. Service validates + writes to PostgreSQL Primary (prisma client)
4. Service calls cacheInvalidate('bounties:*') on Redis
5. Service calls publishEvent('state:changed', payload) → XADD events:bounty
6. HTTP 201 returned to client
```

### Sync Path (background, async)

```
7. Sync Worker reads XREADGROUP BLOCK 5000 from events:bounty (streamRedis)
8. Worker calls fetchBounty(id) → SELECT from PostgreSQL Replica (prismaRead)
9. Worker builds denormalised doc (buildCatalogDoc)
10. Worker upserts into MongoDB bounty_catalog
11. Worker ACKs message (XACK on sharedRedis)
```

### Read Path

```
1. Client GET /api/bounties
2. Nginx → Discovery Service (same Express process, separate routes)
3. cacheGet('bounties:list:...') checks Redis
4. Cache HIT → return JSON immediately (< 5ms)
5. Cache MISS → MongoDB BountyCatalog.find() with secondaryPreferred
6. Response cached in Redis with 600s TTL
7. HTTP 200 returned to client
```

---

## 5. Docker Infrastructure

All databases run as Docker containers defined in `docker-compose.yml`.

| Container | Image | Role |
|---|---|---|
| `bounty-postgres-master` | `postgres:16` | PostgreSQL primary, accepts all writes |
| `bounty-postgres-replica` | `postgres:16` | PostgreSQL read replica, WAL streaming from master |
| `bounty-redis` | `redis:7-alpine` | Single Redis node — cache, streams, sorted sets |
| `bounty-mongo-primary` | `mongo:7` | MongoDB primary (`rs0`) |
| `bounty-mongo-replica` | `mongo:7` | MongoDB replica (`rs0`), secondaryPreferred reads |
| `bounty-db-init` | Custom | One-shot: initialises replica set, creates Mongo user |
| `bounty-sync-worker` | Same as server | Runs `syncWorker.js` in isolation (`WORKER_ONLY=true`) |

### Connection Strings

```env
# PostgreSQL write path
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/bounty_platform

# PostgreSQL read path (replica)
DATABASE_READ_URL=postgresql://postgres:postgres123@localhost:5433/bounty_platform

# Redis
REDIS_URL=redis://localhost:6369

# MongoDB (replica set, secondary-preferred reads)
MONGODB_URL=mongodb://utkarsh:123456@localhost:27017,localhost:27018/bounty_platform?replicaSet=rs0&readPreference=secondaryPreferred&authSource=bounty_platform
```

---

## 6. Why This Design

| Decision | Reason |
|---|---|
| PostgreSQL as source of truth | ACID guarantees, foreign keys, schema enforcement — no dirty data |
| MongoDB for reads | No JOIN overhead on list/search; denormalised doc maps 1:1 to API response shape |
| Redis cache in front of MongoDB | Eliminates repeated identical queries; bounty lists change infrequently |
| Redis Streams for sync | Decouples write latency from MongoDB sync latency; retryable; ordered per key |
| Separate `streamRedis` connection | ioredis queues all commands on one TCP connection; `BLOCK 5000` would stall every cache `GET` on the shared connection |
| Read replica for sync reads | The sync worker runs constant SELECT queries during rebuild; using the replica shields the primary from that read load |
| `secondaryPreferred` MongoDB reads | Spreads read load across the replica set; primary is only used when replica is behind |
| `university_id` as shard key | Even data distribution; all queries are university-scoped so targeted routing eliminates scatter-gather |
