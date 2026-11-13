# HettieAI

A web app that helps English speakers learn Dutch (CEFR A1–B1), with two kinds of AI:

- **Our own neural network**: five small GRU networks, trained on ~30,000 Dutch nouns, that vote on whether a word takes **de** or **het** from its spelling alone.
- **Google Gemini**: Hettie the tutor. It holds role-play conversations, corrects your Dutch, gives pronunciation feedback, writes memory tips, transcribes your voice and speaks with a Dutch voice.

## Features

| Page | What it does |
|---|---|
| **Home** (tutor chat) | Ask Hettie anything about learning Dutch, typed or spoken. |
| **Het / De** | 12-word quizzes per level. Mistakes come back in the next lesson. Every mistake is explained by our network (spelling pattern or not) and by Gemini (memory tip). |
| **Conversation** | Role-play everyday situations (café, doctor, job interview...) at A1, A2 or B1. Type or speak; Hettie replies in character, corrects your grammar and de/het, and comments on pronunciation. |
| **Account** | Sign up / log in, progress dashboard (accuracy, scores per level, your trickiest words, past lessons with their feedback, finished conversations), settings that follow you to any device. |

## Architecture

```
                 ┌──────────────────────┐
                 │  frontend  (React)   │  :5173
                 └───┬──────────────┬───┘
       accounts,     │              │   chat, speech,
       lessons, stats│              │   conversation practice
                     ▼              ▼
┌────────────────────────┐   ┌──────────────────────────────┐
│ api  (NestJS+TypeORM)  │──▶│ backend  (FastAPI, Python)   │ :8000
│ auth, users, settings, │   │ de/het neural network (torch)│
│ lessons, progress      │   │ Gemini: chat, TTS, STT, tips │
└───────────┬────────────┘   └──────────────────────────────┘
            ▼            :3000           stateless, no user data
     ┌──────────────┐
     │ PostgreSQL   │ :5432
     └──────────────┘
```

- **`api/`**: NestJS + TypeORM + PostgreSQL. Owns all user data: accounts (JWT, bcrypt), settings, every lesson and answer, finished conversations. To start or grade a lesson it sends the learner's history to the AI service.
- **`backend/`**: FastAPI AI service. Stateless: it receives the history it needs with each request, so it never stores anything about users.
- **`frontend/`**: React (Vite). Talks to the API for anything user-related and to the AI service for chat/voice.

## Run it (Docker)

1. Copy the example env file and add your Gemini key:
   ```bash
   cp .env.example .env
   # edit .env: GEMINI_API_KEY=...
   ```
2. Make sure the trained model is at `backend/data/dehet_model.pt` (see [Training the network](#training-the-de-het-network); without it the app still works, but the pattern hints fall back to a generic tip).
3. Start everything:
   ```bash
   docker compose up --build
   ```
4. Open http://localhost:5173 and create an account on the **Account** page.

| Service | URL |
|---|---|
| Website | http://localhost:5173 |
| User API (NestJS) | http://localhost:3000/health |
| AI service (FastAPI) | http://localhost:8000/health · docs at http://localhost:8000/docs |

The database schema is created automatically: the API runs its TypeORM migrations on startup.

## Run it without Docker

You need Node 20+, Python 3.11+ and PostgreSQL 13+.

```bash
# 1. Database
createuser -P hettie          # password: hettie
createdb -O hettie hettie

# 2. AI service
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. User API (new terminal)
cd api
npm install
npm run start:dev             # reads ../.env, runs migrations

# 4. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

## Tests

```bash
# AI service: word lists, lesson logic, tip checker, HTTP endpoints (22 tests, Gemini stubbed)
cd backend && python -m unittest discover tests
# or: docker compose run --rm backend python -m unittest discover tests

# User API: unit tests
cd api && npm test

# User API: end-to-end against a real PostgreSQL database (AI service faked)
createdb -O hettie hettie_test
cd api && npm run test:e2e
```

## API overview (NestJS, port 3000)

All routes except `auth/*`, `GET /health` and `GET /lessons/levels` need `Authorization: Bearer <token>`.

| Method | Route | Description |
|---|---|---|
| POST | `/auth/register` | `{ email, password, displayName }` → `{ accessToken, user }` |
| POST | `/auth/login` | `{ email, password }` → `{ accessToken, user }` (rate limited) |
| GET / PATCH / DELETE | `/users/me` | Profile; delete needs `{ password }` and removes all data |
| PATCH | `/users/me/password` | `{ currentPassword, newPassword }` |
| GET / PATCH | `/users/me/settings` | `{ mode, voice, lessonLevel, conversationLevel }` |
| GET | `/lessons/levels` | Levels that have a word list |
| POST | `/lessons` | `{ level }` → start a lesson (12 words, last mistakes first) |
| POST | `/lessons/:id/submit` | `{ answers: [{ word, guess }] }` → score, comparison, AI feedback |
| GET | `/lessons`, `/lessons/:id` | Lesson history / one lesson with answers and feedback |
| GET | `/lessons/stats` | Accuracy, per-level scores, words practised, tricky words |
| POST / GET | `/conversations/completions` | Record / list finished scenarios |
| GET | `/conversations/completions/summary` | Per scenario: times finished, best number of messages |
| GET | `/health` | Database and AI service status |

### Database

| Table | Holds |
|---|---|
| `users` | email (unique, lowercase), display name, bcrypt hash |
| `user_settings` | one row per user: text/voice mode, voice, last lesson + conversation level |
| `lessons` | one de/het lesson: level, words, status, score, AI feedback |
| `lesson_answers` | one row per answered word (powers the stats) |
| `scenario_completions` | finished conversation scenarios |

Everything cascades on user delete.

## AI service overview (FastAPI, port 8000)

| Method | Route | Description |
|---|---|---|
| POST | `/lesson/build` | Pick 12 words given a learner's history |
| POST | `/lesson/grade` | Grade answers, add network hints + Gemini tips |
| GET | `/predict?word=fiets` | Ask the de/het network directly |
| POST | `/chat` | Tutor chat |
| GET | `/conversation/scenarios?level=A1` | Scenarios per level |
| POST | `/conversation/turn` | One conversation turn (text or audio) with feedback |
| POST | `/transcribe` | Speech → text |
| POST | `/speak` | Text → Dutch speech (WAV) |

## Training the de/het network

The trained model (`backend/data/dehet_model.pt`) and the dictionary it is trained on are not in git (too large).

```bash
# 1. Download the Dutch Wiktionary extract from https://kaikki.org (Dutch, all words, JSONL)
#    and save it as backend/data/dutchDictionary.json
# 2. Clean it into ~30,600 nouns with their article
docker compose run --rm backend python -m app.prepare_data
# 3. Train five networks and save them
docker compose run --rm backend python -m app.train
# 4. Try it
docker compose run --rm backend python -m app.predict
```

The lesson words (A1, A2, B1) are kept out of training, so when the network is sure about one of them, that's because the spelling really gives it away.

## Project structure

```
api/                 NestJS user API
  src/auth/          register, login, JWT strategy
  src/users/         profile, settings, password, delete
  src/lessons/       de/het lessons, history, stats
  src/conversations/ finished conversation scenarios
  src/ai/            HTTP client for the AI service
  src/database/      TypeORM options, data source, migrations
  test/              e2e tests
backend/             FastAPI AI service
  app/main.py        HTTP endpoints
  app/lesson_engine.py  lesson logic, network hints, Gemini tips
  app/conversation.py   scenarios, Gemini calls, speech
  app/model.py, train.py, prepare_data.py, predict.py
  data/wordsA1.csv, wordsA2.csv, wordsB1.csv
frontend/            React (Vite)
  src/pages/         Home, HetDe, Conversation, Account
  src/auth/          AuthContext (session + synced settings)
  src/api.js         AI service client
  src/userApi.js     User API client
```
