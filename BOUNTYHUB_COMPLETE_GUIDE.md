# BountyHub — Complete Project Guide & Learning Roadmap


---
S
## Table of Contents

1. [What BountyHub Is](#1-what-bountyhub-is)
2. [How the Current Codebase Works](#2-how-the-current-codebase-works)
3. [Full-Stack Architecture — How It All Connects](#3-full-stack-architecture--how-it-all-connects)
4. [REST API Deep Dive](#4-rest-api-deep-dive)
5. [Object-Oriented Programming — In Depth](#5-object-oriented-programming--in-depth)
6. [Design Patterns You Must Know](#6-design-patterns-you-must-know)
7. [Building Visually Stunning Websites](#7-building-visually-stunning-websites)
8. [Databases & Polyglot Persistence](#8-databases--polyglot-persistence)
9. [Improved BountyHub — What to Build Next](#9-improved-bountyhub--what-to-build-next)
10. [Replication & Scalability — How It Really Works](#10-replication--scalability--how-it-really-works)
11. [Step-by-Step Build Plan](#11-step-by-step-build-plan)
12. [Technology Choices — What to Use and Why](#12-technology-choices--what-to-use-and-why)
13. [Glossary of Terms](#13-glossary-of-terms)

---

## 1. What BountyHub Is

BountyHub is a **multi-university collaboration platform** where:
- Students post **bounties** (tasks with point rewards)
- Other students **bid** on those bounties (say "I can do this")
- The bounty creator **accepts one bid**
- The winner **submits their work**
- The creator **accepts the submission**, and the winner gets **reputation points**

Think of it like a university-internal version of Upwork or GitHub Bounties.

### Current Feature Set

| Feature | Status |
|---------|--------|
| User registration & login (JWT auth) | Done |
| Post/edit/delete bounties | Done |
| Bid on bounties | Done |
| Submit work + review submissions | Done |
| Comments on bounties | Done |
| Reputation/points system | Done |
| Leaderboard | Done |
| Search with autocomplete | Done |
| Read replica for scaling reads | Done (simulated) |
| Redis caching | Done |
| Dark mode | Done |

### What Is Missing (Target for Improved Version)

- Real PostgreSQL streaming replication (not just two separate DBs)
- MongoDB for document-style data (files, rich profiles)
- Elasticsearch for proper full-text search
- WebSockets for real-time bid/comment notifications
- File upload system (currently only accepts a link)
- Role-based access control (admin, moderator, student)
- Email notifications
- OAuth (login with Google)
- Admin dashboard
- Proper CI/CD pipeline
- Unit and integration tests

---

## 2. How the Current Codebase Works

### Directory Map

```
BountyHub-main/
├── server/                 ← Node.js + Express (the "backend")
│   ├── prisma/
│   │   └── schema.prisma   ← Database table definitions
│   └── src/
│       ├── config/         ← DB + Redis connections
│       ├── middleware/     ← JWT auth, validation, error handler
│       ├── routes/         ← URL → handler mapping
│       ├── controllers/    ← HTTP request/response logic
│       ├── services/       ← Business logic
│       ├── repositories/   ← Database queries
│       └── utils/          ← Shared helpers
│
└── client/                 ← Next.js + React (the "frontend")
    ├── pages/              ← Each file = one URL page
    ├── components/         ← Reusable UI pieces
    ├── hooks/              ← Shared React state logic
    ├── lib/api.js          ← Fetch wrapper for calling server
    └── styles/             ← CSS
```

### The Layered Architecture (Backend)

The backend uses a **4-layer pattern**. Each layer has one job:

```
HTTP Request
    ↓
[Route]         → "Which URL? Which method? Any middleware?"
    ↓
[Controller]    → "Parse the request. Call service. Send response."
    ↓
[Service]       → "Is this allowed? What is the business rule?"
    ↓
[Repository]    → "Run the database query. Return data."
    ↓
Database / Redis
```

**Why layers?** So you can change one part without breaking others. If you switch from PostgreSQL to MySQL, you only change the repository layer. The service doesn't care.

### Example: What Happens When You Create a Bounty

1. Browser sends `POST /api/bounties` with `{ title, description, rewardPoints, category, deadline }` and a JWT token in the header.
2. **Route** (`bountyRoutes.js`) checks: is the user logged in? (`authenticate` middleware verifies JWT). Runs input validation.
3. **Controller** (`bountyController.js`) extracts the body and calls `bountyService.createBounty(data, userId)`.
4. **Service** (`bountyService.js`) applies business rules (e.g., deadline must be in the future), then calls `bountyRepository.create(data)`. Also invalidates the Redis cache keys for bounty listings.
5. **Repository** (`bountyRepository.js`) runs `prisma.bounty.create({ data })` — this talks to PostgreSQL.
6. PostgreSQL creates the row and returns it.
7. The response travels back up: Repository → Service → Controller → HTTP response `201 Created` with the new bounty JSON.

### Database Schema (What Tables Exist)

```
Universities  ──→  Users  ──→  Bounties  ──→  Bids
                                         ──→  Submissions
                                         ──→  Comments
              Users ──→ ReputationLog
```

**Bounty status flow:**
```
OPEN → IN_PROGRESS (bid accepted) → COMPLETED (submission accepted)
     ↘ CANCELLED (any time)
```

### How Redis Caching Works

Redis is a fast in-memory key-value store. The pattern used is **cache-aside**:

```
cacheGet("trending:bounties", fetcher, 60)
    ↓
1. Check Redis for key "trending:bounties"
2a. Hit → return cached value (fast, no DB query)
2b. Miss → call fetcher() → query DB → store result in Redis with 60s TTL → return
```

When data changes (bounty created, submission accepted), the cache is **invalidated** (deleted). Next request re-populates it fresh.

### How JWT Authentication Works

```
Registration:
  User sends name/email/password
  → Server hashes password with bcrypt
  → Server creates user in DB
  → Server signs JWT: { id, email } + secret → token string
  → Returns token to client

Client stores token in localStorage.

Every protected request:
  Client sends: Authorization: Bearer <token>
  → Server middleware extracts token
  → Verifies signature with secret
  → Decodes { id, email }
  → Sets req.user = { id, email }
  → Handler runs
```

JWT is **stateless** — the server doesn't store sessions. The token contains the user info, signed so it can't be faked.

---

## 3. Full-Stack Architecture — How It All Connects

Understanding how the frontend and backend communicate is fundamental.

### The Big Picture

```
User's Browser
    │
    │  HTTP requests (JSON)
    ↓
Next.js Frontend (port 3000)
    │
    │  HTTP requests to /api/* (JSON)
    ↓
Express Backend (port 5000)
    │         │
    ↓         ↓
PostgreSQL   Redis
(port 5432)  (port 6379)
```

### What Is "Full-Stack"?

| Layer | Also Called | Technology Here | What It Does |
|-------|------------|-----------------|--------------|
| Frontend | Client-side | Next.js + React | What the user sees and clicks |
| Backend | Server-side | Express + Node.js | Business logic, database access |
| Database | Persistence | PostgreSQL + Redis | Stores data permanently |

### The Request-Response Cycle

Every interaction follows this pattern:

1. **User action** (click button, fill form, navigate to page)
2. **Frontend** builds an HTTP request (GET/POST/PUT/DELETE + URL + body + headers)
3. **Backend** receives it, processes it, queries DB, builds a response
4. **Frontend** receives the response (JSON), updates the UI

### HTTP Methods — What They Mean

| Method | Used For | Body? | Example |
|--------|---------|-------|---------|
| `GET` | Read data | No | Get list of bounties |
| `POST` | Create new resource | Yes | Create a bounty |
| `PUT` | Replace entire resource | Yes | Replace all bounty fields |
| `PATCH` | Update part of resource | Yes | Change bounty status only |
| `DELETE` | Delete a resource | No | Delete a bounty |

### HTTP Status Codes — What They Mean

| Code | Meaning | When to Use |
|------|---------|-------------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST that created something |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid input from client |
| 401 | Unauthorized | Not logged in |
| 403 | Forbidden | Logged in but not allowed |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate (e.g., bidding twice) |
| 422 | Unprocessable Entity | Validation failed |
| 500 | Internal Server Error | Bug on server |

### JSON — The Data Format

Frontend and backend communicate with JSON:

```json
{
  "title": "Build a calculator app",
  "description": "Need a React calculator",
  "rewardPoints": 100,
  "category": "CODING",
  "deadline": "2026-04-01T00:00:00.000Z"
}
```

---

## 4. REST API Deep Dive

REST (Representational State Transfer) is a set of conventions for designing URLs and their behaviors.

### Core REST Principles

**1. Resources, not actions**
```
WRONG:  GET /getBounties
WRONG:  POST /createBounty
RIGHT:  GET /bounties
RIGHT:  POST /bounties
```

The HTTP method (GET/POST) says what action. The URL says what resource.

**2. Hierarchical URLs for relationships**
```
/bounties                   → all bounties
/bounties/42                → bounty with id 42
/bounties/42/bids           → all bids for bounty 42
/bounties/42/bids/7         → bid 7 on bounty 42
/bounties/42/comments       → comments on bounty 42
```

**3. Stateless**
Every request must include everything needed. No server-side sessions. That's why JWT is sent in every request header.

**4. Consistent response format**
```json
// Success (list)
{
  "data": [...],
  "pagination": { "page": 1, "limit": 10, "total": 50 }
}

// Success (single item)
{
  "data": { "id": 1, "title": "..." }
}

// Error
{
  "error": "Bounty not found",
  "details": ["bountyId must be a positive integer"]
}
```

### Building an Express Route — Step by Step

```javascript
// 1. Import router
const express = require('express');
const router = express.Router();

// 2. Import middleware
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { body, param } = require('express-validator');

// 3. Import controller
const bountyController = require('../controllers/bountyController');

// 4. Define routes
// Public: anyone can read bounties
router.get('/', bountyController.list);
router.get('/:id', param('id').isInt(), validate, bountyController.getById);

// Protected: must be logged in to create
router.post('/',
  authenticate,                         // check JWT
  body('title').notEmpty().isLength({ max: 100 }),
  body('rewardPoints').isInt({ min: 1, max: 10000 }),
  validate,                             // check validation errors
  bountyController.create               // handle request
);

module.exports = router;
```

### Controller — Receives Request, Sends Response

```javascript
// bountyController.js
const bountyService = require('../services/bountyService');

// Controller's ONLY job: extract data, call service, respond
async function create(req, res, next) {
  try {
    const { title, description, rewardPoints, category, deadline } = req.body;
    const userId = req.user.id;  // set by authenticate middleware

    const bounty = await bountyService.createBounty({
      title, description, rewardPoints, category, deadline
    }, userId);

    res.status(201).json({ data: bounty });
  } catch (error) {
    next(error);  // pass to error handler middleware
  }
}
```

### Service — Business Rules

```javascript
// bountyService.js
const bountyRepository = require('../repositories/bountyRepository');
const { AppError } = require('../utils/AppError');
const { cacheInvalidate } = require('../config/redis');

async function createBounty(data, userId) {
  // Business rule: deadline must be in the future
  if (new Date(data.deadline) <= new Date()) {
    throw new AppError('Deadline must be in the future', 400);
  }

  // Business rule: title cannot be duplicate (example)
  const existing = await bountyRepository.findByTitle(data.title);
  if (existing) {
    throw new AppError('A bounty with this title already exists', 409);
  }

  const bounty = await bountyRepository.create({ ...data, createdBy: userId });

  // Invalidate cache so next read gets fresh data
  await cacheInvalidate('bounties:*');
  await cacheInvalidate('trending:*');

  return bounty;
}
```

### Repository — Database Queries Only

```javascript
// bountyRepository.js
const { prisma, prismaRead } = require('../config/database');

async function create(data) {
  return prisma.bounty.create({ data });  // writes go to master
}

async function findAll({ page, limit, status, category }) {
  const skip = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;
  if (category) where.category = category;

  const [bounties, total] = await Promise.all([
    prismaRead.bounty.findMany({   // reads go to replica
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { creator: { select: { id: true, name: true } } }
    }),
    prismaRead.bounty.count({ where })
  ]);

  return { bounties, total };
}
```

### Error Handling Middleware

```javascript
// errorHandler.js
function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  const message = err.isOperational
    ? err.message           // safe to show user
    : 'Internal server error';  // don't leak internal errors

  res.status(status).json({ error: message });
}
```

`AppError` has `isOperational: true`. Unexpected crashes (bugs) have `isOperational: false`.

---

## 5. Object-Oriented Programming — In Depth

OOP is a way of structuring code around **objects** — things that have data (properties) and behavior (methods).

### The Four Pillars

#### 1. Encapsulation — Hiding Internal Details

Encapsulation means bundling data and the methods that operate on it together, and hiding the internal implementation.

```javascript
// BAD — no encapsulation, data is exposed
let user = {
  email: 'a@b.com',
  password: 'plaintext123'  // NEVER do this
};
user.password = 'anything'; // anyone can change it

// GOOD — encapsulation with a class
class User {
  #passwordHash;  // private field (# prefix in modern JS)

  constructor(email, password) {
    this.email = email;
    this.#passwordHash = bcrypt.hashSync(password, 12);
  }

  verifyPassword(password) {
    return bcrypt.compareSync(password, this.#passwordHash);
  }

  // Password hash is never exposed
}

const user = new User('a@b.com', 'mypassword');
user.verifyPassword('mypassword');  // true
user.#passwordHash;  // ERROR — private, cannot access
```

**Why it matters:** You can change how the password is hashed (e.g., switch from bcrypt to argon2) without changing any code that uses the `User` class. The internal implementation is hidden.

#### 2. Inheritance — Reusing Behavior

Inheritance lets one class get all the properties and methods of another class.

```javascript
// Base class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);       // calls Error's constructor
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specialized errors inherit from AppError
class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'AuthError';
  }
}

class ValidationError extends AppError {
  constructor(errors) {
    super('Validation failed', 422);
    this.errors = errors;
    this.name = 'ValidationError';
  }
}

// Usage
throw new NotFoundError('Bounty');   // "Bounty not found" with 404
throw new AuthError();               // "Unauthorized" with 401
```

**Why it matters:** You define error behavior once in `AppError`. All subclasses inherit that behavior and only specify what's different.

#### 3. Polymorphism — Same Interface, Different Behavior

Polymorphism means different classes can be used through the same interface.

```javascript
// Different repository implementations — same interface
class PostgresBountyRepository {
  async findAll(filters) {
    return prisma.bounty.findMany({ where: filters });
  }
  async create(data) {
    return prisma.bounty.create({ data });
  }
}

class MongoBountyRepository {
  async findAll(filters) {
    return BountyModel.find(filters);
  }
  async create(data) {
    return BountyModel.create(data);
  }
}

// Service doesn't know or care which repository it's using
class BountyService {
  constructor(repository) {
    this.repository = repository;  // injected
  }

  async listBounties(filters) {
    return this.repository.findAll(filters);  // same call, different implementation
  }
}

// Switch from Postgres to Mongo by changing one line
const service = new BountyService(new PostgresBountyRepository());
// or
const service = new BountyService(new MongoBountyRepository());
```

#### 4. Abstraction — Working With the Concept, Not the Detail

Abstraction means you define what something does without specifying how it does it.

```javascript
// Abstract base class (concept)
class CacheProvider {
  async get(key) { throw new Error('Must implement get()'); }
  async set(key, value, ttl) { throw new Error('Must implement set()'); }
  async delete(pattern) { throw new Error('Must implement delete()'); }
}

// Concrete implementations
class RedisCacheProvider extends CacheProvider {
  constructor(client) {
    super();
    this.client = client;
  }
  async get(key) { return this.client.get(key); }
  async set(key, value, ttl) { return this.client.setex(key, ttl, JSON.stringify(value)); }
  async delete(pattern) { /* redis pattern delete */ }
}

class InMemoryCacheProvider extends CacheProvider {
  constructor() {
    super();
    this.store = new Map();
  }
  async get(key) { return this.store.get(key) || null; }
  async set(key, value, ttl) { this.store.set(key, value); }
  async delete(key) { this.store.delete(key); }
}

// Anywhere in the code, use CacheProvider — works with either implementation
```

### Classes vs Plain Objects vs Functions

| Approach | When to Use |
|----------|-------------|
| Plain object `{}` | Simple data bags, no behavior |
| Function | Single operation, no shared state |
| Class | Multiple methods that share state, when you need multiple instances |

In Node.js/Express, you'll often see service and repository layers written as either classes or exported plain objects of functions. Both are valid. Classes become more useful as your codebase grows and you want to use dependency injection.

### SOLID Principles — The Rules of Good OOP

| Principle | What It Means | Example |
|-----------|--------------|---------|
| **S** Single Responsibility | Each class has one job | `BountyService` only handles bounty logic, not email sending |
| **O** Open/Closed | Open for extension, closed for modification | Add new bid strategy by creating new class, not editing existing |
| **L** Liskov Substitution | Subclasses must work wherever parent is used | `NotFoundError` works anywhere `AppError` is expected |
| **I** Interface Segregation | Don't force classes to implement methods they don't need | Split fat interfaces into smaller ones |
| **D** Dependency Inversion | Depend on abstractions, not concretions | Service depends on `Repository` interface, not `PrismaRepository` |

---

## 6. Design Patterns You Must Know

Design patterns are proven solutions to common programming problems. They're named so engineers can communicate efficiently ("use a Factory here").

### Creational Patterns — Creating Objects

#### Singleton
Ensure only one instance of a class exists (e.g., database connection).

```javascript
// database.js
class Database {
  static #instance = null;

  constructor() {
    if (Database.#instance) {
      return Database.#instance;  // return existing instance
    }
    this.client = new PrismaClient();
    Database.#instance = this;
  }

  static getInstance() {
    if (!Database.#instance) {
      new Database();
    }
    return Database.#instance;
  }
}

// Usage — always same instance
const db1 = Database.getInstance();
const db2 = Database.getInstance();
// db1 === db2 → true
```

**In BountyHub:** The Prisma client is created once at module load and reused (Node.js module caching acts as singleton).

#### Factory Pattern
Create objects without specifying the exact class.

```javascript
class NotificationFactory {
  static create(type, data) {
    switch (type) {
      case 'email':   return new EmailNotification(data);
      case 'push':    return new PushNotification(data);
      case 'sms':     return new SmsNotification(data);
      default: throw new Error(`Unknown notification type: ${type}`);
    }
  }
}

// Usage
const notification = NotificationFactory.create('email', {
  to: 'user@example.com',
  subject: 'Your bid was accepted!'
});
await notification.send();
```

#### Builder Pattern
Construct complex objects step by step.

```javascript
class BountyQueryBuilder {
  constructor() {
    this.query = { where: {}, orderBy: {}, include: {} };
  }

  withStatus(status) {
    this.query.where.status = status;
    return this;  // chainable
  }

  withCategory(category) {
    this.query.where.category = category;
    return this;
  }

  sortBy(field, direction = 'desc') {
    this.query.orderBy[field] = direction;
    return this;
  }

  withCreator() {
    this.query.include.creator = { select: { id: true, name: true } };
    return this;
  }

  paginate(page, limit) {
    this.query.skip = (page - 1) * limit;
    this.query.take = limit;
    return this;
  }

  build() {
    return this.query;
  }
}

// Usage — readable, no long parameter lists
const query = new BountyQueryBuilder()
  .withStatus('OPEN')
  .withCategory('CODING')
  .sortBy('rewardPoints', 'desc')
  .withCreator()
  .paginate(1, 10)
  .build();

const bounties = await prisma.bounty.findMany(query);
```

### Structural Patterns — Organizing Objects

#### Repository Pattern
Abstracts database access behind a consistent interface.

```javascript
// This is what BountyHub already does:
class BountyRepository {
  async findById(id) { ... }
  async findAll(filters) { ... }
  async create(data) { ... }
  async update(id, data) { ... }
  async delete(id) { ... }
}

// Why? Services don't know about Prisma, SQL, or MongoDB.
// You can swap the DB without touching service code.
```

#### Decorator Pattern
Add behavior to an object without changing its class.

```javascript
// Base repository
class BountyRepository {
  async findAll(filters) {
    return prisma.bounty.findMany({ where: filters });
  }
}

// Cached version wraps the base
class CachedBountyRepository {
  constructor(repository, cache) {
    this.repository = repository;
    this.cache = cache;
  }

  async findAll(filters) {
    const key = `bounties:${JSON.stringify(filters)}`;
    return this.cache.getOrSet(key, () => this.repository.findAll(filters), 60);
  }
}

// Usage — compose behavior
const repo = new CachedBountyRepository(
  new BountyRepository(),
  new RedisCacheProvider(redisClient)
);
```

#### Adapter Pattern
Makes incompatible interfaces work together.

```javascript
// Old search interface
class OldSearchService {
  search(term, limit) { ... }  // returns array
}

// New interface your app expects
class SearchAdapter {
  constructor(oldService) {
    this.service = oldService;
  }

  // Translates new interface to old
  async searchBounties({ query, page, limit }) {
    const results = await this.service.search(query, limit);
    return {
      data: results,
      pagination: { page, limit, total: results.length }
    };
  }
}
```

### Behavioral Patterns — Communication Between Objects

#### Observer Pattern
One object notifies many others when something happens. Perfect for real-time features.

```javascript
class EventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }
}

const eventBus = new EventEmitter();

// Register listeners
eventBus.on('bounty:completed', async ({ bountyId, winnerId, points }) => {
  await emailService.send(winnerId, 'Congrats! You earned points!');
});

eventBus.on('bounty:completed', async ({ bountyId }) => {
  await cacheInvalidate('leaderboard:*');
});

eventBus.on('bounty:completed', async ({ bountyId, winnerId }) => {
  await websocketService.notify(winnerId, { type: 'BOUNTY_COMPLETED' });
});

// When submission is accepted, just emit the event
// All listeners are called automatically
eventBus.emit('bounty:completed', {
  bountyId: 42,
  winnerId: 7,
  points: 100
});
```

#### Strategy Pattern
Define a family of algorithms and make them interchangeable.

```javascript
// Sorting strategies
class SortByReward {
  sort(bounties) {
    return bounties.sort((a, b) => b.rewardPoints - a.rewardPoints);
  }
}

class SortByDeadline {
  sort(bounties) {
    return bounties.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }
}

class SortByRecent {
  sort(bounties) {
    return bounties.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

// Context class uses strategy
class BountyListService {
  constructor(sortStrategy) {
    this.sortStrategy = sortStrategy;
  }

  setSortStrategy(strategy) {
    this.sortStrategy = strategy;
  }

  async getSortedBounties(filters) {
    const bounties = await bountyRepository.findAll(filters);
    return this.sortStrategy.sort(bounties);
  }
}

// Switch strategy based on query param
const strategyMap = {
  'reward': new SortByReward(),
  'deadline': new SortByDeadline(),
  'recent': new SortByRecent()
};

const strategy = strategyMap[req.query.sortBy] || new SortByRecent();
const service = new BountyListService(strategy);
```

#### Middleware Pattern (Chain of Responsibility)
Each handler decides whether to process the request or pass it to the next one. This is exactly how Express middleware works.

```javascript
// Express middleware is Chain of Responsibility
app.use(helmet());           // security headers
app.use(cors());             // CORS
app.use(rateLimit());        // rate limiting
app.use(authenticate);       // JWT check
// ...request reaches handler only if all above pass
```

---

## 7. Building Visually Stunning Websites

### Core Principles of Good UI Design

#### 1. Visual Hierarchy
Make important things look important. Users scan, not read.

- **Size:** Bigger = more important
- **Color:** Contrast draws attention
- **Weight:** Bold text stands out
- **Space:** White space gives elements room to breathe
- **Position:** Top-left gets seen first

```css
/* BAD — everything same weight */
.card h2 { font-size: 16px; font-weight: 400; }
.card p { font-size: 16px; font-weight: 400; }
.card span { font-size: 16px; font-weight: 400; }

/* GOOD — clear hierarchy */
.card h2 { font-size: 20px; font-weight: 700; color: #111; }
.card p { font-size: 14px; font-weight: 400; color: #555; }
.card .badge { font-size: 11px; font-weight: 600; text-transform: uppercase; }
```

#### 2. The 8-Point Grid System
All spacing should be multiples of 8 (or 4). This creates visual consistency.

```css
/* All padding/margin/gap values are 4px, 8px, 16px, 24px, 32px, 48px, 64px */
.card { padding: 24px; border-radius: 8px; }
.card-header { margin-bottom: 16px; }
.card-footer { margin-top: 24px; padding-top: 16px; }
.grid { gap: 24px; }
```

TailwindCSS is built on this system — `p-4` = 16px (4 * 4), `p-6` = 24px.

#### 3. Color System
Use a limited, intentional palette.

```css
:root {
  /* Primary — for actions and focus */
  --color-primary-500: #3b82f6;    /* main blue */
  --color-primary-600: #2563eb;    /* hover state */
  --color-primary-100: #dbeafe;    /* light background */

  /* Neutral — for text and backgrounds */
  --color-neutral-900: #111827;    /* headings */
  --color-neutral-600: #4b5563;    /* body text */
  --color-neutral-400: #9ca3af;    /* muted text */
  --color-neutral-100: #f3f4f6;    /* card backgrounds */
  --color-neutral-50:  #f9fafb;    /* page background */

  /* Semantic — for status */
  --color-success: #10b981;        /* green */
  --color-warning: #f59e0b;        /* amber */
  --color-danger:  #ef4444;        /* red */
}
```

#### 4. Typography Scale
Pick a scale and stick to it.

```css
/* Modular scale — each step is 1.25x the previous */
--text-xs:   0.75rem;   /* 12px — labels */
--text-sm:   0.875rem;  /* 14px — secondary text */
--text-base: 1rem;      /* 16px — body */
--text-lg:   1.125rem;  /* 18px — subheadings */
--text-xl:   1.25rem;   /* 20px — card titles */
--text-2xl:  1.5rem;    /* 24px — section titles */
--text-3xl:  1.875rem;  /* 30px — page titles */
--text-4xl:  2.25rem;   /* 36px — hero titles */
```

#### 5. Microinteractions — What Makes UI Feel Alive

Small animations that respond to user actions make interfaces feel polished:

```css
/* Button hover state */
.btn-primary {
  background: var(--color-primary-500);
  transform: translateY(0);
  transition: all 0.15s ease;
}

.btn-primary:hover {
  background: var(--color-primary-600);
  transform: translateY(-1px);          /* subtle lift */
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn-primary:active {
  transform: translateY(0);            /* press down */
}

/* Card hover */
.bounty-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.bounty-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
}

/* Skeleton loading animation */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

### Component Architecture — Building Modular UIs

Think of your UI as **Lego bricks** — small, composable pieces.

```
Atoms (smallest)       → Button, Badge, Input, Icon
Molecules (composed)   → BountyCard = Badge + Icon + Button
Organisms (sections)   → BountyList = header + grid of BountyCards + Pagination
Templates (pages)      → BountiesPage = Navbar + filters + BountyList + Footer
Pages                  → /bounties = Template with real data
```

This is called **Atomic Design**.

```jsx
// Atom — reusable button
function Button({ variant = 'primary', size = 'md', children, ...props }) {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent hover:bg-gray-100'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      className={`rounded-lg font-medium transition-all ${variants[variant]} ${sizes[size]}`}
      {...props}
    >
      {children}
    </button>
  );
}

// Atom — status badge
function StatusBadge({ status }) {
  const styles = {
    OPEN:        'bg-green-100 text-green-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    COMPLETED:   'bg-blue-100 text-blue-800',
    CANCELLED:   'bg-red-100 text-red-800'
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

// Molecule — bounty card uses atoms
function BountyCard({ bounty }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:-translate-y-1 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{bounty.title}</h3>
        <StatusBadge status={bounty.status} />
      </div>
      <p className="text-gray-500 text-sm line-clamp-2 mb-4">{bounty.description}</p>
      <div className="flex items-center justify-between">
        <span className="text-blue-600 font-bold">{bounty.rewardPoints} pts</span>
        <Button variant="ghost" size="sm">View Details</Button>
      </div>
    </div>
  );
}
```

### Responsive Design — Mobile First

Always design for mobile first, then scale up:

```css
/* Mobile first */
.grid { grid-template-columns: 1fr; gap: 16px; }

/* Tablet (768px+) */
@media (min-width: 768px) {
  .grid { grid-template-columns: repeat(2, 1fr); gap: 24px; }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .grid { grid-template-columns: repeat(3, 1fr); gap: 32px; }
}
```

TailwindCSS mobile-first example:
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
```

---

## 8. Databases & Polyglot Persistence

**Polyglot persistence** means using different databases for different types of data, choosing the best tool for each job.

### SQL vs NoSQL — The Core Difference

| Aspect | SQL (PostgreSQL) | NoSQL (MongoDB) |
|--------|-----------------|-----------------|
| Data structure | Fixed schema (tables, rows, columns) | Flexible schema (documents, collections) |
| Relationships | Foreign keys, JOIN queries | Embed or reference |
| Query language | SQL | JSON-based query API |
| Transactions | ACID (strong) | Eventually consistent (depends) |
| Best for | Structured data, complex queries | Flexible/hierarchical data, rapid iteration |

### PostgreSQL — Your Primary Database

PostgreSQL stores your core relational data: users, bounties, bids, submissions, comments, reputation logs.

**Why PostgreSQL for this?**
- Users have strict relationships (a bid belongs to exactly one bounty and one user)
- You need ACID transactions (reputation update must be atomic)
- You want complex queries (join users + bounties + count bids)

**Key SQL concepts:**

```sql
-- Creating a table
CREATE TABLE bounties (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(100) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  created_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- JOIN — linking tables
SELECT b.title, u.name as creator_name, COUNT(bids.id) as bid_count
FROM bounties b
JOIN users u ON b.created_by = u.id
LEFT JOIN bids ON bids.bounty_id = b.id
WHERE b.status = 'OPEN'
GROUP BY b.id, u.name
ORDER BY b.created_at DESC;

-- Transaction — atomic operation
BEGIN;
  INSERT INTO reputation_log (user_id, points, reason) VALUES (7, 100, 'Completed bounty');
  UPDATE users SET reputation = reputation + 100 WHERE id = 7;
  UPDATE bounties SET status = 'COMPLETED' WHERE id = 42;
COMMIT;  -- all succeed or all fail together
```

**Prisma ORM** wraps SQL into JavaScript:
```javascript
// Prisma equivalent of the transaction above
await prisma.$transaction([
  prisma.reputationLog.create({ data: { userId: 7, points: 100, reason: 'Completed bounty' } }),
  prisma.user.update({ where: { id: 7 }, data: { reputation: { increment: 100 } } }),
  prisma.bounty.update({ where: { id: 42 }, data: { status: 'COMPLETED' } })
]);
```

### MongoDB — For Document-Style Data

MongoDB is ideal for data that doesn't fit neatly into tables — like user-uploaded files, rich activity feeds, or notification history.

**In the improved BountyHub, use MongoDB for:**
- File metadata (uploaded submissions — name, size, type, S3 URL, uploaded by)
- Notification history (complex nested structure)
- User activity feeds

```javascript
// Mongoose schema
const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  bountyId:     { type: Number, required: true },   // link to PostgreSQL
  uploadedBy:   { type: Number, required: true },   // link to PostgreSQL user
  filename:     { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType:     { type: String, required: true },
  sizeBytes:    { type: Number, required: true },
  s3Url:        { type: String, required: true },
  uploadedAt:   { type: Date, default: Date.now },
  metadata:     { type: mongoose.Schema.Types.Mixed }  // flexible extra data
});

const File = mongoose.model('File', FileSchema);

// Create
await File.create({
  bountyId: 42,
  uploadedBy: 7,
  filename: 'solution-42.zip',
  originalName: 'my-calculator.zip',
  mimeType: 'application/zip',
  sizeBytes: 1024000,
  s3Url: 'https://s3.amazonaws.com/bountyhub/uploads/...',
});

// Query
const files = await File.find({ bountyId: 42 }).sort({ uploadedAt: -1 });
```

### Redis — For Caching and Real-Time Features

Redis is already used in BountyHub for caching. In the improved version, also use it for:

**1. Session storage (alternative to JWT localStorage)**
```javascript
// Store session in Redis
await redis.setex(`session:${sessionId}`, 604800, JSON.stringify(user));
// Get session
const user = JSON.parse(await redis.get(`session:${sessionId}`));
```

**2. Rate limiting per user (not just IP)**
```javascript
const key = `ratelimit:${userId}`;
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 60);  // 60s window
if (count > 10) throw new AppError('Rate limit exceeded', 429);
```

**3. Real-time bid counters**
```javascript
// Increment atomically — no race conditions
await redis.incr(`bounty:${bountyId}:bid_count`);
const count = await redis.get(`bounty:${bountyId}:bid_count`);
```

**4. Pub/Sub for real-time notifications**
```javascript
// Publisher (when bid is placed)
await redisPublisher.publish('bid:placed', JSON.stringify({
  bountyId: 42,
  bidderId: 7,
  message: 'I can do this!'
}));

// Subscriber (WebSocket server)
await redisSubscriber.subscribe('bid:placed');
redisSubscriber.on('message', (channel, data) => {
  const bid = JSON.parse(data);
  // Notify bounty creator via WebSocket
  wsServer.notifyUser(bounty.createdBy, { type: 'NEW_BID', bid });
});
```

### Elasticsearch — For Proper Full-Text Search

The current search uses PostgreSQL `ILIKE '%term%'` which is slow on large datasets. Elasticsearch provides:
- Fuzzy matching (typo tolerance)
- Relevance scoring
- Faceted search (filter by multiple dimensions simultaneously)
- Real-time indexing

```javascript
const { Client } = require('@elastic/elasticsearch');
const esClient = new Client({ node: 'http://localhost:9200' });

// Index a bounty when created
await esClient.index({
  index: 'bounties',
  id: bounty.id.toString(),
  document: {
    title:        bounty.title,
    description:  bounty.description,
    category:     bounty.category,
    status:       bounty.status,
    rewardPoints: bounty.rewardPoints,
    createdAt:    bounty.createdAt,
    creatorName:  bounty.creator.name,
    universityName: bounty.creator.university.name
  }
});

// Search
const results = await esClient.search({
  index: 'bounties',
  query: {
    multi_match: {
      query: 'calculator react',
      fields: ['title^3', 'description', 'creatorName'],   // title weighted 3x
      fuzziness: 'AUTO'   // tolerates typos
    }
  },
  filter: [{ term: { status: 'OPEN' } }],
  sort: [{ _score: 'desc' }, { rewardPoints: 'desc' }]
});
```

### Polyglot Architecture for Improved BountyHub

```
Data Type           | Database        | Why
--------------------|-----------------|------------------------------------
Users, Bounties,    |                 |
Bids, Submissions,  | PostgreSQL      | Relational, ACID transactions
Comments, Reputation|                 |
--------------------|-----------------|------------------------------------
File uploads        | MongoDB         | Flexible schema, binary metadata
Notification history|                 | Variable structure per event type
--------------------|-----------------|------------------------------------
Caching             | Redis           | Fast reads, TTL support
Rate limiting       |                 | Atomic counters
Real-time pub/sub   |                 | Lightweight messaging
--------------------|-----------------|------------------------------------
Full-text search    | Elasticsearch   | Relevance ranking, fuzzy search
                    |                 | Faceted filtering
```

### Database Migrations — Managing Schema Changes

When you change your database schema, you need migrations — versioned SQL scripts.

```javascript
// With Prisma:
// 1. Edit schema.prisma
// 2. npx prisma migrate dev --name "add_tags_to_bounty"
// This creates: prisma/migrations/20260325_add_tags_to_bounty/migration.sql
// And runs it automatically

// The migration file looks like:
-- ALTER TABLE "bounties" ADD COLUMN "tags" TEXT[];
-- CREATE INDEX "bounties_tags_idx" ON "bounties" USING GIN("tags");
```

---

## 9. Improved BountyHub — What to Build Next

### New Feature Roadmap

#### Phase 1 — Foundation Improvements

**1. Proper Database Replication**

The current setup uses two separate PostgreSQL instances pretending to be master/replica. Real streaming replication:
- Master DB accepts all writes
- Replica streams WAL (Write-Ahead Log) from master in near-real-time
- Read queries automatically go to replica
- Automatic failover: if master fails, replica promotes

```yaml
# docker-compose.yml - proper replication
postgres-master:
  image: postgres:16
  environment:
    POSTGRES_PASSWORD: postgres123
    POSTGRES_REPLICATION_USER: replicator
    POSTGRES_REPLICATION_PASSWORD: replicator123
  command: |
    postgres
    -c wal_level=replica
    -c max_wal_senders=3
    -c wal_keep_size=64

postgres-replica:
  image: postgres:16
  environment:
    PGUSER: replicator
    PGPASSWORD: replicator123
    PGDATABASE: bounty_platform
    POSTGRES_MASTER_HOST: postgres-master
  # Replica starts with pg_basebackup from master
  # Then streams WAL continuously
```

**2. Real File Upload System**

Instead of "paste a link", let users upload files directly.

```
Browser → POST /api/uploads (multipart/form-data)
        → Express + Multer (receive file)
        → Upload to AWS S3 (or MinIO for local dev)
        → Store file metadata in MongoDB
        → Return S3 URL
```

```javascript
// multer setup
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');

const s3 = new S3Client({ region: 'us-east-1' });

const upload = multer({
  storage: multerS3({
    s3,
    bucket: 'bountyhub-uploads',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      cb(null, `submissions/${req.user.id}/${Date.now()}-${file.originalname}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 },  // 50MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['application/zip', 'application/pdf', 'image/png', 'image/jpeg'];
    cb(null, allowed.includes(file.mimetype));
  }
});

router.post('/submissions/:bountyId/upload', authenticate, upload.single('file'), submissionController.upload);
```

**3. WebSocket Real-Time Notifications**

```javascript
// server/src/websocket.js
const { Server } = require('socket.io');

function setupWebSocket(httpServer) {
  const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL } });

  // Auth middleware for WebSocket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    // User joins their own room
    socket.join(`user:${socket.user.id}`);

    socket.on('join:bounty', (bountyId) => {
      socket.join(`bounty:${bountyId}`);  // for bounty-specific updates
    });

    socket.on('disconnect', () => {
      console.log(`User ${socket.user.id} disconnected`);
    });
  });

  return io;
}

// In submission service, after accepting:
io.to(`user:${bid.bidderId}`).emit('notification', {
  type: 'SUBMISSION_ACCEPTED',
  message: `Your submission for "${bounty.title}" was accepted! +${bounty.rewardPoints} points`,
  bountyId: bounty.id
});
```

**4. Role-Based Access Control (RBAC)**

```javascript
// Add roles to User model
// Roles: STUDENT, MODERATOR, ADMIN

// Middleware
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new AppError('Insufficient permissions', 403);
    }
    next();
  };
}

// Usage
router.delete('/bounties/:id', authenticate, requireRole('ADMIN', 'MODERATOR'), bountyController.delete);
router.get('/admin/users', authenticate, requireRole('ADMIN'), adminController.listUsers);
```

#### Phase 2 — Enhanced Features

**5. Email Notifications**

```javascript
// Using Nodemailer + SendGrid/Mailgun
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'sendgrid',
  auth: { user: 'apikey', pass: process.env.SENDGRID_API_KEY }
});

async function sendBidAcceptedEmail(user, bounty) {
  await transporter.sendMail({
    from: 'noreply@bountyhub.com',
    to: user.email,
    subject: `Your bid on "${bounty.title}" was accepted!`,
    html: `
      <h2>Congratulations ${user.name}!</h2>
      <p>Your bid on <strong>${bounty.title}</strong> has been accepted.</p>
      <p>You can now submit your work <a href="${process.env.CLIENT_URL}/bounties/${bounty.id}">here</a>.</p>
    `
  });
}
```

**6. OAuth (Login with Google)**

```javascript
// Passport.js Google strategy
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  '/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;
  let user = await userRepository.findByEmail(email);

  if (!user) {
    user = await userRepository.create({
      name: profile.displayName,
      email,
      avatarUrl: profile.photos[0].value,
      googleId: profile.id,
      universityId: null  // require them to select university after
    });
  }

  done(null, user);
}));

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google'), authController.googleCallback);
```

**7. Elasticsearch Integration**

Replace the ILIKE search with Elasticsearch:

```javascript
// On bounty create, index it
async function createBounty(data, userId) {
  const bounty = await bountyRepository.create({ ...data, createdBy: userId });

  // Index in Elasticsearch asynchronously (don't block response)
  setImmediate(async () => {
    await esClient.index({
      index: 'bounties',
      id: bounty.id.toString(),
      document: { ...bounty, creatorName: req.user.name }
    });
  });

  return bounty;
}

// In search service
async function searchBounties(query, filters, page, limit) {
  const response = await esClient.search({
    index: 'bounties',
    from: (page - 1) * limit,
    size: limit,
    query: {
      bool: {
        must: {
          multi_match: { query, fields: ['title^3', 'description'], fuzziness: 'AUTO' }
        },
        filter: [
          ...(filters.status ? [{ term: { status: filters.status } }] : []),
          ...(filters.category ? [{ term: { category: filters.category } }] : [])
        ]
      }
    }
  });

  return {
    data: response.hits.hits.map(hit => hit._source),
    total: response.hits.total.value
  };
}
```

---

## 10. Replication & Scalability — How It Really Works

### What Is Replication?

Replication = keeping copies of your data on multiple database servers.

**Why?**
- **Read performance:** Many servers handle read queries instead of one
- **High availability:** If one server goes down, another takes over
- **Disaster recovery:** Data isn't lost if a server fails

### Types of Replication

#### 1. Primary-Replica (Master-Slave) Replication

```
All WRITES → Primary (master)
                   |
                   | streams WAL (transaction log)
                   |
         ┌─────────┴──────────┐
         ↓                    ↓
    Replica 1            Replica 2
(READ queries)        (READ queries)
```

The master records every change to a **WAL (Write-Ahead Log)**. Replicas continuously receive and replay this log. Replicas are slightly behind master (replication lag — usually milliseconds).

**In BountyHub:** The `prisma` client writes to master, `prismaRead` reads from replica. This is the pattern used. Real replication requires PostgreSQL configuration (not just two separate instances).

#### 2. Synchronous vs Asynchronous Replication

| Type | How | Latency | Durability |
|------|-----|---------|------------|
| Synchronous | Master waits for replica to confirm before acknowledging write | Higher | No data loss possible |
| Asynchronous | Master doesn't wait, replica catches up later | Lower | Small data loss risk on failure |

Most production systems use **asynchronous** for performance, accepting minimal lag.

#### 3. Sharding — Horizontal Scaling

When one database can't hold all the data:

```
User IDs 1-10000      → Shard 1 (DB server 1)
User IDs 10001-20000  → Shard 2 (DB server 2)
User IDs 20001-30000  → Shard 3 (DB server 3)
```

Sharding is complex. PostgreSQL extension Citus adds this. Avoid until you have millions of rows.

### Connection Pooling — Why It Matters

Every database query requires a **connection** to the DB server. Connections are expensive (memory, TCP handshake). A database can handle ~100-200 connections.

**Problem:** 1000 concurrent users → 1000 connection attempts → DB crashes.

**Solution:** Connection pool (e.g., PgBouncer) — maintain a fixed pool (e.g., 20 connections) and queue requests.

```
1000 users → Connection Pool (20 connections) → PostgreSQL

Queue: [req1, req2, ... req980]
Active: [req3, req7, req12, ...]
```

Prisma has a built-in connection pool. For high traffic, add **PgBouncer** in front of PostgreSQL.

### Caching Strategies

| Strategy | How | When to Use |
|----------|-----|------------|
| **Cache-Aside** | App checks cache; on miss, reads DB and stores in cache | General purpose (what BountyHub uses) |
| **Write-Through** | On write: update DB AND cache simultaneously | When reads always need fresh data |
| **Write-Behind** | Write to cache first, flush to DB asynchronously | Write-heavy workloads |
| **Read-Through** | Cache automatically fetches from DB on miss | Simpler code |

### CDN — For Static Assets

A CDN (Content Delivery Network) distributes static files (images, CSS, JS) from servers close to the user.

```
User in India requests logo.png
  → CDN edge server in Mumbai responds (fast, <10ms)
  → vs. Origin server in US (slow, >200ms)
```

Use Cloudflare, AWS CloudFront, or Vercel (which Next.js is optimized for).

---

## 11. Step-by-Step Build Plan

### Phase 0 — Get the Current Version Running

```bash
# Prerequisites: Docker Desktop installed

# 1. Clone/download the project
# 2. Navigate to project directory
cd BountyHub-main

# 3. Start everything
npm run docker:up

# 4. Open in browser
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000/api/health

# 5. Login with test account
# Email: aarav@iitd.ac.in
# Password: pass123
```

**What to explore:**
- Read every file in `server/src/` from top to bottom
- Use the browser network tab (F12 → Network) to see every API request
- Try the API directly with a tool like Insomnia or Postman

### Phase 1 — Understand Before Touching

1. Map out every route in `server/src/routes/` to its controller → service → repository
2. Draw the database schema on paper — boxes for tables, arrows for relationships
3. Trace the full path of one request (e.g., "create bounty") through all layers
4. Understand how JWT is created, stored, and verified

### Phase 2 — Build Your First Feature Addition

**Add tags to bounties:**

```
Step 1: Schema change
  → Add `tags String[]` to Bounty in schema.prisma
  → Run: npx prisma migrate dev --name "add_bounty_tags"

Step 2: Repository
  → Update bountyRepository.create() to accept tags
  → Update bountyRepository.findAll() to filter by tags

Step 3: Service
  → Update bountyService.createBounty() validation
  → Validate max 5 tags, each max 20 chars

Step 4: Controller & Route
  → Add tags to the POST /bounties validation in bountyRoutes.js
  → No controller change needed (it passes body through)

Step 5: Frontend
  → Add tag input UI to pages/bounties/new.js
  → Show tags on BountyCard component
  → Add tag filter to pages/bounties/index.js
```

This one small feature touches every layer. Doing it teaches you the full stack.

### Phase 3 — Add MongoDB for File Uploads

```
Step 1: Setup
  → Add MongoDB to docker-compose.yml
  → npm install mongoose multer multer-s3 @aws-sdk/client-s3
  → Create server/src/config/mongodb.js

Step 2: Model
  → Create server/src/models/File.js (Mongoose schema)

Step 3: Upload endpoint
  → Create server/src/routes/uploadRoutes.js
  → POST /api/uploads — multer middleware + S3 upload

Step 4: Link to submission
  → Add fileId reference to Submission model
  → Update submission controller to store file reference

Step 5: Frontend
  → Replace submission link input with file upload component
  → Show uploaded file name/size/download link
```

### Phase 4 — Add Elasticsearch Search

```
Step 1: Setup
  → Add Elasticsearch to docker-compose.yml
  → npm install @elastic/elasticsearch

Step 2: Index creation
  → Create server/src/config/elasticsearch.js
  → Create index mapping (field types, analyzers)

Step 3: Sync existing data
  → Script to index all existing bounties in Elasticsearch
  → Run once: node scripts/indexBounties.js

Step 4: Hook into create/update/delete
  → After bountyRepository.create() → esClient.index()
  → After bountyRepository.update() → esClient.update()
  → After bountyRepository.delete() → esClient.delete()

Step 5: Replace search service
  → searchService.searchBounties() now queries Elasticsearch
  → Fall back to PostgreSQL ILIKE if Elasticsearch is down
```

### Phase 5 — Real-Time with WebSockets

```
Step 1: Server setup
  → npm install socket.io
  → Modify server/src/index.js to create http.createServer(app)
  → Create server/src/websocket.js

Step 2: Define events
  → bid:placed    → notify bounty creator
  → bid:accepted  → notify bid winner
  → submission:reviewed → notify submitter
  → comment:added → notify bounty creator + other commenters

Step 3: Emit events in services
  → After bid created in bidService → io.emit('bid:placed', data)
  → After bid accepted → io.emit('bid:accepted', data)

Step 4: Frontend notification center
  → Create NotificationBell component
  → Connect socket.io-client in _app.js or a hook
  → Show toast on new notification
  → Notification drawer with history
```

### Phase 6 — Testing

```javascript
// Unit test for bidService
const { describe, it, expect, jest } = require('@jest/globals');

// Mock the repository
jest.mock('../repositories/bidRepository');
const bidRepository = require('../repositories/bidRepository');

const bidService = require('../services/bidService');

describe('bidService.placeBid', () => {
  it('should throw if user bids on own bounty', async () => {
    const bounty = { id: 1, createdBy: 7, status: 'OPEN' };

    await expect(bidService.placeBid(bounty, { message: 'test' }, 7))
      .rejects.toThrow('You cannot bid on your own bounty');
  });

  it('should throw if bounty is not OPEN', async () => {
    const bounty = { id: 1, createdBy: 5, status: 'IN_PROGRESS' };

    await expect(bidService.placeBid(bounty, { message: 'test' }, 7))
      .rejects.toThrow('This bounty is not accepting bids');
  });

  it('should create bid if all conditions met', async () => {
    const bounty = { id: 1, createdBy: 5, status: 'OPEN' };
    bidRepository.create.mockResolvedValue({ id: 99, bountyId: 1, bidderId: 7 });

    const bid = await bidService.placeBid(bounty, { message: 'I can do this' }, 7);
    expect(bid.id).toBe(99);
    expect(bidRepository.create).toHaveBeenCalledWith({ bountyId: 1, bidderId: 7, message: 'I can do this' });
  });
});
```

---

## 12. Technology Choices — What to Use and Why

### Backend Framework Options

| Framework | Language | When to Use |
|-----------|---------|-------------|
| **Express.js** (current) | JavaScript | Small-medium apps, maximum control, large ecosystem |
| **Fastify** | JavaScript | Express but faster, built-in schema validation |
| **NestJS** | TypeScript | Large teams, enforces structure, Angular-like |
| **Hono** | TypeScript | Edge/serverless, lightweight |

**Recommendation:** Keep Express for learning. Move to NestJS when the team grows.

### Frontend Framework Options

| Framework | When to Use |
|-----------|-------------|
| **Next.js** (current) | Full-stack React apps, SSR/SSG, Vercel deployment |
| **Remix** | Full-stack, forms-focused, progressive enhancement |
| **Vite + React** | SPA only, no SSR needed |
| **SvelteKit** | Simpler mental model, smaller bundle |

**Recommendation:** Keep Next.js. Add TypeScript.

### Why TypeScript Matters

TypeScript = JavaScript + types. Types catch bugs before they reach production.

```typescript
// JavaScript — no warnings even with bugs
function createBounty(data) {
  return db.bounty.create({ data });
}
createBounty({ titl: 'test' });  // typo in 'title' — no error until runtime!

// TypeScript — catches bugs at compile time
interface CreateBountyInput {
  title: string;          // required, must be string
  description: string;
  rewardPoints: number;
  category: BountyCategory;
  deadline: Date;
}

function createBounty(data: CreateBountyInput) {
  return db.bounty.create({ data });
}
createBounty({ titl: 'test' });  // ERROR: 'titl' doesn't exist, did you mean 'title'?
```

**How to add TypeScript to Express:**
```bash
npm install typescript @types/node @types/express ts-node-dev
npx tsc --init
# Rename .js files to .ts and add types
```

### Database ORM Options

| ORM | Pros | Cons |
|-----|------|------|
| **Prisma** (current) | Type-safe, great migrations, Prisma Studio UI | Less flexible for complex queries |
| **Drizzle** | Type-safe, closer to SQL, very fast | Newer, smaller ecosystem |
| **TypeORM** | Mature, Active Record or Data Mapper patterns | Complex, slower |
| **Knex.js** | Query builder, full SQL control | No types, more verbose |
| **Raw SQL** | Maximum control, maximum performance | No type safety, more code |

**Recommendation:** Keep Prisma. It's excellent.

### Deployment Options

| Platform | Cost | Best For |
|---------|------|---------|
| **Vercel** | Free tier | Next.js frontend |
| **Railway** | Free tier | Express backend + PostgreSQL |
| **Render** | Free tier | Full-stack apps |
| **AWS** | Pay per use | Production scale |
| **DigitalOcean** | $5/month | Simple VPS |
| **Docker** (current) | Self-hosted | Learning, local dev |

---

## 13. Glossary of Terms

| Term | Meaning |
|------|---------|
| **API** | Application Programming Interface — a set of rules for how programs communicate |
| **REST** | Representational State Transfer — a style for designing APIs using HTTP |
| **JWT** | JSON Web Token — a signed token used for authentication |
| **ORM** | Object-Relational Mapper — library that converts DB rows to code objects (Prisma) |
| **Migration** | A versioned script that changes the database schema |
| **Middleware** | A function that runs between the request arriving and the handler running |
| **Repository Pattern** | Layer that isolates database queries from business logic |
| **Controller** | Handles HTTP requests/responses, delegates to services |
| **Service** | Contains business rules, orchestrates repositories |
| **ACID** | Atomicity, Consistency, Isolation, Durability — database transaction guarantees |
| **WAL** | Write-Ahead Log — PostgreSQL's transaction log used for replication |
| **Replication** | Keeping synchronized copies of a database on multiple servers |
| **Shard** | A horizontal partition of a database (splitting data across servers) |
| **CDN** | Content Delivery Network — servers distributed globally to serve static assets fast |
| **SSR** | Server-Side Rendering — HTML generated on server, not client (Next.js feature) |
| **SSG** | Static Site Generation — HTML generated at build time |
| **CORS** | Cross-Origin Resource Sharing — browser security policy, configured in backend |
| **bcrypt** | Password hashing algorithm — slow by design to prevent brute-force attacks |
| **Rate Limiting** | Limiting how many requests a client can make in a time window |
| **Pagination** | Splitting large lists into pages to avoid sending too much data at once |
| **WebSocket** | Persistent two-way connection between browser and server for real-time data |
| **Pub/Sub** | Publish-Subscribe — pattern where publishers emit events, subscribers react |
| **Singleton** | Design pattern ensuring only one instance of something exists |
| **Factory** | Design pattern for creating objects without specifying the exact class |
| **Strategy** | Design pattern for swapping algorithms at runtime |
| **Observer** | Design pattern for notifying multiple objects when something changes |
| **SOLID** | Five OOP principles for writing maintainable code |
| **DI** | Dependency Injection — passing dependencies in rather than creating them inside |
| **Atomic Design** | UI component hierarchy: Atoms → Molecules → Organisms → Templates → Pages |
| **Polyglot Persistence** | Using multiple different databases in one application, each for different data types |
| **TailwindCSS** | Utility-first CSS framework — write styles as class names directly in HTML/JSX |
| **Indexing** | Database optimization: create a lookup structure on a column for faster queries |
| **Connection Pool** | A managed set of reusable database connections |
| **TTL** | Time To Live — how long a cache entry is valid before expiring |
| **Cache-Aside** | Caching pattern: check cache first, fetch DB on miss, store in cache |
| **Graceful Degradation** | System continues working (with reduced features) when a dependency fails |

---

## Learning Path Recommendation

**Week 1-2:** Run the current project, read every file, trace request flows
**Week 3-4:** Add one small feature (e.g., tags on bounties) end to end
**Week 5-6:** Add TypeScript, reorganize into classes/OOP
**Week 7-8:** Add MongoDB for file uploads, learn Mongoose
**Week 9-10:** Add Elasticsearch, replace current search
**Week 11-12:** Add WebSockets for real-time notifications
**Month 4:** Write tests (Jest for unit, Supertest for API)
**Month 5:** Deploy to Railway + Vercel, set up CI/CD with GitHub Actions
**Month 6:** Add real PostgreSQL streaming replication

**Resources:**
- **OOP & Design Patterns:** "Head First Design Patterns" (book), Refactoring.guru (website)
- **SQL:** "Learning SQL" by Alan Beaulieu (book), sqlzoo.net (practice)
- **PostgreSQL:** postgresql.org/docs (official docs are excellent)
- **MongoDB:** MongoDB University (free courses at university.mongodb.com)
- **Redis:** redis.io/docs (official docs)
- **Elasticsearch:** elastic.co/guide
- **React/Next.js:** react.dev (official), nextjs.org/learn (official tutorial)
- **TypeScript:** typescriptlang.org/docs (official)
- **System Design:** "Designing Data-Intensive Applications" by Martin Kleppmann (the best book on this topic)
