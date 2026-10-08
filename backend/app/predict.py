import torch
from app.model import DeHetNet, encode

saved = torch.load("/app/data/dehet_model.pt")
vocab = saved["vocab"]

model = DeHetNet(len(vocab) + 2)
model.load_state_dict(saved["state"])
model.eval()

def predict(word):
    with torch.no_grad():
        p = torch.sigmoid(model(torch.tensor([encode(word, vocab)]))).item()
    article = "het" if p > 0.5 else "de"
    confidence = p if p > 0.5 else 1 - p
    return article, confidence

while True:
    word = input("Word (or q to quit): ").strip()
    if word == "q":
        break
    article, conf = predict(word)
    print(f"  -> {article} {word}  ({conf:.0%} sure)\n")
