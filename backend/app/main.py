import os
from datetime import datetime
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.lesson_engine import (
    load_words, load_history, save_history,
    build_lesson, compare, ai_hint, gemini_tips,
)

app = FastAPI(title="AIElective API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Single-user in-memory lesson state
_current_lesson = None


@app.get("/health")
def health():
    return {"status": "ok"}


# ── Lesson ──────────────────────────────────────────────

@app.get("/lesson/new")
def new_lesson():
    global _current_lesson
    words = load_words()
    history = load_history()
    groups, last_wrong = build_lesson(words, history)

    _current_lesson = {
        "words": words,
        "groups": groups,
        "last_wrong": last_wrong,
        "lesson_number": len(history["lessons"]) + 1,
    }

    return {
        "lesson_number": _current_lesson["lesson_number"],
        "last_wrong_count": len(last_wrong),
        "groups": [
            [{"word": w, "english": words[w]["english"]} for w in group]
            for group in groups
        ],
    }


class Answer(BaseModel):
    word: str
    guess: str


class SubmitRequest(BaseModel):
    answers: List[Answer]


@app.post("/lesson/submit")
def submit_lesson(body: SubmitRequest):
    global _current_lesson
    if _current_lesson is None:
        raise HTTPException(status_code=400, detail="No active lesson. Call /lesson/new first.")

    words = _current_lesson["words"]
    last_wrong = _current_lesson["last_wrong"]

    results = [
        {"word": a.word, "guess": a.guess, "correct": a.guess == words[a.word]["article"]}
        for a in body.answers
    ]

    history = load_history()
    report = compare(history, results, last_wrong)

    mistakes = [
        {**words[r["word"]], "guess": r["guess"]}
        for r in results if not r["correct"]
    ]

    tips = gemini_tips(mistakes)

    history["lessons"].append({"date": datetime.now().isoformat(), "results": results})
    save_history(history)
    _current_lesson = None

    return {
        "score": report["score"],
        "total": report["total"],
        "previous": report["previous"],
        "fixed": report["fixed"],
        "still_wrong": report["still_wrong"],
        "mistakes": [
            {
                "word": m["word"],
                "article": m["article"],
                "english": m["english"],
                "guess": m["guess"],
                "ai_hint": ai_hint(m["word"], m["article"]),
                "teacher_tip": tips.get(m["word"]),
            }
            for m in mistakes
        ],
    }


# ── Chat ─────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str


@app.post("/chat")
def chat(body: ChatRequest):
    try:
        from dotenv import load_dotenv
        from google import genai
        from google.genai import types

        load_dotenv()
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL"),
            contents=body.message,
            config=types.GenerateContentConfig(
                system_instruction=(
                    "You are a friendly Dutch language tutor for A1 level English speakers. "
                    "Help students learn Dutch vocabulary, grammar, articles (de/het), and pronunciation. "
                    "Keep responses short, clear, and encouraging."
                ),
            ),
        )
        return {"reply": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
