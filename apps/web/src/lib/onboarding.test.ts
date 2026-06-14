/**
 * Unit tests for onboarding step derivation + progress.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { computeOnboardingSteps, onboardingProgress } from "./onboarding";

const NONE = {
  hasProject: false,
  hasPreview: false,
  hasSecret: false,
  hasToken: false,
};

describe("computeOnboardingSteps", () => {
  it("returns four steps in a stable order regardless of completion", () => {
    const a = computeOnboardingSteps(NONE).map((s) => s.key);
    const b = computeOnboardingSteps({
      hasProject: true,
      hasPreview: true,
      hasSecret: true,
      hasToken: true,
    }).map((s) => s.key);
    expect(a).toEqual(["connect-project", "first-preview", "add-secret", "create-token"]);
    expect(b).toEqual(a);
  });

  it("maps each signal to its step's done flag", () => {
    const steps = computeOnboardingSteps({
      ...NONE,
      hasProject: true,
      hasToken: true,
    });
    const done = Object.fromEntries(steps.map((s) => [s.key, s.done]));
    expect(done).toEqual({
      "connect-project": true,
      "first-preview": false,
      "add-secret": false,
      "create-token": true,
    });
  });

  it("deep-links the add-secret step to the first project when known", () => {
    const withId = computeOnboardingSteps({ ...NONE, hasProject: true, firstProjectId: "proj_1" });
    const withoutId = computeOnboardingSteps({ ...NONE });
    expect(withId.find((s) => s.key === "add-secret")?.href).toBe("/projects/proj_1");
    expect(withoutId.find((s) => s.key === "add-secret")?.href).toBe("/projects");
  });
});

describe("onboardingProgress", () => {
  it("counts completed steps and reports incomplete", () => {
    const p = onboardingProgress(computeOnboardingSteps({ ...NONE, hasProject: true }));
    expect(p).toEqual({ done: 1, total: 4, complete: false, percent: 25 });
  });

  it("reports complete when every step is done", () => {
    const p = onboardingProgress(
      computeOnboardingSteps({
        hasProject: true,
        hasPreview: true,
        hasSecret: true,
        hasToken: true,
      }),
    );
    expect(p).toEqual({ done: 4, total: 4, complete: true, percent: 100 });
  });
});
