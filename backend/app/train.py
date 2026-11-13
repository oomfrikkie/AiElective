import copy
import csv
import random
import torch
import torch.nn as nn
from app.model import DeHetNet, encode
from app.lesson_engine import DATA_DIR, MODEL_FILE, WORD_FILES

random.seed(42)

# ---------- 1. Load the data ----------
with open(DATA_DIR / "dehet_data.csv", encoding="utf-8") as f:
    data = [(r["word"], int(r["label"])) for r in csv.DictReader(f)]

# the lesson words stay hidden, so "follows a pattern" means the spelling gave it away,
# not that the network has seen the answer
lesson_words = {}
for level, path in WORD_FILES.items():
    with open(path, encoding="utf-8") as f:
        lesson_words[level] = [(r["word"], int(r["article"] == "het")) for r in csv.DictReader(f)]
hidden = {w for words in lesson_words.values() for w, _ in words}
data = [(w, l) for w, l in data if w not in hidden]
random.shuffle(data)

# every letter gets a number (0 = padding, 1 = unknown letter)
letters = sorted({c for w, _ in data for c in w})
vocab = {c: i + 2 for i, c in enumerate(letters)}

# ---------- 2. Split: 70% to learn from, 15% to decide when to stop, 15% to test on ----------
split1, split2 = int(len(data) * 0.7), int(len(data) * 0.85)
train, val, test = data[:split1], data[split1:split2], data[split2:]

def to_tensors(rows):
    X = torch.tensor([encode(w, vocab) for w, _ in rows])
    y = torch.tensor([[float(l)] for _, l in rows])
    return X, y

X_train, y_train = to_tensors(train)
X_val, y_val = to_tensors(val)
X_test, y_test = to_tensors(test)

# about 3 in 4 nouns are 'de': count 'het' mistakes as heavier, so the score comes from
# the spelling instead of always leaning towards 'de'
het_weight = (y_train == 0).sum() / (y_train == 1).sum()
loss_fn = nn.BCEWithLogitsLoss(pos_weight=het_weight)   # how wrong is it?

print(f"{len(train)} train / {len(val)} validation / {len(test)} test words")
print(f"Baseline (always guess 'de'): {1 - y_test.mean().item():.1%}\n")

# ---------- 3. Train one network ----------
MAX_EPOCHS, PATIENCE, BATCH = 30, 4, 256

def train_network(seed):
    torch.manual_seed(seed)
    model = DeHetNet(len(vocab) + 2)
    opt = torch.optim.Adam(model.parameters(), lr=0.001)    # how it fixes itself

    best_loss, best_state, bad_epochs = float("inf"), None, 0
    for epoch in range(MAX_EPOCHS):
        model.train()
        perm = torch.randperm(len(X_train))
        for i in range(0, len(X_train), BATCH):
            idx = perm[i:i + BATCH]
            loss = loss_fn(model(X_train[idx]), y_train[idx])
            opt.zero_grad()
            loss.backward()
            opt.step()

        # stop once it only gets better at the words it trains on
        model.eval()
        with torch.no_grad():
            val_loss = loss_fn(model(X_val), y_val).item()
        if val_loss < best_loss:
            best_loss, best_state, bad_epochs = val_loss, copy.deepcopy(model.state_dict()), 0
        else:
            bad_epochs += 1
            if bad_epochs >= PATIENCE:
                break

    model.load_state_dict(best_state)
    model.eval()
    print(f"Network {seed}: {epoch + 1} epochs, validation loss {best_loss:.3f}", flush=True)
    return model

# ---------- 4. Train several and let them vote ----------
SEEDS = [42, 1, 2, 3, 4]
networks = [train_network(seed) for seed in SEEDS]

def report(name, X, y):
    with torch.no_grad():
        p = sum(torch.sigmoid(net(X)) for net in networks) / len(networks)
    correct = ((p > 0.5).float() == y).float()
    conf = torch.max(p, 1 - p)
    print(f"\n{name}: {correct.mean().item():.1%} accurate")
    for threshold in (0.9, 0.98):
        sure = conf >= threshold
        print(f"  at least {threshold:.0%} sure: {correct[sure].mean().item():.1%} accurate, on {sure.float().mean().item():.0%} of the words")

report("Test words", X_test, y_test)
for level, words in lesson_words.items():
    report(f"{level} lesson words (never trained on)", *to_tensors(words))

# ---------- 5. Save ----------
torch.save({"states": [net.state_dict() for net in networks], "vocab": vocab}, MODEL_FILE)
print(f"\nSaved to {MODEL_FILE}")
