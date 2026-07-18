/**
 * BullMQ queues plugin: decorates `app.queues` with the `deploy`/`destroy`
 * producer queues and validated enqueue helpers.
 *
 * Payloads are validated against the shared `@shipyard/core` job schemas before
 * being added (with `DEFAULT_JOB_OPTIONS`) so the API and the worker can never
 * disagree on a job's wire shape. Queues are closed on server shutdown.
 *
 * @module
 */

import { Queue } from "bullmq";
import fp from "fastify-plugin";

import {
  DEFAULT_JOB_OPTIONS,
  DeployJobSchema,
  DestroyJobSchema,
  QUEUE,
  destroyDedupId,
} from "@shipyard/core";

import type { AppQueues } from "../types.js";
import type { DeployJob, DestroyJob } from "@shipyard/core";
import type { FastifyInstance } from "fastify";

/** Options for the queues plugin. */
export interface QueuesPluginOptions {
  /** An injected queues implementation (tests); otherwise real BullMQ queues. */
  queues?: AppQueues;
}

/**
 * Register the BullMQ queues plugin.
 *
 * @param app - The Fastify instance.
 * @param options - Optional injected queues.
 */
async function queuesPlugin(
  app: FastifyInstance,
  options: QueuesPluginOptions,
): Promise<void> {
  if (options.queues) {
    app.decorate("queues", options.queues);
    return;
  }

  // BullMQ shares a single ioredis connection config across its queues. It
  // requires `maxRetriesPerRequest: null`.
  const connection = { url: app.config.REDIS_URL, maxRetriesPerRequest: null };

  const deploy = new Queue(QUEUE.deploy, { connection });
  const destroy = new Queue(QUEUE.destroy, { connection });

  const queues: AppQueues = {
    deploy,
    destroy,
    async enqueueDeploy(payload: DeployJob): Promise<string> {
      const data = DeployJobSchema.parse(payload);
      // Deterministic jobId so concurrent duplicates (double webhook/API call)
      // collapse: BullMQ rejects the second add while the first is still
      // queued/active. The in-processor state-machine guards remain the second
      // line of defence. Keyed by deploymentId (each redeploy mints a new one).
      const job = await deploy.add(QUEUE.deploy, data, {
        ...DEFAULT_JOB_OPTIONS,
        // NB: BullMQ forbids ":" in a custom jobId (its internal key separator).
        jobId: `deploy-${data.deploymentId}`,
      });
      return String(job.id);
    },
    async enqueueDestroy(payload: DestroyJob): Promise<string> {
      const data = DestroyJobSchema.parse(payload);
      // BullMQ deduplication (NOT a bare jobId): the dedup key is released when
      // the job leaves the queue, so a later legitimate destroy for the same
      // preview is not silently swallowed by a retained completed/failed job.
      // Shared id format with the cleanup scheduler so both producers de-dupe.
      const job = await destroy.add(QUEUE.destroy, data, {
        ...DEFAULT_JOB_OPTIONS,
        deduplication: { id: destroyDedupId(data.previewId, data.reason) },
      });
      return String(job.id);
    },
  };

  app.decorate("queues", queues);

  app.addHook("onClose", async () => {
    await Promise.allSettled([deploy.close(), destroy.close()]);
  });
}

export default fp(queuesPlugin, { name: "queues" });
