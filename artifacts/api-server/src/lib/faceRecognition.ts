// tfPatch MUST be imported before face-api so the @tensorflow/tfjs redirect is
// installed before face-api's top-level require runs (dev/tsx runtime only).
import "./tfPatch";
import * as faceapi from "@vladmandic/face-api/dist/face-api.node-wasm.js";
import jpeg from "jpeg-js";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { logger } from "./logger";

const here = dirname(fileURLToPath(import.meta.url));

interface DisposableTensor {
  dispose(): void;
}

// face-api's bundled `tf` typings only surface a subset of the runtime API, so we
// describe the handful of methods we actually use.
interface TfLike {
  setBackend(name: string): Promise<boolean>;
  ready(): Promise<void>;
  getBackend(): string;
  tensor3d(data: Uint8Array | number[], shape: [number, number, number]): DisposableTensor;
  zeros(shape: number[]): DisposableTensor;
}

function tf(): TfLike {
  return faceapi.tf as unknown as TfLike;
}

/**
 * Locate the model weights directory. Depth differs between dev (src/lib/*) and the
 * production bundle (dist/index.mjs), so probe a few candidates for the detector manifest.
 */
function resolveModelsDir(): string {
  const candidates = [
    join(here, "..", "..", "models"), // dev: src/lib -> artifacts/api-server/models
    join(here, "..", "models"),       // prod: dist    -> artifacts/api-server/models
    join(process.cwd(), "models"),
    join(process.cwd(), "artifacts", "api-server", "models"),
  ];
  const marker = "tiny_face_detector_model-weights_manifest.json";
  return candidates.find((p) => existsSync(join(p, marker))) ?? candidates[0]!;
}

// L2 distance threshold: same-person descriptors measure ~0.06, different people ~0.81.
// 0.55 cleanly separates the two while tolerating pose/lighting variation.
export const FACE_MATCH_THRESHOLD = 0.55;
const DETECTOR_INPUT_SIZE = 416;
const DETECTOR_SCORE_THRESHOLD = 0.4;

let loadPromise: Promise<void> | null = null;

/** Serialize all inference: the CPU backend blocks the event loop (~2-4s/image). */
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
  const t = tf();
  await t.setBackend("cpu");
  await t.ready();

  const modelsDir = resolveModelsDir();
  await faceapi.nets.tinyFaceDetector.loadFromDisk(modelsDir);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsDir);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsDir);

  // Warm up the graph so the first real request isn't penalised.
  const warm = t.zeros([DETECTOR_INPUT_SIZE, DETECTOR_INPUT_SIZE, 3]);
  try {
    const opt = new faceapi.TinyFaceDetectorOptions({
      inputSize: DETECTOR_INPUT_SIZE,
      scoreThreshold: DETECTOR_SCORE_THRESHOLD,
    });
    await faceapi.detectSingleFace(warm as unknown as faceapi.TNetInput, opt).withFaceLandmarks().withFaceDescriptor();
  } catch {
    /* warmup best-effort */
  } finally {
    warm.dispose();
  }

  logger.info({ backend: t.getBackend(), modelsDir }, "Face recognition models loaded");
}

/** Idempotently load the models (call at startup and lazily before first use). */
export function initFaceRecognition(): Promise<void> {
  if (!loadPromise) loadPromise = load();
  return loadPromise;
}

export interface DescriptorResult {
  descriptor: number[];
  score: number;
}

/**
 * Decode a JPEG buffer, detect the single most-prominent face and return its
 * 128-d descriptor. Returns null when no face is detected. Inference is serialized.
 */
export async function computeDescriptor(jpegBuffer: Buffer): Promise<DescriptorResult | null> {
  await initFaceRecognition();
  return runExclusive(async () => {
    const t = tf();
    const decoded = jpeg.decode(jpegBuffer, { useTArray: true, maxMemoryUsageInMB: 1024 });
    const { data, width, height } = decoded;

    // Strip alpha channel: RGBA -> RGB
    const rgb = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      rgb[j] = data[i]!;
      rgb[j + 1] = data[i + 1]!;
      rgb[j + 2] = data[i + 2]!;
    }

    const inputTensor = t.tensor3d(rgb, [height, width, 3]);
    const input = inputTensor as unknown as faceapi.TNetInput;
    try {
      const opt = new faceapi.TinyFaceDetectorOptions({
        inputSize: DETECTOR_INPUT_SIZE,
        scoreThreshold: DETECTOR_SCORE_THRESHOLD,
      });
      const result = await faceapi.detectSingleFace(input, opt).withFaceLandmarks().withFaceDescriptor();
      if (!result) return null;
      return { descriptor: Array.from(result.descriptor), score: result.detection.score };
    } finally {
      inputTensor.dispose();
    }
  });
}
