import { Queue, type JobsOptions } from "bullmq";
import { logger } from "./logger";

const REDIS_URL = process.env.REDIS_URL;

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000,
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 500 },
};

let queues: Record<string, Queue> | null = null;

export function getQueues() {
  if (!queues) {
    if (!REDIS_URL) throw new Error("REDIS_URL is required for BullMQ queues");
    // Pass URL config directly so BullMQ creates its own ioredis instance
    // (avoids version conflicts with a shared Redis client)
    const connection = { url: REDIS_URL };

    const makeQueue = (name: string, opts?: JobsOptions) =>
      new Queue(name, {
        connection,
        defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, ...opts },
      });

    queues = {
      contentIngestion: makeQueue("content-ingestion"),
      llmProcessing: makeQueue("llm-processing", { attempts: 5 }),
      miroFishRuns: makeQueue("mirofish-runs", {
        attempts: 2,
        backoff: { type: "exponential", delay: 30000 },
      }),
      alertDispatch: makeQueue("alert-dispatch", { attempts: 5 }),
      reportGeneration: makeQueue("report-generation", { attempts: 3 }),
      emailDelivery: makeQueue("email-delivery", { attempts: 5 }),
    };

    logger.info("BullMQ queues initialized");
  }
  return queues;
}

export type QueueName = keyof ReturnType<typeof getQueues>;

export async function addJob<T>(
  queueName: QueueName,
  jobName: string,
  data: T,
  opts?: JobsOptions
): Promise<void> {
  const qs = getQueues();
  const queue = qs[queueName];
  if (!queue) throw new Error(`Unknown queue: ${queueName}`);
  await queue.add(jobName, data, opts);
}

export async function closeQueues(): Promise<void> {
  if (!queues) return;
  await Promise.all(Object.values(queues).map((q) => q.close()));
  queues = null;
}
