# Interview Coach — Architecture

> AI co-pilot for **live** interviews. It listens to the interviewer over your call
> (Zoom / Teams / Meet), transcribes the question in real time, and streams a
> resume‑tailored answer back to you before you need to speak.

The repository currently hosts **two apps in one Express server**:

- **Interview Coach** — the active product (everything under `/interview`, `/api/interview*`, `/api/profiles`, `/api/stripe`).
- **Quizmaster (legacy)** — an older quiz/challenge app (`/api/quiz`, `/api/challenge`, `/api/auth`, the `users` + `challenges` tables) sharing the same server. Slated for review/removal.

---

## 1. High-level diagram

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT (Browser / PWA)                            │
│                                                                                  │
│   Static frontend — server/public/  (vanilla HTML/CSS/JS, no framework)          │
│   ┌──────────────┬──────────────┬───────────────┬──────────────┬─────────────┐  │
│   │ index.html   │ interview/   │ profiles.html │ login /      │ pricing /   │  │
│   │ (marketing)  │ index.html   │ (resume + JD  │ register /   │ about /     │  │
│   │              │ ★ THE APP    │  profiles)    │ forgot/reset │ admin /...  │  │
│   └──────────────┴──────┬───────┴───────────────┴──────────────┴─────────────┘  │
│   auth.js (JWT helper) · sw.js (service worker) · manifest.json (PWA) · styles   │
│                         │                                                        │
│   Browser APIs used by the live session:                                         │
│   • getUserMedia / getDisplayMedia  → capture interviewer audio (BlackHole/tab)  │
│   • MediaRecorder (4s chunks)       → POST audio → Whisper                       │
│   • Web Speech API                  → "You" panel (your own voice, parallel)     │
│   • fetch + SSE stream              → AI answer streamed token-by-token          │
│   • SpeechSynthesis                 → "Read Aloud"                               │
│   • localStorage                    → capture mode, answer style, font size      │
└──────────────────────────────────┬─────────────────────────────────────────────┘
                                    │ HTTPS  (Cache-Control: no-store on HTML)
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                     VERCEL  (project: interview-coach)                            │
│                                                                                  │
│   vercel.json:  /api/* → Express serverless fn   ·   /* → static files           │
│                                                                                  │
│   ┌──────────────────────  Express app (src/index.ts)  ──────────────────────┐  │
│   │  Middleware: helmet (CSP) · cors · compression · express.json · rate-limit │ │
│   │             · Sentry error handler · static file server                    │ │
│   │                                                                            │ │
│   │  ── API ROUTES ──────────────────────────────────────────────────────────│ │
│   │  /api/interview        ★ parse-resume · transcribe · detect-question ·     │ │
│   │                          answer-stream (SSE)                               │ │
│   │  /api/interview-auth     register · login · session · quota ·              │ │
│   │                          question-used · forgot/reset-password             │ │
│   │  /api/profiles           CRUD resume + JD + supporting-docs profiles       │ │
│   │  /api/stripe             create-checkout · portal · webhook (Pro upgrade)  │ │
│   │  /api/admin              users · stats · feedback · beta · reset-password   │ │
│   │  /api/auth, /api/quiz,    ← legacy "quizmaster" app (separate user base)    │ │
│   │  /api/challenge                                                            │ │
│   └────────────┬───────────────────────────┬──────────────────┬───────────────┘ │
└────────────────┼───────────────────────────┼──────────────────┼─────────────────┘
                 │                            │                  │
        ┌────────▼────────┐        ┌──────────▼─────────┐   ┌────▼──────────────┐
        │  ANTHROPIC API  │        │  GROQ (or OpenAI)  │   │  PostgreSQL       │
        │  Claude         │        │  Whisper STT       │   │  (Neon/Supabase   │
        │  • Sonnet       │        │  large-v3-turbo    │   │   via DATABASE_URL)│
        │    (full answer)│        │  ~300ms, temp 0    │   │                   │
        │  • Haiku        │        └────────────────────┘   │  Tables:          │
        │   (1-liner/cue, │        ┌────────────────────┐   │  • interview_users│
        │    detect-q)    │        │  STRIPE            │   │  • interview_     │
        │  SSE streaming, │        │  checkout/webhook/ │   │    profiles       │
        │  prompt caching │        │  billing portal    │   │  • ..questions_   │
        └─────────────────┘        └────────────────────┘   │    used (quota)   │
        ┌─────────────────┐        ┌────────────────────┐   │  • ..reset_tokens │
        │  RESEND (email)  │        │  SENTRY (errors)   │   │  • interview_     │
        │  password reset  │        └────────────────────┘   │    feedback       │
        └─────────────────┘                                  │  • users (legacy) │
                                                             │  • challenges     │
                                                             └───────────────────┘
```

---

## 2. Tech stack

| Layer        | Technology |
|--------------|-----------|
| Frontend     | Vanilla HTML/CSS/JS (no framework), PWA (service worker + manifest) |
| Backend      | Node.js 22 · Express (TypeScript) |
| Hosting      | Vercel — Express bundled as a serverless function (`@vercel/node`); `public/**` served static (`@vercel/static`) |
| Database     | PostgreSQL via `pg` (`DATABASE_URL`; works with Neon / Supabase / Railway) |
| LLM          | Anthropic Claude (`@anthropic-ai/sdk`) — Sonnet for full answers, Haiku for aids + question detection |
| Speech-to-text | Groq Whisper `large-v3-turbo` (preferred, free/fast) → OpenAI Whisper fallback (`openai` SDK) |
| Payments     | Stripe (checkout, billing portal, webhooks) |
| Email        | Resend (password reset) |
| Monitoring   | Sentry |
| Security     | helmet (CSP), CORS allowlist, `express-rate-limit`, JWT auth |
| Resume parse | `pdf-parse` (PDF), `mammoth` (DOCX) |

---

## 3. Repository layout

```
server/
├── src/
│   ├── index.ts                # Express app: middleware, routes, static serving, env checklist
│   ├── routes/
│   │   ├── interview.ts        # ★ parse-resume, transcribe, detect-question, answer-stream (SSE)
│   │   ├── interviewAuth.ts    #   register/login/session/quota/question-used/password-reset (JWT)
│   │   ├── profiles.ts         #   resume + JD + supporting-docs profile CRUD
│   │   ├── stripe.ts           #   checkout / portal / webhook → Pro plan
│   │   ├── admin.ts            #   users, stats, feedback, beta flags
│   │   ├── auth.ts             #   legacy quizmaster auth
│   │   ├── quiz.ts             #   legacy quiz generation + tutor
│   │   └── challenge.ts        #   legacy multiplayer challenges
│   └── services/
│       ├── claudeService.ts    # Anthropic client singleton + API-key loading
│       ├── database.ts         # pg Pool + table bootstrap
│       └── fileStore.ts        # filesystem helpers
├── public/
│   ├── interview/index.html    # ★ THE live-session app (setup + session UI + all client JS)
│   ├── index.html              # marketing home page
│   ├── profiles.html           # profile manager
│   ├── login/register/...html  # auth + legal + support pages
│   ├── auth.js                 # client JWT helper (token, headers, nav, quota)
│   ├── sw.js                   # service worker (HTML network-only, assets cache-first)
│   ├── manifest.json           # PWA manifest
│   └── styles.css
├── vercel.json                 # routes + no-cache headers for HTML/SW
└── package.json                # scripts: dev (ts-node), build (tsc), start
```

---

## 4. The core flow — one live answer

```
Interviewer speaks (Zoom/Teams/Meet)
   │  audio via BlackHole (system) / browser-tab share / mic
   ▼
MediaRecorder cuts a 4-second chunk ──► POST /api/interview/transcribe
   │                                          │ Groq Whisper (temp 0, interview-primed prompt)
   │  ◄───────────────────────────────────────┘ returns text
   ▼
sysAcc accumulates → 🎤 Interviewer panel + "Question to answer" box
   │   (energy-gated to skip silent chunks; de-duped to avoid repeats)
   │   trigger: ≥5 words AND ≥3s silence  (SYS_SILENCE)
   ▼
sysAutoAnswer() ──► triggerAnswerText()      [in parallel: Web Speech API → 💬 You panel]
   │   fires ONLY the setup-selected style (Full / One-Liner / Cue Cards)
   ▼
POST /api/interview/answer-stream  (Server-Sent Events)
   │   body: resume + jobDescription + supportingDocs + question + mode
   │   Claude — Sonnet (full answer) or Haiku (aids); system prompt is cache_control:ephemeral
   ◄── tokens stream back as `data: {text}` ──► rendered word-by-word in the answer card
```

Key client timing constants (`public/interview/index.html`):

| Constant | Value | Purpose |
|----------|-------|---------|
| chunk length | 4000 ms | MediaRecorder segment sent to Whisper |
| `SYS_SILENCE` | 3000 ms | silence after speech → auto-answer fires |
| `SYS_CLEAR_MS` | 6000 ms | wipe leftover (<5 word) question fragments |
| `USER_SILENCE_MS` | 2500 ms | clear the "You" panel after you stop talking |

---

## 5. Answer generation (`/api/interview/answer-stream`)

Three **modes**, selected on the Setup screen and generated on demand:

| Mode | UI label | Model | max_tokens | Style |
|------|----------|-------|-----------|-------|
| `answer` | 📝 Full Answer | Claude Sonnet | 500 | Restate the question → 2–4 spoken paragraphs → "In short, …". Conversational, grounded in resume + JD, no bullet/STAR labels. |
| `one-liner` | 💬 One-Liner | Claude Haiku | 150 | 4 punchy talking points (→ lines) with real numbers. |
| `hints` | ⚡ Cue Cards | Claude Haiku | 120 | 4 ultra-short, ≤6-word scannable cue lines. |

- Only the **setup-selected** style is generated per question (1 API call, not 3); other tabs **lazy-load** when clicked.
- System prompts use **prompt caching** (`cache_control: ephemeral`) to cut input cost ~80% after the first call.
- `detect-question` (Claude Haiku) exists but the live auto-answer path **fires directly** on the transcript for speed; the endpoint remains available.

---

## 6. Authentication & data

- **Two independent user bases** (historical): `interview_users` (Interview Coach, JWT) and `users` (legacy quizmaster). They do **not** share accounts.
- Auth = **JWT Bearer** signed with `JWT_SECRET`; the browser stores only the token (`auth.js`). Server verifies on every protected call.
- Free-tier **quota** tracked in `interview_questions_used`; Stripe webhooks flip users to Pro.
- Profiles, feedback, and reset tokens persist in Postgres; the profiles UI falls back to **localStorage** when `DATABASE_URL` is absent (returns HTTP 503 `NO_DATABASE`).

### Postgres tables
| Table | App | Purpose |
|-------|-----|---------|
| `interview_users` | Interview Coach | accounts, plan, password hash |
| `interview_profiles` | Interview Coach | saved resume + JD + supporting docs |
| `interview_questions_used` | Interview Coach | per-user quota tracking |
| `interview_reset_tokens` | Interview Coach | password-reset tokens |
| `interview_feedback` | Interview Coach | in-app feedback |
| `users` | Quizmaster (legacy) | quiz app accounts |
| `challenges` | Quizmaster (legacy) | multiplayer quiz challenges |

---

## 7. Environment variables

**Required**
| Var | Used for |
|-----|----------|
| `DATABASE_URL` | Postgres (auth, profiles, quota) |
| `JWT_SECRET` | JWT signing |
| `ANTHROPIC_API_KEY` | Claude (interview answers) |

**Optional / feature-gated**
| Var | Enables |
|-----|---------|
| `GROQ_API_KEY` | Groq Whisper transcription (free, preferred) |
| `OPENAI_API_KEY` | OpenAI Whisper fallback |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_LIFETIME_PRICE_ID` | Stripe payments |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Password-reset email |
| `SENTRY_DSN` | Error monitoring |
| `ADMIN_PASSWORD` | Admin account |
| `PRODUCTION_URL` | CORS + email links |

`src/index.ts` prints a startup checklist of present/missing vars.

---

## 8. Deployment

- **Vercel project:** `interview-coach` (scope `gayathri-s-projects-d7941053`).
- **Currently manual:** `cd server && vercel --prod`. There is **no GitHub→Vercel auto-deploy** wired yet.
- HTML and `sw.js` are served `Cache-Control: no-store` (via `vercel.json` headers) and the service worker fetches HTML network-only, so deploys take effect on a normal reload.
- Because HTML-only changes don't invalidate Vercel's TS build cache, a build-marker comment in `src/index.ts` is bumped to force a clean rebuild when needed.

---

## 9. Known tech-debt / follow-ups

1. **Legacy quizmaster app** shares this server (`quiz`/`challenge`/`auth` routes, `users`/`challenges` tables). Removing it would slim the deploy and shrink attack surface.
2. **Claude model-name drift** — code references `claude-sonnet-4-6`, `claude-sonnet-4-20250514`, and `claude-haiku-4-5`. The interview path and the legacy/quiz path use different Sonnet identifiers; standardize to one known version.
3. **No GitHub→Vercel auto-deploy** — every release is a manual CLI deploy (no preview URLs, no easy rollback).
4. **No automated tests / CI gate** — changes ship straight to production.
5. **Transcript precision** — fixed 4-second chunks can clip words at boundaries; a silence-aware / overlapping-chunk capture would improve interviewer-question accuracy.
6. **`package.json` name is `quiz-api-server`** — a leftover from the quizmaster origins.
