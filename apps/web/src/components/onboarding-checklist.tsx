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

/** localStorage key: the checklist was permanently dismissed. */
const DISMISS_KEY = "shipyard.onboarding.dismissed";

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

  // Every contributing signal must have SETTLED before we trust completion: the
  // token/env queries only begin once me/projects resolve (null SWR keys until
  // then), so a step can read "not done" merely because its query is still in
  // flight. Treat a skipped (null-key) or errored query as settled.
  const previewsSettled =
    previews.data !== undefined || previews.error !== undefined;
  const tokensSettled =
    teamId === null || tokens.data !== undefined || tokens.error !== undefined;
  const envSettled =
    firstProjectId === null ||
    projectEnv.data !== undefined ||
    projectEnv.error !== undefined;
  const dataReady =
    Boolean(me.data) &&
    Boolean(projects.data) &&
    previewsSettled &&
    tokensSettled &&
    envSettled;

  // Emit onboarding analytics only for GENUINE in-session transitions. We
  // snapshot the starting state once every signal has settled — so an
  // already-onboarded team (on any device) emits no historical events — then
  // fire step/completed events as steps flip to done during this session.
  const doneSnapshot = React.useRef<Set<string> | null>(null);
  const completedFired = React.useRef(false);
  const doneKey = steps
    .filter((s) => s.done)
    .map((s) => s.key)
    .join(",");
  React.useEffect(() => {
    if (!mounted || !dataReady) return;
    const done = new Set(steps.filter((s) => s.done).map((s) => s.key));

    // Capture the baseline exactly once, after all signals have settled.
    if (doneSnapshot.current === null) {
      doneSnapshot.current = done;
      if (progress.complete) completedFired.current = true; // already onboarded
      return;
    }

    for (const key of done) {
      if (!doneSnapshot.current.has(key)) {
        trackEvent(ANALYTICS_EVENTS.onboardingStepCompleted, { step: key });
      }
    }
    doneSnapshot.current = done;

    if (progress.complete && !completedFired.current) {
      completedFired.current = true;
      trackEvent(ANALYTICS_EVENTS.onboardingCompleted, { steps: progress.total });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, dataReady, doneKey]);

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
  if (!dataReady) return null;
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
