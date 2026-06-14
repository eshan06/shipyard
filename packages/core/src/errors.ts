/**
 * Typed application error hierarchy shared across the Shipyard control plane.
 *
 * Every domain/control-plane error extends {@link AppError}, which couples a
 * stable machine-readable `code` with an HTTP `httpStatus`. The API layer can
 * serialize any thrown {@link AppError} into a consistent wire shape via
 * {@link AppError.toResponse} / {@link toErrorResponse}, while the worker can
 * branch on `code` for retry decisions.
 *
 * @module
 */

/**
 * Stable, machine-readable error codes. These are part of the API contract:
 * clients (dashboard, CLI) may branch on them, so values must not change
 * without a deliberate migration.
 */
export const ErrorCode = {
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION: "VALIDATION",
  CONFLICT: "CONFLICT",
  RATE_LIMIT: "RATE_LIMIT",
  INTERNAL: "INTERNAL",
} as const;

/**
 * Union of all known {@link ErrorCode} string literals.
 */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * A single field-level validation issue, suitable for surfacing in a form UI.
 */
export interface FieldIssue {
  /** Dotted path to the offending field, e.g. `"config.buildCommand"`. */
  readonly path: string;
  /** Human-readable message describing the problem. */
  readonly message: string;
}

/**
 * The serialized wire shape returned to API clients for any {@link AppError}.
 * Intentionally flat and stable so it can be consumed by the dashboard and
 * the CLI without coupling to internal class hierarchy.
 */
export interface ErrorResponse {
  error: {
    /** Stable machine-readable code (see {@link ErrorCode}). */
    code: ErrorCode;
    /** Human-readable message; safe to display. */
    message: string;
    /** HTTP status code associated with the error. */
    httpStatus: number;
    /** Optional structured details (e.g. validation field issues). */
    details?: unknown;
  };
}

/**
 * Base class for all Shipyard application errors.
 *
 * Subclasses fix a concrete {@link ErrorCode} and HTTP status. Extra
 * structured context can be attached via `details` (never include secrets).
 */
export abstract class AppError extends Error {
  /** Stable machine-readable error code. */
  abstract readonly code: ErrorCode;
  /** HTTP status code to respond with. */
  abstract readonly httpStatus: number;
  /** Optional structured details safe to expose to clients. */
  readonly details?: unknown;

  /**
   * @param message - Human-readable, client-safe message.
   * @param details - Optional structured context (must not contain secrets).
   */
  constructor(message: string, details?: unknown) {
    super(message);
    // Restore prototype chain for instanceof across transpilation targets.
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = new.target.name;
    this.details = details;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }

  /**
   * Serialize this error into the stable {@link ErrorResponse} wire shape.
   *
   * @returns A JSON-serializable error response object.
   */
  toResponse(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        httpStatus: this.httpStatus,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

/**
 * The requested resource does not exist (HTTP 404).
 */
export class NotFoundError extends AppError {
  readonly code = ErrorCode.NOT_FOUND;
  readonly httpStatus = 404;

  /**
   * @param resource - Human-readable resource name, e.g. `"Preview"`.
   * @param identifier - Optional identifier that was looked up.
   */
  constructor(resource: string, identifier?: string) {
    super(
      identifier === undefined
        ? `${resource} not found`
        : `${resource} not found: ${identifier}`,
      identifier === undefined ? undefined : { resource, identifier },
    );
  }
}

/**
 * The caller is authenticated but not permitted to perform the action
 * (HTTP 403).
 */
export class ForbiddenError extends AppError {
  readonly code = ErrorCode.FORBIDDEN;
  readonly httpStatus = 403;

  /**
   * @param message - Reason access was denied. Defaults to a generic message.
   * @param details - Optional structured context.
   */
  constructor(message = "You do not have permission to perform this action", details?: unknown) {
    super(message, details);
  }
}

/**
 * Input failed validation (HTTP 422). Carries field-level {@link FieldIssue}s.
 */
export class ValidationError extends AppError {
  readonly code = ErrorCode.VALIDATION;
  readonly httpStatus = 422;
  /** Field-level issues describing why validation failed. */
  readonly issues: readonly FieldIssue[];

  /**
   * @param message - Summary message. Defaults to `"Validation failed"`.
   * @param issues - Field-level issues (also exposed via `details`).
   */
  constructor(message = "Validation failed", issues: readonly FieldIssue[] = []) {
    super(message, { issues });
    this.issues = issues;
  }
}

/**
 * The request conflicts with current state, e.g. a uniqueness violation
 * (HTTP 409).
 */
export class ConflictError extends AppError {
  readonly code = ErrorCode.CONFLICT;
  readonly httpStatus = 409;

  /**
   * @param message - Description of the conflict.
   * @param details - Optional structured context.
   */
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

/**
 * The caller has exceeded a rate limit (HTTP 429).
 */
export class RateLimitError extends AppError {
  readonly code = ErrorCode.RATE_LIMIT;
  readonly httpStatus = 429;
  /** Seconds the client should wait before retrying, if known. */
  readonly retryAfterSeconds?: number;

  /**
   * @param retryAfterSeconds - Suggested cooldown before retrying.
   * @param message - Optional override message.
   */
  constructor(retryAfterSeconds?: number, message = "Rate limit exceeded") {
    super(
      message,
      retryAfterSeconds === undefined ? undefined : { retryAfterSeconds },
    );
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Type guard: is the given value an {@link AppError}?
 *
 * @param value - Arbitrary value (e.g. a caught error).
 * @returns `true` and narrows to {@link AppError} when applicable.
 */
export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/**
 * Convert any caught value into the stable {@link ErrorResponse} wire shape.
 *
 * Known {@link AppError}s are serialized directly. Anything else is mapped to a
 * generic `INTERNAL` (HTTP 500) response without leaking internal details to
 * the client.
 *
 * @param error - The caught value to convert.
 * @returns A JSON-serializable {@link ErrorResponse}.
 */
export function toErrorResponse(error: unknown): ErrorResponse {
  if (isAppError(error)) {
    return error.toResponse();
  }
  return {
    error: {
      code: ErrorCode.INTERNAL,
      message: "Internal server error",
      httpStatus: 500,
    },
  };
}
