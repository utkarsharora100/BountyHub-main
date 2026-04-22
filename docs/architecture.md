# BountyHub — Architecture Deep Dive

## System Overview

BountyHub is a CQRS + polyglot persistence platform. The write path and read path are physically separated and use different databases for different access patterns.

```
Browser
  │
  ▼
Nginx :8080
  ├── /api/*  ──────────────────────────► Express Server :5000
  │                                             │
  │                 ┌───────────────────────────┤
  │                 │                           │
  │          WRITE PATH                   READ PATH
  │       (Transaction Svc)           (Discovery Svc)
  │                 │                           │
  │                 ▼                           ▼
  │        PostgreSQL Master          Redis Replica :6380
  │              :5432                    (cache GET)
  │                 │                           │
  │           Redis Master             cache miss │
  │            :6369 (XADD)                      ▼
  │                 │                    MongoDB Secondary
  │                 ▼                         :27018
  │        Sync Worker (bg)            (secondaryPreferred)
  │                 │
  │      PG Replica :5433 (read)
  │                 │
  │      MongoDB Primary :27017 (upsert)
  │
  └── /  ──────────────────────────────► Next.js Client :3000
```

---

## Full Request Lifecycle

### READ: `GET /api/bounties?status=COMPLETED&page=1&limit=15`

```
Browser
  → Next.js rewrite: /api/* → http://server:5000/api/*
  → Nginx: /api/* → server:5000
  → Express router → bountyController.list()
  → bountyService.list(query)
      ↓
      Build cache key:
        bounties:list:{"skip":0,"take":15,"where":{"status":"COMPLETED"},"sortBy":"newest"}
      ↓
      cacheGet(key, fetcher, 600s)
          ↓
          redisRead.get(key)           ← Redis Replica :6380
              │
              ├── HIT  → parse JSON → return (~5ms total)
              │
              └── MISS
                    ↓
                    bountyRepository.findMany({ skip, take, where, orderBy })
                        ↓
                        prismaRead.bounty.findMany(...)    ← PG Replica :5433
                        prismaRead.bounty.count(...)       ← PG Replica :5433  (parallel)
                        ↓
                        { bounties: [...], total: N }
                    ↓
                    redis.setex(key, 600, JSON.stringify(data))  ← Redis Master :6369
                    ↓
                    return data
```

**Observed latency breakdown:**

| Scenario | Time | Why |
|---|---|---|
| Cold start, cache miss | ~2700ms | Prisma cold connection pool + PG query + cache write |
| Warm pool, cache miss | ~140ms | Warm TCP connections, PG plan cache, smaller result |
| Cache hit | ~5ms | Single Redis GET from replica |
| Repeat request (same key) | ~5ms | Cached for 600s, invalidated on any write |

The 18x difference between first and second cold miss is almost entirely Prisma's lazy connection pool initialization. After the first query, all subsequent PG reads (any key) benefit from pooled connections.

---

### WRITE: `POST /api/bounties` (create)

```
Browser
  → POST /api/bounties  { title, description, rewardPoints, category, deadline }
  → Express → bountyController.create()
  → bountyService.create(userId, data)
      ↓
      bountyRepository.create(data)
          ↓
          prisma.bounty.create(...)         ← PostgreSQL Master :5432  (ACID write)
          returns new bounty row
      ↓
      cacheInvalidate('bounties:*')          ← Redis Master :6369  (DEL all list keys)
      cacheInvalidate('trending:*')          ← Redis Master :6369
      ↓
      publishEvent('BOUNTY_CREATED', { bountyId, createdBy })
          ↓
          redis.xadd('events:bounty', '*',   ← Redis Stream (Master :6369)
            'type', 'BOUNTY_CREATED',
            'data', JSON.stringify(payload))
      ↓
      return bounty to client
```

After the write returns, the **Sync Worker** picks up the stream event asynchronously:

```
Redis Stream 'events:bounty'
  ↓
  Sync Worker: redis.xreadgroup(GROUP sync-workers WORKER-{PID} BLOCK 5000 ...)
      ↓
      Parse message fields
      ↓
      fetchBounty(bountyId)
          ↓
          prismaRead.bounty.findUnique(...)   ← PG Replica :5433  (shields primary)
      ↓
      buildCatalogDoc(bounty)  → flat denormalized document
      ↓
      BountyCatalog.findOneAndUpdate(         ← MongoDB Primary :27017  (upsert)
        { bounty_id, university_id },
        { $set: doc },
        { upsert: true }
      )
      ↓
      redis.xack('events:bounty', 'sync-workers', messageId)
```

Eventual consistency gap between PostgreSQL write and MongoDB catalog update is typically **under 500ms** (Redis stream delivery + PG replica WAL lag + MongoDB write).

---

### SEARCH: `GET /api/bounties/search?q=machine+learning`

```
Browser
  → GET /api/search?q=machine+learning&page=1&limit=10
  → bountyService.search(query, page, limit)
      ↓
      cache key: bounties:search:machine+learning:1:10
      cacheGet(key, fetcher, 600s)
          ↓
          Redis cache check (redisRead)
              │
              ├── HIT → return (~5ms)
              │
              └── MISS
                    ↓
                    discoveryService.search(query, skip, limit)
                        ↓
                        BountyCatalog.find({ $text: { $search: query } })
                          .read('secondaryPreferred')   ← MongoDB Secondary :27018
                          .sort({ score: { $meta: 'textScore' } })
                        ↓
                        returns { bounties, total }
                    ↓
                    if total === 0:  fallback to bountyRepository.search()
                                      ← PostgreSQL Replica :5433 (ILIKE fallback)
                    ↓
                    cache set (600s)
                    return
```

MongoDB `$text` search uses a compound text index on `title` + `description` built into the `BountyCatalog` collection. Results are ranked by `textScore`. If MongoDB is empty (catalog not yet populated on fresh start), the search falls back to PostgreSQL `ILIKE` automatically.

---

### AUTOCOMPLETE: `GET /api/search/autocomplete?q=mach`

```
Browser → searchService.autocomplete('mach')
  ↓
  redisRead.zrangebylex('search:suggestions', '[mach', '[mach\xff')
    ← Redis Replica :6380 (ZSET sorted lexicographically)
  ↓
  returns up to 10 prefix matches from pre-populated sorted set
  (~1-2ms, no database involved)
```

The sorted set is populated at startup by `cacheWarmer.js` with 1000+ common search terms extracted from existing bounty titles.

---

## Data Flow Diagram (Write → Sync → Read)

```
                    WRITE PATH
                    ──────────
User creates bounty
        │
        ▼
PostgreSQL Master :5432
  bounties table
  [ACID transaction complete]
        │
        ├──► Cache invalidated ('bounties:*', 'trending:*')
        │
        └──► Redis Stream 'events:bounty' (XADD)
                    │
                    │  ~100-500ms (async)
                    ▼
             Sync Worker
             (XREADGROUP, consumer group 'sync-workers')
                    │
                    ├── Read full bounty from PG Replica :5433
                    │   (includes creator, bid count, submission count)
                    │
                    └── Upsert into MongoDB :27017
                        BountyCatalog collection
                        shard key: university_id
                        (XACK after successful upsert)

                    READ PATH
                    ─────────
User lists bounties
        │
        ▼
Redis Replica :6380
  Cache key: bounties:list:{filter hash}
        │
        ├── HIT  → return JSON (~5ms)
        │
        └── MISS
              │
              ▼
       PostgreSQL Replica :5433
         SELECT with filters, pagination
         (~50-200ms warm, ~2500ms cold pool)
              │
              └──► Write to Redis cache (600s TTL)

User searches bounties
        │
        ▼
Redis Replica :6380
  Cache key: bounties:search:{query}:{page}
        │
        ├── HIT  → return (~5ms)
        │
        └── MISS
              │
              ▼
       MongoDB Secondary :27018
         $text index search, textScore sort
         secondaryPreferred read
         (~20-80ms)
              │
              └──► Write to Redis cache (600s TTL)
```

---

## Database Responsibilities

| Database | Role | What lives here | Access pattern |
|---|---|---|---|
| PostgreSQL Primary :5432 | Source of truth | Normalized relational data (Users, Bounties, Bids, Submissions, Comments) | Writes only via `prisma` |
| PostgreSQL Replica :5433 | Read offload | WAL-replicated copy of primary | Reads via `prismaRead`, Sync Worker fetches |
| Redis Master :6369 | Event bus + cache writes | Stream `events:bounty`, cache SETEX, ZINCRBY hot score | Writes: stream publish, cache set, autocomplete build |
| Redis Replica :6380 | Fast reads | Mirror of master cache keys + sorted sets | Reads: cache GET, ZRANGEBYLEX autocomplete |
| MongoDB Primary :27017 | Catalog write target | Denormalized `BountyCatalog` documents | Sync Worker upserts only |
| MongoDB Secondary :27018 | Catalog reads | Mirror of primary, `secondaryPreferred` | Discovery Service reads |

---

## Why Three Databases

**PostgreSQL** — ACID guarantees for all mutations. When a bid is accepted, the bounty status changes and reputation is updated atomically. You cannot do this safely in MongoDB without multi-document transactions, which defeat the purpose of a document store.

**Redis** — Two roles:
1. *Cache*: absorbs read traffic. The list endpoint returns 9KB of JSON. Serving that from Redis at 5ms vs 150ms from PostgreSQL means you can handle ~30x more concurrent users with the same hardware.
2. *Event bus*: decouples the write path from MongoDB. The Transaction Service doesn't wait for MongoDB — it fires an event and returns. The sync happens in the background.

**MongoDB** — Full-text search and denormalized reads. PostgreSQL `ILIKE` search across 500K bounties is a sequential scan. MongoDB's `$text` index with `textScore` ranking is orders of magnitude faster for user-facing search. The denormalized document also collapses a 6-table JOIN (bounty + creator + university + bid_count + submission_count) into a single document fetch.

---

## Cache Invalidation Strategy

Redis cache TTL is 600 seconds but **every write immediately invalidates** the relevant key patterns:

```
bountyService.create()  →  DEL bounties:*  +  DEL trending:*
bountyService.update()  →  DEL bounties:*  +  DEL trending:*
bountyService.delete()  →  DEL bounties:*  +  DEL trending:*
```

`cacheInvalidate(pattern)` uses `redis.keys(pattern)` + `redis.del(keys)` on the master. The 600s TTL is a safety net only — in practice, stale keys are deleted on every mutation, not after timeout.

---

## Sync Worker — Exactly-Once Semantics

The Sync Worker uses Redis Streams consumer groups for at-least-once delivery:

- `XREADGROUP` delivers a message and marks it **pending** (PEL entry)
- After successful MongoDB upsert: `XACK` removes the PEL entry
- On failure: no XACK → message stays pending → redelivered on next restart
- Idempotent: MongoDB upsert uses `findOneAndUpdate + { upsert: true }`, so replaying a message is safe

**Startup race fix:** The worker waits for `redis.status === 'ready'` before calling `xgroup CREATE`. With `enableOfflineQueue: false`, commands issued during the `connecting` phase fail immediately — waiting for the `ready` event prevents this crash.

---

## Replication Lag

| Replication | Type | Typical lag | Risk if lagged |
|---|---|---|---|
| PG primary → replica | WAL async streaming | <10ms local | Sync Worker reads slightly stale data (acceptable — source of truth is primary) |
| Redis master → replica | Async | <5ms local | Autocomplete may miss very recent additions (acceptable) |
| MongoDB primary → secondary | Replica set oplog | <50ms local | Discovery reads slightly stale catalog (acceptable — catalog itself is eventual) |

None of these affect write correctness. All writes go to primaries. Read replicas only serve the read path where eventual consistency is acceptable.

---

## Layer Request Timings (Warm System)

| Request type | p50 | p95 | Why |
|---|---|---|---|
| Redis cache hit | ~5ms | ~10ms | Single network hop to replica |
| MongoDB search (cache miss) | ~30ms | ~80ms | Text index lookup, secondary read |
| PostgreSQL list (cache miss) | ~50ms | ~150ms | Indexed query, connection pool warm |
| PostgreSQL list (cold pool) | ~2500ms | ~4000ms | Prisma lazy pool init + query |
| Autocomplete (ZRANGEBYLEX) | ~2ms | ~5ms | In-memory sorted set, no disk |
| Write (create bounty) | ~30ms | ~80ms | PG write + cache invalidation + stream publish |

Cold pool on first request is the only outlier. After the first request to any PostgreSQL endpoint, the pool stays warm for all subsequent queries.
