"use client";

import { ArrowRight, CheckCircle2, Circle, Rocket, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import {
  useMe,
  usePreviews,
  useProjectEnv,
  useProjects,
  useTeamTokens,
} from "@/lib/hooks";
import {
  computeOnboardingSteps,
  onboardingProgress,
  type OnboardingStep,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

/** localStorage keys: dismissed permanently, and completed-event fired once. */
const DISMISS_KEY = "shipyard.onboarding.dismissed";
const COMPLETED_KEY = "shipyard.onboarding.completed";

/** A single checklist row. */
function StepRow({ step }: { step: OnboardingStep }): React.JSX.Element {
  return (
    <li className="flex items-start gap-3 py-3">
      {step.done ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
      ) : (
        <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground/50" />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium",
            step.done && "text-muted-foreground line-through",
          )}
        >
          {step.title}
        </p>
        <p className="text-xs text-muted-foreground">{step.description}</p>
      </div>
      {!step.done ? (
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href={step.href}>
            {step.cta}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      ) : null}
    </li>
  );
}

/**
 * First-run onboarding checklist shown on the Overview page. Derives each step's
 * completion from live account data (projects, previews, secrets, API tokens),
 * shows progress, and can be permanently dismissed. Renders nothing once every
 * step is complete or after dismissal, so it never nags established teams.
 */
export function OnboardingChecklist(): React.JSX.Element | null {
  const [mounted, setMounted] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      /* localStorage unavailable (private mode) — show the checklist */
    }
  }, []);

  const me = useMe();
  const projects = useProjects();
  const previews = usePreviews({ limit: 1 });
  const teamId = me.data?.memberships[0]?.teamId ?? null;
  const firstProjectId = projects.data?.data[0]?.id ?? null;
  const tokens = useTeamTokens(teamId);
  const projectEnv = useProjectEnv(firstProjectId);

  const steps = computeOnboardingSteps({
    hasProject: (projects.data?.data.length ?? 0) > 0,
    hasPreview: (previews.data?.data.length ?? 0) > 0,
    hasSecret: (projectEnv.data?.data.length ?? 0) > 0,
    hasToken: (tokens.data?.data.length ?? 0) > 0,
    firstProjectId,
  });
  const progress = onboardingProgress(steps);

  // Fire `onboarding_completed` exactly once, when all steps are first done.
  React.useEffect(() => {
    if (!mounted || !progress.complete) return;
    try {
      if (localStorage.getItem(COMPLETED_KEY) === "1") return;
      localStorage.setItem(COMPLETED_KEY, "1");
    } catch {
      /* ignore */
    }
    trackEvent(ANALYTICS_EVENTS.onboardingCompleted, { steps: progress.total });
  }, [mounted, progress.complete, progress.total]);

  // Fire `onboarding_step_completed` when a step transitions to done in-session
  // (not on the initial load — we snapshot the starting state first).
  const doneSnapshot = React.useRef<Set<string> | null>(null);
  const doneKey = steps
    .filter((s) => s.done)
    .map((s) => s.key)
    .join(",");
  React.useEffect(() => {
    if (!mounted || !projects.data) return;
    const done = new Set(steps.filter((s) => s.done).map((s) => s.key));
    if (doneSnapshot.current === null) {
      doneSnapshot.current = done;
      return;
    }
    for (const key of done) {
      if (!doneSnapshot.current.has(key)) {
        trackEvent(ANALYTICS_EVENTS.onboardingStepCompleted, { step: key });
      }
    }
    doneSnapshot.current = done;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKey, mounted]);

  const dismiss = (): void => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
    trackEvent(ANALYTICS_EVENTS.onboardingDismissed, {
      done: progress.done,
      total: progress.total,
    });
  };

  // Avoid hydration flicker / nagging: render nothing until mounted, while the
  // first signals load, once dismissed, or once fully complete.
  if (!mounted || dismissed) return null;
  if (!projects.data || !me.data) return null;
  if (progress.complete) return null;

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex items-center gap-2">
          <Rocket className="size-5 text-primary" />
          <CardTitle>Get started with Shipyard</CardTitle>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-1 size-7 text-muted-foreground"
          onClick={dismiss}
          aria-label="Dismiss onboarding checklist"
        >
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={progress.done}
            aria-valuemin={0}
            aria-valuemax={progress.total}
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {progress.done} of {progress.total}
          </span>
        </div>
        <ul className="divide-y divide-border/60">
          {steps.map((step) => (
            <StepRow key={step.key} step={step} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
