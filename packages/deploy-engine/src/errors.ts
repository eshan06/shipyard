/**
 * Typed errors for `@shipyard/deploy-engine`.
 *
 * Every engine failure surfaces as a {@link DeployEngineError} (or subclass) so
 * callers can branch on a stable `code` instead of string-matching messages.
 */

/** Discriminator for {@link DeployEngineError} subtypes. */
export type DeployEngineErrorCode =
  | "DAEMON_UNAVAILABLE"
  | "IMAGE_PULL_FAILED"
  | "IMAGE_BUILD_FAILED"
  | "CONTAINER_START_FAILED"
  | "HEALTHCHECK_TIMEOUT"
  | "DEPENDENCY_CYCLE"
  | "INVALID_PLAN"
  | "NOT_FOUND"
  | "TEARDOWN_FAILED";

/** Base class for all errors thrown by the deploy engine. */
export class DeployEngineError extends Error {
  /** Stable machine-readable error code. */
  readonly code: DeployEngineErrorCode;
  /** The logical service this error relates to, when applicable. */
  readonly service?: string;
  /** The underlying error that caused this one, when wrapped. */
  override readonly cause?: unknown;

  constructor(
    code: DeployEngineErrorCode,
    message: string,
    options: { service?: string; cause?: unknown } = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.service = options.service;
    this.cause = options.cause;
    // Restore prototype chain for instanceof across transpilation boundaries.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Raised when the Docker daemon cannot be reached (socket missing, connection
 * refused, permission denied). Carries actionable guidance in the message.
 */
export class DaemonUnavailableError extends DeployEngineError {
  constructor(cause?: unknown) {
    super(
      "DAEMON_UNAVAILABLE",
      "Docker daemon is unavailable. Ensure Docker is running and that the current " +
        "user can access the Docker socket (DOCKER_HOST / /var/run/docker.sock).",
      { cause },
    );
  }
}

/** Raised when pulling an image fails. */
export class ImagePullError extends DeployEngineError {
  constructor(image: string, cause?: unknown, service?: string) {
    super("IMAGE_PULL_FAILED", `Failed to pull image "${image}".`, { service, cause });
  }
}

/** Raised when building an image fails. */
export class ImageBuildError extends DeployEngineError {
  constructor(message: string, cause?: unknown, service?: string) {
    super("IMAGE_BUILD_FAILED", message, { service, cause });
  }
}

/** Raised when a container cannot be created or started. */
export class ContainerStartError extends DeployEngineError {
  constructor(service: string, cause?: unknown) {
    super("CONTAINER_START_FAILED", `Failed to start service "${service}".`, { service, cause });
  }
}

/** Raised when a service does not become healthy within its allotted budget. */
export class HealthcheckTimeoutError extends DeployEngineError {
  constructor(service: string) {
    super("HEALTHCHECK_TIMEOUT", `Service "${service}" did not become healthy in time.`, {
      service,
    });
  }
}

/** Raised when the service `dependsOn` graph contains a cycle. */
export class DependencyCycleError extends DeployEngineError {
  constructor(cycle: string[]) {
    super("DEPENDENCY_CYCLE", `Service dependency cycle detected: ${cycle.join(" -> ")}.`);
  }
}

/** Raised when a plan fails validation or is structurally inconsistent. */
export class InvalidPlanError extends DeployEngineError {
  constructor(message: string, cause?: unknown) {
    super("INVALID_PLAN", message, { cause });
  }
}

/**
 * Detect whether an unknown error indicates the Docker daemon is unreachable.
 *
 * dockerode surfaces daemon connectivity failures as Node system errors
 * (`ECONNREFUSED`, `ENOENT` for a missing socket, `EACCES` for permissions) and
 * as plain `connect`/socket messages. This normalizes those shapes.
 */
export function isDaemonUnavailable(error: unknown): boolean {
  if (error == null) return false;
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ECONNREFUSED" || code === "ENOENT" || code === "EACCES" || code === "EPIPE") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /connect (ECONNREFUSED|ENOENT|EACCES)|docker daemon|cannot connect to the docker/i.test(
    message,
  );
}
