import csv
import random
import torch
import torch.nn as nn
from app.model import DeHetNet, encode

random.seed(42)
torch.manual_seed(42)

# ---------- 1. Load the data ----------
with open("/app/data/dehet_data.csv", encoding="utf-8") as f:
    data = [(r["word"], int(r["label"])) for r in csv.DictReader(f)]
random.shuffle(data)

# every letter gets a number (0 = padding, 1 = unknown letter)
letters = sorted({c for w, _ in data for c in w})
vocab = {c: i + 2 for i, c in enumerate(letters)}

# ---------- 2. Split: 80% to learn from, 20% to test on ----------
split = int(len(data) * 0.8)
train, test = data[:split], data[split:]

def to_tensors(rows):
    X = torch.tensor([encode(w, vocab) for w, _ in rows])
    y = torch.tensor([[float(l)] for _, l in rows])
    return X, y

X_train, y_train = to_tensors(train)
X_test, y_test = to_tensors(test)

# ---------- 3. Set up the network ----------
model = DeHetNet(len(vocab) + 2)
loss_fn = nn.BCEWithLogitsLoss()                        # how wrong is it?
opt = torch.optim.Adam(model.parameters(), lr=0.001)    # how it fixes itself

def accuracy(X, y):
    model.eval()
    with torch.no_grad():
        preds = (torch.sigmoid(model(X)) > 0.5).float()
    model.train()
    return (preds == y).float().mean().item()

baseline = 1 - y_test.mean().item()
print(f"{len(train)} train / {len(test)} test words")
print(f"Baseline (always guess 'de'): {baseline:.1%}\n")

# ---------- 4. Train ----------
EPOCHS, BATCH = 15, 256
for epoch in range(EPOCHS):
    perm = torch.randperm(len(X_train))
    for i in range(0, len(X_train), BATCH):
        idx = perm[i:i + BATCH]
        loss = loss_fn(model(X_train[idx]), y_train[idx])
        opt.zero_grad()
        loss.backward()
        opt.step()
    print(f"Epoch {epoch + 1:2}/{EPOCHS}  loss {loss.item():.3f}  test accuracy {accuracy(X_test, y_test):.1%}")

# ---------- 5. Save ----------
torch.save({"state": model.state_dict(), "vocab": vocab}, "/app/data/dehet_model.pt")
print("\nSaved to /app/data/dehet_model.pt")
