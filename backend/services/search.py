"""Local "semantic-ish" search over short text documents.

This replaces plain substring/regex matching with TF-IDF + cosine
similarity, computed in-process over the (small, per-user) memory set.
It's not true embedding-based semantic search — that needs an embedding
model and a vector DB, which is a bigger infrastructure decision the app
owner should make deliberately (self-hosted model? paid API? which
vector store?). This gets meaningfully better recall/ranking than regex
today, entirely offline, with zero new dependencies or API keys.
"""
import math
import re
from collections import Counter

_WORD_RE = re.compile(r"[a-zA-Z0-9']+")

_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "to", "of", "and", "or", "in", "on", "at", "for", "with", "about",
    "it", "this", "that", "my", "me", "i", "you", "your", "we", "our",
}


def _tokenize(text: str) -> list[str]:
    return [w.lower() for w in _WORD_RE.findall(text or "") if w.lower() not in _STOPWORDS]


def rank_by_relevance(query: str, documents: list[dict], text_fields: tuple[str, ...]) -> list[dict]:
    """documents: list of dicts, each with the given text_fields (e.g.
    ("title", "content")) and a "tags" list (used as extra weighted terms).
    Returns the same dicts (unmodified) re-ordered by relevance, most
    relevant first. Documents with zero overlap with the query are
    dropped."""
    q_tokens = _tokenize(query)
    if not q_tokens or not documents:
        return documents

    doc_tokens: list[list[str]] = []
    for doc in documents:
        tokens: list[str] = []
        for field in text_fields:
            tokens.extend(_tokenize(str(doc.get(field, ""))))
        for tag in (doc.get("tags") or []):
            # tags are a strong signal — count them extra
            tokens.extend(_tokenize(str(tag)) * 3)
        doc_tokens.append(tokens)

    n_docs = len(doc_tokens)
    df = Counter()
    for tokens in doc_tokens:
        for term in set(tokens):
            df[term] += 1

    def idf(term: str) -> float:
        return math.log((1 + n_docs) / (1 + df.get(term, 0))) + 1

    q_vec = Counter(q_tokens)

    scored: list[tuple[float, dict]] = []
    for doc, tokens in zip(documents, doc_tokens):
        if not tokens:
            continue
        d_vec = Counter(tokens)
        dot = sum(q_vec[t] * d_vec.get(t, 0) * idf(t) for t in q_vec)
        if dot <= 0:
            continue
        q_norm = math.sqrt(sum((c * idf(t)) ** 2 for t, c in q_vec.items())) or 1
        d_norm = math.sqrt(sum((c * idf(t)) ** 2 for t, c in d_vec.items())) or 1
        score = dot / (q_norm * d_norm)
        scored.append((score, doc))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [doc for _, doc in scored]
