"use client";

import {
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import useSWR from "swr";


import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api, ApiError } from "@/lib/api";

import type { EnvVar, ListResponse } from "@/lib/api-types";
import type { EnvTarget } from "@shipyard/core";

/** Selectable env targets with friendly labels. */
const TARGETS: ReadonlyArray<{ value: EnvTarget; label: string; hint: string }> =
  [
    { value: "BOTH", label: "Build & Runtime", hint: "Available everywhere" },
    { value: "BUILD", label: "Build only", hint: "Injected during the build" },
    { value: "RUNTIME", label: "Runtime only", hint: "Injected at run time" },
  ];

/** A valid POSIX-ish env key, mirroring the API's EnvKeySchema. */
const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Loose extraction of an API error message. */
function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** The masked placeholder rendered for secret values (never revealable). */
const SECRET_MASK = "••••••••••••";

/**
 * The add/edit env-var dialog.
 *
 * On create, all fields are editable. On edit, the `key` is immutable (the API
 * fixes it for the row's lifetime) and the value field is left blank — a blank
 * value means "leave the stored value unchanged", which is the safe default for
 * secrets that can never be revealed.
 */
function EnvVarDialog({
  projectId,
  existing,
  open,
  onOpenChange,
  onSaved,
}: {
  projectId: string;
  existing: EnvVar | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}): React.JSX.Element {
  const isEdit = existing !== null;
  const [key, setKey] = React.useState("");
  const [value, setValue] = React.useState("");
  const [target, setTarget] = React.useState<EnvTarget>("BOTH");
  const [isSecret, setIsSecret] = React.useState(false);
  const [showValue, setShowValue] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Seed the form whenever the dialog opens for a new target row.
  React.useEffect(() => {
    if (!open) return;
    setKey(existing?.key ?? "");
    // Never prefill a value: secrets are unrecoverable, and for non-secrets a
    // blank field still means "unchanged" on edit.
    setValue("");
    setTarget(existing?.target ?? "BOTH");
    setIsSecret(existing?.isSecret ?? false);
    setShowValue(false);
  }, [open, existing]);

  const keyError =
    key.length > 0 && !ENV_KEY_RE.test(key)
      ? "Use letters, digits, and underscores; must not start with a digit."
      : null;

  // On create the value is required; on edit a blank value keeps the current one.
  const valueRequired = !isEdit;
  const canSubmit =
    key.trim().length > 0 &&
    !keyError &&
    (!valueRequired || value.length > 0) &&
    !busy;

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (isEdit && existing) {
        // Only send fields that changed; omit value when left blank.
        const body: {
          value?: string;
          target?: EnvTarget;
          isSecret?: boolean;
        } = {};
        if (value.length > 0) body.value = value;
        if (target !== existing.target) body.target = target;
        if (isSecret !== existing.isSecret) body.isSecret = isSecret;
        if (Object.keys(body).length === 0) {
          toast.info("No changes to save");
          onOpenChange(false);
          return;
        }
        await api.patch<EnvVar>(`/env/${existing.id}`, body);
        toast.success(`Updated ${existing.key}`);
      } else {
        await api.post<EnvVar>(`/projects/${projectId}/env`, {
          key: key.trim(),
          value,
          target,
          isSecret,
        });
        toast.success(`Added ${key.trim()}`);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(errMessage(err, "Failed to save variable"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? null : onOpenChange(o))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit ${existing?.key}` : "Add environment variable"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this variable. Leave the value blank to keep the stored value."
              : "Add a project-scoped variable available to every preview in this project."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="env-key">Key</Label>
            <Input
              id="env-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="DATABASE_URL"
              disabled={isEdit}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              aria-invalid={keyError ? true : undefined}
              aria-describedby={keyError ? "env-key-error" : undefined}
            />
            {keyError ? (
              <p id="env-key-error" className="text-xs text-destructive">
                {keyError}
              </p>
            ) : isEdit ? (
              <p className="text-xs text-muted-foreground">
                The key is fixed once created.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="env-value">
              Value{" "}
              {isEdit ? (
                <span className="font-normal text-muted-foreground">
                  (optional — blank keeps current)
                </span>
              ) : null}
            </Label>
            <div className="relative">
              <Input
                id="env-value"
                type={isSecret && !showValue ? "password" : "text"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={
                  isEdit && existing?.isSecret
                    ? "Enter a new secret to rotate it"
                    : "value"
                }
                autoComplete="off"
                spellCheck={false}
                className="pr-9 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowValue((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                aria-label={showValue ? "Hide value" : "Show value"}
              >
                {showValue ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {isEdit && existing?.isSecret && value.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                The current secret cannot be displayed. Type a new value to
                rotate it.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="env-target">Target</Label>
            <Select
              value={target}
              onValueChange={(v) => setTarget(v as EnvTarget)}
            >
              <SelectTrigger id="env-target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGETS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex flex-col">
                      <span>{t.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {TARGETS.find((t) => t.value === target)?.hint}
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div className="space-y-0.5">
              <Label
                htmlFor="env-secret"
                className="flex items-center gap-1.5"
              >
                <Lock className="size-3.5" />
                Secret
              </Label>
              <p className="text-xs text-muted-foreground">
                Encrypted at rest and never shown again after saving.
              </p>
            </div>
            <Switch
              id="env-secret"
              checked={isSecret}
              onCheckedChange={setIsSecret}
              aria-label="Mark as secret"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {isEdit ? "Save changes" : "Add variable"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A single env-var row in the table. */
function EnvVarRow({
  v,
  onEdit,
  onDelete,
}: {
  v: EnvVar;
  onEdit: (v: EnvVar) => void;
  onDelete: (v: EnvVar) => void;
}): React.JSX.Element {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs font-medium">
        <span className="flex items-center gap-1.5">
          {v.isSecret ? (
            <Lock className="size-3.5 shrink-0 text-warning" />
          ) : (
            <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          {v.key}
        </span>
      </TableCell>
      <TableCell className="max-w-[16rem]">
        {v.isSecret ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="select-none font-mono text-xs text-muted-foreground"
                  aria-label="Hidden secret value"
                >
                  {SECRET_MASK}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Secret values are encrypted and can never be revealed.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="block truncate font-mono text-xs text-muted-foreground">
            {v.value && v.value.length > 0 ? (
              v.value
            ) : (
              <span className="italic opacity-60">empty</span>
            )}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-[10px]">
          {v.target}
        </Badge>
      </TableCell>
      <TableCell>
        {v.isSecret ? (
          <Badge variant="warning" className="gap-1 text-[10px]">
            <Lock className="size-3" />
            Secret
          </Badge>
        ) : (
          <Badge variant="muted" className="text-[10px]">
            Plain
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onEdit(v)}
            aria-label={`Edit ${v.key}`}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(v)}
            aria-label={`Delete ${v.key}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * The project Environment Variables & Secrets manager.
 *
 * Lists project-scoped env vars in a table (secrets are masked with a lock icon
 * and are never revealable), and supports add (dialog), edit (dialog), and
 * delete (confirm) with toasts. Renders loading, empty, and error states.
 */
export function EnvManager({
  projectId,
}: {
  projectId: string;
}): React.JSX.Element {
  const env = useSWR<ListResponse<EnvVar>, ApiError>(
    ["project-env", projectId],
    () => api.listProjectEnv(projectId, { limit: 100 }),
  );

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<EnvVar | null>(null);
  const [deleting, setDeleting] = React.useState<EnvVar | null>(null);

  const items = env.data?.data ?? [];
  const secretCount = items.filter((v) => v.isSecret).length;

  const openAdd = (): void => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (v: EnvVar): void => {
    setEditing(v);
    setDialogOpen(true);
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleting) return;
    try {
      await api.del<void>(`/env/${deleting.id}`);
      toast.success(`Deleted ${deleting.key}`);
      void env.mutate();
    } catch (err) {
      toast.error(errMessage(err, "Failed to delete variable"));
      throw err;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Environment variables</h3>
          <p className="text-sm text-muted-foreground">
            Project-scoped variables injected into every preview.
            {items.length > 0
              ? ` ${items.length} total${
                  secretCount > 0 ? `, ${secretCount} secret` : ""
                }.`
              : ""}
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4" />
          Add variable
        </Button>
      </div>

      {env.isLoading ? (
        <div className="space-y-2 rounded-md border p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : env.error ? (
        <ErrorState
          description={env.error.message}
          onRetry={() => void env.mutate()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No environment variables"
          description="Add variables and secrets here to make them available to every preview in this project."
          action={
            <Button size="sm" onClick={openAdd}>
              <Plus className="size-4" />
              Add variable
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((v) => (
                <EnvVarRow
                  key={v.id}
                  v={v}
                  onEdit={openEdit}
                  onDelete={setDeleting}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EnvVarDialog
        projectId={projectId}
        existing={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => void env.mutate()}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => (o ? null : setDeleting(null))}
        title={`Delete ${deleting?.key ?? "variable"}?`}
        description={
          deleting?.isSecret
            ? "This permanently removes the secret. Any preview relying on it may fail to build or start. This cannot be undone."
            : "This permanently removes the variable from this project. This cannot be undone."
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
