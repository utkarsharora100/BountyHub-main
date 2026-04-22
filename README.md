# Scalable Multi-University Bounty Collaboration Platform

A production-grade web platform where students from multiple universities can post tasks/bounties and collaborate to complete them. Built as an advanced ADBMS project demonstrating database scalability, caching, read replicas, and optimized queries.

---

## Architecture Overview

```
┌──────────────── Docker Compose ────────────────────┐
│                                                     │
│  ┌─────────────────────────────┐                   │
│  │     Client (Next.js)        │  :3000             │
│  │  React + TailwindCSS        │                   │
│  └──────────┬──────────────────┘                   │
│             │  HTTP / REST                          │
│  ┌──────────▼──────────────────┐                   │
│  │   API Gateway (Express.js)  │  :5000             │
│  │  JWT Auth • Rate Limiting   │                   │
│  │  Helmet • CORS • Validation │                   │
│  ├─────────────────────────────┤                   │
│  │      Service Layer          │                   │
│  │  Business logic + caching   │                   │
│  ├─────────────────────────────┤                   │
│  │    Repository Layer         │                   │
│  │  Data access abstraction    │                   │
│  ├──────────┬──────────┬───────┤                   │
│  │  Master  │  Read    │ Redis │                   │
│  │  (Write) │  Replica │ Cache │                   │
│  │  PG:5432 │  PG:5433 │ :6379 │                   │
│  └──────────┴──────────┴───────┘                   │
└─────────────────────────────────────────────────────┘
```

### Key ADBMS Concepts Demonstrated

| Concept | Implementation |
|---------|---------------|
| **Normalized Schema** | 3NF with 7 tables, FKs, unique constraints |
| **Master-Replica** | Writes → master DB, Reads → read replica |
| **Connection Pooling** | Via Prisma's built-in pool management |
| **Indexing Strategy** | Indexes on FKs, search columns, timestamps, reputation |
| **Caching Layer** | Redis for leaderboard, trending bounties, autocomplete |
| **Full-Text Search** | PostgreSQL text search with Redis suggestion cache |
| **Pagination** | Cursor/offset pagination on all list endpoints |
| **Transactions** | Atomic reputation updates (log + user update) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TailwindCSS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL (Master + Read Replica) |
| ORM | Prisma |
| Cache | Redis (ioredis) |
| Auth | JWT + bcryptjs |
| Icons | Lucide React |

---

## Database Schema (ER)

```
Universities ──< Users ──< Bounties ──< Bids
                  │              │──< Submissions
                  │              └──< Comments
                  └──< ReputationLog
```

**Tables:** Universities, Users, Bounties, Bids, Submissions, Comments, ReputationLog

---

## Project Structure

```
├── docker-compose.yml         # Full-stack orchestration
├── client/                    # Next.js Frontend
│   ├── Dockerfile             # Client container
│   ├── .dockerignore
│   ├── components/            # Reusable UI components
│   │   ├── Layout.js          # App shell with navbar/footer
│   │   ├── BountyCard.js      # Bounty preview card
│   │   ├── Modal.js           # Dialog component
│   │   ├── Pagination.js      # Page navigation
│   │   └── Skeletons.js       # Loading placeholders
│   ├── hooks/                 # React hooks
│   │   ├── useAuth.js         # Authentication context
│   │   └── useTheme.js        # Dark/light theme
│   ├── lib/
│   │   └── api.js             # API client utility
│   ├── pages/                 # Next.js pages
│   │   ├── index.js           # Home (trending + recent)
│   │   ├── login.js           # Login
│   │   ├── register.js        # Registration
│   │   ├── search.js          # Search with autocomplete
│   │   ├── leaderboard.js     # Top users
│   │   ├── bounties/
│   │   │   ├── index.js       # Browse/filter bounties
│   │   │   ├── [id].js        # Bounty detail + bids/comments
│   │   │   └── new.js         # Post new bounty
│   │   └── profile/
│   │       └── [id].js        # User profile + reputation
│   └── styles/
│       └── globals.css        # Tailwind + custom styles
│
├── server/                    # Express.js Backend
│   ├── Dockerfile             # Server container
│   ├── .dockerignore
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── seed.js            # Seed data
│   └── src/
│       ├── index.js           # Server entry point
│       ├── config/
│       │   ├── index.js       # Environment config
│       │   ├── database.js    # Prisma master + replica
│       │   └── redis.js       # Redis client + helpers
│       ├── middleware/
│       │   ├── auth.js        # JWT authentication
│       │   ├── errorHandler.js# Error handling
│       │   └── validate.js    # Input validation
│       ├── routes/            # HTTP route definitions
│       ├── controllers/       # Request handlers
│       ├── services/          # Business logic
│       ├── repositories/      # Database queries
│       └── utils/             # Helpers (logger, pagination)
```

---

## Setup & Run

### Option A: Docker (Recommended)

The entire stack runs with a single command. You only need **Docker** and **Docker Compose** installed.

```bash
cd "ads project"

# Start everything (PostgreSQL master + replica, Redis, API server, frontend)
docker compose up --build
```

That's it! Docker will:
1. Spin up PostgreSQL master (port 5432) + read replica (port 5433)
2. Spin up Redis (port 6379)
3. Build and start the API server (port 5000), run migrations, and seed data
4. Build and start the Next.js frontend (port 3000)

**Useful Docker commands:**
```bash
# Start in detached mode
docker compose up --build -d

# View logs
docker compose logs -f

# Stop everything
docker compose down

# Full reset (wipe database volumes and rebuild)
docker compose down -v && docker compose up --build
```

Or use the root scripts:
```bash
npm run docker:up      # Build & start
npm run docker:down    # Stop
npm run docker:reset   # Wipe volumes & rebuild
npm run docker:logs    # Tail logs
```

---

### Option B: Local Development (without Docker)

#### Prerequisites

- **Node.js** >= 18
- **PostgreSQL** >= 14
- **Redis** >= 6 (optional — app works without it)

#### 1. Install Dependencies

```bash
cd "ads project"
npm run install:all
```

#### 2. Configure Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your PostgreSQL and Redis credentials:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/bounty_platform"
DATABASE_READ_URL="postgresql://postgres:yourpassword@localhost:5432/bounty_platform"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="change-this-to-a-random-secret"
```

> **Note:** If you don't have a separate read replica, use the same URL for both DATABASE_URL and DATABASE_READ_URL. The architecture still demonstrates the pattern.

#### 3. Setup Database

```bash
cd server

# Create database tables
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Seed with example data
npx prisma db seed
```

#### 4. Start Development

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
```
Server starts on `http://localhost:5000`

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```
Client starts on `http://localhost:3000`

---

### Demo Login

| Email | Password |
|-------|----------|
| alice@mit.edu | password123 |
| bob@stanford.edu | password123 |
| charlie@oxford.ac.uk | password123 |

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/leaderboard` | Top users by reputation |
| GET | `/api/users/:id` | User profile |
| PUT | `/api/users/profile` | Update own profile |
| GET | `/api/users/:id/reputation` | Reputation history |

### Bounties
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bounties` | List (paginated, filterable) |
| GET | `/api/bounties/trending` | Trending bounties |
| GET | `/api/bounties/search?q=` | Search bounties |
| GET | `/api/bounties/:id` | Bounty details |
| POST | `/api/bounties` | Create bounty |
| PUT | `/api/bounties/:id` | Update bounty |
| DELETE | `/api/bounties/:id` | Delete bounty |

### Bids
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bounties/:id/bids` | Bids for bounty |
| POST | `/api/bounties/:id/bids` | Place bid |
| PATCH | `/api/bounties/bids/:id/accept` | Accept bid |
| PATCH | `/api/bounties/bids/:id/reject` | Reject bid |

### Submissions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bounties/:id/submissions` | Submissions |
| POST | `/api/bounties/:id/submissions` | Submit work |
| PATCH | `/api/bounties/submissions/:id/review` | Review submission |

### Comments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bounties/:id/comments` | Comments |
| POST | `/api/bounties/:id/comments` | Add comment |

### Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search/suggestions?q=` | Autocomplete |

---

## Performance & Scalability Features

### Read Replica Pattern
```javascript
// Writes go to master
const prisma = new PrismaClient({ datasources: { db: { url: MASTER_URL } } });

// Reads go to replica
const prismaRead = new PrismaClient({ datasources: { db: { url: REPLICA_URL } } });
```

### Redis Caching with TTL
```javascript
// Leaderboard cached for 60s
await cacheGet('leaderboard:top20', () => userRepository.getLeaderboard(20), 60);

// Trending bounties cached for 60s
await cacheGet('trending:bounties', () => bountyRepository.getTrending(10), 60);

// Cache invalidated on writes
await cacheInvalidate('leaderboard:*');
```

### Database Indexes
- Foreign keys: `user_id`, `bounty_id`, `university_id`
- Search: `title`, `description` (text search)
- Sorting: `created_at DESC`, `reputation DESC`, `reward_points DESC`
- Composite unique: `(bounty_id, bidder_id)` on bids

---

## Security

- **Password hashing** — bcrypt with salt rounds = 12
- **JWT authentication** — stateless tokens with expiry
- **Input validation** — express-validator on all endpoints
- **Rate limiting** — 200 requests per 15-minute window
- **CORS protection** — origin-restricted
- **Helmet** — security headers
- **Body size limit** — 10KB max payload

---

## License

Academic project for ADBMS course. MIT License.
