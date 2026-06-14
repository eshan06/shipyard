/**
 * Global error & not-found handlers for the API.
 *
 * Converts everything thrown in a handler into the stable `ErrorResponse` wire
 * shape from `@shipyard/core`:
 *
 * - **zod validation** errors (request body/query/params) → 422 with field
 *   issues, using the core `ValidationError` shape.
 * - thrown **`AppError`s** → their own `toResponse()` + `httpStatus`.
 * - **`@fastify/rate-limit`** 429s → a `RATE_LIMIT` response.
 * - anything else → logged and returned as a generic 500 (no internal leakage).
 *
 * @module
 */

import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { ZodError } from "zod";

import {
  RateLimitError,
  ValidationError,
  isAppError,
  toErrorResponse,
} from "@shipyard/core";

import type { FieldIssue } from "@shipyard/core";
import type { FastifyError, FastifyInstance } from "fastify";

/**
 * Map a {@link ZodError} into the flat {@link FieldIssue} list our
 * `ValidationError` carries.
 *
 * @param error - The zod error to convert.
 * @returns Field-level issues with dotted paths.
 */
function zodIssues(error: ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

/**
 * Install the global error handler and the not-found handler on the app.
 *
 * @param app - The Fastify instance to attach the handlers to.
 */
export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    // 1. Request-schema validation failures from fastify-type-provider-zod.
    if (hasZodFastifySchemaValidationErrors(error)) {
      const issues: FieldIssue[] = error.validation.map((v) => ({
        path: (v.instancePath || v.params?.["issue"]?.path?.join(".") || "")
          .toString()
          .replace(/^\//, "")
          .replace(/\//g, "."),
        message: v.message ?? "Invalid value",
      }));
      const validation = new ValidationError("Validation failed", issues);
      reply.status(validation.httpStatus).send(validation.toResponse());
      return;
    }

    // 2. A raw ZodError thrown inside a handler (e.g. manual `.parse`).
    if (error instanceof ZodError) {
      const validation = new ValidationError("Validation failed", zodIssues(error));
      reply.status(validation.httpStatus).send(validation.toResponse());
      return;
    }

    // 3. Our typed application errors.
    if (isAppError(error)) {
      reply.status(error.httpStatus).send(error.toResponse());
      return;
    }

    // 4. Fastify rate-limit (429) → stable RATE_LIMIT shape.
    if (error.statusCode === 429) {
      const rl = new RateLimitError();
      reply.status(rl.httpStatus).send(rl.toResponse());
      return;
    }

    // 5. Other Fastify client errors (4xx) carry a usable message/code.
    if (typeof error.statusCode === "number" && error.statusCode < 500) {
      reply.status(error.statusCode).send({
        error: {
          code: "VALIDATION",
          message: error.message,
          httpStatus: error.statusCode,
        },
      });
      return;
    }

    // 6. Anything else: log and return an opaque 500.
    request.log.error({ err: error }, "unhandled error");
    reply.status(500).send(toErrorResponse(error));
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method} ${request.url} not found`,
        httpStatus: 404,
      },
    });
  });
}
