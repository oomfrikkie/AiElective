import json
import csv

JSONL_FILE = "/app/data/dutchDictionary.jsonl"
OUT_FILE = "/app/data/dehet_data.csv"
SKIP_ENGLISH_LOANS = True


FUNCTION_POS = {"pron", "prep", "det", "article", "conj", "adv", "num", "particle", "intj"}


def get_article(entry):
    # 1. Best source: the noun template, "n" = het, "m"/"f"/"c" = de
    for t in entry.get("head_templates", []):
        if t.get("name") == "nl-noun":
            g = t.get("args", {}).get("1", "")
            if g == "n":
                return "het"
            if g in ("m", "f", "c", "m/f", "f/m"):
                return "de"

    # 2. Fallback: tags on the senses
    tags = set(entry.get("tags", []))
    for sense in entry.get("senses", []):
        tags.update(sense.get("tags", []))

    is_het = "neuter" in tags
    is_de = "masculine" in tags or "feminine" in tags or "common" in tags

    if is_het and not is_de:
        return "het"
    if is_de and not is_het:
        return "de"
    return None


def is_english_loan(entry):
    for t in entry.get("etymology_templates", []):
        if t.get("name") in ("bor", "ubor", "lbor") and t.get("args", {}).get("2") == "en":
            return True
    return False


nouns = {}             # word -> label
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
        if word in nouns:
            continue

        article = get_article(entry)
        if article:
            nouns[word] = 1 if article == "het" else 0

# remove nouns that are also grammar words (een, hij, van, niet...)
rows = [(w, l) for w, l in nouns.items() if w not in function_words]

with open(OUT_FILE, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["word", "label"])
    writer.writerows(rows)

het = sum(l for _, l in rows)
print(f"Removed {len(nouns) - len(rows)} grammar words")
print(f"Saved {len(rows)} nouns ({len(rows) - het} de, {het} het) to {OUT_FILE}")
