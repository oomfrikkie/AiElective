from datetime import datetime
from app.lesson_engine import (
    load_words, load_history, save_history,
    build_lesson, compare, ai_hint, gemini_tips,
)

words = load_words()
history = load_history()
groups, last_wrong = build_lesson(words, history)

print(f"\n=== De or het? Lesson {len(history['lessons']) + 1} ===")
if last_wrong:
    print(f"{len(last_wrong)} words from last time are coming back.")
print("For each round, type d or h for every word, like: dhdd\n")

results = []

for i, group in enumerate(groups, 1):
    print(f"Round {i}/{len(groups)}")
    for n, w in enumerate(group, 1):
        print(f"  {n}. ___ {w}  ({words[w]['english']})")

    while True:
        answer = input("  Your answers: ").strip().lower()
        if len(answer) == len(group) and all(c in "dh" for c in answer):
            break
        print(f"  Type exactly {len(group)} letters, only d or h.")

    for w, a in zip(group, answer):
        guess = "de" if a == "d" else "het"
        real = words[w]["article"]
        ok = guess == real
        results.append({"word": w, "guess": guess, "correct": ok})
        print(f"    {'OK' if ok else 'X '}  {real} {w}")
    print()

# ---------- Results ----------
report = compare(history, results, last_wrong)
print(f"Score: {report['score']}/{report['total']}")

if report["previous"] is not None:
    diff = report["score"] - report["previous"]
    sign = "+" if diff >= 0 else ""
    print(f"Last lesson: {report['previous']}/{report['total']}  ({sign}{diff})")
if report["fixed"]:
    print(f"Fixed since last time: {', '.join(report['fixed'])}")
if report["still_wrong"]:
    print(f"Still tricky: {', '.join(report['still_wrong'])}")

# ---------- Mistakes, explained by both AIs ----------
mistakes = [
    {**words[r["word"]], "guess": r["guess"]}
    for r in results if not r["correct"]
]

if mistakes:
    print("\nLet's look at your mistakes...")
    tips = gemini_tips(mistakes)
    for m in mistakes:
        print(f"\n  {m['article']} {m['word']} ({m['english']})")
        print(f"    Pattern AI: {ai_hint(m['word'], m['article'])}")
        if m["word"] in tips:
            print(f"    Teacher:    {tips[m['word']]}")
    print("\nThese will come back next lesson.")
else:
    print("\nPerfect! Next lesson will be all new words.")

history["lessons"].append({"date": datetime.now().isoformat(), "results": results})
save_history(history)
