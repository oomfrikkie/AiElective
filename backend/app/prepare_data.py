import json
import csv
import re

from app.lesson_engine import DATA_DIR

JSONL_FILE = DATA_DIR / "dutchDictionary.json"
OUT_FILE = DATA_DIR / "dehet_data.csv"
SKIP_ENGLISH_LOANS = True


FUNCTION_POS = {"pron", "prep", "det", "article", "conj", "adv", "num", "particle", "intj"}
COMMON_GENDERS = {"m", "f", "c", "mf", "mfbysense"}


def pick_article(is_het, is_de):
    if is_het and is_de:
        return "both"
    if is_het:
        return "het"
    if is_de:
        return "de"
    return None


def get_article(entry):
    # 1. Best source: the noun template, "n" = het, "m"/"f"/"c" = de (can list several, e.g. "n,f,m")
    for t in entry.get("head_templates", []):
        if t.get("name") == "nl-noun":
            genders = set(re.split(r"[,/]", t.get("args", {}).get("1", "")))
            article = pick_article("n" in genders, bool(genders & COMMON_GENDERS))
            if article:
                return article

    # 2. Fallback: tags on the senses
    tags = set(entry.get("tags", []))
    for sense in entry.get("senses", []):
        tags.update(sense.get("tags", []))

    return pick_article(
        "neuter" in tags,
        "masculine" in tags or "feminine" in tags or "common" in tags,
    )


def is_english_loan(entry):
    for t in entry.get("etymology_templates", []):
        if t.get("name") in ("bor", "ubor", "lbor") and t.get("args", {}).get("2") == "en":
            return True
    return False


nouns = {}             # word -> label
ambiguous = set()
function_words = set()

with open(JSONL_FILE, encoding="utf-8") as f:
    for line in f:
        entry = json.loads(line)

        if entry.get("lang_code") != "nl":
            continue

        word = entry.get("word", "")
        pos = entry.get("pos")

        if pos in FUNCTION_POS:
            function_words.add(word)
            continue
        if pos != "noun":
            continue
        if any("form_of" in s or "alt_of" in s for s in entry.get("senses", [])):
            continue
        if not word.isalpha() or not word.islower() or len(word) < 2:
            continue
        if SKIP_ENGLISH_LOANS and is_english_loan(entry):
            continue

        article = get_article(entry)
        if article == "both":
            ambiguous.add(word)
        elif article:
            label = 1 if article == "het" else 0
            if nouns.setdefault(word, label) != label:
                ambiguous.add(word)

# remove nouns that can take either article: spelling can't decide those (het raam / de raam)
for word in ambiguous:
    nouns.pop(word, None)
print(f"Removed {len(ambiguous)} words with both articles")

# remove nouns that are also grammar words (een, hij, van, niet...)
rows = [(w, l) for w, l in nouns.items() if w not in function_words]

with open(OUT_FILE, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["word", "label"])
    writer.writerows(rows)

het = sum(l for _, l in rows)
print(f"Removed {len(nouns) - len(rows)} grammar words")
print(f"Saved {len(rows)} nouns ({len(rows) - het} de, {het} het) to {OUT_FILE}")
