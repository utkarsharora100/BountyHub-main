# BountyHub — Subagent Guide

This document defines how to decompose work on BountyHub into parallel subagent tasks, what each agent should own, and the contracts between them.

---

## System Decomposition — One Agent Per Service Boundary

BountyHub has five independently deployable concerns. Each maps to a distinct subagent scope:

| Agent | Owns | Tools it needs |
|---|---|---|
| **transaction-agent** | Write path: PostgreSQL writes, Redis event emit, cache invalidation | Prisma, ioredis (master) |
| **discovery-agent** | Read path: MongoDB queries, Redis autocomplete, cache reads | Mongoose, ioredis (replica) |
| **sync-worker-agent** | Background sync: Redis stream consumer → PG replica read → MongoDB upsert | ioredis consumer group, Prisma (read), Mongoose (write) |
| **infra-agent** | docker-compose, replication health, schema migrations | docker, psql, mongosh, redis-cli |
| **frontend-agent** | Next.js UI, API calls, component state | client/ directory only |

---

## Agent Contracts

### transaction-agent

**Responsibility:** Handle all state mutations. Emit events. Never read from MongoDB.

**Input:** HTTP request payload (validated by middleware)  
**Output:** Persisted PostgreSQL row + Redis stream event + cache invalidation

**Critical invariants:**
- Always use `prisma` (master), never `prismaRead`, for writes
- After every write: call `cacheInvalidate('bounties:*')` and any entity-specific pattern
- Emit to Redis Stream key `bounty:events` with payload `{ type, entityId, universityId, timestamp }`
- Never call MongoDB directly — that is sync-worker-agent's job

**Files owned:**
- `server/src/services/bountyService.js`
- `server/src/services/bidService.js`
- `server/src/services/submissionService.js`
- `server/src/services/authService.js`
- `server/src/services/userService.js`
- `server/src/services/commentService.js`
- `server/src/repositories/*.js`
- `server/prisma/schema.prisma`

---

### discovery-agent

**Responsibility:** Handle all reads. Never write to PostgreSQL or MongoDB.

**Input:** GET request with `universityId`, optional `query`, `page`, `limit`  
**Output:** Paginated list of denormalized documents from MongoDB or cached Redis result

**Critical invariants:**
- Always include `university_id` in MongoDB filter — no scatter-gather
- Use `read('secondaryPreferred')` on every Mongoose query
- Check Redis cache first (`cacheGet`) before hitting MongoDB
- Redis autocomplete uses `ZRANGEBYLEX` on the `autocomplete:{prefix}` sorted set
- Cache TTL: list=30s, search=60s

**Files owned:**
- `server/src/services/discoveryService.js`
- `server/src/services/searchService.js`
- `server/src/config/Document.js`
- `server/src/controllers/searchController.js`
- `server/src/routes/searchRoutes.js`

---

### sync-worker-agent

**Responsibility:** Bridge PostgreSQL (source of truth) → MongoDB (read catalog). Triggered exclusively by Redis Stream events.

**Input:** Redis Stream message from `bounty:events` consumer group  
**Output:** Upserted denormalized document in MongoDB

**Flow:**
1. `XREADGROUP GROUP sync-workers WORKER-{n} COUNT 1 BLOCK 0 STREAMS bounty:events >`
2. Parse `entityId` and `universityId` from message
3. Read full entity from **PostgreSQL Read Replica** (`prismaRead`) — never hit primary
4. Flatten/normalize into MongoDB document shape (include `university_id` as top-level field)
5. `Document.findOneAndUpdate({ id: entityId, university_id: universityId }, data, { upsert: true })`
6. `XACK bounty:events sync-workers {messageId}`

**Critical invariants:**
- Read from `prismaRead` only — the replica exists to shield the primary from this load
- Always `XACK` after successful upsert to prevent re-delivery
- On upsert failure: log error, do NOT ack — let Redis redeliver
- Consumer group name: `sync-workers`, worker IDs: `WORKER-0` through `WORKER-49`

**Files owned:**
- `server/src/workers/syncWorker.js`
- `server/src/config/database.js` (read-only access — do not modify)

---

### infra-agent

**Responsibility:** Infrastructure correctness — replication health, migrations, schema changes, docker configuration.

**Checklist before any schema migration:**
1. Run `pg_isready` on both primary and replica
2. Verify replica lag: `SELECT now() - pg_last_xact_replay_timestamp() AS lag;`
3. Run `prisma migrate dev` against primary only
4. Confirm WAL replication picks up the DDL on replica within 5s
5. Check MongoDB replica set: `rs.status()` — all members should be PRIMARY or SECONDARY

**Files owned:**
- `docker-compose.yml`
- `server/prisma/schema.prisma` (DDL changes only, in coordination with transaction-agent)
- `server/prisma/seed.js`

---

### frontend-agent

**Responsibility:** Next.js client — pages, components, API integration, styling.

**API contract (must not break):**
- Write endpoints: `POST /api/bounties`, `POST /api/bids`, `POST /api/submissions`
- Read endpoints: `GET /api/search?universityId=&q=&page=`, `GET /api/bounties`, `GET /api/bounties/:id`
- User endpoints: `GET /api/users/:id`, `GET /api/users/:id/reputation`, `GET /api/users/:id/activity`
  - `/activity` returns `{ created[], createdTotal, bids[], bidsTotal, total }` — parallel PG replica reads, no MongoDB involved
- Auth: `POST /api/auth/login`, `POST /api/auth/register`
- 300ms debounce on all search inputs before firing API call

**Files owned:**
- `client/` (all files)

---

## Parallel Execution Rules

These tasks are **safe to parallelize** (no shared state):

```
transaction-agent task  ||  discovery-agent task     (different DB targets)
sync-worker-agent task  ||  frontend-agent task       (no shared files)
infra-agent health check  ||  any agent code task     (read-only observation)
```

These tasks **must be sequential**:

```
infra-agent: schema migration  →  transaction-agent: use new schema
sync-worker-agent: upsert      →  discovery-agent: read result        (eventual consistency gap ~100ms)
transaction-agent: emit event  →  sync-worker-agent: consume event    (stream ordering guaranteed)
```

---

## Spawning a Subagent — Prompt Template

When delegating to a subagent, include:

```
You are working on BountyHub — a CQRS + polyglot persistence university bounty platform.

Your role: <agent-name> (e.g. transaction-agent)
Your scope: <what you own>

Context:
- PostgreSQL Primary (port 5432) = source of truth for all writes
- PostgreSQL Replica (port 5433) = WAL async replication, read-only
- Redis Master (port 6369) = writes: cache, stream events, sorted sets
- Redis Replica (port 6380) = reads: cache lookups, autocomplete
- MongoDB (port 27017/27018, replicaSet=rs0) = denormalized read catalog, sharded by university_id

Rules for your scope:
<paste relevant invariants from the agent contract above>

Task:
<specific task description with file paths and line numbers>
```

---

## Event Schema (Redis Stream: `bounty:events`)

```json
{
  "type": "BOUNTY_CREATED | BOUNTY_UPDATED | BOUNTY_DELETED | BID_ACCEPTED | SUBMISSION_ACCEPTED",
  "entityId": 42,
  "entityType": "bounty | bid | submission",
  "universityId": 7,
  "actorId": 15,
  "timestamp": "2026-04-21T10:00:00.000Z"
}
```

Sync Worker maps `entityType` → repository fetch → MongoDB collection upsert.

---

## MongoDB Document Shape (`Document` collection)

```json
{
  "id": 42,
  "university_id": 7,
  "title": "Build a search indexer",
  "description": "...",
  "category": "CODING",
  "status": "OPEN",
  "reward_points": 500,
  "creator": { "id": 15, "name": "Alice", "reputation": 120 },
  "bid_count": 3,
  "submission_count": 1,
  "deadline": "2026-05-01T00:00:00.000Z",
  "createdAt": "2026-04-21T10:00:00.000Z",
  "updatedAt": "2026-04-21T10:05:00.000Z"
}
```

Sync Worker is responsible for assembling this shape from PostgreSQL normalized tables.
