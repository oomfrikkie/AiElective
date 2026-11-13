# Overnight handoff 🌙

Everything below is committed and pushed to the branch **`claude/inspiring-albattani-u4no3h`** (not merged into `main` yet).

## TL;DR

| | Status |
|---|---|
| AI works as intended (Gemini + de/het network) | ✅ Tested live with your key and model. **Fixed 3 real bugs**, including broken text-to-speech |
| NestJS + TypeORM + Postgres backend | ✅ New `api/` service. Accounts, settings, lessons and progress are now stored per user in the database |
| Frontend wired up | ✅ New Account page (login/sign-up/progress/settings); Het/De lessons are saved per user |
| B1 lessons | ✅ 177-word de/het list + 7 conversation scenarios |
| Docs | ✅ `README.md` (technical) + **`HettieAI - How it works (updated).docx`** (your doc, updated; original untouched) |
| Tests | ✅ 23 Python + 4 NestJS unit + 16 NestJS e2e (real Postgres) + a browser run-through, all passing |

## ▶️ How to run it in the morning

```bash
git checkout claude/inspiring-albattani-u4no3h
docker compose up --build
```
Open http://localhost:5173 → **Account** → sign up → try Het/De.

Your existing `.env` works as is (the API has a dev default for the JWT secret). Optional tidy-up: the line `VITE_API_URL=http://localhost:5173/` in your `.env` is wrong (that's the frontend's own port) but harmless, since it isn't used. You can delete it. See `.env.example` for all options.

---

## 1. AI: tested live, bugs fixed

I ran every AI feature for real: tutor chat, conversation practice (text **and** voice), speech-to-text, text-to-speech, Gemini teacher tips, and the de/het network (`meisje` → het 99.6%, `regering` → de 99.4%).

**Bugs found and fixed:**
1. **Text-to-speech was completely broken.** `google-genai` wasn't pinned, and its newest version talks to Gemini API `v1`, which rejects voice settings. Every 🔊 Listen failed. Now forced to `v1beta`.
2. **Garbled audio.** The first TTS model already returns a complete WAV file, and the code wrapped it in a second WAV header. Now it only wraps raw audio.
3. **`.env` loaded too late.** `GEMINI_MODELS` etc. were read before `.env` was loaded, so they were ignored. Now `.env` loads first.
4. **Lessons only worked for one person.** A single global "current lesson" + `history.json` meant two users would overwrite each other. The AI service is now **stateless**; the new API owns user data.
5. Hardcoded `/app/data` paths only worked inside Docker. Now uses `DATA_DIR` (defaults to `backend/data`).
6. Without `dehet_model.pt` (e.g. a fresh clone by a teacher), every lesson with a mistake crashed. Now it falls back to a generic hint.
7. Python dependencies pinned so this can't silently break again.

**New:** `GET /predict?word=fiets` asks the network directly; `/health` shows whether the key and model are loaded.

## 2. NestJS + TypeORM + PostgreSQL user API (`api/`)

- **Auth:** register/login with JWT, bcrypt password hashing, rate limiting on login, same error for wrong email vs wrong password.
- **Users:** profile, password change, account deletion (removes everything via cascades).
- **Settings:** text/voice mode, voice, last lesson/conversation level, which **used to be in localStorage** and now live in the DB and follow the user to any device. Guests still get localStorage as a fallback.
- **Lessons:** the API loads the learner's history from Postgres, asks the Python service to build or grade, then saves every answer. It blocks double submits, answers for words not in the lesson, and reading other users' lessons. **A refresh mid-lesson resumes the same lesson.**
- **Stats:** accuracy, best/last score per level, words practised, "tricky words" (most missed).
- **Conversations:** finished scenarios are recorded, shown as "✓ Done" on the scenario cards and on the Account page.
- **Migrations:** schema managed by a real TypeORM migration that runs on startup (`synchronize` is off).
- Endpoint list: see `README.md`.

## 3. Frontend

- New **Account** page (the nav already linked to it, but it didn't exist): sign up / log in, progress dashboard, recent lessons (click to see the AI feedback again), finished conversations, settings, profile, password, delete account.
- Het/De needs a login (shows a friendly prompt otherwise). Chat and conversation still work as a guest.
- Nav shows who's logged in.
- Fixed: `api.js` used `undefined/...` URLs when run without Docker.

## 4. B1
- `backend/data/wordsB1.csv`: 177 nouns (55 het), no overlap with A1/A2, no words that take both articles, no English loanwords.
- 7 B1 scenarios: job interview, making a complaint, town hall registration, problem with the landlord, discussing the environment, discussing the news, volunteering. Tested live: Hettie speaks natural B1 Dutch.

## 5. Docs
- `README.md`: architecture diagram, how to run (Docker and without), tests, API tables, database tables, training.
- `HettieAI - How it works (updated).docx`: your explainer, updated: new section 4 (user API + database), User API/Database rows in the big-picture table, B1 everywhere, history.json corrected, 4 glossary terms. Same styling as yours. **Your original .docx is untouched**, so compare and keep whichever you want.

---

## ⚠️ Honest notes (read these)

1. **I couldn't run `docker compose up` end to end here.** This sandbox blocks the network inside Docker builds (pip/npm can't download). The compose file validates, and I tested every part outside Docker (AI service, API against real Postgres, production build + migrations, frontend in a real browser). It should just work on your machine, but **run it once before you submit**.
2. **Voice from a real microphone** wasn't tested (no mic here). The audio path *was* tested end to end with generated speech: transcription and pronunciation feedback both worked.
3. **The de/het model has seen the B1 words** (it was trained before B1 existed), so its B1 "pattern" hints may sound more confident than they should. `train.py` now hides all lesson words automatically, so retraining fixes this (optional; needs the Wiktionary dump).
4. Your old `history.json` progress isn't imported into accounts. It's still used by the terminal game `play.py`.
5. Known limitations you could mention in your report (they're fine for a school project): the AI service has no login, so anyone who can reach port 8000 can use your Gemini key; the JWT sits in localStorage; there's no "forgot password" email.

## 🧪 Run the tests yourself
```bash
cd backend && python -m unittest discover tests        # 23 tests
cd api && npm test                                     # 4 unit tests
createdb -O hettie hettie_test && cd api && npm run test:e2e   # 16 e2e tests (needs local Postgres)
```
