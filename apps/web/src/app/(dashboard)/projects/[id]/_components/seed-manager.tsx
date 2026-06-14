"use client";

import { Database, Pencil, Plus, Star, Trash2 } from "lucide-react";
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
import { api, ApiError } from "@/lib/api";

import type { ListResponse, SeedTemplate } from "@/lib/api-types";
import type { SeedKind } from "@shipyard/core";

/** Selectable seed kinds with friendly labels and source hints. */
const KINDS: ReadonlyArray<{
  value: SeedKind;
  label: string;
  hint: string;
  placeholder: string;
}> = [
  {
    value: "SQL",
    label: "Inline SQL",
    hint: "SQL statements run against a fresh preview database.",
    placeholder: "INSERT INTO users (email) VALUES ('demo@example.com');",
  },
  {
    value: "SCRIPT",
    label: "Script",
    hint: "Path to a script executed to seed the environment.",
    placeholder: "scripts/seed.ts",
  },
  {
    value: "SNAPSHOT",
    label: "Snapshot",
    hint: "Reference to a stored database snapshot to restore.",
    placeholder: "snapshots/2026-06-01-baseline",
  },
];

/** Loose extraction of an API error message. */
function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** The add/edit seed-template dialog. */
function SeedDialog({
  projectId,
  existing,
  open,
  onOpenChange,
  onSaved,
}: {
  projectId: string;
  existing: SeedTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}): React.JSX.Element {
  const isEdit = existing !== null;
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<SeedKind>("SQL");
  const [source, setSource] = React.useState("");
  const [isDefault, setIsDefault] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "");
    setKind(existing?.kind ?? "SQL");
    setSource(existing?.source ?? "");
    setIsDefault(existing?.isDefault ?? false);
  }, [open, existing]);

  const kindMeta = KINDS.find((k) => k.value === kind);
  const isSql = kind === "SQL";

  const canSubmit =
    name.trim().length > 0 && source.trim().length > 0 && !busy;

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (isEdit && existing) {
        const body: {
          name?: string;
          kind?: SeedKind;
          source?: string;
          isDefault?: boolean;
        } = {};
        if (name.trim() !== existing.name) body.name = name.trim();
        if (kind !== existing.kind) body.kind = kind;
        if (source !== existing.source) body.source = source;
        if (isDefault !== existing.isDefault) body.isDefault = isDefault;
        if (Object.keys(body).length === 0) {
          toast.info("No changes to save");
          onOpenChange(false);
          return;
        }
        await api.patch<SeedTemplate>(`/seeds/${existing.id}`, body);
        toast.success(`Updated ${existing.name}`);
      } else {
        await api.post<SeedTemplate>(`/projects/${projectId}/seeds`, {
          name: name.trim(),
          kind,
          source,
          isDefault,
        });
        toast.success(`Added ${name.trim()}`);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(errMessage(err, "Failed to save seed template"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? null : onOpenChange(o))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit ${existing?.name}` : "Add seed template"}
          </DialogTitle>
          <DialogDescription>
            Seed templates populate a fresh preview database when an environment
            is created.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="seed-name">Name</Label>
            <Input
              id="seed-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Demo data"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="seed-kind">Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as SeedKind)}>
              <SelectTrigger id="seed-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{kindMeta?.hint}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="seed-source">
              {isSql ? "SQL" : "Source"}
            </Label>
            <textarea
              id="seed-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={kindMeta?.placeholder}
              spellCheck={false}
              rows={isSql ? 6 : 2}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div className="space-y-0.5">
              <Label
                htmlFor="seed-default"
                className="flex items-center gap-1.5"
              >
                <Star className="size-3.5" />
                Default template
              </Label>
              <p className="text-xs text-muted-foreground">
                Used automatically for new previews. Setting this unsets any
                other default.
              </p>
            </div>
            <Switch
              id="seed-default"
              checked={isDefault}
              onCheckedChange={setIsDefault}
              aria-label="Mark as default"
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
            {isEdit ? "Save changes" : "Add template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The project Seed Templates manager.
 *
 * Lists a project's seed templates and supports add (dialog), edit (dialog),
 * delete (confirm), and "make default" (a single template can be the default,
 * enforced server-side). Renders loading, empty, and error states with toasts.
 */
export function SeedManager({
  projectId,
}: {
  projectId: string;
}): React.JSX.Element {
  const seeds = useSWR<ListResponse<SeedTemplate>, ApiError>(
    ["project-seeds", projectId],
    () => api.listProjectSeeds(projectId, { limit: 100 }),
  );

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SeedTemplate | null>(null);
  const [deleting, setDeleting] = React.useState<SeedTemplate | null>(null);
  const [defaultingId, setDefaultingId] = React.useState<string | null>(null);

  const items = seeds.data?.data ?? [];

  const openAdd = (): void => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (s: SeedTemplate): void => {
    setEditing(s);
    setDialogOpen(true);
  };

  const makeDefault = async (s: SeedTemplate): Promise<void> => {
    setDefaultingId(s.id);
    try {
      await api.patch<SeedTemplate>(`/seeds/${s.id}`, { isDefault: true });
      toast.success(`${s.name} is now the default`);
      void seeds.mutate();
    } catch (err) {
      toast.error(errMessage(err, "Failed to set default"));
    } finally {
      setDefaultingId(null);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleting) return;
    try {
      await api.del<void>(`/seeds/${deleting.id}`);
      toast.success(`Deleted ${deleting.name}`);
      void seeds.mutate();
    } catch (err) {
      toast.error(errMessage(err, "Failed to delete seed template"));
      throw err;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Seed templates</h3>
          <p className="text-sm text-muted-foreground">
            Define how fresh preview databases are populated.
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4" />
          Add template
        </Button>
      </div>

      {seeds.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      ) : seeds.error ? (
        <ErrorState
          description={seeds.error.message}
          onRetry={() => void seeds.mutate()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No seed templates"
          description="Add a template to automatically seed data into new preview databases."
          action={
            <Button size="sm" onClick={openAdd}>
              <Plus className="size-4" />
              Add template
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <div
              key={s.id}
              className="flex items-start justify-between gap-3 rounded-md border p-4"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{s.name}</span>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {s.kind}
                  </Badge>
                  {s.isDefault ? (
                    <Badge variant="info" className="gap-1 text-[10px]">
                      <Star className="size-3" />
                      Default
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {s.source}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!s.isDefault ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={defaultingId === s.id}
                    onClick={() => void makeDefault(s)}
                  >
                    <Star className="size-4" />
                    Make default
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => openEdit(s)}
                  aria-label={`Edit ${s.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleting(s)}
                  aria-label={`Delete ${s.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SeedDialog
        projectId={projectId}
        existing={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => void seeds.mutate()}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => (o ? null : setDeleting(null))}
        title={`Delete ${deleting?.name ?? "template"}?`}
        description="This permanently removes the seed template. New previews will no longer use it. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
