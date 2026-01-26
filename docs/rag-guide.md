# RAG (Retrieval-Augmented Generation) Guide

A practical guide to building RAG pipelines, covering embeddings, chunking strategies, prompt engineering, re-ranking, and hybrid search.

## Table of Contents

- [Embedding Fundamentals](#embedding-fundamentals)
- [Chunking Strategies](#chunking-strategies)
- [Prompt Engineering for Generation](#prompt-engineering-for-generation)
- [Re-ranking Strategies](#re-ranking-strategies)
- [Hybrid Search](#hybrid-search)
- [Index Structure Strategies](#index-structure-strategies)
- [Search Strategies](#search-strategies)

---

## Embedding Fundamentals

An embedding is a vector (array of numbers) that represents the **meaning** of text in a high-dimensional space.

```typescript
const text = "I led a team to migrate our codebase to TypeScript"
const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: text
});
// Returns: [0.023, -0.041, 0.089, ..., 0.012]  // 1536 numbers
```

Each dimension captures some aspect of meaning. The model learned these during training on billions of text examples.

### Why It Works

Semantically similar texts end up **close together** in this space:

```
"I showed ownership by fixing the production bug"
    ↓
[0.02, 0.05, 0.11, ...]  ← vectors are close

"I took initiative to resolve a critical system issue"
    ↓
[0.03, 0.04, 0.10, ...]  ← similar meaning = similar vectors
```

Unrelated texts are far apart:

```
"My favorite pizza topping is pepperoni"
    ↓
[0.91, -0.23, 0.44, ...]  ← very different vector
```

### Cosine Similarity

Measures the **angle** between two vectors, ignoring magnitude:

```
similarity = cos(θ) = (A · B) / (|A| × |B|)
```

- **1.0** = identical direction (same meaning)
- **0.0** = perpendicular (unrelated)
- **-1.0** = opposite (rare for text)

In pgvector, `<=>` is the **distance** operator (1 - similarity), so we sort ascending:

```sql
ORDER BY vector <=> query_vector  -- smaller distance = more similar
```

### Dimension Trade-offs

| Model | Dimensions | Quality | Cost |
|-------|------------|---------|------|
| text-embedding-3-small | 1536 | Good | $0.02/1M tokens |
| text-embedding-3-large | 3072 | Better | $0.13/1M tokens |

More dimensions = more nuance captured, but larger storage and slower search.

---

## Chunking Strategies

Embeddings work best on focused, coherent text. A 5000-word document embedded as one vector loses nuance—the vector becomes an "average" of everything.

### When to Chunk

| Scenario | Approach |
|----------|----------|
| Short, focused content (< 500 tokens) | Embed whole |
| Long documents | Chunk into 200-500 token pieces |
| Structured data (experiences) | Embed whole (already concise) |
| Narrative content (stories) | Might benefit from chunking if very long |

### Chunking Methods

**1. Fixed-size chunks:**
```typescript
const chunks = splitByTokens(text, 500);
```
Simple but might split mid-sentence.

**2. Semantic chunking:**
```typescript
const chunks = splitByParagraphs(text);
// or splitBySections(text);
```
Respects natural boundaries.

**3. Overlapping windows:**
```typescript
// 500 tokens each, with 50 token overlap
chunks = [
  tokens[0:500],
  tokens[450:950],  // overlaps with previous
  tokens[900:1400],
  ...
]
```
Preserves context across boundaries. Costs more storage.

---

## Prompt Engineering for Generation

The final step: you have retrieved chunks, now the LLM answers based on them.

### Anatomy of a RAG Prompt

```typescript
const systemPrompt = `You are answering questions about ${user.name}'s professional background.
Use ONLY the provided context to answer. If the context doesn't contain
relevant information, say so honestly.

Context:
${chunks.map(c => c.chunk).join('\n\n---\n\n')}
`;

const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: recruiterQuestion }
  ]
});
```

### Key Principles

**1. Ground the model:**
```
"Use ONLY the provided context..."
```
Prevents hallucination. The model might have general knowledge about the person (if famous), but you want it to use YOUR data.

**2. Handle missing info gracefully:**
```
"If the context doesn't contain relevant information, say 'I don't have specific information about that...'"
```

**3. Set the persona:**
- Coaching chat = first person, exploratory
- Profile chat = third person, informative

**4. Include source types:**
```typescript
const contextWithSources = chunks.map(c =>
  `[${c.type.toUpperCase()}] ${c.chunk}`
).join('\n\n');
```
Helps the model understand what kind of information it's working with.

### Advanced: Citation

```typescript
const systemPrompt = `
When answering, cite which experiences or stories you're drawing from.
Example: "During their time at daily.dev (Senior Engineer), they led..."
`;
```

---

## Re-ranking Strategies

Initial vector retrieval gets you candidates. Re-ranking improves precision.

### Cross-Encoder Re-ranking

After vector search returns top 20, use a cross-encoder to re-score:

```typescript
// 1. Vector search (fast, approximate)
const candidates = await vectorSearch(query, limit: 20);

// 2. Cross-encoder scoring (slow, precise)
const reranked = await crossEncoder.rank(query, candidates);

// 3. Take top 5 after re-ranking
const final = reranked.slice(0, 5);
```

**Why it's better:** Bi-encoders (embedding models) encode query and document separately. Cross-encoders see both together, catching nuance.

**Trade-off:** 10-100x slower than vector search. Only viable for small candidate sets.

### LLM-based Re-ranking

Use GPT to judge relevance:

```typescript
const prompt = `Rate 1-10 how relevant this chunk is to answering: "${query}"
Chunk: ${chunk}`;

const score = await llm.generate(prompt);
```

Expensive but very accurate.

### Reciprocal Rank Fusion (RRF)

Combine rankings from multiple sources:

```typescript
// Vector search ranking
const vectorRanks = { docA: 1, docB: 2, docC: 3 };

// Keyword search ranking
const keywordRanks = { docB: 1, docA: 3, docD: 2 };

// RRF score = sum(1 / (k + rank)) across all rankings
// Higher score = better
const rrfScore = (doc) =>
  (1 / (60 + vectorRanks[doc])) + (1 / (60 + keywordRanks[doc]));
```

---

## Hybrid Search

Combines vector (semantic) and keyword (lexical) search.

### Why Hybrid?

**Vector search weakness:** Misses exact matches.
- Query: "TypeScript migration at daily.dev"
- Vector might return "JavaScript refactoring at a startup" (semantically similar)
- But misses documents that literally mention "daily.dev"

**Keyword search weakness:** Misses synonyms.
- Query: "bug fixes"
- Keyword misses "issue resolution" or "defect remediation"

**Hybrid:** Best of both.

### Implementation Options

**1. Parallel search + merge:**
```typescript
const vectorResults = await vectorSearch(query);
const keywordResults = await keywordSearch(query);
const merged = rrf(vectorResults, keywordResults);
```

**2. pgvector + pg_trgm:**
```sql
SELECT *,
  (0.7 * vector_similarity) + (0.3 * text_similarity) as combined_score
FROM chunks
WHERE text ILIKE '%keyword%' OR vector <=> query < 0.5
ORDER BY combined_score DESC
```

**3. Full-text search + vector:**
```sql
-- PostgreSQL full-text + pgvector
SELECT *,
  ts_rank(to_tsvector(chunk), plainto_tsquery('ownership leadership')) as text_rank,
  1 - (vector <=> query_vector) as vector_rank
FROM story_index
WHERE to_tsvector(chunk) @@ plainto_tsquery('ownership leadership')
ORDER BY (text_rank * 0.3 + vector_rank * 0.7) DESC
```

### When to Use Hybrid

| Use Case | Recommendation |
|----------|---------------|
| Named entities (companies, people) | Hybrid (keywords matter) |
| Conceptual queries ("leadership") | Pure vector |
| Exact phrases ("managed a team of 5") | Hybrid or keyword |
| Profile chat | Start with vector, add hybrid if retrieval quality issues |

---

## Index Structure Strategies

### Single Table vs Multiple Tables

**Single unified table:**
```
profileIndex
├── sourceType: 'story' | 'experience' | 'skill' | ...
├── sourceId
├── chunk
└── vector
```

Good when:
- You want simpler queries (no UNION)
- All sources have similar update patterns
- You might add many source types later

Problem:
- Different sources may need different versioning
- Harder to delete/reindex just one type
- Mixed metadata structures

**Separate tables:**
```
storyIndex      → story-specific versioning, metadata
experienceIndex → experience-specific metadata
```

Good when:
- Sources have different lifecycles
- You want to reindex one type without touching others
- Each has distinct metadata needs

The tradeoff is query complexity (UNION), but SQL handles this well.

---

## Search Strategies

### Strategy 1: Pure Similarity

```sql
SELECT * FROM (
  SELECT 'story', chunk, similarity FROM storyIndex
  UNION ALL
  SELECT 'experience', chunk, similarity FROM experienceIndex
)
ORDER BY similarity DESC
LIMIT 5
```

Vector similarity is the only ranking factor. If an experience is more semantically similar to the query than a story, it surfaces first.

### Strategy 2: Weighted Blend

```sql
SELECT * FROM (
  SELECT 'story', similarity * 1.2 AS boosted_similarity FROM storyIndex  -- boost stories
  UNION ALL
  SELECT 'experience', similarity * 0.9 FROM experienceIndex
)
ORDER BY boosted_similarity DESC
```

Use when you believe one source type is always more valuable.

### Strategy 3: Source-Aware Limits

```sql
(SELECT * FROM storyIndex ORDER BY similarity LIMIT 3)
UNION ALL
(SELECT * FROM experienceIndex ORDER BY similarity LIMIT 2)
```

Guarantees diversity in context. But you lose "best overall" ranking.

### Strategy 4: Two-Phase Retrieval

```
Phase 1: Get top experience (high-level context)
Phase 2: Get top stories related to that experience
```

Use when a query mentions a specific role—first find the experience, then find stories linked to it.

### Strategy 5: Metadata Pre-Filtering

```sql
WHERE metadata->>'type' = 'work' AND metadata->>'skills' @> '["TypeScript"]'
ORDER BY similarity
```

If the query mentions specific skills or job types, filter before similarity search. More efficient and precise.

---

## RAG Pipeline Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    INDEXING (Offline)                        │
├─────────────────────────────────────────────────────────────┤
│  Source Docs → Chunking → Embedding → Vector Store          │
│                                                              │
│  story.content ──→ storyIndex (chunk, vector, metadata)     │
│  experience    ──→ experienceIndex (chunk, vector, metadata)│
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   RETRIEVAL (Query Time)                     │
├─────────────────────────────────────────────────────────────┤
│  User Query → Embed Query → Vector Similarity → Top-K       │
│                                                              │
│  "What are their strengths?"                                │
│       ↓                                                      │
│  [0.02, 0.05, ...]                                          │
│       ↓                                                      │
│  UNION search across indices                                 │
│       ↓                                                      │
│  Top 5 chunks by similarity                                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   GENERATION (Query Time)                    │
├─────────────────────────────────────────────────────────────┤
│  Top-K Chunks + Query → LLM → Grounded Answer               │
│                                                              │
│  System: "Answer based on: [EXPERIENCE] Senior Engineer..." │
│  User: "What are their strengths?"                          │
│  Assistant: "Based on their experience at daily.dev..."     │
└─────────────────────────────────────────────────────────────┘
```
