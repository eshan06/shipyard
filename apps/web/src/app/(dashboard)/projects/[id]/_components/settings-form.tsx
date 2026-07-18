"use client";

import { Archive, ArchiveRestore, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Toggle } from "@/components/sy";
import { api, ApiError } from "@/lib/api";

import type { Project } from "@/lib/api-types";

/** Minimal dark-terminal input styling (no shared `.input` class exists). */
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-elev, #0e1015)",
  border: "1px solid var(--line)",
  borderRadius: 7,
  color: "var(--tx)",
  fontFamily: "var(--mono)",
  fontSize: 13,
  padding: "8px 10px",
  outline: "none",
};

/** Loose extraction of an API error message. */
function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** Editable deployment-behaviour settings, persisted via PATCH /projects/:id. */
export function DeploySettingsCard({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: () => void;
}): React.JSX.Element {
  const [autoDeployPrs, setAutoDeployPrs] = React.useState(
    project.autoDeployPrs,
  );
  const [autoStop, setAutoStop] = React.useState(
    String(project.autoStopMinutes),
  );
  const [destroyTtl, setDestroyTtl] = React.useState(
    String(project.destroyTtlMinutes),
  );
  const [busy, setBusy] = React.useState(false);

  // Re-sync when the upstream project changes (e.g. after a successful save).
  React.useEffect(() => {
    setAutoDeployPrs(project.autoDeployPrs);
    setAutoStop(String(project.autoStopMinutes));
    setDestroyTtl(String(project.destroyTtlMinutes));
  }, [project]);

  const autoStopNum = Number(autoStop);
  const destroyTtlNum = Number(destroyTtl);
  const autoStopError =
    autoStop.trim() === "" || !Number.isInteger(autoStopNum) || autoStopNum < 0
      ? "Enter a whole number of minutes (0 disables)."
      : null;
  const destroyTtlError =
    destroyTtl.trim() === "" ||
    !Number.isInteger(destroyTtlNum) ||
    destroyTtlNum < 0
      ? "Enter a whole number of minutes (0 disables)."
      : null;

  const dirty =
    autoDeployPrs !== project.autoDeployPrs ||
    autoStopNum !== project.autoStopMinutes ||
    destroyTtlNum !== project.destroyTtlMinutes;

  const canSave = dirty && !autoStopError && !destroyTtlError && !busy;

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setBusy(true);
    try {
      await api.patch<Project>(`/projects/${project.id}`, {
        autoDeployPrs,
        autoStopMinutes: autoStopNum,
        destroyTtlMinutes: destroyTtlNum,
      });
      toast.success("Settings saved");
      onSaved();
    } catch (err) {
      toast.error(errMessage(err, "Failed to save settings"));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = (): void => {
    setAutoDeployPrs(project.autoDeployPrs);
    setAutoStop(String(project.autoStopMinutes));
    setDestroyTtl(String(project.destroyTtlMinutes));
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Deployment behaviour</span>
      </div>
      <div style={{ padding: "16px 18px 18px", display: "grid", gap: 20 }}>
        <p className="psub" style={{ marginTop: -2 }}>
          Control how previews are created, idled, and reaped for this project.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              Auto-deploy pull requests
            </div>
            <p className="psub" style={{ marginTop: 3 }}>
              Automatically create a preview when a pull request is opened or
              updated.
            </p>
          </div>
          <Toggle on={autoDeployPrs} onChange={setAutoDeployPrs} />
        </div>

        <div className="grid cols-2">
          <div style={{ display: "grid", gap: 6 }}>
            <label
              htmlFor="auto-stop"
              style={{ fontSize: 12, color: "var(--tx-dim)" }}
            >
              Auto-stop after (minutes)
            </label>
            <input
              id="auto-stop"
              type="number"
              min={0}
              inputMode="numeric"
              value={autoStop}
              onChange={(e) => setAutoStop(e.target.value)}
              aria-invalid={autoStopError ? true : undefined}
              style={{
                ...inputStyle,
                borderColor: autoStopError ? "var(--red-line)" : "var(--line)",
              }}
            />
            {autoStopError ? (
              <p style={{ fontSize: 11.5, color: "#ff8c82" }}>{autoStopError}</p>
            ) : (
              <p className="psub" style={{ fontSize: 11.5 }}>
                Idle previews are stopped after this long. 0 disables.
              </p>
            )}
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label
              htmlFor="destroy-ttl"
              style={{ fontSize: 12, color: "var(--tx-dim)" }}
            >
              Destroy TTL (minutes)
            </label>
            <input
              id="destroy-ttl"
              type="number"
              min={0}
              inputMode="numeric"
              value={destroyTtl}
              onChange={(e) => setDestroyTtl(e.target.value)}
              aria-invalid={destroyTtlError ? true : undefined}
              style={{
                ...inputStyle,
                borderColor: destroyTtlError
                  ? "var(--red-line)"
                  : "var(--line)",
              }}
            />
            {destroyTtlError ? (
              <p style={{ fontSize: 11.5, color: "#ff8c82" }}>
                {destroyTtlError}
              </p>
            ) : (
              <p className="psub" style={{ fontSize: 11.5 }}>
                Stopped previews are destroyed after this long. 0 disables.
              </p>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 9,
          }}
        >
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleReset}
            disabled={!dirty || busy}
          >
            Reset
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void handleSave()}
            disabled={!canSave}
          >
            <Save size={14} />
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

/** Archive/unarchive + delete actions for a project. */
export function DangerZoneCard({
  project,
  onChanged,
}: {
  project: Project;
  onChanged: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const toggleArchive = async (): Promise<void> => {
    try {
      await api.patch<Project>(`/projects/${project.id}`, {
        isArchived: !project.isArchived,
      });
      toast.success(
        project.isArchived ? "Project unarchived" : "Project archived",
      );
      onChanged();
    } catch (err) {
      toast.error(errMessage(err, "Failed to update project"));
      throw err;
    }
  };

  const deleteProject = async (): Promise<void> => {
    try {
      await api.del<void>(`/projects/${project.id}`);
      toast.success("Project deleted");
      router.push("/projects");
    } catch (err) {
      toast.error(errMessage(err, "Failed to delete project"));
      throw err;
    }
  };

  return (
    <div className="panel" style={{ borderColor: "var(--red-line)" }}>
      <div className="panel-head">
        <span className="panel-title">Danger zone</span>
      </div>
      <div style={{ padding: "16px 18px 18px", display: "grid", gap: 14 }}>
        <p className="psub" style={{ marginTop: -2 }}>
          Irreversible and destructive actions for this project.
        </p>

        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            padding: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {project.isArchived ? "Unarchive project" : "Archive project"}
            </div>
            <p className="psub" style={{ marginTop: 3 }}>
              {project.isArchived
                ? "Restore this project so new previews can be created."
                : "Hide this project and stop creating new previews. Existing data is kept."}
            </p>
          </div>
          <button
            className="btn btn-outline"
            style={{ flex: "none" }}
            onClick={() => setArchiveOpen(true)}
          >
            {project.isArchived ? (
              <ArchiveRestore size={15} />
            ) : (
              <Archive size={15} />
            )}
            {project.isArchived ? "Unarchive" : "Archive"}
          </button>
        </div>

        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            padding: 16,
            flexWrap: "wrap",
            borderColor: "var(--red-line)",
            background: "var(--red-soft)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Delete project</div>
            <p className="psub" style={{ marginTop: 3 }}>
              Permanently delete this project and all of its previews, env vars,
              and seed templates.
            </p>
          </div>
          <button
            className="btn btn-danger"
            style={{ flex: "none" }}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 size={15} />
            Delete
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={
          project.isArchived ? "Unarchive this project?" : "Archive this project?"
        }
        description={
          project.isArchived
            ? "New previews can be created again after unarchiving."
            : "New previews will no longer be created. You can unarchive later."
        }
        confirmLabel={project.isArchived ? "Unarchive" : "Archive"}
        onConfirm={toggleArchive}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${project.name}?`}
        description="This permanently deletes the project and everything attached to it — previews, environment variables, and seed templates. This cannot be undone."
        confirmLabel="Delete project"
        confirmVariant="destructive"
        onConfirm={deleteProject}
      />
    </div>
  );
}
