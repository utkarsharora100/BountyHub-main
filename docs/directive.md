# BountyHub — Development Directives

Rules that every contributor and AI agent must follow. These are non-negotiable — they exist because violating them silently corrupts data or defeats the architecture.

---

## 1. CQRS Separation Is Absolute

**Rule:** Transaction Service writes. Discovery Service reads. Never cross.

- `bountyService`, `bidService`, `submissionService`, `authService` → write to PostgreSQL via `prisma` (master)
- `discoveryService`, `searchService` → read from MongoDB + Redis replica only
- Transaction Service must NEVER query MongoDB
- Discovery Service must NEVER call `prisma` (write client) or emit Redis events

**Why:** Mixing read/write paths collapses the entire scaling benefit — the read nodes (10x more) cannot be independently scaled if they carry write traffic.

---

## 2. Always Use the Correct Database Client

| Operation | Client to use | File |
|---|---|---|
| Any INSERT / UPDATE / DELETE | `prisma` | `config/database.js` |
| Any SELECT in a repository | `prismaRead` | `config/database.js` |
| Cache write / stream publish | `redis` | `config/redis.js` |
| Cache read / autocomplete | `redisRead` (inside `cacheGet`) | `config/redis.js` |
| MongoDB writes (Sync Worker only) | Mongoose default (routes to primary) | `config/mongodb.js` |
| MongoDB reads (Discovery only) | `.read('secondaryPreferred')` per query | `discoveryService.js` |

**Why:** Using the wrong client bypasses replication benefits. Using `prisma` for reads under high load spikes the primary — that's the node that cannot be replicated away.

---

## 3. Sync Worker Is the Only Path to MongoDB

**Rule:** No service other than the Sync Worker may write to MongoDB.

Flow that must be followed:
```
Transaction Service → PostgreSQL Primary
                    → Redis Stream (XADD bounty:events)
                              ↓
                    Sync Worker (XREADGROUP)
                    → PostgreSQL Replica (read full record)
                    → MongoDB (upsert Document)
```

**Why:** If services write directly to MongoDB, the denormalized catalog diverges from PostgreSQL (source of truth). The Sync Worker is the single serialization point that guarantees consistency.

---

## 4. Always Include `university_id` in MongoDB Queries

**Rule:** Every `Document.find()` or `Document.findOneAndUpdate()` must include `university_id` in the filter.

```js
// CORRECT
Document.find({ university_id: universityId, ... })

// WRONG — scatter-gather across all shards
Document.find({ title: /bounty/i })
```

**Why:** MongoDB is sharded on `university_id`. A query without the shard key is scatter-gathered across every shard — O(shards) instead of O(1). At scale this is catastrophic.

---

## 5. Cache Invalidation Is Mandatory on Every Write

**Rule:** Every service method that mutates state must call `cacheInvalidate` before returning.

```js
// After create/update/delete in any service:
await cacheInvalidate('bounties:*');
await cacheInvalidate(`bounty:${bountyId}`);   // entity-specific if applicable
await cacheInvalidate('trending:*');
```

**Why:** Stale cache serves outdated data. Redis TTL is not a substitute for explicit invalidation — a 30s stale bounty list after a status change is a user-facing bug.

---

## 6. Redis Stream XACK Is Mandatory

**Rule:** Sync Worker must `XACK` every message after successful MongoDB upsert. On failure, do NOT ack — let Redis redeliver.

```js
// CORRECT pattern
try {
  await upsertToMongo(data);
  await redis.xack('bounty:events', 'sync-workers', messageId);
} catch (err) {
  logger.error('Sync failed, will retry:', err);
  // no xack — message stays pending
}
```

**Why:** Without XACK, messages accumulate in the Pending Entry List (PEL) and Redis memory grows unbounded. Without retry-on-failure, failed syncs silently drop data.

---

## 7. WAL Replica Is Read-Only — Never Write to It

**Rule:** `prismaRead` points to the PostgreSQL replica. It must only be used for SELECT queries.

**Why:** The replica is in `recovery` mode (WAL follower). Any write attempt will fail with a PostgreSQL error. More importantly, attempting to write there indicates a logic bug where the write path is confused with the read path.

---

## 8. Prisma Schema Is the Canonical Data Model

**Rule:** The `server/prisma/schema.prisma` file is the single source of truth for the PostgreSQL schema. Do not write raw SQL DDL migrations. Do not alter MongoDB document shape without updating the Sync Worker transform to match.

**Why:** Prisma migrations are tracked in git. Raw SQL bypasses migration history. MongoDB's document shape must stay in sync with what the Sync Worker produces — they are not independent.

---

## 9. No Direct Database Access from Routes

**Rule:** Routes → Controllers → Services → Repositories → Database clients. No skipping layers.

- Controllers handle req/res only — no business logic
- Services contain business rules — no direct Prisma/Mongoose calls
- Repositories contain all DB queries — no business logic

**Why:** When the database client needs to change (e.g., swap `prisma` for `prismaRead` in a hot path), it's a one-line change in a repository. If controllers talk directly to Prisma, that change requires hunting across dozens of files.

---

## 10. Frontend Obeys API Contract — No Direct DB Connections

**Rule:** The Next.js client may only talk to the backend via `client/lib/api.js`. It must never import Prisma, mongoose, or ioredis.

Search inputs must have a **300ms debounce** before triggering API calls.

**Why:** The debounce prevents search-per-keystroke hammering the Discovery Service. Direct DB connections from client would bypass all auth, rate limiting, and CQRS routing.

---

## Implementation Priority Order

When building new features, implement in this order:

1. **Prisma schema change** (if needed) → run migration
2. **Repository layer** (PostgreSQL query)
3. **Service layer** (business logic + cache invalidation + Redis event emit)
4. **Controller + Route** (req/res only)
5. **Sync Worker transform** (if MongoDB document shape changes)
6. **Discovery Service** (MongoDB read query)
7. **Frontend** (UI + API call with debounce)

This order ensures the write path is always complete before the read path tries to consume its output.
