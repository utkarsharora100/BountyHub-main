# BountyHub — Required Info

Everything a developer needs before touching this codebase.

---

## Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js + React + Tailwind CSS | Next 14 |
| Backend | Node.js + Express | Express 4.x |
| ORM | Prisma | 5.x |
| Primary DB | PostgreSQL | 16 (Bitnami) |
| Event Bus + Cache | Redis | 7 (Alpine) |
| Read Catalog | MongoDB | Latest (Bitnami) |
| Containerization | Docker Compose | v3 |

---

## Infrastructure Ports

| Service | Container Name | Host Port | Purpose |
|---|---|---|---|
| PostgreSQL Primary | bounty-postgres-master | 5432 | All writes |
| PostgreSQL Replica | bounty-postgres-replica | 5433 | WAL reads (Sync Worker) |
| Redis | bounty-redis | 6369 | Cache, autocomplete, stream publish |
| MongoDB Primary | bounty-mongo-primary | 27017 | Write target for Sync Worker |
| MongoDB Replica | bounty-mongo-replica | 27018 | Read replica for Discovery |
| Backend API | bounty-server | 5000 | All API endpoints |
| Frontend | bounty-client | 3000 | UI |

---

## Credentials (Development Only)

| Service | User | Password | Database |
|---|---|---|---|
| PostgreSQL | postgres | postgres123 | bounty_platform |
| MongoDB | utkarsh | 123456 | bounty_platform |
| MongoDB root | root | root | admin |
| Redis | (no auth) | — | — |
| JWT Secret | — | docker-jwt-secret-change-in-production | — |

---

## Replication Configuration

### PostgreSQL WAL Replication
- Mode: **async streaming replication** (WAL)
- Replication user: `repl_user` / `repl_password`
- Replica connects to master via `POSTGRESQL_MASTER_HOST=postgres-master`
- Sync Worker reads from replica only — primary is write-only from app perspective

### Redis Configuration
- Single Redis instance handles cache reads/writes, autocomplete, and stream events on port 6369

### MongoDB Replica Set
- Set name: `rs0`
- Key: `replicasetkey123`
- Connection URI uses `replicaSet=rs0&readPreference=secondaryPreferred`
- Shard key on `university_id` field in all document queries

---

## Key Environment Variables

```env
# PostgreSQL
DATABASE_URL          # Master — used by prisma (writes)
DATABASE_READ_URL     # Replica — used by prismaRead (reads)

# Redis
REDIS_URL             # Single Redis endpoint — cache, autocomplete, stream

# MongoDB
MONGODB_URL           # Replica set URI — single connection, driver routes reads/writes

# App
JWT_SECRET
JWT_EXPIRES_IN        # default: 7d
PORT                  # default: 5000
NODE_ENV              # development | production
CLIENT_URL            # CORS origin
```

---

## Prisma Schema Summary

```
University (1) ──< User (1) ──< Bounty (1) ──< Bid
                                           ──< Submission
                                           ──< Comment
               User ──< ReputationLog
```

- `university_id` indexed on `users` table — join anchor
- `reputation` on `users` sorted descending index — leaderboard
- `status`, `category`, `createdAt`, `rewardPoints`, `deadline` all indexed on `bounties`
- Unique constraint: one bid per user per bounty `@@unique([bountyId, bidderId])`

---

## Redis Data Structures in Use

| Key Pattern | Type | Written by | Read by |
|---|---|---|---|
| `bounties:list:*` | String (JSON) | bountyService | cacheGet (redisRead GET) |
| `bounties:search:*` | String (JSON) | bountyService | cacheGet (redisRead GET) |
| `trending:*` | String (JSON) | bountyService | cacheGet (redisRead GET) |
| `autocomplete:*` | String (JSON) | searchService.getSuggestions | cacheGet (redisRead GET) |
| `events:bounty` | Stream | publishEvent (bountyService) | Sync Worker XREADGROUP |
| `search:suggestions` | Sorted Set (ZSET, scored by popularity) | cacheWarmer + addSearchSuggestion | getSuggestions ZREVRANGE |
| `unmet:demand` | Sorted Set (ZSET, scored by search count) | searchService.trackUnmetDemand | searchService.getUnmetDemand |

---

## MongoDB Collections

| Collection | Schema File | Written by | Read by |
|---|---|---|---|
| `documents` | `server/src/config/Document.js` | Sync Worker | Discovery Service |

Shard key: `university_id`  
Text index: `title`, `description` for `$text` search  
All reads use `.read('secondaryPreferred')`

---

## Common Commands

```bash
# Full stack up
docker compose up --build

# Rebuild only backend
docker compose up --build server

# Prisma studio (visual DB browser)
docker exec bounty-server npx prisma studio

# Apply migration
docker exec bounty-server npx prisma migrate dev --name <name>

# Seed
docker exec bounty-server npm run seed

# Check PostgreSQL replica lag
docker exec bounty-postgres-replica psql -U postgres -c \
  "SELECT now() - pg_last_xact_replay_timestamp() AS lag;"

# Check Redis health
docker exec bounty-redis redis-cli ping

# Check MongoDB replica set
docker exec bounty-mongo-primary mongosh -u root -p root \
  --authenticationDatabase admin --eval "rs.status()"

# Watch server logs
docker logs bounty-server -f

# Connect to PostgreSQL master
docker exec -it bounty-postgres-master psql -U postgres -d bounty_platform
```

---

## What Is Built

| Component | Status | File |
|---|---|---|
| Sync Worker (Redis stream → MongoDB) | Built | `server/src/workers/syncWorker.js` |
| Nginx load balancer config | Built | `nginx/nginx.conf` |
| Redis master/replica split with `enableOfflineQueue: false` | Built | `server/src/config/redis.js` |
| Cache warmer (pre-populates on startup) | Built | `server/src/utils/cacheWarmer.js` |
| Lifecycle worker (expires OPEN bounties) | Built | `server/src/workers/lifecycleWorker.js` |
| Transaction + Discovery co-located in `server/` | Current state | Separated logically by service/repository layer |
| User activity endpoint `GET /api/users/:id/activity` | Built | `bountyRepository.findByCreator` + `bidRepository.findByBidder` (parallel `prismaRead` queries) |

## Known Architectural Gaps

- Transaction Service and Discovery Service are co-located in a single Express process — not yet split into independently deployable nodes
- Horizontal scaling (5 Transaction + 10 Discovery) requires extracting them into separate Docker services
- MongoDB sharding with `mongos` router is configured in compose but not enforced at the query layer beyond `university_id` filters