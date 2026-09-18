# Social Sentinel

**Monitor • Analyze • Verify • Document • Report**

A web workspace for social media monitoring, SOCMINT, social network analysis, content analysis,
ToC/ToS policy matching, evidence and case management, and reporting.

It is a **decision-support and investigation tool, not an automated censorship system.** It never
deletes content, bans accounts, files mass reports, creates accounts, bypasses authentication or
rate limits, or acts on an account. Every automated result is an *indicator* with a confidence, a
reason and evidence, and stays **"needs human review"** until a person decides. Reports are filed
by a person through the platform's **official** reporting page.

```text
COLLECT → ANALYZE → CORRELATE → VERIFY → DOCUMENT → HUMAN REVIEW → REPORT → OFFICIAL PLATFORM MECHANISM
```

> **Data is mock / simulated by default** (fictional identities, `.example` domains). The UI says so
> everywhere. An official YouTube Data API provider is included but disabled unless configured.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Recharts · React Flow (`@xyflow/react`) ·
`jose` (sessions) · `bcryptjs` · `zod` · `pdf-lib` · `lucide-react` · Vitest

## Run locally

```bash
npm install
cp .env.example .env.local        # then set AUTH_SECRET
npm run dev                       # http://localhost:3000
```

Generate `AUTH_SECRET` (32+ characters):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | development / production build / run the build |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | 87 unit + integration tests (Vitest) |
| `npm run data:generate` | regenerate the deterministic mock dataset (`src/data/mock-*.json`) |

## Demo accounts (prototype only)

| Username | Email | Role |
| --- | --- | --- |
| `admin` | `admin@sentinel.example` | Administrator |
| `analyst` | `analyst@sentinel.example` | Analyst |
| `reviewer` | `reviewer@sentinel.example` | Reviewer |

Password for all three: `SentinelDemo#2026`, **for local development only** (`npm run dev`). It is stored only as
bcrypt hashes in `src/lib/auth/users.ts`.

**In production the demo accounts are disabled** unless you set both `DEMO_MODE=true` and
`DEMO_PASSWORD_HASH` (a bcrypt hash of a password *you* choose, which then replaces the built-in one for
every demo account). The documented password therefore never works against a deployment. Replace the user
store with a database before real use.

## What's in it

| Area | Routes | Notes |
| --- | --- | --- |
| Auth | `/login` | signed HttpOnly session cookie, remember me, RBAC (admin / analyst / reviewer) |
| Dashboard | `/dashboard` | 7 KPIs, 7 charts (each with a data-table view) |
| Monitoring | `/monitoring`, `/posts`, `/posts/[id]`, `/issues`, `/search` | keyword/hashtag/@user/URL search, filters, pagination |
| Accounts | `/accounts`, `/accounts/[id]` | authenticity signals ("Potentially Inauthentic", never "fake"), behaviour, network role |
| Analysis | `/analysis`, `/analysis/comments`, `/analysis/claims`, `/sentiment` | sentiment, hate/harassment/threat/spam/misinformation/defamation/impersonation indicators, claim workflow |
| SNA | `/sna` | interactive graph (zoom, pan, search, filters, selection), centrality, density, clusters. Neutral wording: "Highly Connected Account", "Potential Network Hub" |
| ToC / ToS | `/toc` | policy database + policy matching; **unverified entries are flagged** |
| Cases | `/cases`, `/cases/new`, `/cases/[id]` | workflow, notes, timeline, four-eyes verification |
| Evidence | `/evidence` | hashed (SHA-256) snapshots with integrity check |
| Reports | `/reports`, `/reports/[id]` | draft → review → approve → record submission; export PDF / CSV / JSON |
| Audit | `/audit` | append-only log (admin / reviewer) |
| Settings | `/settings` | profile, security, providers (presence only, never values), system info |

### API

All endpoints require a session, are rate limited, validate input (zod) and check `Origin` on writes.
Responses are `{ "data": … }` or `{ "error": "…" }`.

```text
GET  /api/posts  /api/posts/:id     GET  /api/accounts  /api/accounts/:id
GET  /api/comments                  GET  /api/issues       GET /api/toc
POST /api/analysis  /api/sentiment  /api/sna
GET  /api/cases   POST /api/cases   PATCH /api/cases/:id
GET  /api/evidence  POST /api/evidence
GET  /api/reports   POST /api/reports   GET /api/reports/:id/export?format=pdf|csv|json
GET  /api/audit
```

## Architecture

```text
UI (src/app, src/components)
  → services (src/lib/services)          business rules, permissions, audit
  → analysis engine (src/lib/analysis, risk, sna, toc)   pure, unit-tested functions
  → provider layer (src/lib/providers)   SocialMediaProvider interface
        MockProvider (default)  |  YouTube Data API v3 (official)  |  more later
```

* **Observed vs analysed data.** Providers return observed records only; sentiment, risk and
  indicators are computed by the engine and never stored on records (data governance).
* **Explainable risk.** `Content 40 + Behavior 25 + Network 20 + Coordination 15 = 100`, mapped to
  LOW 0–24 / MEDIUM 25–49 / HIGH 50–74 / CRITICAL 75–100. It is a prioritisation aid, not a decision.
* **Swappable analysis.** `analyzeSentiment`, `analyzeContent`, … can be replaced by an NLP API or a
  local model without touching the UI. The default `lexicon-v1` engine is keyword-based (English +
  Indonesian) and *will* miss sarcasm and context — hence mandatory human review.
* **Human review built in.** Only a reviewer other than the analyst can verify a case or approve a
  report; `REPORTED` is reachable only by recording a submission; nothing is submitted automatically.
* **ToC accuracy.** Rule names come from official pages (Meta Community Standards, YouTube Community
  Guidelines, Telegram ToS). X, TikTok and Reddit could not be retrieved automatically, so those
  entries are **placeholders marked "needs verification"** and matches show a warning. Reporting page
  URLs were checked on 2026-09-18 (X and Reddit block bots; confirm in a browser).
* **Auth.** `src/proxy.ts` does the fast optimistic redirect; the real check is `verifySession()` /
  `requireRole()` in every page, server action and API route (`src/lib/auth/dal.ts`, `src/lib/api/handler.ts`).

## Real data provider (Phase 8)

```env
DATA_PROVIDER=youtube
YOUTUBE_API_KEY=…
YOUTUBE_REGION=ID
```

Read-only, official YouTube Data API v3; the key is sent in a header, responses are cached 5 minutes
to save quota (`search.list` costs 100 of the default 10,000 daily units). If `youtube` is requested
without a key the app falls back to the clearly-labelled mock provider. **Not verified against the live
API in development** (no key was available): mapping and error handling are covered by tests using
recorded-shape fixtures. Review the YouTube API Services Terms before production use. One platform is
integrated at a time; others need official API access and permissions first.

## Deploy: GitHub → Vercel

```bash
git add .
git status                         # confirm .env.local is NOT listed
git commit -m "Initial Social Sentinel application"
git branch -M main
git remote add origin <GITHUB_REPOSITORY_URL>
git push -u origin main
```

In Vercel: **Add New → Project → Import** the repository, then set **Environment Variables**:

| Name | Value |
| --- | --- |
| `AUTH_SECRET` | 32+ random characters (required) |
| `DEMO_MODE` | `true` to allow the demo accounts (otherwise nobody can sign in) |
| `DEMO_PASSWORD_HASH` | bcrypt hash of a password you choose (**required** together with `DEMO_MODE`) |
| `DATA_PROVIDER`, `YOUTUBE_API_KEY` | optional, see above |

Then **Deploy**. Vercel does not give the app a static public IP. For a custom domain: add it in
Vercel → point DNS as instructed → SSL is issued automatically.

## Known limitations (read before production)

* **Storage is in memory.** Cases, evidence, reports and the audit log reset on restart and on a
  serverless cold start; on Vercel they will not persist reliably. Replace `src/lib/store` with
  PostgreSQL/Supabase behind the same service functions.
* **Users are hard-coded demo accounts.** Sessions are stateless JWTs and cannot be revoked
  server-side before they expire (logout only clears the cookie). No password reset / MFA.
* **Rate limiting is per server instance** (in memory), and the login form itself has no lockout.
* **No Content-Security-Policy** yet (Next.js needs nonces for a strict one). Other security headers are set.
* **Evidence screenshots** are reference text only; no file upload/storage yet.
* **Policy database is read-only**; editing (admin, audited as `UPDATE_POLICY`) needs the database.
* Assessments on `/analysis/claims` are read-only seed data; there is no assessment editor yet.
* The lexicon engine is deliberately simple. Expect false positives/negatives.

## Project layout

```text
src/
├── app/            (app)/ = authenticated pages · api/ = route handlers · login/
├── components/     layout, charts, network, tables, analysis, ui
├── data/           mock-*.json (fictional, generated by scripts/generate-mock-data.mjs)
├── lib/
│   ├── analysis/   sentiment, indicators, comments, coordination, account signals
│   ├── risk/       score → level, explainable risk model
│   ├── sna/        graph build, centrality, communities, layout
│   ├── toc/        policy matching, rules, official reporting pages
│   ├── workflow/   case/report state machine (four-eyes)
│   ├── providers/  interface, mock, youtube
│   ├── services/   analysis, cases, evidence, reports, audit, dashboard
│   ├── auth/ api/ store/ reports/ evidence/ validation/ utils/
├── proxy.ts        optimistic route protection
└── types/
```
