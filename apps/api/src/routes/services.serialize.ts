/**
 * Service serializers + response schema (co-located with `routes/services.ts`).
 *
 * Follows the project serializer convention (`lib/serialize.ts`): dates are
 * emitted as ISO-8601 strings and handlers return these DTOs rather than raw
 * Prisma rows, so the OpenAPI response shape and the wire payload always agree.
 *
 * @module
 */

import { z } from "zod";

import { ServiceStatusSchema, ServiceTypeSchema } from "@shipyard/core";

import { iso } from "../lib/serialize.js";

import type { Service } from "@shipyard/db";

/**
 * Response schema for a single {@link Service} DTO. Dates are ISO strings;
 * `ports` is the list of exposed container ports.
 */
export const ServiceResponseSchema = z.object({
  id: z.string(),
  previewId: z.string(),
  name: z.string(),
  type: ServiceTypeSchema,
  image: z.string().nullable(),
  command: z.string().nullable(),
  internalHost: z.string().nullable(),
  ports: z.array(z.number().int()),
  status: ServiceStatusSchema,
  healthPath: z.string().nullable(),
  restartCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** The wire shape of a {@link Service}. Dates are ISO strings. */
export type ServiceDto = z.infer<typeof ServiceResponseSchema>;

/**
 * Serialize a {@link Service} row into its public DTO.
 *
 * The internal `containerId` (an orchestrator handle) is intentionally omitted
 * — it is an implementation detail, not part of the dashboard contract.
 *
 * @param service - A Prisma `Service` row.
 * @returns The {@link ServiceDto}.
 */
export function toServiceDto(service: Service): ServiceDto {
  return {
    id: service.id,
    previewId: service.previewId,
    name: service.name,
    type: service.type,
    image: service.image,
    command: service.command,
    internalHost: service.internalHost,
    ports: service.ports,
    status: service.status,
    healthPath: service.healthPath,
    restartCount: service.restartCount,
    createdAt: iso(service.createdAt)!,
    updatedAt: iso(service.updatedAt)!,
  };
}
