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
        self.embed = nn.Embedding(vocab_size, 48, padding_idx=0)  # letter -> 48 numbers describing it
        self.gru = nn.GRU(48, 128, num_layers=2, dropout=0.3,     # reads the letters in both directions
                          bidirectional=True, batch_first=True)
        self.drop = nn.Dropout(0.3)                               # forget a little, so it can't just memorize
        self.out = nn.Linear(256, 1)                              # squeezes it all into one score

    def forward(self, x):
        x = self.embed(x)
        _, hidden = self.gru(x)                          # what the GRU "remembers" after reading the word
        both = torch.cat([hidden[-2], hidden[-1]], 1)    # the forwards and the backwards reading
        return self.out(self.drop(both))                 # raw score: low = de, high = het


def load_networks(path):
    """Load all the trained networks. They vote together, see het_probability."""
    saved = torch.load(path)
    vocab = saved["vocab"]
    networks = []
    for state in saved["states"]:
        net = DeHetNet(len(vocab) + 2)
        net.load_state_dict(state)
        net.eval()
        networks.append(net)
    return networks, vocab


def het_probability(networks, vocab, word):
    """Average the networks: a single one has its own quirks about borderline words."""
    x = torch.tensor([encode(word, vocab)])
    with torch.no_grad():
        return sum(torch.sigmoid(net(x)).item() for net in networks) / len(networks)
