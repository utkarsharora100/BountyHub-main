# Test Account Credentials

> **Password for ALL accounts:** `pass123`

All 200 user accounts share the same password for ease of testing during development.

---

## Featured Test Accounts

These 10 accounts have simple, memorable emails for quick testing:

| # | Name | Email | University | Reputation |
|---|------|-------|------------|------------|
| 1 | Aarav Sharma | `aarav@iitd.ac.in` | IIT Delhi | 720 |
| 2 | Priya Patel | `priya@iitb.ac.in` | IIT Bombay | 650 |
| 3 | Rohan Gupta | `rohan@iitm.ac.in` | IIT Madras | 580 |
| 4 | Ananya Reddy | `ananya@iitk.ac.in` | IIT Kanpur | 510 |
| 5 | Arjun Singh | `arjun@iitkgp.ac.in` | IIT Kharagpur | 440 |
| 6 | Kavya Nair | `kavya@nitt.edu` | NIT Trichy | 390 |
| 7 | Siddharth Iyer | `sid@pilani.bits-pilani.ac.in` | BITS Pilani | 350 |
| 8 | Meera Joshi | `meera@iiit.ac.in` | IIIT Hyderabad | 300 |
| 9 | Dhruv Kulkarni | `dhruv@dtu.ac.in` | DTU Delhi | 250 |
| 10 | Sneha Banerjee | `sneha@jaduniv.edu.in` | Jadavpur University | 200 |

### Quick Login Examples

```
Email:    aarav@iitd.ac.in
Password: pass123

Email:    priya@iitb.ac.in
Password: pass123

Email:    rohan@iitm.ac.in
Password: pass123
```

---

## Seeded Data Summary

| Entity | Count | Notes |
|--------|-------|-------|
| Universities | 30 | All Indian (IITs, NITs, BITS, IIITs, etc.) |
| Users | 200 | ~6-7 per university, Indian names |
| Bounties | 500 | Across 6 categories, mix of statuses |
| Bids | ~1,500 | ~3 per bounty average |
| Comments | 1,000 | Discussion threads on bounties |
| Submissions | ~300 | With GitHub/Drive links |
| Reputation Logs | 500 | Point history per user |
| **Total Records** | **~4,030** | |

---

## University List

All 30 universities in the system:

| # | University | Email Domain |
|---|-----------|--------------|
| 1 | IIT Delhi | iitd.ac.in |
| 2 | IIT Bombay | iitb.ac.in |
| 3 | IIT Madras | iitm.ac.in |
| 4 | IIT Kanpur | iitk.ac.in |
| 5 | IIT Kharagpur | iitkgp.ac.in |
| 6 | IIT Roorkee | iitr.ac.in |
| 7 | IIT Guwahati | iitg.ac.in |
| 8 | IIT Hyderabad | iith.ac.in |
| 9 | IIT BHU Varanasi | iitbhu.ac.in |
| 10 | IIT Indore | iiti.ac.in |
| 11 | NIT Trichy | nitt.edu |
| 12 | NIT Warangal | nitw.ac.in |
| 13 | NIT Surathkal | nitk.edu.in |
| 14 | NIT Calicut | nitc.ac.in |
| 15 | NIT Rourkela | nitrkl.ac.in |
| 16 | BITS Pilani | pilani.bits-pilani.ac.in |
| 17 | BITS Goa | goa.bits-pilani.ac.in |
| 18 | BITS Hyderabad | hyderabad.bits-pilani.ac.in |
| 19 | IIIT Hyderabad | iiit.ac.in |
| 20 | IIIT Bangalore | iiitb.ac.in |
| 21 | IIIT Delhi | iiitd.ac.in |
| 22 | Delhi University | du.ac.in |
| 23 | Anna University | annauniv.edu |
| 24 | Jadavpur University | jaduniv.edu.in |
| 25 | VIT Vellore | vit.ac.in |
| 26 | SRM Chennai | srmist.edu.in |
| 27 | DTU Delhi | dtu.ac.in |
| 28 | NSUT Delhi | nsut.ac.in |
| 29 | Manipal Institute of Technology | manipal.edu |
| 30 | COEP Pune | coep.org.in |

---

## Bounty Categories

- **CODING** — Programming tasks (APIs, apps, bots, pipelines)
- **RESEARCH** — Literature reviews, surveys, experimental analysis
- **DESIGN** — UI/UX, dashboards, mobile designs, design systems
- **DEBUGGING** — Performance fixes, memory leaks, query optimization
- **DOCUMENTATION** — API docs, setup guides, tutorials
- **OTHER** — Project planning, code reviews, data analysis, mentorship

---

## Notes

- Password hashing uses bcrypt with cost factor 10
- All data is generated deterministically (seeded PRNG with seed 42) — re-running produces identical data
- Bounties span dates from Sep 2025 to Mar 2026, with deadlines through Aug 2026
- User reputation ranges from 0 to 800
- Bounty reward points range from 20 to 300
