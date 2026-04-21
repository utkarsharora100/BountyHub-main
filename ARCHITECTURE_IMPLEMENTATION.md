# Architecture Implementation

## What Is Now Implemented

BountyHub now implements a practical local version of the proposed CQRS + polyglot persistence architecture.

## Runtime Topology

| Layer | Implementation |
|---|---|
| Edge routing | Nginx reverse proxy on `http://localhost:8080` |
| Frontend | Next.js client |
| API / command side | Express + Prisma service |
| Transaction store | PostgreSQL primary |
| Read replica | PostgreSQL replica for read-heavy Prisma queries |
| Search/index cache | Redis sorted-set prefix index |
| Event bus | Redis Streams, stream: `events:bounty` |
| Catalog read model | MongoDB collection: `bounty_catalog` |
| Sync worker | Dedicated `catalog-sync-worker` container |
| DB bootstrap | Dedicated `db-init` container runs schema push + seed once |

## Data Flow

### Write Path

1. API writes authoritative state to PostgreSQL through Prisma.
2. Critical operations such as bid acceptance and submission approval use database transactions.
3. The API publishes compact bounty events to Redis Streams.
4. The API returns without waiting for catalog/index rebuild work.

### Read/Search Path

1. Search queries hit Redis prefix indexes first.
2. Matching bounty IDs are hydrated from MongoDB catalog documents.
3. If MongoDB is unavailable or missing a document, the system falls back to PostgreSQL reads.
4. Standard lists and profile views continue to use the Prisma read client.

### Sync Path

1. `catalog-sync-worker` rebuilds Redis + Mongo read models on startup.
2. It consumes `events:bounty` with Redis consumer groups.
3. It upserts open, non-expired bounties into Redis and MongoDB.
4. It removes closed, deleted, completed, or expired bounties from discovery read models.

## Requirement Checklist

Status legend:

- Implemented: present in the current codebase and runtime topology.
- Partial: present in simplified or local form, but not to the full extent claimed in the abstract or diagram.
- Missing: not implemented in the current project.

| Requirement | Status | Notes |
|---|---|---|
| Cross-university user base | Implemented | Users belong to universities in the shared PostgreSQL schema. |
| Multi-university bounty collaboration | Implemented | Users from different universities can post, browse, bid, and submit work in one shared system. |
| Decentralized marketplace | Missing | The project is a centralized deployment, not a federated or institution-owned network. |
| Departments post bounties as first-class actors | Partial | Bounties have a `department` field, but there is no Department model, department role, or department-scoped authorization. |
| Skill-based discovery by skill/category/department | Implemented | Redis prefix indexing covers title, description, category, department, skills, and university name. |
| Real-time typeahead search | Implemented | The client issues debounced quick-match requests and the API serves Redis-backed search matches. |
| Sub-millisecond search latency | Missing | The architecture supports fast search, but the repo does not contain benchmarks or proof of this latency target. |
| Secure bidding flow | Implemented | Authenticated users can place bids with validation around bounty state, deadline, and bid amount. |
| Concurrency control to prevent double-claiming | Implemented | Bid acceptance uses serializable transactions and conditional updates to prevent race conditions. |
| Full bounty lifecycle management | Implemented | Bounties can be created, updated, cancelled, moved in progress, completed, and expired automatically. |
| Automatic expiration handling | Implemented | A lifecycle worker cancels overdue open bounties and rejects pending bids. |
| Budget cap enforcement | Implemented | Bid amounts cannot exceed the configured bounty reward points. |
| Final payment authorization | Missing | There is no payment gateway, wallet, escrow, or payout authorization flow. |
| Demand analytics for no-result searches | Implemented | Search queries with zero results are logged into Redis and exposed through an unmet-demand endpoint. |
| PostgreSQL as source of truth | Implemented | Authoritative writes and transactional state live in PostgreSQL. |
| Normalized relational model for core entities | Implemented | The Prisma schema models universities, users, bounties, bids, submissions, comments, and reputation logs relationally. |
| ACID-compliant critical transactions | Implemented | Bid acceptance and submission review use Prisma transactions with serializable isolation. |
| Redis read-optimized search layer | Implemented | Redis stores prefix indexes, suggestions, and unmet-demand counters for search-heavy traffic. |
| Redis Trie / Prefix Tree specifically | Partial | The implementation is prefix indexing over Redis sorted sets, not a literal trie data structure. |
| Search isolated from transactional load | Implemented | Search hits Redis first and only falls back to PostgreSQL when needed. |
| Background sync worker for eventual consistency | Implemented | A dedicated catalog sync worker rebuilds and incrementally maintains read models. |
| Redis Streams event bus | Implemented | Bounty change events are published to `events:bounty` and consumed with consumer groups. |
| MongoDB denormalized catalog read model | Implemented | Search results are hydrated from MongoDB catalog documents before PostgreSQL fallback. |
| PostgreSQL read replica for read-heavy queries | Implemented | The codebase uses a separate Prisma read client pointed at the replica URL. |
| Nginx edge proxy | Implemented | Docker Compose exposes the stack through a local Nginx reverse proxy on port 8080. |
| Round-robin load balancing across multiple API nodes | Partial | Nginx is present and `docker compose --scale server=2` is documented, but the checked-in config only lists one upstream server entry. |
| Cloudflare/CDN edge caching | Missing | Not implemented; the project uses a local Nginx equivalent only. |
| Managed autoscaling | Missing | No autoscaling platform or orchestration is present. |
| Redis Cluster | Missing | The runtime uses Redis master/replica containers, not Redis Cluster. |
| MongoDB sharding | Missing | The runtime uses a single MongoDB container, not a sharded cluster. |
| 10-node discovery service / 5-node transaction service / 50-worker sync topology | Missing | The diagram's node counts are not implemented in this local stack. |
| Production observability stack | Missing | No dedicated tracing, metrics, or log aggregation stack is defined here. |

## Docker Usage

Start the full architecture:

```bash
docker compose up --build
```

Open the app through the edge proxy:

```text
http://localhost:8080
```

Scale API replicas behind Nginx:

```bash
docker compose up --build --scale server=2
```

## Important Boundaries

This is still a local implementation, not a cloud deployment. Cloudflare/CDN, managed autoscaling, managed Redis Cluster, and production observability are represented by local equivalents where possible. The core data architecture is now real: PostgreSQL remains the source of truth, Redis Streams carries read-model events, Redis serves fast prefix discovery, and MongoDB stores the denormalized catalog.
