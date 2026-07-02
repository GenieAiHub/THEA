import { Queue, Worker, type JobsOptions, type WorkerOptions, type Processor } from "bullmq";
import { logger } from "./logger";

const REDIS_URL = process.env.REDIS_URL;

/**
 * Default job options applied to all queues.
 * Dead-letter behaviour: failed jobs are kept in the failed set (removeOnFail)
 * so they can be inspected and retried.  In Phase 2+ a dedicated DLQ worker
 * will monitor the failed set and route to the dlq queue.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000,
  },
  removeOnComplete: { count: 1000 },
  // Keep failed jobs for 7 days so they can be inspected / replayed
  removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
};

/**
 * Per-queue concurrency limits.  These control how many jobs of the same
 * type can run simultaneously across all worker processes.
 */
export const QUEUE_CONCURRENCY: Record<string, number> = {
  "content-ingestion": 10,
  "llm-processing":    3,   // rate-limited by OpenAI quotas
  "mirofish-runs":     2,   // resource-intensive simulation
  "alert-dispatch":    5,
  "report-generation": 2,
  "email-delivery":    5,
  "market-generation": 1,   // LLM poll generation — sequential
  "dlq":               1,   // dead-letter queue — sequential, low priority
};

let queues: Record<string, Queue> | null = null;

function buildConnection() {
  if (!REDIS_URL) throw new Error("REDIS_URL is required for BullMQ queues");
  // Pass URL config directly so BullMQ creates its own ioredis instance
  // (avoids version conflicts with a shared Redis client)
  return { url: REDIS_URL };
}

export function getQueues() {
  if (!queues) {
    const connection = buildConnection();

    const makeQueue = (name: string, opts?: JobsOptions) =>
      new Queue(name, {
        connection,
        defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, ...opts },
      });

    queues = {
      contentIngestion: makeQueue("content-ingestion"),
      llmProcessing: makeQueue("llm-processing", {
        attempts: 5,
        backoff: { type: "exponential", delay: 10000 },
      }),
      miroFishRuns: makeQueue("mirofish-runs", {
        attempts: 2,
        backoff: { type: "exponential", delay: 30000 },
      }),
      alertDispatch: makeQueue("alert-dispatch", { attempts: 5 }),
      reportGeneration: makeQueue("report-generation", { attempts: 3 }),
      emailDelivery: makeQueue("email-delivery", { attempts: 5 }),
      marketGeneration: makeQueue("market-generation", { attempts: 1 }),
      // Dead-letter queue — jobs are moved here after exhausting all retries
      dlq: makeQueue("dlq", { attempts: 1, removeOnFail: { count: 10000 } }),
    };

    logger.info("BullMQ queues initialized");
  }
  return queues;
}

export type QueueName = keyof ReturnType<typeof getQueues>;

/**
 * Convenience helper: enqueue a job on the named queue.
 */
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

/**
 * Create a worker for a named BullMQ queue with the correct concurrency
 * limit and automatic dead-letter routing on terminal failure.
 *
 * @param queueName  Key in QUEUE_CONCURRENCY map
 * @param processor  Job processor function
 * @param opts       Additional WorkerOptions (merged on top of defaults)
 */
export function createWorker<T = unknown>(
  queueName: keyof typeof QUEUE_CONCURRENCY,
  processor: Processor<T>,
  opts?: Partial<WorkerOptions>
): Worker<T> {
  const connection = buildConnection();
  const concurrency = QUEUE_CONCURRENCY[queueName] ?? 5;
  const qs = getQueues();

  const worker = new Worker<T>(queueName, processor, {
    connection,
    concurrency,
    ...opts,
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;
    // Route exhausted jobs to the DLQ for manual inspection / replay
    if ((job.attemptsMade ?? 0) >= (job.opts?.attempts ?? 3)) {
      logger.error(
        { jobId: job.id, queue: queueName, err: err.message },
        "Job exhausted retries — routing to DLQ"
      );
      await qs.dlq.add(
        `dlq:${queueName}:${job.name}`,
        { originalQueue: queueName, originalJobId: job.id, originalData: job.data, error: err.message },
        { removeOnComplete: false }
      );
    }
  });

  worker.on("error", (err) => {
    logger.error({ queue: queueName, err }, "Worker error");
  });

  return worker;
}

export async function closeQueues(): Promise<void> {
  if (!queues) return;
  await Promise.all(Object.values(queues).map((q) => q.close()));
  queues = null;
}
