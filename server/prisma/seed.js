// ─── Database Seed Script ────────────────────────────────────
// Generates sizable India-specific data for demo/testing purposes
// ~30 universities, ~200 users, ~500 bounties, ~1500 bids,
// ~1000 comments, ~300 submissions, ~500 reputation logs
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ─── Seeded PRNG (mulberry32) for reproducible data ─────────
function createRng(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = createRng(42);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const shuffle = (arr) => [...arr].sort(() => rand() - 0.5);
const pickN = (arr, n) => shuffle(arr).slice(0, Math.min(n, arr.length));
const randDate = (start, end) => {
  const s = start.getTime();
  return new Date(s + rand() * (end.getTime() - s));
};

// ─── Data pools ─────────────────────────────────────────────

const UNIVERSITIES = [
  { name: 'IIT Delhi', domain: 'iitd.ac.in' },
  { name: 'IIT Bombay', domain: 'iitb.ac.in' },
  { name: 'IIT Madras', domain: 'iitm.ac.in' },
  { name: 'IIT Kanpur', domain: 'iitk.ac.in' },
  { name: 'IIT Kharagpur', domain: 'iitkgp.ac.in' },
  { name: 'IIT Roorkee', domain: 'iitr.ac.in' },
  { name: 'IIT Guwahati', domain: 'iitg.ac.in' },
  { name: 'IIT Hyderabad', domain: 'iith.ac.in' },
  { name: 'IIT BHU Varanasi', domain: 'iitbhu.ac.in' },
  { name: 'IIT Indore', domain: 'iiti.ac.in' },
  { name: 'NIT Trichy', domain: 'nitt.edu' },
  { name: 'NIT Warangal', domain: 'nitw.ac.in' },
  { name: 'NIT Surathkal', domain: 'nitk.edu.in' },
  { name: 'NIT Calicut', domain: 'nitc.ac.in' },
  { name: 'NIT Rourkela', domain: 'nitrkl.ac.in' },
  { name: 'BITS Pilani', domain: 'pilani.bits-pilani.ac.in' },
  { name: 'BITS Goa', domain: 'goa.bits-pilani.ac.in' },
  { name: 'BITS Hyderabad', domain: 'hyderabad.bits-pilani.ac.in' },
  { name: 'IIIT Hyderabad', domain: 'iiit.ac.in' },
  { name: 'IIIT Bangalore', domain: 'iiitb.ac.in' },
  { name: 'IIIT Delhi', domain: 'iiitd.ac.in' },
  { name: 'Delhi University', domain: 'du.ac.in' },
  { name: 'Anna University', domain: 'annauniv.edu' },
  { name: 'Jadavpur University', domain: 'jaduniv.edu.in' },
  { name: 'VIT Vellore', domain: 'vit.ac.in' },
  { name: 'SRM Chennai', domain: 'srmist.edu.in' },
  { name: 'DTU Delhi', domain: 'dtu.ac.in' },
  { name: 'NSUT Delhi', domain: 'nsut.ac.in' },
  { name: 'Manipal Institute of Technology', domain: 'manipal.edu' },
  { name: 'COEP Pune', domain: 'coep.org.in' },
];

const FIRST_MALE = [
  'Aarav','Vivaan','Aditya','Vihaan','Arjun','Sai','Reyansh','Ayaan','Krishna',
  'Ishaan','Rohan','Aryan','Arnav','Kabir','Shaurya','Atharv','Dhruv','Yash',
  'Tanmay','Ojas','Pranav','Harsh','Dev','Siddharth','Ravi','Ankit','Gaurav',
  'Varun','Nikhil','Akash','Rahul','Prateek','Karan','Aman','Nishant','Abhishek',
  'Kunal','Sahil','Manish','Ajay','Vikram','Arun','Deepak','Rajat','Mohit',
  'Suraj','Vishal','Ankur','Chirag','Tushar','Piyush','Himanshu','Sachin','Vinay',
  'Naveen','Kartik','Lakshay','Parth','Ritesh','Tarun',
];

const FIRST_FEMALE = [
  'Ananya','Aanya','Aadhya','Saanvi','Myra','Pari','Anika','Sara','Isha','Diya',
  'Priya','Riya','Kavya','Meera','Neha','Pooja','Shruti','Anjali','Sneha','Tanvi',
  'Divya','Nisha','Swati','Pallavi','Kriti','Aditi','Tanya','Simran','Bhavya',
  'Ritika','Trisha','Sanya','Ira','Nandini','Sakshi','Megha','Radhika','Shreya',
  'Aparna','Gargi','Lavanya','Mahima','Nikita','Shalini','Vanshika','Jhanvi',
  'Khushi','Manya','Navya','Vedika',
];

const LAST_NAMES = [
  'Sharma','Verma','Gupta','Singh','Patel','Kumar','Reddy','Nair','Iyer','Joshi',
  'Deshmukh','Chatterjee','Banerjee','Mukherjee','Bose','Das','Srinivasan',
  'Venkatesh','Pillai','Menon','Kulkarni','Patil','Shah','Mehta','Agarwal',
  'Tiwari','Mishra','Pandey','Yadav','Chauhan','Malhotra','Kapoor','Rao','Hegde',
  'Kamath','Saxena','Dubey','Thakur','Bhatt','Goswami','Rajan','Subramaniam',
  'Prasad','Choudhury','Deshpande',
];

const CATEGORIES = ['CODING', 'RESEARCH', 'DESIGN', 'DEBUGGING', 'DOCUMENTATION', 'OTHER'];
const STATUSES = ['OPEN', 'OPEN', 'OPEN', 'OPEN', 'IN_PROGRESS', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

// ── Bounty title + description templates ────────────────────
const BOUNTY_TEMPLATES = {
  CODING: [
    { t: 'Build a REST API for {topic}', d: 'Implement a complete REST API with CRUD endpoints, authentication, input validation, and proper error handling. Must include Swagger/OpenAPI documentation and Postman collection. Tech stack: Node.js + Express + PostgreSQL.' },
    { t: 'Develop a {topic} using React', d: 'Build a responsive, production-ready React application with proper state management, routing, and component architecture. Must work on mobile and desktop. Include unit tests for core components.' },
    { t: 'Implement {topic} in Python', d: 'Write a well-structured Python implementation with clean code, type hints, proper error handling, and comprehensive test coverage using pytest. Include a README with usage examples.' },
    { t: 'Create a CLI tool for {topic}', d: 'Build a command-line tool with intuitive argument parsing, colored output, progress bars, and proper exit codes. Should be installable via npm/pip and include a man page or --help documentation.' },
    { t: 'Build a real-time {topic} with WebSockets', d: 'Implement a real-time feature using Socket.io or native WebSockets. Must handle connection drops gracefully, support reconnection, and persist state to the database. Include both client and server code.' },
    { t: 'Develop a microservice for {topic}', d: 'Design and implement a standalone microservice with its own database, health checks, graceful shutdown, structured logging, and Docker containerization. Must expose a clean API contract.' },
    { t: 'Build a GraphQL API for {topic}', d: 'Implement a GraphQL server with queries, mutations, subscriptions, proper authentication middleware, pagination, and N+1 query prevention using DataLoader.' },
    { t: 'Create a Telegram bot for {topic}', d: 'Build a Telegram bot using the Bot API with inline keyboards, conversation handlers, persistent user state, and webhook-based deployment. Must handle rate limits gracefully.' },
    { t: 'Implement {topic} data pipeline', d: 'Build an ETL pipeline to extract, transform, and load data from multiple sources. Must handle failures gracefully with retry logic, produce logs, and store results in PostgreSQL. Schedule with cron or Airflow.' },
    { t: 'Develop a Flutter app for {topic}', d: 'Build a cross-platform mobile app using Flutter/Dart. Requirements include clean architecture (BLoC pattern), offline support, push notifications, and responsive UI for different screen sizes.' },
  ],
  RESEARCH: [
    { t: 'Literature review on {topic}', d: 'Conduct a systematic literature review covering the last 5 years of research. Need a minimum 10-page report with comparison tables, methodology analysis, gap identification, and annotated bibliography of 30+ papers.' },
    { t: 'Survey paper: {topic}', d: 'Write a comprehensive survey paper comparing existing approaches, their strengths, weaknesses, and open challenges. Must include taxonomy diagram, comparison table with quantitative metrics, and future research directions.' },
    { t: 'Research summary: {topic}', d: 'Summarize and critically analyze 10 recent top-tier papers (ICML, NeurIPS, CVPR, ACL). Need 500-word summaries per paper with interconnections highlighted and a 2-page executive summary.' },
    { t: 'Experimental analysis of {topic}', d: 'Reproduce key experiments from the referenced paper, run additional ablation studies, and present results with statistical significance tests. Provide all code, notebooks, and raw data.' },
    { t: 'Comparative study: {topic}', d: 'Compare 4-5 existing approaches/tools for the given problem on standard benchmarks. Provide fair evaluation methodology, quantitative results, computational cost analysis, and clear recommendations.' },
  ],
  DESIGN: [
    { t: 'Design a {topic} dashboard UI', d: 'Create a complete Figma design for a dashboard including: sidebar navigation, analytics charts, data tables, filters, notifications panel, and settings page. Provide both dark and light mode variants with a consistent design system.' },
    { t: 'UI/UX redesign for {topic}', d: 'Redesign an existing interface with modern UI principles. Deliverables: user flow diagrams, wireframes, and pixel-perfect high-fidelity mockups in Figma. Must include responsive variants for mobile, tablet, and desktop.' },
    { t: 'Mobile app design: {topic}', d: 'Design a native-feeling mobile app with proper iOS/Android design guidelines. Include onboarding flow, main navigation, key feature screens, empty states, error states, and a clickable prototype.' },
    { t: 'Design system for {topic}', d: 'Create a comprehensive design system in Figma with color palette, typography scale, spacing system, icon set, component library (buttons, inputs, cards, modals, tables), and usage documentation.' },
    { t: 'Landing page design for {topic}', d: 'Design a high-converting landing page with hero section, feature highlights, testimonials, pricing table, CTA sections, and footer. Provide desktop and mobile variants with interactive micro-animations spec.' },
  ],
  DEBUGGING: [
    { t: 'Fix performance issues in {topic}', d: 'Profile and fix performance bottlenecks. Current symptoms: slow page loads (>5s), high memory usage, and occasional timeouts. Need root cause analysis, fix implementation, and before/after benchmarks with profiling evidence.' },
    { t: 'Debug memory leak in {topic}', d: 'Identify and fix a memory leak causing the application to crash after extended use. Need heap dump analysis, identification of the leaking objects/closures, fix, and memory usage monitoring setup.' },
    { t: 'Fix database query performance for {topic}', d: 'Optimize slow SQL queries (currently >2s response time). Need EXPLAIN ANALYZE output, missing index identification, query rewrites, and connection pooling review. Target: <100ms p95 latency.' },
    { t: 'Debug authentication issues in {topic}', d: 'Fix broken auth flow: intermittent login failures, token refresh race conditions, and session management bugs. Need root cause analysis, comprehensive fix, and end-to-end auth flow tests.' },
    { t: 'Fix deployment pipeline for {topic}', d: 'Debug and fix CI/CD pipeline failures. Currently: flaky tests, Docker build cache issues, and intermittent deployment timeouts. Need investigation, fixes, and pipeline optimization.' },
  ],
  DOCUMENTATION: [
    { t: 'Write API docs for {topic}', d: 'Write comprehensive API documentation using OpenAPI 3.0 spec. Cover all endpoints with request/response schemas, authentication details, error codes, rate limits, and real-world usage examples with curl commands.' },
    { t: 'Create setup guide for {topic}', d: 'Write a detailed setup and deployment guide covering: prerequisites, environment setup, configuration, database migrations, Docker deployment, troubleshooting common issues, and production checklist.' },
    { t: 'Write technical docs for {topic}', d: 'Document the system architecture, data flow, key design decisions, component interactions, and operational runbooks. Include architecture diagrams (C4 model), sequence diagrams, and ADR (Architecture Decision Records).' },
    { t: 'Create tutorial series for {topic}', d: 'Write a 5-part beginner-friendly tutorial series with progressive complexity. Each part should include learning objectives, code examples, exercises, and a mini-project. Target audience: 2nd year CS students.' },
    { t: 'Write user guide for {topic}', d: 'Create end-user documentation with getting started guide, feature walkthroughs with screenshots, FAQ section, keyboard shortcuts, and common workflow recipes. Must be accessible to non-technical users.' },
  ],
  OTHER: [
    { t: 'Help with {topic} project planning', d: 'Need help creating a project plan with milestones, task breakdown, risk assessment, resource estimation, and timeline. Use Agile methodology with 2-week sprints. Deliverable: Notion/Jira board setup + documentation.' },
    { t: 'Code review for {topic}', d: 'Perform a thorough code review of a medium-sized codebase (~5000 lines). Check for: security vulnerabilities, performance issues, code quality, adherence to best practices, test coverage gaps, and provide actionable improvement suggestions.' },
    { t: 'Data analysis for {topic}', d: 'Analyze a dataset (~50k rows) and produce insights. Need: data cleaning, exploratory analysis with visualizations, statistical tests, and a summary report with actionable recommendations. Use Python/Pandas/Matplotlib.' },
    { t: 'Mentorship session on {topic}', d: 'Looking for 3 one-hour mentorship/tutoring sessions covering fundamentals, hands-on practice, and real-world applications. Must provide session notes, practice problems, and additional learning resources.' },
    { t: 'Translate documentation for {topic}', d: 'Translate technical documentation from English to Hindi while maintaining technical accuracy. Approximately 20 pages of developer documentation. Must understand the technical context, not just do literal translation.' },
  ],
};

const TOPICS = [
  'student attendance system','hostel management portal','online exam platform','college event management',
  'campus food delivery app','library management system','placement portal','alumni network platform',
  'lab equipment booking','course feedback system','faculty review platform','project collaboration tool',
  'research paper repository','hackathon management','campus navigation app','student marketplace',
  'study group finder','internship tracker','scholarship management','campus safety alert system',
  'timetable scheduler','assignment submission portal','peer tutoring platform','club management system',
  'student budget tracker','notes sharing platform','campus job board','mental health support app',
  'sports team management','lost and found portal','carpool coordination app','campus announcement system',
  'automated grading system','virtual lab platform','student ID card system','fee payment gateway',
  'hostel complaint system','department newsletter','student election platform','campus Wi-Fi analytics',
  'canteen menu and ordering','semester GPA calculator','workshop registration system','alumni mentorship app',
  'research grant tracker','campus sustainability dashboard','student wellness tracker','course recommendation engine',
  'inter-college competition portal','campus parking management',
];

const BID_MESSAGES = [
  'I have relevant experience in this area and can start right away. Let me know if you need samples of my previous work.',
  'This looks like an interesting challenge. I have worked on similar projects at my college. Can deliver within the deadline.',
  'I can help with this. My coursework and personal projects align well with the requirements. Happy to discuss approach first.',
  'Experienced with the tech stack mentioned. I have completed 3 similar bounties on this platform with good reviews.',
  'This is right in my area of expertise. I can provide a detailed plan of action within 24 hours of acceptance.',
  'I would love to work on this. Currently between semesters so I have dedicated time. Portfolio link in my profile.',
  'Have built something very similar for my final year project. Can adapt and deliver quickly. Let us connect to discuss.',
  'Strong background in this domain from internship experience at a startup. Can bring industry-level quality to this.',
  'I am a research assistant working in this exact area. Can bring academic rigor plus practical implementation skills.',
  'Interested! I have the right skills and availability. Can we schedule a quick call to align on expectations?',
  'My team and I can handle this efficiently. We have complementary skills that would make this a solid deliverable.',
  'I can propose an iterative approach with weekly check-ins. First deliverable within 3 days to validate direction.',
  'Placed in the top 10 at SIH for a similar project. Can leverage that experience here. Keen to discuss further.',
  'Final year student with strong fundamentals in this area. Looking to build my portfolio with quality work like this.',
  'I have contributed to open-source projects in this domain. Can bring well-tested, production-quality code.',
];

const COMMENT_MESSAGES = [
  'What is the expected tech stack for this? Any preferences on frameworks or libraries?',
  'Is there a specific deadline extension possible if we encounter blockers midway?',
  'I started working on something similar last month. Happy to share insights from my experience.',
  'Can you share more details about the expected output format and any evaluation criteria?',
  'Would it be okay to use TypeScript instead of JavaScript for better type safety?',
  'This is a great bounty. The requirements are well defined. Whoever takes this will enjoy it.',
  'Suggestion: consider using Redis for caching if performance is a key requirement.',
  'I think the reward points should be higher given the complexity of this task.',
  'Has anyone started working on this yet? Would be interested in collaborating.',
  'For the database part, I would recommend using Prisma ORM. It works great with PostgreSQL.',
  'Can the scope be split into smaller milestones? That would make it easier to track progress.',
  'The deadline might be tight for the full scope. Would you consider prioritizing features?',
  'I did something similar for my DBMS course project. Normalization was the trickiest part.',
  'Pro tip: use Docker from the start to avoid environment setup issues later.',
  'Would you accept a solution that uses a different approach but achieves the same goal?',
  'Just a heads up — the API you mentioned has rate limits. Need to account for that in the design.',
  'Great problem statement. This could be extended into a full SaaS product honestly.',
  'Is testing (unit + integration) part of the deliverable or just the core implementation?',
  'For the ML part, I suggest starting with a baseline model before trying complex architectures.',
  'This is very relevant to what we are learning in our Advanced DBMS course right now.',
];

const SUBMISSION_LINKS = [
  'https://github.com/{user}/bounty-solution-{id}',
  'https://drive.google.com/drive/folders/bounty-submission-{id}',
  'https://codesandbox.io/s/bounty-{id}-solution',
  'https://replit.com/@{user}/bounty-{id}',
  'https://gitlab.com/{user}/submission-{id}',
];

const SUBMISSION_DESCS = [
  'Completed all requirements. Includes README with setup instructions and demo video link.',
  'Implemented the core features plus a few bonus enhancements. All tests passing.',
  'Solution with clean architecture and comprehensive error handling. See README for details.',
  'Finished implementation with full test coverage. Happy to make revisions if needed.',
  'Submitted working solution. Used Docker for easy setup. Documentation included.',
  'All requirements met. Added CI/CD pipeline as a bonus. See the repo for live demo link.',
  'Completed with proper documentation and example data. Ready for review.',
  'Implementation follows best practices from our coursework. Tested on multiple scenarios.',
];

const REP_REASONS = [
  'Completed bounty: {title}',
  'High-quality submission for: {title}',
  'Helpful comments and mentoring',
  'Bug report accepted',
  'Community contribution bonus',
  'Excellent code review feedback',
  'On-time delivery with bonus features',
  'Top-rated submission this week',
];

// ─── Main seed function ─────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database with India-specific data...\n');

  // ── Clean slate ───────────────────────────────────────────
  console.log('  🗑  Clearing existing data...');
  try {
    // Dynamically fetch all tables and truncate them to avoid naming mismatch errors
    const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
    const tableNames = tables.map(t => `"${t.tablename}"`).filter(name => name !== '"_prisma_migrations"');
    
    if (tableNames.length > 0) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames.join(', ')} RESTART IDENTITY CASCADE;`);
    }
  } catch {
    // Tables may not exist on first run — db push will create them
    console.log('  ℹ  No existing tables to clear (first run)');
  }

  // ── 1. Universities (30) ──────────────────────────────────
  await prisma.university.createMany({
    data: UNIVERSITIES.map((u) => ({ name: u.name, country: 'India' })),
    skipDuplicates: true,
  });
  const universities = await prisma.university.findMany({ orderBy: { id: 'asc' } });
  console.log(`  ✓ ${universities.length} universities`);

  // ── 2. Users (200) ────────────────────────────────────────
  // 10 featured test accounts with easy-to-remember emails, then 190 generated
  const passwordHash = await bcrypt.hash('pass123', 10);

  const FEATURED_USERS = [
    { name: 'Aarav Sharma', email: 'aarav@iitd.ac.in', uniIdx: 0, reputation: 720, role: 'STAFF' },
    { name: 'Priya Patel', email: 'priya@iitb.ac.in', uniIdx: 1, reputation: 650, role: 'STAFF' },
    { name: 'Rohan Gupta', email: 'rohan@iitm.ac.in', uniIdx: 2, reputation: 580, role: 'STAFF' },
    { name: 'Ananya Reddy', email: 'ananya@iitk.ac.in', uniIdx: 3, reputation: 510, role: 'STUDENT' },
    { name: 'Arjun Singh', email: 'arjun@iitkgp.ac.in', uniIdx: 4, reputation: 440, role: 'STUDENT' },
    { name: 'Kavya Nair', email: 'kavya@nitt.edu', uniIdx: 10, reputation: 390, role: 'STAFF' },
    { name: 'Siddharth Iyer', email: 'sid@pilani.bits-pilani.ac.in', uniIdx: 15, reputation: 350, role: 'STUDENT' },
    { name: 'Meera Joshi', email: 'meera@iiit.ac.in', uniIdx: 18, reputation: 300, role: 'STAFF' },
    { name: 'Dhruv Kulkarni', email: 'dhruv@dtu.ac.in', uniIdx: 26, reputation: 250, role: 'STUDENT' },
    { name: 'Sneha Banerjee', email: 'sneha@jaduniv.edu.in', uniIdx: 23, reputation: 200, role: 'STUDENT' },
  ];

  const emailSet = new Set(FEATURED_USERS.map((u) => u.email));
  const usersData = FEATURED_USERS.map((u) => ({
    name: u.name,
    email: u.email,
    passwordHash,
    universityId: universities[u.uniIdx].id,
    reputation: u.reputation,
    role: u.role,
  }));

  for (let i = 0; i < 190; i++) {
    const isMale = rand() < 0.55;
    const first = isMale ? pick(FIRST_MALE) : pick(FIRST_FEMALE);
    const last = pick(LAST_NAMES);
    const uniOffset = (i + FEATURED_USERS.length) % universities.length;
    const uni = universities[uniOffset];
    const domain = UNIVERSITIES[uniOffset].domain;

    // Ensure unique email
    let email;
    let suffix = '';
    let attempts = 0;
    do {
      email = `${first.toLowerCase()}${suffix}.${last.toLowerCase()}@${domain}`;
      suffix = attempts > 0 ? String(attempts) : '';
      attempts++;
    } while (emailSet.has(email));
    emailSet.add(email);

    usersData.push({
      name: `${first} ${last}`,
      email,
      passwordHash,
      universityId: uni.id,
      reputation: randInt(0, 800),
      role: rand() > 0.8 ? 'STAFF' : 'STUDENT',
    });
  }

  await prisma.user.createMany({ data: usersData, skipDuplicates: true });
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
  console.log(`  ✓ ${users.length} users (password: pass123)`);
  const staffUsers = users.filter((u) => u.role === 'STAFF');

  // ── 3. Bounties (500) ─────────────────────────────────────
  const bountiesData = [];
  for (let i = 0; i < 500; i++) {
    const cat = pick(CATEGORIES);
    const template = pick(BOUNTY_TEMPLATES[cat]);
    const topic = pick(TOPICS);
    const creator = pick(staffUsers);
    const status = pick(STATUSES);
    const hasDeadline = rand() > 0.15;

    bountiesData.push({
      title: template.t.replace('{topic}', topic),
      description: template.d,
      rewardPoints: randInt(20, 300),
      category: cat,
      status,
      createdBy: creator.id,
      deadline: hasDeadline
        ? randDate(new Date('2026-03-10'), new Date('2026-08-30'))
        : null,
      createdAt: randDate(new Date('2025-09-01'), new Date('2026-03-04')),
    });
  }

  await prisma.bounty.createMany({ data: bountiesData, skipDuplicates: true });
  const bounties = await prisma.bounty.findMany({ orderBy: { id: 'asc' } });
  console.log(`  ✓ ${bounties.length} bounties`);

  // ── 4. Bids (~1500) ──────────────────────────────────────
  const bidSet = new Set();
  const bidsData = [];
  let bidAttempts = 0;

  while (bidsData.length < 1500 && bidAttempts < 5000) {
    bidAttempts++;
    const bounty = pick(bounties);
    const bidder = pick(users);
    if (bidder.id === bounty.createdBy) continue; // can't bid on own bounty
    const key = `${bounty.id}-${bidder.id}`;
    if (bidSet.has(key)) continue; // unique constraint
    bidSet.add(key);

    bidsData.push({
      bountyId: bounty.id,
      bidderId: bidder.id,
      message: pick(BID_MESSAGES),
      status: pick(['PENDING', 'PENDING', 'PENDING', 'ACCEPTED', 'REJECTED']),
    });
  }

  await prisma.bid.createMany({ data: bidsData, skipDuplicates: true });
  console.log(`  ✓ ${bidsData.length} bids`);

  // ── 5. Comments (~1000) ───────────────────────────────────
  const commentsData = [];
  for (let i = 0; i < 1000; i++) {
    commentsData.push({
      bountyId: pick(bounties).id,
      userId: pick(users).id,
      content: pick(COMMENT_MESSAGES),
      createdAt: randDate(new Date('2025-09-05'), new Date('2026-03-04')),
    });
  }

  await prisma.comment.createMany({ data: commentsData, skipDuplicates: true });
  console.log(`  ✓ ${commentsData.length} comments`);

  // ── 6. Submissions (~300) ─────────────────────────────────
  const submissionsData = [];
  const submissionSet = new Set();

  for (let i = 0; i < 300; i++) {
    const bounty = pick(bounties);
    const submitter = pick(users);
    if (submitter.id === bounty.createdBy) continue;

      // Fix: Actually use the submissionSet to prevent unique constraint crashes
      const key = `${bounty.id}-${submitter.id}`;
      if (submissionSet.has(key)) continue;
      submissionSet.add(key);

    const linkTemplate = pick(SUBMISSION_LINKS);
    submissionsData.push({
      bountyId: bounty.id,
      submittedBy: submitter.id,
      submissionLink: linkTemplate
        .replace('{user}', submitter.email.split('@')[0])
        .replace('{id}', String(bounty.id)),
      description: pick(SUBMISSION_DESCS),
      status: pick(['PENDING', 'PENDING', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED']),
      createdAt: randDate(new Date('2025-10-01'), new Date('2026-03-04')),
    });
  }

  await prisma.submission.createMany({ data: submissionsData, skipDuplicates: true });
  console.log(`  ✓ ${submissionsData.length} submissions`);

  // ── 7. Reputation Logs (~500) ─────────────────────────────
  const repData = [];
  for (let i = 0; i < 500; i++) {
    const user = pick(users);
    const bounty = pick(bounties);
    const reasonTpl = pick(REP_REASONS);
    repData.push({
      userId: user.id,
      points: randInt(10, 200),
      reason: reasonTpl.replace('{title}', bounty.title.substring(0, 80)),
      createdAt: randDate(new Date('2025-09-01'), new Date('2026-03-04')),
    });
  }

  await prisma.reputationLog.createMany({ data: repData, skipDuplicates: true });
  console.log(`  ✓ ${repData.length} reputation logs`);

  // ── Summary ───────────────────────────────────────────────
  const counts = {
    universities: await prisma.university.count(),
    users: await prisma.user.count(),
    bounties: await prisma.bounty.count(),
    bids: await prisma.bid.count(),
    comments: await prisma.comment.count(),
    submissions: await prisma.submission.count(),
    reputationLogs: await prisma.reputationLog.count(),
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  console.log(`\n✅ Seeding complete! Total records: ${total}`);
  console.log('   Breakdown:', JSON.stringify(counts, null, 2));
  console.log('\n   Login: any user email + password "pass123"');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
