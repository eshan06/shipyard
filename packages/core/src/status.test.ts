import { describe, expect, it } from "vitest";

import {
  DeploymentStatusSchema,
  PreviewStatusSchema,
  type DeploymentStatus,
  type PreviewStatus,
} from "./schemas/enums.js";
import {
  DEPLOYMENT_STATUS_DISPLAY,
  DEPLOYMENT_TRANSITIONS,
  PREVIEW_STATUS_DISPLAY,
  PREVIEW_TRANSITIONS,
  canTransitionDeployment,
  canTransitionPreview,
  deploymentFromsFor,
  deploymentStatusDisplay,
  isDeploymentTerminal,
  isPreviewTerminal,
  previewFromsFor,
  previewStatusDisplay,
} from "./status.js";

const PREVIEW_STATUSES = PreviewStatusSchema.options as readonly PreviewStatus[];
const DEPLOYMENT_STATUSES =
  DeploymentStatusSchema.options as readonly DeploymentStatus[];

describe("status — preview", () => {
  it("defines transitions and display for every enum member", () => {
    for (const status of PREVIEW_STATUSES) {
      expect(PREVIEW_TRANSITIONS[status]).toBeDefined();
      expect(PREVIEW_STATUS_DISPLAY[status]).toBeDefined();
    }
  });

  it("allows the happy-path lifecycle", () => {
    expect(canTransitionPreview("QUEUED", "BUILDING")).toBe(true);
    expect(canTransitionPreview("BUILDING", "DEPLOYING")).toBe(true);
    expect(canTransitionPreview("DEPLOYING", "RUNNING")).toBe(true);
    expect(canTransitionPreview("RUNNING", "STOPPED")).toBe(true);
  });

  it("treats no-op transitions as allowed", () => {
    expect(canTransitionPreview("RUNNING", "RUNNING")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(canTransitionPreview("DESTROYED", "RUNNING")).toBe(false);
    expect(canTransitionPreview("QUEUED", "RUNNING")).toBe(false);
    expect(canTransitionPreview("STOPPED", "RUNNING")).toBe(false);
  });

  it("allows re-queue from FAILED and STOPPED", () => {
    expect(canTransitionPreview("FAILED", "QUEUED")).toBe(true);
    expect(canTransitionPreview("STOPPED", "QUEUED")).toBe(true);
  });

  it("marks only DESTROYED as terminal", () => {
    expect(isPreviewTerminal("DESTROYED")).toBe(true);
    for (const status of PREVIEW_STATUSES.filter((s) => s !== "DESTROYED")) {
      expect(isPreviewTerminal(status)).toBe(false);
    }
  });

  it("terminal statuses have no outgoing transitions", () => {
    for (const status of PREVIEW_STATUSES) {
      if (isPreviewTerminal(status)) {
        expect(PREVIEW_TRANSITIONS[status]).toHaveLength(0);
      }
    }
  });

  it("exposes display metadata", () => {
    expect(previewStatusDisplay("RUNNING")).toEqual({
      label: "Running",
      color: "success",
      isActive: true,
    });
  });
});

describe("status — deployment", () => {
  it("defines transitions and display for every enum member", () => {
    for (const status of DEPLOYMENT_STATUSES) {
      expect(DEPLOYMENT_TRANSITIONS[status]).toBeDefined();
      expect(DEPLOYMENT_STATUS_DISPLAY[status]).toBeDefined();
    }
  });

  it("allows the happy-path lifecycle", () => {
    expect(canTransitionDeployment("QUEUED", "BUILDING")).toBe(true);
    expect(canTransitionDeployment("BUILDING", "DEPLOYING")).toBe(true);
    expect(canTransitionDeployment("DEPLOYING", "SUCCEEDED")).toBe(true);
  });

  it("allows cancellation/failure from non-terminal states", () => {
    expect(canTransitionDeployment("QUEUED", "CANCELLED")).toBe(true);
    expect(canTransitionDeployment("BUILDING", "FAILED")).toBe(true);
  });

  it("rejects transitions out of terminal states", () => {
    expect(canTransitionDeployment("SUCCEEDED", "DEPLOYING")).toBe(false);
    expect(canTransitionDeployment("FAILED", "QUEUED")).toBe(false);
    expect(canTransitionDeployment("CANCELLED", "QUEUED")).toBe(false);
  });

  it("marks SUCCEEDED/FAILED/CANCELLED as terminal", () => {
    expect(isDeploymentTerminal("SUCCEEDED")).toBe(true);
    expect(isDeploymentTerminal("FAILED")).toBe(true);
    expect(isDeploymentTerminal("CANCELLED")).toBe(true);
    expect(isDeploymentTerminal("QUEUED")).toBe(false);
  });

  it("exposes display metadata", () => {
    expect(deploymentStatusDisplay("FAILED")).toEqual({
      label: "Failed",
      color: "danger",
      isActive: false,
    });
  });
});

describe("previewFromsFor / deploymentFromsFor (CAS source states)", () => {
  it("returns every legal source state (plus the target itself) for a preview target", () => {
    // DEPLOYING and QUEUED/STOPPED/FAILED can reach RUNNING? Only DEPLOYING/DEGRADED
    // legally reach RUNNING; the helper must include those and RUNNING itself,
    // and must NOT include a terminal DESTROYED.
    const froms = previewFromsFor("RUNNING");
    expect(froms).toContain("RUNNING"); // idempotent same-state write
    expect(froms).toContain("DEPLOYING");
    expect(froms).toContain("DEGRADED");
    expect(froms).not.toContain("DESTROYED");
    // Consistency with the transition table: every returned `from` (except the
    // target itself) can legally transition to the target.
    for (const from of froms) {
      if (from === "RUNNING") continue;
      expect(canTransitionPreview(from, "RUNNING")).toBe(true);
    }
  });

  it("cannot resurrect a DESTROYED preview: DESTROYED is never a legal source", () => {
    for (const to of ["RUNNING", "BUILDING", "DEPLOYING", "STOPPED"] as const) {
      expect(previewFromsFor(to)).not.toContain("DESTROYED");
    }
  });

  it("returns the legal source states for a deployment target", () => {
    const froms = deploymentFromsFor("SUCCEEDED");
    expect(froms).toContain("SUCCEEDED");
    expect(froms).toContain("DEPLOYING");
    expect(froms).not.toContain("FAILED");
    expect(froms).not.toContain("CANCELLED");
  });
});
