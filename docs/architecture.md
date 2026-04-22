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
                    if total === 0 OR MongoDB error:
                        fallback → bountyRepository.search()
                                   ← PostgreSQL Replica :5433 (ILIKE)
                    ↓
                    cache set (600s)
                    return
```

MongoDB `$text` search uses a compound text index on `title` + `description`. Results are ranked by `textScore`. If MongoDB has no catalog yet (fresh start), or throws a text-index error, `discoveryService.search()` returns `null` and the fallback to PostgreSQL fires automatically.

---

### AUTOCOMPLETE: `GET /api/search/suggestions?q=reac`

```
Browser → searchService.getSuggestions('reac')
  ↓
  cache key: autocomplete:reac
  cacheGet(key, fetcher, 600s)
      ↓
      Redis cache check (redisRead)
          │
          ├── HIT → return array (~5ms)
          │
          └── MISS
                ↓
                redis.zrevrange('search:suggestions', 0, -1)
                  ← Redis Master (all terms, sorted by score desc)
                ↓
                filter: terms.startsWith('reac') → ['react', 'react hooks', 'reactjs']
                ↓
                if no matches:
                    fallback → bountyRepository.search('reac', 0, 8)
                               ← PostgreSQL Replica :5433
                ↓
                cache set (600s)
                return matches
```

The sorted set `search:suggestions` is seeded at startup by `cacheWarmer.js` with all bounty title words (scored 1) and full titles (scored 5). Fetching ALL entries (`0, -1`) instead of top-N ensures prefix filtering works regardless of term popularity.

---

## Redis — When It Works and Why It's Fast

Redis is the **speed layer** for this system. It has three roles: cache, event bus, and autocomplete index.

### Role 1: Cache (String keys → JSON blobs)

**When Redis is active:** Every GET request to `/api/bounties`, `/api/bounties/search`, or `/api/trending` checks Redis first.

**Concrete example — list request:**

```
First request: GET /api/bounties?page=1&limit=15&sortBy=newest
  Redis key checked: bounties:list:{"skip":0,"take":15,"where":{},"sortBy":"newest"}
  → MISS  (key doesn't exist yet)
  → PostgreSQL query runs: ~150ms
  → Redis SETEX: redis.setex(key, 600, JSON.stringify({bounties:[...], total:500}))
    Stored value: a 9KB JSON string
    TTL: 600 seconds

Second request: same URL, same user or different user
  Redis key checked: bounties:list:{"skip":0,"take":15,"where":{},"sortBy":"newest"}
  → HIT  (key exists, TTL still valid)
  → JSON.parse of 9KB string
  → return  (~5ms total, no DB touched)
```

**Why it's fast:** Redis stores the fully serialized JSON response in RAM. A GET command is a single hash lookup — O(1) — plus a network round-trip to the replica. No SQL query, no connection pool, no JOIN, no serialization from DB types. The 9KB travels over a local Docker network at gigabit speeds.

**Cache invalidation:** When any write happens (create/update/delete bounty):
```
cacheInvalidate('bounties:*')  →  DEL every key matching that pattern
cacheInvalidate('trending:*')  →  DEL trending keys
```
After a write, the next request to that endpoint runs cold again and re-populates the cache. Since the keys are invalidated immediately (not after TTL), users never see stale data.

**What breaks without Redis cache:**
- Every page load hits PostgreSQL replica
- At 100 concurrent users all loading the homepage (same bounty list): 100 simultaneous PG queries
- With Redis: 1 PG query (on first miss) + 99 Redis GETs → 99% queries served from RAM

---

### Role 2: Event Bus (Redis Streams)

**When Redis stream is active:** Every write (create/update/delete bounty) emits an event to the stream `events:bounty`. The Sync Worker consumes it.

**Concrete example — create bounty, full stream trace:**

```
1. User creates bounty (id=42, universityId=7)

2. bountyService.create() calls:
   redis.xadd('events:bounty', '*', 'type', 'BOUNTY_CREATED', 'data', '{"bountyId":42,"createdBy":15}')

   Redis stream state after XADD:
   events:bounty
   └── 1714000000000-0  type=BOUNTY_CREATED  data={"bountyId":42,"createdBy":15}

3. Sync Worker is blocking on:
   redis.xreadgroup('GROUP','sync-workers','WORKER-1234','COUNT','10','BLOCK','5000','STREAMS','events:bounty','>')
   → Immediately unblocked by new message

4. Worker reads message:
   messageId = "1714000000000-0"
   fields = { type: "BOUNTY_CREATED", data: '{"bountyId":42,"createdBy":15}' }

5. Worker fetches from PG Replica:
   prismaRead.bounty.findUnique({ where: { id: 42 }, include: { creator, _count } })
   → full bounty object with 6-table join result

6. Worker upserts to MongoDB:
   BountyCatalog.findOneAndUpdate(
     { bounty_id: 42, university_id: 7 },
     { $set: { title: "...", creator: {...}, bid_count: 0, ... } },
     { upsert: true }
   )

7. Worker ACKs:
   redis.xack('events:bounty', 'sync-workers', '1714000000000-0')
   → Message removed from PEL (Pending Entry List)
   → Message stays in stream but won't be redelivered

Total time from step 2 to step 7: ~200-500ms
```

**Why it's fast:** The Transaction Service (step 2) returns to the user after step 2 completes — it does NOT wait for MongoDB. The user gets a response in ~30ms. MongoDB gets updated in the background. This is the core benefit of the event-driven design: write latency is decoupled from read-catalog latency.

**What breaks if the stream is skipped (wrong approach):**
```
// WRONG — blocks the HTTP response until MongoDB is updated
await bountyRepository.create(data);
await mongoDb.updateOne(...)  // adds 50-200ms to every write response
```

**Retry semantics:** If MongoDB is down during step 6, the worker logs the error and does NOT call XACK. The message stays in the PEL. On next restart (or after a timeout), Redis redelivers it. Once MongoDB comes back, the message is processed and ACKed. This means **no events are ever lost** even if MongoDB has downtime.

---

### Role 3: Autocomplete Sorted Set (ZSET)

**When the sorted set is active:** Every call to `/api/search/suggestions?q=<prefix>` queries the `search:suggestions` sorted set.

**Data structure — what's stored:**

```
search:suggestions (Redis Sorted Set)
  Member            Score   (higher = more popular / more frequently searched)
  ──────────────    ─────
  "react"           5       (was a bounty title — seeds with score 5)
  "machine"         5       (bounty title word)
  "learning"        5
  "machine learning" 5      (full title)
  "python"          3       (appears in 3 titles)
  "api"             2
  "web"             2
  ...1000+ more...
```

Scores are set at startup by `cacheWarmer.js` and incremented by `addSearchSuggestion()` each time a user actually searches for a term.

**Concrete autocomplete example — user types "reac":**

```
GET /api/search/suggestions?q=reac

1. cacheKey = "autocomplete:reac"
2. redisRead.get("autocomplete:reac") → MISS (first time)
3. redis.zrevrange('search:suggestions', 0, -1)
   → Returns ALL ~1000 terms sorted by score descending:
     ["machine learning", "machine", "python", "react", "react hooks", "api", "web", ...]
4. Filter: term.startsWith("reac")
   → ["react", "react hooks", "reactjs"]
5. redis.setex("autocomplete:reac", 600, JSON.stringify(["react","react hooks","reactjs"]))
6. Return ["react", "react hooks", "reactjs"]

Next request for "reac" (within 600s):
1. redisRead.get("autocomplete:reac") → HIT
2. Return ["react", "react hooks", "reactjs"]  (~1ms)
```

**Why it's fast:** The sorted set lives entirely in Redis RAM. `zrevrange` with ~1000 entries returns in ~2ms. No disk read, no SQL query. The 600s cache on the filtered result means repeated prefix lookups (users typing character-by-character) are served in ~1ms after the first character.

**What 9s looked like before the fix:** `zrevrange('search:suggestions', 0, 99)` only returned top-99 terms. "react" was term #247 by score — not included. Filter returned empty. Fallback triggered: `bountyRepository.search('reac', 0, 8)` — PostgreSQL ILIKE query on cold connection pool → 9 seconds.

---

## MongoDB — When It Works and Why It's Faster Than PostgreSQL for Search

### When MongoDB is active

MongoDB handles two things:
1. **Full-text search** — `discoveryService.search()` via `$text` index
2. **Sync Worker upserts** — denormalized catalog population

### Why MongoDB search beats PostgreSQL ILIKE

**PostgreSQL ILIKE approach (fallback):**
```sql
SELECT * FROM bounties
WHERE title ILIKE '%machine learning%'
   OR description ILIKE '%machine learning%'
ORDER BY created_at DESC
LIMIT 10;
```
- `ILIKE '%term%'` cannot use a B-tree index — it's a full sequential scan
- On 500K bounties: reads every row, applies the regex-like filter
- Time: O(N) rows × string comparison cost
- Result: ~500ms to 2s at scale, no relevance ranking

**MongoDB `$text` approach:**
```js
BountyCatalog.find({ $text: { $search: 'machine learning' } })
  .sort({ score: { $meta: 'textScore' } })
```
- Uses an inverted index — maps each word to a list of document IDs
- Lookup: O(log V) where V = vocabulary size (not document count)
- "machine": → doc IDs [5, 42, 88, 201, ...]
- "learning": → doc IDs [42, 88, 315, ...]
- Intersection: docs matching both = [42, 88, ...]
- textScore: documents where both words appear in title score higher than description-only matches
- Result: ~20-80ms regardless of collection size, with relevance ranking

**Concrete example — search for "react":**

```
MongoDB index (simplified inverted index):
  "react"    → [{doc: 42, title: true}, {doc: 88, desc: true}, {doc: 201, title: true}]
  "hooks"    → [{doc: 42, title: true}, {doc: 315, desc: true}]
  "frontend" → [{doc: 42, title: true}, ...]

Query: $text: { $search: "react hooks" }
  Step 1: lookup "react" → docs [42, 88, 201]
  Step 2: lookup "hooks" → docs [42, 315]
  Step 3: score each doc:
    doc 42: both words in title → textScore = 2.4
    doc 88: "react" in desc only → textScore = 0.6
  Step 4: sort by textScore desc
  Result: [doc 42, doc 88, doc 201, ...]  (~25ms)
```

### MongoDB document shape (denormalized for fast reads)

The sync worker collapses a 6-table JOIN into a single MongoDB document:

```
PostgreSQL (normalized):
  bounties.id = 42
  bounties.title = "Build React Dashboard"
  bounties.created_by → users.id = 15 → users.name = "Alice"
  users.university_id → universities.id = 7 → universities.name = "IIT Delhi"
  COUNT(bids WHERE bounty_id = 42) = 3
  COUNT(submissions WHERE bounty_id = 42) = 1

MongoDB BountyCatalog document (denormalized):
  {
    bounty_id:        42,
    university_id:    7,            ← shard key, always present
    title:            "Build React Dashboard",
    description:      "...",
    category:         "CODING",
    status:           "OPEN",
    reward_points:    500,
    creator: {
      id:         15,
      name:       "Alice",          ← joined from users table
      reputation: 240,
      university: "IIT Delhi"       ← joined from universities table
    },
    bid_count:        3,            ← pre-aggregated COUNT
    submission_count: 1,            ← pre-aggregated COUNT
  }
```

**Read time comparison:**

| Approach | Query | Time |
|---|---|---|
| PostgreSQL JOIN | SELECT bounties + JOIN users + JOIN universities + 2× COUNT subqueries | ~40-120ms warm |
| MongoDB document fetch | findOne({ bounty_id: 42 }) — single document, no join | ~5-15ms |
| Redis cache (pre-warmed) | GET bounties:list:... | ~5ms |

For list pages showing 15 bounties, MongoDB returns all 15 as individual documents already containing creator name, university, and counts — no JOIN needed.

### Text index and the fresh-collection race

On a fresh MongoDB container (first `docker compose up`), the `bounty_catalog` collection is created when the Sync Worker pushes its first document. Mongoose defines the text index in the schema, but actually building it in MongoDB is asynchronous. If a search request arrives during the ~2s index-build window, MongoDB throws:

```
MongoServerError: text index required for $text query
```

Two safeguards are in place:
1. `Document.js` calls `BountyCatalog.ensureIndexes()` explicitly on the `open` event, forcing index creation before any query can run
2. `discoveryService.search()` wraps the query in try/catch and returns `null` on any error, triggering the PostgreSQL ILIKE fallback — the user gets results, just without textScore ranking

---

## PostgreSQL — When It Works and Why It's the Source of Truth

### When PostgreSQL is active

**Primary (:5432) — writes only:**
- Every `POST /api/bounties`, `POST /api/bids`, `POST /api/submissions`
- Auth: `POST /api/auth/register`, `POST /api/auth/login` (user creation/lookup)
- Status transitions (bid accepted, submission accepted)
- Reputation updates

**Replica (:5433) — reads only:**
- `bountyRepository.findMany()` — list page cache misses
- `bountyRepository.findById()` — single bounty page
- `bountyRepository.search()` — ILIKE fallback when MongoDB is empty
- `bountyRepository.getTrending()` — trending list cache misses
- `bountyRepository.findByCreator(userId, skip, take)` — user profile activity: bounties this user created
- `bidRepository.findByBidder(userId, skip, take)` — user profile activity: bids this user placed
- Sync Worker: `fetchBounty()` — reads the full row before writing to MongoDB

### Why writes go to primary only

PostgreSQL WAL replication is **async** and **unidirectional**:
```
Primary :5432 (accepts writes)
    │  WAL stream (binary log)
    ▼
Replica :5433 (read-only — in recovery mode)
```

The replica is in recovery mode. Any write attempt on the replica throws a PostgreSQL error. More importantly, if both nodes accepted writes, you'd have split-brain divergence with no conflict resolution. The primary is the single serialization point.

### ACID guarantees — concrete example

When a bid is accepted:
```
BEGIN;
  UPDATE bounties SET status = 'IN_PROGRESS' WHERE id = 42;
  UPDATE bids SET status = 'ACCEPTED' WHERE id = 77;
  UPDATE users SET reputation = reputation + 10 WHERE id = 15;  -- bid creator
  INSERT INTO reputation_logs (user_id, delta, reason) VALUES (15, 10, 'BID_ACCEPTED');
COMMIT;
```
All four operations commit atomically. If the server crashes mid-transaction, PostgreSQL rolls it all back. The bounty cannot be `IN_PROGRESS` with the bid still `PENDING`, nor can reputation be updated without a log entry. This atomicity is impossible to replicate across MongoDB documents without multi-document transactions.

### Why reads use the replica

With 500 seeded bounties and typical read:write ratios of 10:1+:
- Primary handles: all writes (low volume)
- Replica handles: all reads (high volume)
- Primary CPU is reserved for write throughput, WAL generation, and replication

If reads ran on the primary, a spike in list-page traffic (e.g. a university just posted 50 new bounties and students are browsing) would compete with write locks, increasing write latency.

### Connection pool cold start

Prisma uses a lazy connection pool. On the first query after server startup:
1. TCP handshake to PostgreSQL (SYN → SYN-ACK → ACK)
2. PostgreSQL authentication (SSL negotiation + password exchange)
3. Session setup (search_path, timezone, etc.)
4. Query execution
5. Result serialization

Steps 1-3 add ~2-2.5s on the first query. After that, the pool holds open connections and only step 4+5 run for subsequent queries (~50-150ms). This is why:
```
GET /api/bounties?status=COMPLETED   →   2723ms  (cold pool)
GET /api/bounties?status=COMPLETED&category=DESIGN   →   144ms  (warm pool)
```

The cache warmer at startup runs a dummy query to pre-warm the pool, but only after the Redis connection is ready — so there can still be a cold-pool hit on the very first request if it arrives before warming completes.

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
        │      Redis Master :6369
        │      redis.keys('bounties:*') → DEL all matching keys
        │
        └──► Redis Stream 'events:bounty' (XADD)
                    │
                    │  ~100-500ms (async, does not block HTTP response)
                    ▼
             Sync Worker
             (XREADGROUP, consumer group 'sync-workers')
                    │
                    ├── Read full bounty from PG Replica :5433
                    │   prismaRead.bounty.findUnique({ include: creator, _count })
                    │
                    └── Upsert into MongoDB :27017
                        BountyCatalog.findOneAndUpdate(
                          { bounty_id, university_id },
                          { $set: flatDoc },
                          { upsert: true }
                        )
                        → XACK after success

                    READ PATH
                    ─────────
User lists bounties
        │
        ▼
Redis Replica :6380
  redis.get('bounties:list:{filter-hash}')
        │
        ├── HIT  → JSON.parse → return  (~5ms)
        │
        └── MISS
              │
              ▼
       PostgreSQL Replica :5433
         prismaRead.bounty.findMany({ where, orderBy, skip, take })
         prismaRead.bounty.count({ where })   [parallel]
         (~50-200ms warm, ~2500ms cold pool)
              │
              └──► redis.setex(key, 600, JSON.stringify(result))

User searches bounties
        │
        ▼
Redis Replica :6380
  redis.get('bounties:search:{query}:{page}')
        │
        ├── HIT  → return  (~5ms)
        │
        └── MISS
              │
              ▼
       MongoDB Secondary :27018
         BountyCatalog.find({ $text: { $search: query } })
           .sort({ score: { $meta: 'textScore' } })
           [secondaryPreferred]
         (~20-80ms)
              │
              ├── Error / empty → PostgreSQL ILIKE fallback (~100-200ms warm)
              │
              └──► redis.setex(key, 600, result)

User types prefix for autocomplete
        │
        ▼
Redis Replica :6380
  redis.get('autocomplete:{prefix}')
        │
        ├── HIT  → return array  (~1ms)
        │
        └── MISS
              │
              ▼
       Redis Master :6369
         redis.zrevrange('search:suggestions', 0, -1)
         → all 1000 terms sorted by score
         filter: term.startsWith(prefix)  [in Node.js]
         (~3-5ms)
              │
              ├── Empty → PostgreSQL search fallback (~100ms warm)
              │
              └──► redis.setex('autocomplete:{prefix}', 600, matches)
```

---

## Database Responsibilities

| Database | Role | What lives here | Access pattern |
|---|---|---|---|
| PostgreSQL Primary :5432 | Source of truth | Normalized relational data (Users, Bounties, Bids, Submissions, Comments) | Writes only via `prisma` |
| PostgreSQL Replica :5433 | Read offload | WAL-replicated copy of primary | Reads via `prismaRead`, Sync Worker fetches |
| Redis Master :6369 | Event bus + cache writes | Stream `events:bounty`, cache SETEX, ZINCRBY suggestion scores | Writes: stream publish, cache set, autocomplete build |
| Redis Replica :6380 | Fast reads | Mirror of master cache keys + sorted sets | Reads: cache GET, suggestion zrevrange |
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
| Autocomplete (warm sorted set) | ~3ms | ~8ms | zrevrange all terms + JS filter + cache set |
| MongoDB search (cache miss) | ~30ms | ~80ms | Text index lookup, secondary read |
| PostgreSQL list (cache miss) | ~50ms | ~150ms | Indexed query, connection pool warm |
| PostgreSQL list (cold pool) | ~2500ms | ~4000ms | Prisma lazy pool init + query |
| Write (create bounty) | ~30ms | ~80ms | PG write + cache invalidation + stream publish |

Cold pool on first request is the only outlier. After the first request to any PostgreSQL endpoint, the pool stays warm for all subsequent queries.

---

## Fallback Chain (Resilience)

Every read has a degradation path so the platform stays partially functional even when a component is down:

```
Bounty list:
  Redis hit  →  5ms
  Redis miss → PostgreSQL replica  →  150ms
  (no MongoDB involved in listing)

Bounty search:
  Redis hit      →  5ms
  Redis miss     →  MongoDB $text search  →  30-80ms
  MongoDB error  →  PostgreSQL ILIKE  →  100-200ms
  (search always works, relevance ranking degrades gracefully)

Autocomplete:
  Redis cache hit  →  1ms
  Cache miss       →  sorted set filter  →  5ms
  No matches       →  PostgreSQL ILIKE  →  100ms
  (suggestions always return, just slower on cold prefix)
```
