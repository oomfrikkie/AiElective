import csv
import json
import os
import random
import re
from datetime import datetime

WORD_FILES = {"A1": "/app/data/wordsA1.csv", "A2": "/app/data/wordsA2.csv"}
HISTORY_FILE = "/app/data/history.json"
LESSON_SIZE = 12
GROUP_SIZE = 4


# ---------- Words + history ----------
def load_words(level=None):
    """The words of one level, or of all levels when no level is given."""
    words = {}
    for name, path in WORD_FILES.items():
        if level in (None, name):
            with open(path, encoding="utf-8") as f:
                words.update({r["word"]: r for r in csv.DictReader(f)})
    return words

def level_lessons(history, level):
    # Lessons from before levels existed were all A1.
    return [lesson for lesson in history["lessons"] if lesson.get("level", "A1") == level]

def load_history():
    if not os.path.exists(HISTORY_FILE):
        return {"lessons": []}
    with open(HISTORY_FILE, encoding="utf-8") as f:
        return json.load(f)

def save_history(history):
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


# ---------- Build a lesson ----------
def build_lesson(words, history, level="A1"):
    lessons = level_lessons(history, level)
    seen = {r["word"] for lesson in lessons for r in lesson["results"]}

    last_wrong = []
    if lessons:
        last_wrong = [r["word"] for r in lessons[-1]["results"] if not r["correct"]]

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
def compare(history, results, last_wrong, level="A1"):
    score = sum(r["correct"] for r in results)
    report = {"score": score, "total": len(results), "previous": None, "fixed": [], "still_wrong": []}

    lessons = level_lessons(history, level)
    if lessons:
        prev = lessons[-1]["results"]
        report["previous"] = sum(r["correct"] for r in prev)

    for r in results:
        if r["word"] in last_wrong:
            (report["fixed"] if r["correct"] else report["still_wrong"]).append(r["word"])
    return report


# ---------- AI 1: your neural network ----------
_networks = None
_vocab = None
PATTERN_CONF = 0.9          # 97-98% reliable on words the network never saw
STRONG_PATTERN_CONF = 0.98  # 98-99% reliable

def ai_hint(word, real_article):
    global _networks, _vocab
    from app.model import load_networks, het_probability

    if _networks is None:
        _networks, _vocab = load_networks("/app/data/dehet_model.pt")

    p = het_probability(_networks, _vocab, word)
    guess = "het" if p > 0.5 else "de"
    conf = p if p > 0.5 else 1 - p

    sure = f"my AI was {conf:.0%} sure it's {guess}"
    if guess == real_article and conf >= STRONG_PATTERN_CONF:
        return {"verdict": "pattern", "hint": f"Strong spelling pattern ({sure})"}
    if guess == real_article and conf >= PATTERN_CONF:
        return {"verdict": "pattern", "hint": f"Follows a spelling pattern ({sure})"}
    clue = "The spelling points the wrong way" if guess != real_article else "No clear spelling pattern"
    if real_article == "de":
        return {"verdict": "default", "hint": f"{clue}, but 'de' is the safe default: about 3 in 4 nouns take it ({sure})"}
    return {"verdict": "memorize", "hint": f"{clue}, just memorize this one ({sure})"}


# ---------- AI 2: Gemini tips ----------
# The only spelling rules a tip may state. Gemini likes to invent others ("-en words are het").
REAL_RULES = {"je": "het", "ing": "de"}
GENERALISATION = re.compile(
    r"\b(words?|nouns?|objects?|animals?|things?|furniture|most|many|often|usually|always|almost|rule)\b",
    re.IGNORECASE,
)

def tip_is_sound(tip, word, article):
    """False if a tip names the wrong article, invents a rule or runs words together."""
    other = "de" if article == "het" else "het"
    if re.search(rf"\b{other}\s+{re.escape(word)}\b", tip, re.IGNORECASE):
        return False
    if re.search(r"[a-z]het\b", tip, re.IGNORECASE):  # "inhet bed"
        return False
    has_real_rule = any(word.endswith(end) and art == article for end, art in REAL_RULES.items())
    for ending in re.findall(r"(?<![a-zA-Z])-([a-zA-Z]+)", tip):
        if not (ending.lower() in REAL_RULES and word.endswith(ending.lower())):
            return False
    return has_real_rule or not GENERALISATION.search(tip)


def plain_tip(m):
    """Used when Gemini is unavailable or its tip didn't pass the check."""
    article, word = m["article"], m["word"]
    if m["verdict"] == "pattern":
        return f"The spelling of '{word}' is typical for '{article}', so trust that feeling."
    if m["verdict"] == "default":
        return f"Say '{article} {word}' out loud a few times, and when you're unsure, go with 'de'."
    return f"Say '{article} {word}' out loud a few times until it sticks."


def gemini_tips(mistakes):
    if not mistakes:
        return {}
    tips = {}
    try:
        from pydantic import BaseModel
        from app.conversation import generate, TEXT_MODELS

        class Tip(BaseModel):
            word: str
            tip: str

        listing = "\n".join(
            f"- {m['article']} {m['word']} ({m['english']}), learner guessed '{m['guess']}', verdict: {m['verdict']}"
            for m in mistakes
        )

        # Your chosen model first; the others only step in when it's overloaded.
        model = os.getenv("GEMINI_MODEL")

        response = generate(
            f"The learner got these wrong:\n{listing}\n\nGive one short, friendly memory tip per word.",
            models=[model, *TEXT_MODELS] if model else TEXT_MODELS,
            hedge_after=8,
            system_instruction=(
                "You are a Dutch teacher for A1 English speakers. "
                "The article given is always correct, never change it. "
                "Tips are max 1 sentence and only about remembering this word's article. "
                "Each word has a verdict from a spelling model, and the tip must agree with it: "
                "'pattern' = say that this word's spelling is typical for its article, without naming an ending; "
                "'default' = no clear clue, so give a vivid memory trick using 'de' and the word; "
                "'memorize' = no clear clue, so give a vivid memory trick using 'het' and the word. "
                "The only spelling rules you may ever state are: -je words are het, -ing words are de, "
                "plurals are de. Never invent a rule about other endings or letters, and make every "
                "tip different. Keep normal spaces around 'de' and 'het'."
            ),
            response_mime_type="application/json",
            response_schema=list[Tip],
        )
        # The model sometimes answers "het huis" instead of "huis".
        tips = {t.word.removeprefix("de ").removeprefix("het ").strip(): t.tip for t in response.parsed}
    except Exception as e:
        print(f"(Gemini tips unavailable: {e.__class__.__name__})")

    checked = {}
    for m in mistakes:
        tip = tips.get(m["word"])
        if tip and tip_is_sound(tip, m["word"], m["article"]):
            checked[m["word"]] = tip
        else:
            checked[m["word"]] = plain_tip(m)
    return checked
