# NSCT Ready

A national platform where computing students in Pakistan prepare for the National Skills Competency Test (NSCT) 2027. Free for students, with an optional Pro plan for students whose university has no plan or sponsor.

Built with Next.js 14, TypeScript, PostgreSQL (Prisma), NextAuth and the Anthropic API for the AI tutor.

## Panels and roles

| Role | Sees | Home |
|---|---|---|
| STUDENT | Own preparation, results, certificates, community | /dashboard |
| FACULTY | Question bank (write, peer review, fix weak items), student doubts | /contribute |
| HOD | Own department: students, verification, reports, announcements | /university |
| CAMPUS_ADMIN | Own campus, same tools | /university |
| FOCAL, CHAIR | Whole university, same tools | /university |
| GOV | Live anonymised national dashboard and published reports | /gov |
| EMPLOYER | Opt-in talent pool, shortlist, messages, hiring tests, certificate checks | /employer |
| SPONSOR | Impact of their sponsorship, PDF impact report | /sponsor |
| ADMIN | Everything | /admin/analytics |

Staff scoping is enforced on the server (`profileScope` in `lib/auth.ts`). Staff roles must use two-factor sign-in.

## Features

**Sign-in and accounts**
- Google, email link, or phone number with SMS code. No CNIC: students are identified by roll number, unique within each university
- Two-factor (authenticator app) for all staff, with reset by the super admin
- Account lock after 5 wrong codes, rate limits on sign-in, OTP, AI and payments
- Status: pending, verified, active, blocked. Focal persons verify or ask the student to fix details. Changing roll number or university sends the account back to pending
- English and Urdu interface (right to left)

**Students**
- Diagnostic, full mock, subject mini mock, national mock in a scheduled window (one attempt), topic practice with a difficulty filter, mistakes notebook, bookmarks
- Question types: single answer, multi-select with partial credit, scenario-based, and coding (run against tests through Judge0)
- Auto-save every 15 seconds plus a local copy, so a dropped connection loses nothing. Extra time for students with a disability
- Results with percentile, subject radar, comparison with university and national averages, progress over time
- Certificates with a QR code and a public verification page
- Re-check requests on any question, wrong-question reports
- AI tutor, lessons with notes and video, discussion forum, support tickets, FAQ and help, surveys, notifications
- Pro plan through JazzCash, Easypaisa or card, discount codes, referrals (7 days free per paid referral), invoices

**Universities (HOD, campus admin, focal person, chair)**
- Verification queue, student records, extra time, activate or deactivate
- Bulk upload from Excel or a Moodle user export
- Breakdowns by campus, department, program and section, national rank and average
- Subject heatmap, weakest topics, students at risk and not started
- PDF and Excel reports, per-student PDF
- Announcements by in-app, email, SMS and WhatsApp

**Question bank**
- Submitted, peer review, expert review, live. Only the super admin makes a question live
- Exact and near-duplicate detection, version history, a secure pool for national mocks that contributors never see
- Item analysis: difficulty, discrimination, report flags. Import from Excel

**HEC and government**
- Live dashboard filtered by province, city, sector, program and gender, with a province heatmap and breakdowns by district, city, university and program
- Consenting students only, every group under the minimum size (default 20) withheld
- Published weekly snapshots and archive

**Super admin**
- Analytics (KPIs, 30 day trends, funnel, study hours, readiness, subjects, topics, all breakdowns, consent), drill down from national to student, live activity and server health
- Users and roles with hierarchy pickers, blocking, two-factor reset, Pro grants
- Universities, campuses, departments and programs
- Test blueprints (subject counts, difficulty mix, time, pass mark, negative marking) and national mock windows
- Business: university plans, sponsors and sponsorships, discount codes, payments, refunds, invoices, employers and API keys. Amounts in lakh and crore
- Support tickets and re-checks (uphold for one student or credit everyone), lessons, FAQ, surveys, events and awards
- Settings for branding, notifications, scoring, pricing and limits. Full audit log

## Exam integrity

- Questions picked and graded on the server. Answers never reach the browser before submit
- Options shuffled per student, server deadline with 30 seconds grace
- Full screen required, copy, paste and right-click blocked, student watermark on screen
- Signals recorded: tab switches, full-screen exits, very fast high scores, shared device, shared network, matching answer patterns. Flagged tests get no certificate and appear in Integrity review
- Webcam proctoring is not included, by decision

## Run it locally

Requirements: Node.js 20, Docker.

```bash
cp .env.example .env              # fill in the values
docker compose up -d db
npm install
npx prisma migrate dev --name init
npm run db:seed                   # universities with a main campus, starter questions, FAQ, a national mock window
npm run dev                       # http://localhost:3000
npx tsx scripts/set-role.ts you@example.com ADMIN
```

Checks: `npm run typecheck` and `npm test`.

## Scheduled jobs

Call these with `Authorization: Bearer $CRON_SECRET`:

| Job | Schedule | What it does |
|---|---|---|
| `POST /api/cron/notify` | every minute | Sends queued email, SMS and WhatsApp messages |
| `POST /api/cron/nightly` | 02:00 PKT | Countdown reminders, question discrimination recompute, weekly HEC snapshot on Mondays |

Use Cloud Scheduler, a cron container, or Vercel cron.

## Deploy (recommended: Google Cloud)

1. **App:** Cloud Run, minimum 2 instances, maximum 20, 2 vCPU and 2 GB each. Build with the included Dockerfile
2. **Database:** Cloud SQL PostgreSQL 16 with high availability, PgBouncer or the Cloud SQL connector for pooling, a read replica for dashboards
3. **Edge:** Cloudflare in front for DNS, TLS, caching of static files and DDoS protection
4. **Backups:** automated daily Cloud SQL backups kept 30 days, point-in-time recovery on, a monthly restore test
5. **Staging:** a second Cloud Run service and database, sandbox payment keys, deploy there first
6. **Secrets:** Secret Manager for everything in `.env.example`
7. **Code runner:** a self-hosted Judge0 on a separate VM with no outbound network
8. **Monitoring:** `/api/health` for uptime checks, Cloud Logging, alerts on 5xx and database CPU

Before each national mock: load test with k6 at 20,000 concurrent students, scale minimum instances up, watch Live activity.

## Before going live

- Test JazzCash and Easypaisa in sandbox with the merchant team. Field names follow the public guides
- Register the WhatsApp template and an SMS sender ID with PTA
- Legal review of the terms and privacy pages against PECA and Pakistan's data protection rules
- Load the question bank to at least 3,000 reviewed questions, with a separate secure pool for national mocks

## Branding

The platform is independent. Do not use HEC, PSEB, P@SHA or VU logos, and keep the "not affiliated" line in the footer.

## Project layout

```
app/(app)/        signed-in pages for every panel
app/api/          REST endpoints
app/verify/       public certificate verification
lib/              auth, tests, questions, payments, notify, integrity, certificates, reports, settings, i18n
prisma/           schema and seed
components/       UI kit, charts, question editor, navigation
scripts/          set-role
```
