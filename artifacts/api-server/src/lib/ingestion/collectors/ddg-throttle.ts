import { search } from "duck-duck-scrape";

/**
 * duck-duck-scrape does no rate-limit handling, and DuckDuckGo trips anomaly
 * detection under bursts. The BullMQ content-ingestion worker runs many jobs
 * concurrently (QUEUE_CONCURRENCY), and both the web-search (`duckduckgo`) and
 * social-search collectors hit DDG — so without coordination a single tick can
 * fire dozens of parallel queries and get the whole process soft-blocked.
 *
 * Every DDG query in the pipeline goes through this module-level serialized
 * queue: DDG only ever sees one request at a time, spaced by at least
 * MIN_GAP_MS. Failures never break the chain (the next call still runs).
 */
const MIN_GAP_MS = 1500;

let chain: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;

export function throttledDdgSearch(
  ...args: Parameters<typeof search>
): ReturnType<typeof search> {
  const run = chain.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastCallAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
    return search(...args);
  });

  // Advance the shared chain without swallowing the caller's result or leaking
  // unhandled rejections.
  chain = run.catch(() => undefined);
  return run;
}
