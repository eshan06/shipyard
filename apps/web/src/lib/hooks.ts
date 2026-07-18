"use client";

/**
 * SWR data hooks for the dashboard, backed by the typed {@link api} client.
 *
 * All hooks are client-side (the build must succeed with no API running), so
 * data loads at runtime in the browser. Keys are stable strings/arrays so SWR
 * dedupes and caches correctly across components.
 *
 * @module
 */

import useSWR, { type SWRConfiguration, type SWRResponse } from "swr";

import { api, ApiError } from "./api";

import type {
  ApiToken,
  CostSummary,
  Deployment,
  EnvVar,
  ListResponse,
  MeResponse,
  Notification,
  Preview,
  PreviewCostsResponse,
  PreviewDetail,
  Project,
  Review,
  Service,
} from "./api-types";
import type {
  DeploymentStatus,
  PreviewStatus,
} from "@shipyard/core";

/**
 * Default per-hook SWR config: retry only non-auth errors. Revalidation policy
 * (dedupe, keepPreviousData, revalidateOnFocus:false) is set once globally in
 * the SWRConfig provider — this must NOT re-specify `revalidateOnFocus`, or it
 * would override the global "off" on every hook and re-introduce the alt-tab
 * refetch storm the provider deliberately disables.
 */
const baseConfig: SWRConfiguration = {
  shouldRetryOnError: (err: unknown) =>
    !(err instanceof ApiError && err.isUnauthorized),
};

/** Filters accepted by {@link usePreviews}. */
export interface PreviewFilters {
  projectId?: string;
  status?: PreviewStatus;
  limit?: number;
}

/** The current user + memberships. `error` is an {@link ApiError} on 401. */
export function useMe(): SWRResponse<MeResponse, ApiError> {
  return useSWR<MeResponse, ApiError>("/me", () => api.me(), {
    ...baseConfig,
    shouldRetryOnError: false,
  });
}

/** Paginated previews list (first page) with optional filters. */
export function usePreviews(
  filters: PreviewFilters = {},
): SWRResponse<ListResponse<Preview>, ApiError> {
  return useSWR<ListResponse<Preview>, ApiError>(
    ["previews", filters.projectId ?? "", filters.status ?? "", filters.limit],
    () =>
      api.listPreviews({
        projectId: filters.projectId,
        status: filters.status,
        limit: filters.limit,
      }),
    baseConfig,
  );
}

/** A single preview's detail. Polls every 5s while the preview is active. */
export function usePreview(
  id: string | null,
): SWRResponse<PreviewDetail, ApiError> {
  return useSWR<PreviewDetail, ApiError>(
    id ? ["preview", id] : null,
    () => api.getPreview(id as string),
    {
      ...baseConfig,
      refreshInterval: (data) =>
        data?.statusDisplay.isActive ? 5000 : 0,
    },
  );
}

/** A preview's services list. */
export function usePreviewServices(
  id: string | null,
): SWRResponse<ListResponse<Service>, ApiError> {
  return useSWR<ListResponse<Service>, ApiError>(
    id ? ["preview-services", id] : null,
    () => api.listPreviewServices(id as string),
    baseConfig,
  );
}

/** A preview's reviewers list. */
export function usePreviewReviews(
  id: string | null,
): SWRResponse<ListResponse<Review>, ApiError> {
  return useSWR<ListResponse<Review>, ApiError>(
    id ? ["preview-reviews", id] : null,
    () => api.listPreviewReviews(id as string),
    baseConfig,
  );
}

/** A preview's env vars (secrets masked). */
export function usePreviewEnv(
  id: string | null,
): SWRResponse<ListResponse<EnvVar>, ApiError> {
  return useSWR<ListResponse<EnvVar>, ApiError>(
    id ? ["preview-env", id] : null,
    () => api.listPreviewEnv(id as string),
    baseConfig,
  );
}

/** A preview's cost records + total. */
export function usePreviewCosts(
  id: string | null,
): SWRResponse<PreviewCostsResponse, ApiError> {
  return useSWR<PreviewCostsResponse, ApiError>(
    id ? ["preview-costs", id] : null,
    () => api.getPreviewCosts(id as string),
    baseConfig,
  );
}

/** A preview's deployments (most recent first). */
export function usePreviewDeployments(
  id: string | null,
): SWRResponse<ListResponse<Deployment>, ApiError> {
  return useSWR<ListResponse<Deployment>, ApiError>(
    id ? ["preview-deployments", id] : null,
    () => api.listDeployments({ previewId: id as string, order: "desc" }),
    baseConfig,
  );
}

/** Paginated deployments list (first page) with optional status filter. */
export function useDeployments(
  filters: { status?: DeploymentStatus; previewId?: string; limit?: number } = {},
): SWRResponse<ListResponse<Deployment>, ApiError> {
  return useSWR<ListResponse<Deployment>, ApiError>(
    ["deployments", filters.status ?? "", filters.previewId ?? "", filters.limit],
    () => api.listDeployments(filters),
    baseConfig,
  );
}

/** A single deployment's detail. Polls every 4s while in-flight. */
export function useDeployment(
  id: string | null,
): SWRResponse<Deployment, ApiError> {
  return useSWR<Deployment, ApiError>(
    id ? ["deployment", id] : null,
    () => api.getDeployment(id as string),
    {
      ...baseConfig,
      refreshInterval: (data) => {
        const active =
          data &&
          ["QUEUED", "BUILDING", "DEPLOYING"].includes(data.status);
        return active ? 4000 : 0;
      },
    },
  );
}

/** Projects list. */
export function useProjects(): SWRResponse<ListResponse<Project>, ApiError> {
  return useSWR<ListResponse<Project>, ApiError>(
    "projects",
    () => api.listProjects(),
    baseConfig,
  );
}

/** A single project's detail. */
export function useProject(
  id: string | null,
): SWRResponse<Project, ApiError> {
  return useSWR<Project, ApiError>(
    id ? ["project", id] : null,
    () => api.getProject(id as string),
    baseConfig,
  );
}

/** The current user's notifications. Refreshes every 30s. */
export function useNotifications(): SWRResponse<
  ListResponse<Notification>,
  ApiError
> {
  return useSWR<ListResponse<Notification>, ApiError>(
    "notifications",
    () => api.listNotifications({ limit: 20 }),
    { ...baseConfig, refreshInterval: 30000 },
  );
}

/** The dashboard cost summary for the current month. */
export function useCostSummary(): SWRResponse<CostSummary, ApiError> {
  return useSWR<CostSummary, ApiError>(
    "costs-summary",
    () => api.costsSummary(),
    baseConfig,
  );
}

/** A team's API tokens. Pass `null` to skip fetching (e.g. team unknown). */
export function useTeamTokens(
  teamId: string | null,
): SWRResponse<ListResponse<ApiToken>, ApiError> {
  return useSWR<ListResponse<ApiToken>, ApiError>(
    teamId ? ["team-tokens", teamId] : null,
    () => api.listTeamTokens(teamId as string),
    baseConfig,
  );
}

/** A project's env vars (secrets masked). Pass `null` to skip fetching. */
export function useProjectEnv(
  projectId: string | null,
): SWRResponse<ListResponse<EnvVar>, ApiError> {
  return useSWR<ListResponse<EnvVar>, ApiError>(
    projectId ? ["project-env", projectId] : null,
    () => api.listProjectEnv(projectId as string),
    baseConfig,
  );
}
