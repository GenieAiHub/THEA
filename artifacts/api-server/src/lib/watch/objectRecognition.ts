/**
 * Object/vehicle detection (coco-ssd) + visual-similarity embeddings (MobileNetV2)
 * on a pure-JS tfjs-core engine with the cpu backend.
 *
 * IMPORTANT: this module deliberately imports @tensorflow/tfjs-core (NOT the
 * patched @tensorflow/tfjs UMD bundle used by face-api). The @tensorflow-models
 * packages bind to tfjs-core directly, so our tensors must come from the same
 * core instance or the engine rejects them. face-api keeps its own bundled tf —
 * the two engines coexist but must never exchange tensors.
 */
import "@tensorflow/tfjs-backend-cpu";
import * as tf from "@tensorflow/tfjs-core";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import * as mobilenet from "@tensorflow-models/mobilenet";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { logger } from "../logger";
import type { RgbImage } from "./imageOps";

const here = dirname(fileURLToPath(import.meta.url));

/** MobileNetV2 (alpha 1.0) global-average-pool embedding size. */
export const OBJECT_EMBEDDING_DIM = 1280;
/** Default cosine-similarity threshold for reference-image matching. */
export const OBJECT_SIMILARITY_THRESHOLD = 0.6;
/** Minimum coco-ssd detection score to consider a box at all. */
export const DETECTION_MIN_SCORE = 0.4;

export const VEHICLE_CLASSES = new Set(["car", "truck", "bus", "motorcycle", "bicycle"]);

export interface ObjectDetection {
  class: string;
  score: number;
  bbox: [number, number, number, number]; // x, y, w, h
}

function resolveModelsDir(): string {
  const candidates = [
    join(here, "..", "..", "..", "models"), // dev: src/lib/watch -> artifacts/api-server/models
    join(here, "..", "models"),             // prod: dist -> artifacts/api-server/models
    join(process.cwd(), "models"),
    join(process.cwd(), "artifacts", "api-server", "models"),
  ];
  return candidates.find((p) => existsSync(join(p, "coco-ssd", "model.json"))) ?? candidates[0]!;
}

/** Minimal fs-backed IOHandler so graph models load from vendored weights without tfjs-node. */
function fsIOHandler(dir: string): tf.io.IOHandler {
  return {
    load: async () => {
      const modelJSON = JSON.parse(readFileSync(join(dir, "model.json"), "utf8"));
      return tf.io.getModelArtifactsForJSON(modelJSON, async (weightsManifest) => {
        const specs: tf.io.WeightsManifestEntry[] = [];
        const buffers: Buffer[] = [];
        for (const group of weightsManifest) {
          specs.push(...group.weights);
          for (const p of group.paths) buffers.push(readFileSync(join(dir, p)));
        }
        const total = Buffer.concat(buffers);
        const ab = total.buffer.slice(total.byteOffset, total.byteOffset + total.byteLength);
        return [specs, ab as ArrayBuffer];
      });
    },
  };
}

let detector: cocoSsd.ObjectDetection | null = null;
let embedder: mobilenet.MobileNet | null = null;
let loadPromise: Promise<void> | null = null;

/** Serialize inference: the cpu backend blocks the event loop. */
let inferenceQueue: Promise<unknown> = Promise.resolve();
function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = inferenceQueue.then(fn, fn);
  inferenceQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function load(): Promise<void> {
  await tf.setBackend("cpu");
  await tf.ready();
  const modelsDir = resolveModelsDir();
  detector = await cocoSsd.load({
    modelUrl: fsIOHandler(join(modelsDir, "coco-ssd")) as unknown as string,
  });
  embedder = await mobilenet.load({
    version: 2,
    alpha: 1.0,
    modelUrl: fsIOHandler(join(modelsDir, "mobilenet")) as unknown as string,
    inputRange: [0, 1],
  });
  logger.info({ modelsDir, backend: tf.getBackend() }, "Object recognition models loaded");
}

/** Idempotently load coco-ssd + mobilenet from the vendored weights. */
export function initObjectRecognition(): Promise<void> {
  if (!loadPromise) loadPromise = load();
  return loadPromise;
}

function toTensor(img: RgbImage): tf.Tensor3D {
  return tf.tensor3d(img.data, [img.height, img.width, 3], "int32");
}

/** Detect objects in a frame. Serialized; ~2s/frame on CPU. */
export async function detectObjects(img: RgbImage, maxBoxes = 20): Promise<ObjectDetection[]> {
  await initObjectRecognition();
  return runExclusive(async () => {
    const t = toTensor(img);
    try {
      const results = await detector!.detect(t as unknown as Parameters<cocoSsd.ObjectDetection["detect"]>[0], maxBoxes, DETECTION_MIN_SCORE);
      return results.map((r) => ({ class: r.class, score: r.score, bbox: r.bbox as [number, number, number, number] }));
    } finally {
      t.dispose();
    }
  });
}

/** Compute a 1280-d MobileNetV2 embedding for an image (typically a crop). Serialized. */
export async function computeObjectEmbedding(img: RgbImage): Promise<number[]> {
  await initObjectRecognition();
  return runExclusive(async () => {
    const t = toTensor(img);
    let emb: tf.Tensor | null = null;
    try {
      emb = embedder!.infer(t as unknown as Parameters<mobilenet.MobileNet["infer"]>[0], true) as tf.Tensor;
      const data = await emb.data();
      return Array.from(data);
    } finally {
      emb?.dispose();
      t.dispose();
    }
  });
}

/** Cosine similarity between two embeddings. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
