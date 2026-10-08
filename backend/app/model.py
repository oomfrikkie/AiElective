import torch
import torch.nn as nn

MAX_LEN = 12  # only look at the last 12 letters, endings matter most


def encode(word, vocab):
    """Turn a word into a list of numbers the network can read."""
    chars = word.lower()[-MAX_LEN:]
    ids = [vocab.get(c, 1) for c in chars]       # each letter -> its number (1 = unknown letter)
    return [0] * (MAX_LEN - len(ids)) + ids      # pad on the left with 0 so all words are 12 long


class DeHetNet(nn.Module):
    def __init__(self, vocab_size):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, 32, padding_idx=0)  # letter -> 32 numbers describing it
        self.gru = nn.GRU(32, 64, batch_first=True)               # reads the letters one by one, in order
        self.out = nn.Linear(64, 1)                               # squeezes it all into one score

    def forward(self, x):
        x = self.embed(x)
        _, hidden = self.gru(x)       # hidden = what the GRU "remembers" after the last letter
        return self.out(hidden[-1])   # raw score: low = de, high = het
