import os
import traceback
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.lesson_engine import (
    WORD_FILES, load_words, load_history, save_history, level_lessons,
    build_lesson, compare, ai_hint, gemini_tips,
)
from app.conversation import (
    LEVELS, SCENARIOS, list_scenarios, get_scenario,
    conversation_turn, to_contents, audio_content, generate,
    speak, TTS_VOICES,
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
def new_lesson(level: str = "A1"):
    global _current_lesson
    if level not in WORD_FILES:
        raise HTTPException(status_code=404, detail=f"Unknown level '{level}'.")
    words = load_words(level)
    history = load_history()
    groups, last_wrong = build_lesson(words, history, level)

    _current_lesson = {
        "level": level,
        "words": words,
        "groups": groups,
        "last_wrong": last_wrong,
        "lesson_number": len(level_lessons(history, level)) + 1,
    }

    return {
        "level": level,
        "levels": list(WORD_FILES),
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

    level = _current_lesson["level"]
    words = _current_lesson["words"]
    last_wrong = _current_lesson["last_wrong"]

    results = [
        {"word": a.word, "guess": a.guess, "correct": a.guess == words[a.word]["article"]}
        for a in body.answers
    ]

    history = load_history()
    report = compare(history, results, last_wrong, level)

    mistakes = [
        {**words[r["word"]], "guess": r["guess"], **ai_hint(r["word"], words[r["word"]]["article"])}
        for r in results if not r["correct"]
    ]

    tips = gemini_tips(mistakes)

    history["lessons"].append({"date": datetime.now().isoformat(), "level": level, "results": results})
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
                "ai_hint": m["hint"],
                "teacher_tip": tips.get(m["word"]),
            }
            for m in mistakes
        ],
    }


# ── Chat ─────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" or "ai"
    text: str


class AudioInput(BaseModel):
    data: str  # base64
    mime_type: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


@app.post("/chat")
def chat(body: ChatRequest):
    try:
        # Send the whole conversation, not just the last message, so Gemini doesn't
        # treat every message as the start of a new chat and greet again.
        history = [m.model_dump() for m in body.history] + [{"role": "user", "text": body.message}]
        response = generate(
            to_contents(history),
            system_instruction=(
                "You are a friendly Dutch language tutor named 'Hettie' for A1 level English speakers. "
                "Help students learn Dutch vocabulary, grammar, articles (de/het), and pronunciation. "
                "Keep responses short, clear, and encouraging. You may not accept any questions that are irrelevant in learning Dutch, eg, question about games. "
                "You have already greeted the student, so never greet them again or ask what they want to start with; "
                "just answer their latest message, using the earlier conversation as context. "
                "DE/HET: only state rules that are really true, such as: -je words are het, -ing and -heid words are de, "
                "plurals are de, and about 3 in 4 nouns take de. Never invent a rule based on a word's meaning or size; "
                "if no rule applies, say the article of that word simply has to be learned. "
                "LANGUAGE: the student is a beginner, so always explain in ENGLISH, even when they write to you in "
                "Dutch. Use Dutch only for the words and example sentences you are teaching, each followed by its "
                "English meaning, e.g. 'de appel (the apple)'. Only answer fully in Dutch if the student explicitly "
                "asks to practise in Dutch, and then keep it very simple and add an English translation."
            ),
        )
        return {"reply": response.text}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── Speech to text ───────────────────────────────────────
# Fallback for browsers without live speech recognition: a small, fast call that only
# transcribes, so the learner sees their words before the full reply is ready.

class TranscribeRequest(BaseModel):
    audio: AudioInput


@app.post("/transcribe")
def transcribe(body: TranscribeRequest):
    try:
        response = generate([audio_content(
            body.audio.model_dump(),
            "Transcribe exactly what is said in this clip (Dutch, English or a mix). "
            "Do not fix mistakes. Reply with the transcript only.",
        )])
        return {"transcript": (response.text or "").strip()}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── Text to speech ───────────────────────────────────────
# Gemini reads Hettie's replies in a real Dutch voice; browser voices are unreliable
# (e.g. Opera ignores the Dutch voice and reads Dutch with an English one).

class SpeakRequest(BaseModel):
    text: str
    voice: str = TTS_VOICES[0]
    dutch_only: bool = True  # False: mixed English/Dutch, the voice picks the language itself


@app.get("/speak/voices")
def speak_voices():
    return {"voices": TTS_VOICES}


@app.post("/speak")
def speak_text(body: SpeakRequest):
    try:
        return Response(content=speak(body.text, body.voice, body.dutch_only), media_type="audio/wav")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── Conversation practice ────────────────────────────────

@app.get("/conversation/scenarios")
def conversation_scenarios(level: str = "A1"):
    if level not in LEVELS:
        raise HTTPException(status_code=404, detail=f"Unknown level '{level}'.")
    return {
        "level": level,
        "levels": [{"level": l, "available": bool(SCENARIOS[l])} for l in LEVELS],
        "scenarios": list_scenarios(level),
    }


class ConversationRequest(BaseModel):
    level: str = "A1"
    scenario_id: str
    history: List[ChatMessage] = []
    audio: Optional[AudioInput] = None
    transcript: str = ""  # what the learner sees in their bubble, if already transcribed


@app.post("/conversation/turn")
def conversation(body: ConversationRequest):
    scenario = get_scenario(body.level, body.scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Unknown scenario.")
    try:
        audio = body.audio.model_dump() if body.audio else None
        return conversation_turn(
            body.level, scenario, [m.model_dump() for m in body.history], audio, body.transcript,
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
