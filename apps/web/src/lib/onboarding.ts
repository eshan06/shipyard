/**
 * First-run onboarding: pure derivation of the getting-started checklist from
 * real account signals (does the team have a project? a preview? a secret? an
 * API token?). Kept framework-agnostic so it is unit-tested without a DOM; the
 * `OnboardingChecklist` component supplies the live signals.
 *
 * @module
 */

/** Booleans derived from the account's current data. */
export interface OnboardingSignals {
  /** The team has at least one connected project. */
  hasProject: boolean;
  /** At least one preview exists (a PR opened or a manual deploy ran). */
  hasPreview: boolean;
  /** At least one environment variable/secret is configured on a project. */
  hasSecret: boolean;
  /** The team has minted at least one API token. */
  hasToken: boolean;
  /** First project id, used to deep-link the "add a secret" step (optional). */
  firstProjectId?: string | null;
}

/** A single checklist step. */
export interface OnboardingStep {
  /** Stable key (also used as the analytics property). */
  key: string;
  /** Short imperative title. */
  title: string;
  /** One-line explanation of the step. */
  description: string;
  /** Whether the step is satisfied. */
  done: boolean;
  /** Where the step's CTA navigates. */
  href: string;
  /** CTA button label. */
  cta: string;
}

/** Aggregate progress over a set of steps. */
export interface OnboardingProgress {
  /** Number of completed steps. */
  done: number;
  /** Total number of steps. */
  total: number;
  /** Whether every step is complete. */
  complete: boolean;
  /** Completion as a 0–100 integer percentage. */
  percent: number;
}

/**
 * Derive the ordered onboarding steps from account signals.
 *
 * @param signals - The current account state.
 * @returns The ordered checklist (stable order, regardless of completion).
 */
export function computeOnboardingSteps(
  signals: OnboardingSignals,
): OnboardingStep[] {
  const projectHref = signals.firstProjectId
    ? `/projects/${signals.firstProjectId}`
    : "/projects";

  return [
    {
      key: "connect-project",
      title: "Connect a project",
      description: "Link a GitHub repository so Shipyard can build previews for it.",
      done: signals.hasProject,
      href: "/projects",
      cta: "Add a project",
    },
    {
      key: "first-preview",
      title: "Get your first preview",
      description:
        "Open a pull request (or trigger a deploy) to spin up a live preview environment.",
      done: signals.hasPreview,
      href: "/previews",
      cta: "View previews",
    },
    {
      key: "add-secret",
      title: "Add an environment variable",
      description:
        "Give your previews the configuration and secrets they need to run. Secrets are encrypted at rest.",
      done: signals.hasSecret,
      href: projectHref,
      cta: signals.hasProject ? "Open project" : "Add a project first",
    },
    {
      key: "create-token",
      title: "Create an API token",
      description: "Use the API or CI integrations with a scoped, team-bound token.",
      done: signals.hasToken,
      href: "/settings/team",
      cta: "Create a token",
    },
  ];
}

/**
 * Summarize completion across steps.
 *
 * @param steps - The checklist steps.
 * @returns Progress totals + percentage.
 */
export function onboardingProgress(steps: OnboardingStep[]): OnboardingProgress {
  const total = steps.length;
  const done = steps.filter((s) => s.done).length;
  return {
    done,
    total,
    complete: total > 0 && done === total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}
