/**
 * Prisma-row → API-DTO serializers.
 *
 * ## CRITICAL CONVENTION (read before adding a router)
 *
 * Response DTO zod schemas represent **dates as `z.string()`** (ISO-8601) and
 * **Prisma `Decimal`s as `z.number()`**. Route handlers MUST return DTOs
 * produced by the serializer functions in this module — **never** raw Prisma
 * rows. This guarantees that:
 *
 * - `Date` and `Prisma.Decimal` values serialize to the wire types the schemas
 *   declare (a raw `Date`/`Decimal` would fail zod response serialization);
 * - we never leak internal columns (e.g. `valueEncrypted`, `hashedToken`) or
 *   secret values over the API.
 *
 * Each aggregate gets a small, pure `to<Entity>Dto(row)` function. Add new ones
 * here following the same shape so the rule is enforced in one place.
 *
 * @module
 */

import type { Prisma, Membership, Team, User } from "@shipyard/db";

/**
 * Convert a `Date` (or null/undefined) to an ISO-8601 string, null-safe.
 *
 * @param date - A `Date`, `null`, or `undefined`.
 * @returns The ISO string, or `null` when the input is null/undefined.
 */
export function iso(date: Date | null | undefined): string | null {
  return date == null ? null : date.toISOString();
}

/**
 * Convert a Prisma `Decimal` (or null/undefined) to a JS number, null-safe.
 *
 * @param value - A `Prisma.Decimal`, `null`, or `undefined`.
 * @returns The numeric value, or `null` when the input is null/undefined.
 */
export function decimalToNumber(
  value: Prisma.Decimal | null | undefined,
): number | null {
  return value == null ? null : value.toNumber();
}

/**
 * The wire shape of a {@link User}. Dates are ISO strings.
 */
export interface UserDto {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  githubLogin: string | null;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Serialize a {@link User} row into its public DTO (omits nothing sensitive —
 * users have no secret columns — but normalises dates).
 *
 * @param user - A Prisma `User` row.
 * @returns The {@link UserDto}.
 */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    githubLogin: user.githubLogin,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * The wire shape of a {@link Team}. Dates are ISO strings, `budgetUsdMonthly`
 * is a number.
 */
export interface TeamDto {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  budgetUsdMonthly: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Serialize a {@link Team} row into its public DTO.
 *
 * @param team - A Prisma `Team` row.
 * @returns The {@link TeamDto}.
 */
export function toTeamDto(team: Team): TeamDto {
  return {
    id: team.id,
    name: team.name,
    slug: team.slug,
    avatarUrl: team.avatarUrl,
    budgetUsdMonthly: decimalToNumber(team.budgetUsdMonthly),
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  };
}

/**
 * The wire shape of a {@link Membership}. Optionally embeds the related team
 * when the caller included it.
 */
export interface MembershipDto {
  id: string;
  userId: string;
  teamId: string;
  role: Membership["role"];
  createdAt: string;
  team?: TeamDto;
}

/**
 * Serialize a {@link Membership} row into its DTO, optionally embedding the
 * related team when it was loaded (`include: { team: true }`).
 *
 * @param membership - A Prisma `Membership` row, optionally with `team`.
 * @returns The {@link MembershipDto}.
 */
export function toMembershipDto(
  membership: Membership & { team?: Team },
): MembershipDto {
  return {
    id: membership.id,
    userId: membership.userId,
    teamId: membership.teamId,
    role: membership.role,
    createdAt: membership.createdAt.toISOString(),
    ...(membership.team ? { team: toTeamDto(membership.team) } : {}),
  };
}
