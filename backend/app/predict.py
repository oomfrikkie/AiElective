from app.model import load_networks, het_probability

networks, vocab = load_networks("/app/data/dehet_model.pt")

def predict(word):
    p = het_probability(networks, vocab, word)
    article = "het" if p > 0.5 else "de"
    confidence = p if p > 0.5 else 1 - p
    return article, confidence

while True:
    word = input("Word (or q to quit): ").strip()
    if word == "q":
        break
    article, conf = predict(word)
    print(f"  -> {article} {word}  ({conf:.0%} sure)\n")
