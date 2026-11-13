# Overnight handoff 🌙

Live progress log. Updated after every finished part, so if the session stops early this still shows where things are.

## ✅ Done

### 1. AI checked live with your Gemini key + model
Everything was tested for real, not just "it compiles":
- Tutor chat, conversation practice (text + voice), speech-to-text, text-to-speech, Gemini teacher tips, de/het neural network.

**Bugs found and fixed:**
- **Text-to-speech was broken.** The `google-genai` package wasn't pinned, and the newest version talks to Gemini API `v1`, which rejects the voice settings. Every `/speak` call failed. Now forced to `v1beta`.
- **Garbled audio.** The first TTS model already returns a full WAV file, and the code wrapped it in a *second* WAV header. Now it only wraps raw audio.
- **`.env` loaded too late.** It was only read on the first Gemini call, so the model settings in `.env` were ignored at startup. Now loads first thing.
- **Lessons were single-user.** One global "current lesson" + `history.json` meant two people using the app at once would overwrite each other. The AI service is now stateless (see below).
- Hardcoded `/app/data` paths meant the Python code only worked inside Docker. Now it uses `DATA_DIR` (defaults to `backend/data`).
- No model file = crash on every lesson with a mistake. Now it falls back to a sensible hint.
- Python dependencies pinned to working versions.

**New:** `GET /predict?word=fiets` lets you ask the neural network directly. `/health` shows whether the key and model are loaded.

**Tests:** 22 Python tests pass (14 existing + 8 new endpoint tests).

## 🚧 In progress
- NestJS + TypeORM + Postgres API for accounts, settings and lesson history.

## ⏭️ Next
- Frontend: Account page (login/register), Het/De lessons saved per user, settings synced.
- Docker compose with Postgres + API, `.env.example`, README.
- B1 lessons.
