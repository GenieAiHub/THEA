---
name: Gemini Google Search grounding
description: How to do live Google Search grounding with the deprecated @google/generative-ai SDK, and its dedup caveats
---

# Gemini Google Search grounding

Grounding = Gemini runs live Google searches server-side and returns a synthesized
answer + grounding metadata (source chunks + which sentence each supports). This is
the only true live-web path from Gemini; a plain chat call has no internet.

**Rule: use the `googleSearch` tool with a Gemini 2.x model, NOT `googleSearchRetrieval`.**
- `googleSearchRetrieval` is the retired 1.x-only tool. The 1.x model line itself is
  retired from the public Gemini API — pinning to 1.5 makes every grounded call 404,
  and the collector swallows it (warn + return []), so the feature silently yields
  zero data forever. If a configured default model contains "1.5"/"1.0", bump it to
  a 2.x model (default `gemini-2.0-flash`).

**Why no second SDK:** the installed `@google/generative-ai` (0.24.x) `Tool` type
predates `googleSearch`, but the SDK forwards `tools` verbatim into the REST body
(no validation/stripping). So `tools: [{ googleSearch: {} }] as unknown as Tool[]`
works — no need to add `@google/genai`.

**Response shape (2.x runtime):** `candidates[0].groundingMetadata` has
`groundingChunks[].web.{uri,title}` and `groundingSupports[].{segment:{text}, groundingChunkIndices}`.
The SDK's TS types for these are wrong/misspelled (`groundingChunckIndices`, `segment`
typed as string) — cast to a local runtime interface with the correct names.

**Dedup / quality caveats (surface to user):**
- The pipeline dedups on exact body-hash. Gemini re-synthesizes text every run, so the
  same story produces fresh (paraphrased) bodies each cycle → not deduped across runs.
  It raises the ingestion baseline rather than causing false spikes (volume is steady),
  but it is not a clean 1:1 article source. Best treated as a discovery/trending signal.
- Grounding chunk URIs are `vertexaisearch` redirect URLs with ephemeral tokens: they
  change every call, expire (~30d), and hide the real domain — low-quality as stored
  `sourceUrl` and useless for cross-run URI-based dedup.

**Can't live-test here:** no GEMINI_API_KEY in this env; correctness verified by SDK
pass-through inspection + typecheck only. One live grounded call should be confirmed
once an operator sets a key.
