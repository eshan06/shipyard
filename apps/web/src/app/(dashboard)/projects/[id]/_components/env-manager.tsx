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

import type { EnvVar, ListResponse } from "@/lib/api-types";
import type { EnvTarget } from "@shipyard/core";

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

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label htmlFor="env-key" style={{ fontSize: 12, color: "var(--tx-dim)" }}>
              Key
            </label>
            <input
              id="env-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="DATABASE_URL"
              disabled={isEdit}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={keyError ? true : undefined}
              aria-describedby={keyError ? "env-key-error" : undefined}
              style={{
                ...inputStyle,
                borderColor: keyError ? "var(--red-line)" : "var(--line)",
                opacity: isEdit ? 0.6 : 1,
              }}
            />
            {keyError ? (
              <p id="env-key-error" style={{ fontSize: 11.5, color: "#ff8c82" }}>
                {keyError}
              </p>
            ) : isEdit ? (
              <p className="psub" style={{ fontSize: 11.5 }}>
                The key is fixed once created.
              </p>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label htmlFor="env-value" style={{ fontSize: 12, color: "var(--tx-dim)" }}>
              Value{" "}
              {isEdit ? (
                <span style={{ color: "var(--tx-faint)" }}>
                  (optional — blank keeps current)
                </span>
              ) : null}
            </label>
            <div style={{ position: "relative" }}>
              <input
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
                style={{ ...inputStyle, paddingRight: 34 }}
              />
              <button
                type="button"
                onClick={() => setShowValue((s) => !s)}
                aria-label={showValue ? "Hide value" : "Show value"}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "grid",
                  placeItems: "center",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--tx-dim)",
                  padding: 0,
                }}
              >
                {showValue ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {isEdit && existing?.isSecret && value.length === 0 ? (
              <p className="psub" style={{ fontSize: 11.5 }}>
                The current secret cannot be displayed. Type a new value to
                rotate it.
              </p>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, color: "var(--tx-dim)" }}>Target</label>
            <Select
              value={target}
              options={TARGETS.map((t) => ({ value: t.value, label: t.label }))}
              onChange={(v) => setTarget(v as EnvTarget)}
              width={220}
            />
            <p className="psub" style={{ fontSize: 11.5 }}>
              {TARGETS.find((t) => t.value === target)?.hint}
            </p>
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
                <Lock size={13} />
                Secret
              </div>
              <p className="psub" style={{ marginTop: 3, fontSize: 11.5 }}>
                Encrypted at rest and never shown again after saving.
              </p>
            </div>
            <Toggle on={isSecret} onChange={setIsSecret} />
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
            {isEdit ? "Save changes" : "Add variable"}
          </button>
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
    <tr style={{ cursor: "default" }}>
      <td>
        <span
          className="c-mono"
          style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 500 }}
        >
          {v.isSecret ? (
            <Lock size={13} style={{ color: "var(--amber)", flex: "none" }} />
          ) : (
            <KeyRound size={13} style={{ color: "var(--tx-dim)", flex: "none" }} />
          )}
          {v.key}
        </span>
      </td>
      <td style={{ maxWidth: "16rem" }}>
        {v.isSecret ? (
          <span
            className="c-mono"
            title="Secret values are encrypted and can never be revealed."
            aria-label="Hidden secret value"
            style={{ color: "var(--tx-dim)", userSelect: "none" }}
          >
            {SECRET_MASK}
          </span>
        ) : (
          <span
            className="c-mono truncate"
            style={{ color: "var(--tx-dim)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {v.value && v.value.length > 0 ? (
              v.value
            ) : (
              <span style={{ fontStyle: "italic", opacity: 0.6 }}>empty</span>
            )}
          </span>
        )}
      </td>
      <td>
        <span className="pill">{v.target}</span>
      </td>
      <td>
        {v.isSecret ? (
          <span className="badge b-amber">
            <Lock size={11} />
            Secret
          </span>
        ) : (
          <span className="badge b-gray">Plain</span>
        )}
      </td>
      <td style={{ textAlign: "right" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
          <button
            className="copybtn"
            onClick={() => onEdit(v)}
            aria-label={`Edit ${v.key}`}
          >
            <Pencil size={13} />
          </button>
          <button
            className="copybtn"
            onClick={() => onDelete(v)}
            aria-label={`Delete ${v.key}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
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
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Environment variables</h3>
          <p className="psub" style={{ marginTop: 4 }}>
            Project-scoped variables injected into every preview.
            {items.length > 0
              ? ` ${items.length} total${
                  secretCount > 0 ? `, ${secretCount} secret` : ""
                }.`
              : ""}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <Plus size={13} />
          Add variable
        </button>
      </div>

      {env.isLoading ? (
        <div className="empty">Loading variables…</div>
      ) : env.error ? (
        <div className="empty">
          <div style={{ marginBottom: 10 }}>{env.error.message}</div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => void env.mutate()}
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="empty">
          <KeyRound
            size={20}
            style={{ display: "block", margin: "0 auto 10px", opacity: 0.6 }}
          />
          No environment variables yet — add variables and secrets here to make
          them available to every preview in this project.
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary btn-sm" onClick={openAdd}>
              <Plus size={13} />
              Add variable
            </button>
          </div>
        </div>
      ) : (
        <div className="tablewrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Target</th>
                <th>Type</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <EnvVarRow
                  key={v.id}
                  v={v}
                  onEdit={openEdit}
                  onDelete={setDeleting}
                />
              ))}
            </tbody>
          </table>
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
