/**
 * Orchestrator selection for the worker.
 *
 * The worker talks to a {@link PreviewOrchestrator} from `@shipyard/deploy-engine`
 * but does not care which implementation it is: in `mock` mode it uses the
 * in-memory {@link MockOrchestrator} (no Docker daemon needed — CI, tests, local
 * demos), and in `docker` mode it uses the real {@link DockerOrchestrator} wired
 * to the configured preview base domain.
 *
 * `DOCKER_HOST` is honoured by dockerode straight from the ambient environment
 * (the validated config has already confirmed it parses), so there is nothing to
 * thread through the driver here.
 *
 * Lifecycle hooks ({@link OrchestratorHooks}) are NOT bound here — each job
 * provides its own hooks at call time so logs/status route to the right
 * deployment/preview.
 *
 * @module
 */

import {
  DockerOrchestrator,
  MockOrchestrator,
  type PreviewOrchestrator,
} from "@shipyard/deploy-engine";

import type { WorkerConfig } from "./config.js";
import type { Logger } from "pino";

/**
 * Create the {@link PreviewOrchestrator} dictated by `config.DEPLOY_DRIVER`.
 *
 * @param config - The validated worker configuration.
 * @param logger - Logger for a one-line note about the selected driver.
 * @returns A ready-to-use orchestrator.
 */
export function createOrchestrator(
  config: WorkerConfig,
  logger: Logger,
): PreviewOrchestrator {
  if (config.DEPLOY_DRIVER === "mock") {
    logger.info({ driver: "mock" }, "using in-memory mock orchestrator");
    return new MockOrchestrator();
  }

  const registryAuth =
    config.REGISTRY_USERNAME && config.REGISTRY_PASSWORD
      ? [
          {
            username: config.REGISTRY_USERNAME,
            password: config.REGISTRY_PASSWORD,
            ...(config.REGISTRY_SERVER ? { serveraddress: config.REGISTRY_SERVER } : {}),
          },
        ]
      : undefined;

  logger.info(
    {
      driver: "docker",
      dockerHost: config.DOCKER_HOST ?? "(default)",
      edgeNetwork: config.PREVIEW_EDGE_NETWORK ?? "(none)",
      registryAuth: registryAuth ? "configured" : "(none)",
    },
    "using docker orchestrator",
  );
  return new DockerOrchestrator({
    baseDomain: config.PREVIEW_BASE_DOMAIN,
    ...(config.PREVIEW_EDGE_NETWORK ? { edgeNetworkName: config.PREVIEW_EDGE_NETWORK } : {}),
    ...(registryAuth ? { registryAuth } : {}),
  });
}
