"use client";

import { Database, Pencil, Plus, Star, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Select, Toggle } from "@/components/sy";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";

import type { ListResponse, SeedTemplate } from "@/lib/api-types";
import type { SeedKind } from "@shipyard/core";

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

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label htmlFor="seed-name" style={{ fontSize: 12, color: "var(--tx-dim)" }}>
              Name
            </label>
            <input
              id="seed-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Demo data"
              autoComplete="off"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, color: "var(--tx-dim)" }}>Kind</label>
            <Select
              value={kind}
              options={KINDS.map((k) => ({ value: k.value, label: k.label }))}
              onChange={(v) => setKind(v as SeedKind)}
              width={220}
            />
            <p className="psub" style={{ fontSize: 11.5 }}>
              {kindMeta?.hint}
            </p>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label htmlFor="seed-source" style={{ fontSize: 12, color: "var(--tx-dim)" }}>
              {isSql ? "SQL" : "Source"}
            </label>
            <textarea
              id="seed-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={kindMeta?.placeholder}
              spellCheck={false}
              rows={isSql ? 6 : 2}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Star size={13} />
                Default template
              </div>
              <p className="psub" style={{ marginTop: 3, fontSize: 11.5 }}>
                Used automatically for new previews. Setting this unsets any
                other default.
              </p>
            </div>
            <Toggle on={isDefault} onChange={setIsDefault} />
          </div>
        </div>

        <DialogFooter>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            {isEdit ? "Save changes" : "Add template"}
          </button>
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
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Seed templates</h3>
          <p className="psub" style={{ marginTop: 4 }}>
            Define how fresh preview databases are populated.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <Plus size={13} />
          Add template
        </button>
      </div>

      {seeds.isLoading ? (
        <div className="empty">Loading templates…</div>
      ) : seeds.error ? (
        <div className="empty">
          <div style={{ marginBottom: 10 }}>{seeds.error.message}</div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => void seeds.mutate()}
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="empty">
          <Database
            size={20}
            style={{ display: "block", margin: "0 auto 10px", opacity: 0.6 }}
          />
          No seed templates yet — add a template to automatically seed data into
          new preview databases.
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary btn-sm" onClick={openAdd}>
              <Plus size={13} />
              Add template
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((s) => (
            <div
              key={s.id}
              className="card"
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                padding: 16,
              }}
            >
              <div style={{ minWidth: 0, display: "grid", gap: 6 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    className="truncate"
                    style={{ fontSize: 13, fontWeight: 600 }}
                  >
                    {s.name}
                  </span>
                  <span className="pill" style={{ textTransform: "uppercase" }}>
                    {s.kind}
                  </span>
                  {s.isDefault ? (
                    <span className="badge b-blue">
                      <Star size={11} />
                      Default
                    </span>
                  ) : null}
                </div>
                <p
                  className="c-mono truncate"
                  style={{
                    color: "var(--tx-dim)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.source}
                </p>
              </div>
              <div
                style={{
                  display: "flex",
                  flex: "none",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {!s.isDefault ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={defaultingId === s.id}
                    onClick={() => void makeDefault(s)}
                  >
                    <Star size={13} />
                    Make default
                  </button>
                ) : null}
                <button
                  className="copybtn"
                  onClick={() => openEdit(s)}
                  aria-label={`Edit ${s.name}`}
                >
                  <Pencil size={13} />
                </button>
                <button
                  className="copybtn"
                  onClick={() => setDeleting(s)}
                  aria-label={`Delete ${s.name}`}
                >
                  <Trash2 size={13} />
                </button>
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
