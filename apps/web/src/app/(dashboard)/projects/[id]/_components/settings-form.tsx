"use client";

import { Archive, ArchiveRestore, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";


import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";

import type { Project } from "@/lib/api-types";

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
    <Card>
      <CardHeader>
        <CardTitle>Deployment behaviour</CardTitle>
        <CardDescription>
          Control how previews are created, idled, and reaped for this project.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="auto-deploy">Auto-deploy pull requests</Label>
            <p className="text-sm text-muted-foreground">
              Automatically create a preview when a pull request is opened or
              updated.
            </p>
          </div>
          <Switch
            id="auto-deploy"
            checked={autoDeployPrs}
            onCheckedChange={setAutoDeployPrs}
            aria-label="Auto-deploy pull requests"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="auto-stop">Auto-stop after (minutes)</Label>
            <Input
              id="auto-stop"
              type="number"
              min={0}
              inputMode="numeric"
              value={autoStop}
              onChange={(e) => setAutoStop(e.target.value)}
              aria-invalid={autoStopError ? true : undefined}
            />
            {autoStopError ? (
              <p className="text-xs text-destructive">{autoStopError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Idle previews are stopped after this long. 0 disables.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="destroy-ttl">Destroy TTL (minutes)</Label>
            <Input
              id="destroy-ttl"
              type="number"
              min={0}
              inputMode="numeric"
              value={destroyTtl}
              onChange={(e) => setDestroyTtl(e.target.value)}
              aria-invalid={destroyTtlError ? true : undefined}
            />
            {destroyTtlError ? (
              <p className="text-xs text-destructive">{destroyTtlError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Stopped previews are destroyed after this long. 0 disables.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={handleReset}
            disabled={!dirty || busy}
          >
            Reset
          </Button>
          <Button onClick={() => void handleSave()} disabled={!canSave}>
            <Save className="size-4" />
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
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
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Danger zone</CardTitle>
        <CardDescription>
          Irreversible and destructive actions for this project.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {project.isArchived ? "Unarchive project" : "Archive project"}
            </p>
            <p className="text-sm text-muted-foreground">
              {project.isArchived
                ? "Restore this project so new previews can be created."
                : "Hide this project and stop creating new previews. Existing data is kept."}
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => setArchiveOpen(true)}
          >
            {project.isArchived ? (
              <ArchiveRestore className="size-4" />
            ) : (
              <Archive className="size-4" />
            )}
            {project.isArchived ? "Unarchive" : "Archive"}
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Delete project</p>
            <p className="text-sm text-muted-foreground">
              Permanently delete this project and all of its previews, env vars,
              and seed templates.
            </p>
          </div>
          <Button
            variant="destructive"
            className="shrink-0"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </CardContent>

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
    </Card>
  );
}
