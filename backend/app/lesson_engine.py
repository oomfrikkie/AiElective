import csv
import json
import os
import random
from datetime import datetime

WORDS_FILE = "/app/data/wordsA1.csv"
HISTORY_FILE = "/app/data/history.json"
LESSON_SIZE = 20
GROUP_SIZE = 4


# ---------- Words + history ----------
def load_words():
    with open(WORDS_FILE, encoding="utf-8") as f:
        return {r["word"]: r for r in csv.DictReader(f)}

def load_history():
    if not os.path.exists(HISTORY_FILE):
        return {"lessons": []}
    with open(HISTORY_FILE, encoding="utf-8") as f:
        return json.load(f)

def save_history(history):
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


# ---------- Build a lesson ----------
def build_lesson(words, history):
    seen = {r["word"] for lesson in history["lessons"] for r in lesson["results"]}

    last_wrong = []
    if history["lessons"]:
        last_wrong = [r["word"] for r in history["lessons"][-1]["results"] if not r["correct"]]

    # 1. last lesson's mistakes always come back
    picked = [w for w in last_wrong if w in words][:LESSON_SIZE]

    # 2. fill up with words never seen before
    fresh = [w for w in words if w not in seen and w not in picked]
    random.shuffle(fresh)
    picked += fresh[:LESSON_SIZE - len(picked)]

    # 3. ran out of new words? reuse old ones
    if len(picked) < LESSON_SIZE:
        old = [w for w in words if w not in picked]
        random.shuffle(old)
        picked += old[:LESSON_SIZE - len(picked)]

    random.shuffle(picked)
    groups = [picked[i:i + GROUP_SIZE] for i in range(0, len(picked), GROUP_SIZE)]
    return groups, last_wrong


# ---------- Compare with last lesson ----------
def compare(history, results, last_wrong):
    score = sum(r["correct"] for r in results)
    report = {"score": score, "total": len(results), "previous": None, "fixed": [], "still_wrong": []}

    if history["lessons"]:
        prev = history["lessons"][-1]["results"]
        report["previous"] = sum(r["correct"] for r in prev)

    for r in results:
        if r["word"] in last_wrong:
            (report["fixed"] if r["correct"] else report["still_wrong"]).append(r["word"])
    return report


# ---------- AI 1: your neural network ----------
_model = None
_vocab = None

def ai_hint(word, real_article):
    global _model, _vocab
    import torch
    from app.model import DeHetNet, encode

    if _model is None:
        saved = torch.load("/app/data/dehet_model.pt")
        _vocab = saved["vocab"]
        _model = DeHetNet(len(_vocab) + 2)
        _model.load_state_dict(saved["state"])
        _model.eval()

    with torch.no_grad():
        p = torch.sigmoid(_model(torch.tensor([encode(word, _vocab)]))).item()
    guess = "het" if p > 0.5 else "de"
    conf = p if p > 0.5 else 1 - p

    if guess == real_article and conf >= 0.8:
        return f"Follows a pattern (my AI was {conf:.0%} sure it's {guess})"
    if guess != real_article:
        return f"Rule breaker! Even my AI guessed '{guess}'. Just memorize this one."
    return f"Weak pattern (my AI was only {conf:.0%} sure)"


# ---------- AI 2: Gemini tips ----------
def gemini_tips(mistakes):
    if not mistakes:
        return {}
    try:
        from dotenv import load_dotenv
        from google import genai
        from google.genai import types
        from pydantic import BaseModel

        class Tip(BaseModel):
            word: str
            tip: str

        load_dotenv()
        client = genai.Client(
            api_key=os.getenv("GEMINI_API_KEY"),
            http_options=types.HttpOptions(
                timeout=60_000,
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )

        listing = "\n".join(
            f"- {m['article']} {m['word']} ({m['english']}), learner guessed '{m['guess']}'"
            for m in mistakes
        )

        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL"),
            contents=f"The learner got these wrong:\n{listing}\n\nGive one short, friendly memory tip per word.",
            config=types.GenerateContentConfig(
                system_instruction=(
                    "You are a Dutch teacher for A1 English speakers. "
                    "The article given is always correct, never change it. "
                    "Tips are max 1 sentence. Mention a real rule only if it applies "
                    "(-je words are het, -ing words are de, plurals are de)."
                ),
                response_mime_type="application/json",
                response_schema=list[Tip],
            ),
        )
        return {t.word: t.tip for t in response.parsed}
    except Exception as e:
        print(f"(Gemini tips unavailable: {e.__class__.__name__})")
        return {}
