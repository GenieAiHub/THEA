/**
 * Licence-plate OCR via tesseract.js (WASM) with vendored eng.traineddata.
 * One long-lived worker; recognition is serialized by tesseract.js internally.
 */
import { createWorker, PSM, type Worker } from "tesseract.js";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { logger } from "../logger";

const here = dirname(fileURLToPath(import.meta.url));

function resolveTessdataDir(): string {
  const candidates = [
    join(here, "..", "..", "..", "models", "tessdata"),
    join(here, "..", "models", "tessdata"),
    join(process.cwd(), "models", "tessdata"),
    join(process.cwd(), "artifacts", "api-server", "models", "tessdata"),
  ];
  return candidates.find((p) => existsSync(join(p, "eng.traineddata.gz"))) ?? candidates[0]!;
}

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const langPath = resolveTessdataDir();
      const worker = await createWorker("eng", 1, {
        langPath,
        gzip: true,
        cachePath: "/tmp/thea-tessdata-cache",
        logger: () => undefined,
      });
      await worker.setParameters({
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ",
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      });
      logger.info({ langPath }, "Plate OCR worker ready");
      return worker;
    })();
    workerPromise.catch((err) => {
      logger.warn({ err }, "Plate OCR worker failed to initialize");
      workerPromise = null;
    });
  }
  return workerPromise;
}

export interface PlateCandidate {
  text: string; // normalized
  confidence: number; // 0..1
}

/** Uppercase and strip everything but A-Z0-9. */
export function normalizePlate(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Fold visually-ambiguous characters so OCR confusions still match. */
function foldAmbiguous(plate: string): string {
  return plate
    .replace(/O/g, "0")
    .replace(/Q/g, "0")
    .replace(/I/g, "1")
    .replace(/L/g, "1")
    .replace(/B/g, "8")
    .replace(/S/g, "5")
    .replace(/Z/g, "2")
    .replace(/G/g, "6");
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]!;
  }
  return prev[n]!;
}

/** Fuzzy plate comparison: fold ambiguous glyphs, allow edit distance <= 1. */
export function platesMatch(candidate: string, target: string): boolean {
  const c = foldAmbiguous(normalizePlate(candidate));
  const t = foldAmbiguous(normalizePlate(target));
  if (c.length < 4 || t.length < 4) return c === t && c.length > 0;
  return levenshtein(c, t) <= 1;
}

/**
 * OCR a (pre-processed, upscaled) crop and extract plate-like tokens
 * (4-10 alphanumeric chars after normalization).
 */
export async function recognizePlateCandidates(jpegBuffer: Buffer): Promise<PlateCandidate[]> {
  let worker: Worker;
  try {
    worker = await getWorker();
  } catch {
    return [];
  }
  try {
    const { data } = await worker.recognize(jpegBuffer);
    const overall = (data.confidence ?? 0) / 100;
    const rawTokens = (data.text ?? "")
      .split(/\s+/)
      .map((t) => normalizePlate(t))
      .filter((t) => t.length > 0);
    const tokens = rawTokens.filter((t) => t.length >= 4 && t.length <= 10);
    // OCR often splits plates across tokens ("0 M677", "ABC 1234") — join
    // sliding windows of 2-3 adjacent tokens as extra candidates.
    for (let i = 0; i < rawTokens.length; i++) {
      for (const span of [2, 3]) {
        if (i + span > rawTokens.length) continue;
        const joined = rawTokens.slice(i, i + span).join("");
        if (joined.length >= 4 && joined.length <= 10) tokens.push(joined);
      }
    }
    // Also try joining everything ("A BC 12 34" -> "ABC1234")
    const joinedAll = normalizePlate((data.text ?? "").replace(/\s+/g, ""));
    if (joinedAll.length >= 4 && joinedAll.length <= 10) tokens.push(joinedAll);
    const unique = [...new Set(tokens)];
    return unique.map((text) => ({ text, confidence: overall }));
  } catch (err) {
    logger.warn({ err }, "Plate OCR recognition failed");
    return [];
  }
}

export async function closePlateOcr(): Promise<void> {
  if (!workerPromise) return;
  try {
    const worker = await workerPromise;
    await worker.terminate();
  } catch {
    /* ignore */
  }
  workerPromise = null;
}
