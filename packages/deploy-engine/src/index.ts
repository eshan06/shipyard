/**
 * `@shipyard/deploy-engine` — Docker orchestration for Shipyard preview stacks.
 *
 * Public surface:
 *  - {@link ComposePlanner}: project config → {@link PreviewPlan}.
 *  - {@link DockerDriver}: typed dockerode primitives.
 *  - {@link DockerOrchestrator}: real preview lifecycle (deploy/stop/destroy/…).
 *  - {@link MockOrchestrator}: in-memory orchestrator for tests/CI.
 *  - Types ({@link PreviewPlan}, {@link ServicePlan}, {@link DeployResult}, …)
 *    and typed errors ({@link DeployEngineError} and friends).
 */

export * from "./types.js";
export * from "./errors.js";
export {
  ComposePlanner,
  networkNameFor,
  buildLabels,
  inferKind,
  normalizeEnv,
  normalizePorts,
  parsePortString,
  normalizeDependsOn,
  normalizeRestart,
  normalizeVolumes,
  normalizeHealthcheck,
  parseDuration,
  type Framework,
  type ProjectConfig,
  type PlanInput,
} from "./planner.js";
export { topologicalOrder } from "./graph.js";
export {
  DockerDriver,
  portConfig,
  hostConfigFor,
  restartPolicy,
  dockerHealthcheck,
  parseStats,
  DEFAULT_RESOURCE_LIMITS,
  type BuildLogEvent,
  type CreateContainerOptions,
  type DockerDriverOptions,
  type RegistryAuth,
} from "./docker.js";
export {
  DockerOrchestrator,
  aggregatePreviewState,
  type DockerOrchestratorOptions,
} from "./orchestrator.js";
export { MockOrchestrator, type MockOrchestratorOptions } from "./mock.js";
