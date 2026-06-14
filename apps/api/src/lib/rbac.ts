/**
 * Team-scoped role-based access control (RBAC).
 *
 * AuthZ in Shipyard is team-scoped: every protected resource resolves to an
 * owning team, and the caller's `Membership.role` on that team is checked
 * against a required minimum (`OWNER > ADMIN > MEMBER > VIEWER`). Reads need
 * `VIEWER`, writes need `MEMBER`, destructive/settings actions need
 * `ADMIN`/`OWNER` (see `docs/ENGINEERING.md` §6).
 *
 * This module centralises the role ordering, the assertion that throws the
 * right `AppError`, and the resolvers that walk a project/preview/deployment
 * back to its team.
 *
 * @module
 */

import { ForbiddenError, NotFoundError, UnauthorizedError } from "@shipyard/core";

import type { MembershipRole } from "@shipyard/core";
import type { FastifyInstance, FastifyRequest } from "fastify";

/**
 * Roles ordered from least to most privileged. Index = privilege rank, so a
 * numeric comparison answers "does role A satisfy required role B?".
 */
const ROLE_ORDER: readonly MembershipRole[] = [
  "VIEWER",
  "MEMBER",
  "ADMIN",
  "OWNER",
];

/**
 * Does `actual` meet or exceed the privilege of `required`?
 *
 * @param actual - The caller's role on the team.
 * @param required - The minimum role the action requires.
 * @returns `true` when `actual` is at least as privileged as `required`.
 */
export function roleAtLeast(
  actual: MembershipRole,
  required: MembershipRole,
): boolean {
  return ROLE_ORDER.indexOf(actual) >= ROLE_ORDER.indexOf(required);
}

/**
 * Assert the authenticated caller has at least `minRole` on `teamId`, returning
 * their actual role on success.
 *
 * @param app - The Fastify instance (for `app.prisma`).
 * @param request - The current request (must carry `request.auth`).
 * @param teamId - The team the action is scoped to.
 * @param minRole - The minimum role required.
 * @returns The caller's actual {@link MembershipRole} on the team.
 * @throws UnauthorizedError when the request is unauthenticated.
 * @throws ForbiddenError when the caller is not a member, or lacks `minRole`.
 */
export async function requireTeamRole(
  app: FastifyInstance,
  request: FastifyRequest,
  teamId: string,
  minRole: MembershipRole,
): Promise<MembershipRole> {
  if (!request.auth) {
    throw new UnauthorizedError();
  }

  const membership = await app.prisma.membership.findUnique({
    where: { userId_teamId: { userId: request.auth.userId, teamId } },
    select: { role: true },
  });

  if (!membership) {
    // Do not disclose team existence to non-members.
    throw new ForbiddenError("You are not a member of this team");
  }
  if (!roleAtLeast(membership.role, minRole)) {
    throw new ForbiddenError(
      `This action requires the ${minRole} role or higher`,
    );
  }
  return membership.role;
}

/**
 * The minimal Prisma surface the resolvers below need. Accepting this rather
 * than the full `PrismaClient` keeps the resolvers easy to unit test.
 */
type ResolverPrisma = Pick<
  FastifyInstance["prisma"],
  "project" | "preview" | "deployment"
>;

/**
 * Resolve the owning team id for a project.
 *
 * @param prisma - Prisma client.
 * @param projectId - The project id.
 * @returns The owning `Team.id`.
 * @throws NotFoundError when the project does not exist.
 */
export async function teamIdForProject(
  prisma: ResolverPrisma,
  projectId: string,
): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { teamId: true },
  });
  if (!project) throw new NotFoundError("Project", projectId);
  return project.teamId;
}

/**
 * Resolve the owning team id for a preview (via its project).
 *
 * @param prisma - Prisma client.
 * @param previewId - The preview id.
 * @returns The owning `Team.id`.
 * @throws NotFoundError when the preview does not exist.
 */
export async function teamIdForPreview(
  prisma: ResolverPrisma,
  previewId: string,
): Promise<string> {
  const preview = await prisma.preview.findUnique({
    where: { id: previewId },
    select: { project: { select: { teamId: true } } },
  });
  if (!preview) throw new NotFoundError("Preview", previewId);
  return preview.project.teamId;
}

/**
 * Resolve the owning team id for a deployment (via its preview's project).
 *
 * @param prisma - Prisma client.
 * @param deploymentId - The deployment id.
 * @returns The owning `Team.id`.
 * @throws NotFoundError when the deployment does not exist.
 */
export async function teamIdForDeployment(
  prisma: ResolverPrisma,
  deploymentId: string,
): Promise<string> {
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    select: { preview: { select: { project: { select: { teamId: true } } } } },
  });
  if (!deployment) throw new NotFoundError("Deployment", deploymentId);
  return deployment.preview.project.teamId;
}
