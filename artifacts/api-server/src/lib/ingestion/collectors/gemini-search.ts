import type { NormalizedItem } from "../types";
import { logger } from "../../logger";
import { extractHashtags, logTrending } from "./hashtags";
import { geminiGroundedSearch } from "../../llm";

const MAX_ITEMS = 8;

/**
 * Gemini + Google Search grounding as a data collector. Gemini runs live Google
 * searches server-side for the keyword and returns grounded claims with their
 * source URLs; we turn each grounded sentence into a NormalizedItem tagged with
 * its source. This is genuine current-web data (not the model's memory).
 *
 * Needs a Gemini API key (Super Admin → API Keys). Unlike the keyless search
 * collectors this is an LLM call (billable), so it's scheduled/triggered with
 * attempts:1 and the worker skips it when no key is configured.
 */
export async function collectGeminiSearch(keyword: string, category: string): Promise<NormalizedItem[]> {
  if (!keyword) return [];

  try {
    const prompt =
      `Use Google Search to find the most recent and relevant news, social-media posts, ` +
      `and public discussion about "${keyword}" in the ${category} space over the last few days. ` +
      `Report the concrete developments with specific facts, names, and figures.`;

    const res = await geminiGroundedSearch(prompt, { operation: "ingestion-gemini-search" });

    const items: NormalizedItem[] = [];
    const seen = new Set<string>();

    // Each grounding "support" is a distinct grounded sentence + the source(s)
    // it came from — the cleanest per-item mapping (distinct bodies dedup well).
    for (const sup of res.supports) {
      const body = sup.text.trim();
      // pipeline.ts drops bodies < 10 chars before hashing — skip early.
      if (body.length < 10 || seen.has(body)) continue;
      seen.add(body);

      const src = sup.sourceIndices.map((i) => res.sources[i]).find(Boolean);

      items.push({
        platform: "gemini-search",
        sourceUrl: src?.uri || `gemini-search://${encodeURIComponent(keyword)}`,
        title: src?.title ?? null,
        body,
        author: src?.title ?? null,
        publishedAt: null,
        language: "en",
        category,
        engagementMetrics: {},
        rawMetadata: {
          keyword,
          engine: "gemini-search",
          hashtags: extractHashtags(body),
          sources: res.sources,
          webSearchQueries: res.webSearchQueries,
        },
      });
      if (items.length >= MAX_ITEMS) break;
    }

    // Fallback: grounding returned no per-sentence supports but we still got a
    // synthesized answer — store it as a single item.
    if (!items.length) {
      const body = res.text.trim();
      if (body.length >= 10) {
        items.push({
          platform: "gemini-search",
          sourceUrl: res.sources[0]?.uri || `gemini-search://${encodeURIComponent(keyword)}`,
          title: res.sources[0]?.title ?? `Gemini search: ${keyword}`,
          body: body.slice(0, 2000),
          author: res.sources[0]?.title ?? null,
          publishedAt: null,
          language: "en",
          category,
          engagementMetrics: {},
          rawMetadata: {
            keyword,
            engine: "gemini-search",
            hashtags: extractHashtags(body),
            sources: res.sources,
            webSearchQueries: res.webSearchQueries,
          },
        });
      }
    }

    if (items.length) logTrending("gemini-search", category, items);
    logger.info(
      { keyword, category, fetched: items.length, sources: res.sources.length },
      "Gemini grounded search collection complete",
    );
    return items;
  } catch (err) {
    logger.warn({ err, keyword }, "Gemini grounded search failed");
    return [];
  }
}
