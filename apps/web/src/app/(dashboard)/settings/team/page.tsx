"use client";

import { KeyRound, Plus, Shield, ShieldAlert, Trash2, Users } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyBtn } from "@/components/sy";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import { api, ApiError } from "@/lib/api";
import { useMe, useTeamTokens } from "@/lib/hooks";
import { absoluteTime, relativeTime } from "@/lib/time";
import { formatUsd, initials } from "@/lib/utils";

import { canManage, useActiveTeam } from "./_components/use-active-team";

import type { ApiToken } from "@/lib/api-types";
import type { MembershipRole } from "@shipyard/core";

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

/** Deterministic magenta→blue gradient for a member avatar tile. */
function avatarGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) % 360;
  }
  return `linear-gradient(135deg, hsl(${h} 70% 62%), hsl(${(h + 48) % 360} 72% 56%))`;
}

/** The `.role` chip class for a membership role (owner-tinted vs member-tinted). */
function roleClass(role: MembershipRole): string {
  return `role ${role === "OWNER" ? "owner" : "member"}`;
}

/**
 * Team settings — "engineering terminal" redesign. Shows the active team's
 * overview (slug, budget, member count, created, id), its members, and its API
 * tokens, all wired to the real `/me` and team-token hooks. The active team and
 * the caller's role come from {@link useActiveTeam}. The create/revoke controls
 * render for ADMIN/OWNER roles but are presentational here. Renders
 * loading/empty/error states.
 */
export default function TeamSettingsPage(): React.JSX.Element {
  const me = useMe();
  const { memberships, teamId, active, role, isLoading, error, refresh } =
    useActiveTeam();
  const tokens = useTeamTokens(teamId);
  const tokenItems: ApiToken[] = tokens.data?.data ?? [];

  const user = me.data?.user;
  const team = active?.team;

  // ── API-token create/revoke state (terminal-styled, inline) ────────────────
  const [createOpen, setCreateOpen] = React.useState(false);
  const [tokenName, setTokenName] = React.useState("");
  const [tokenExpiry, setTokenExpiry] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [rawToken, setRawToken] = React.useState<string | null>(null);
  const [revoking, setRevoking] = React.useState<ApiToken | null>(null);

  const resetCreate = React.useCallback(() => {
    setCreateOpen(false);
    setTokenName("");
    setTokenExpiry("");
    setRawToken(null);
    setCreating(false);
  }, []);

  const handleCreate = async (): Promise<void> => {
    if (!teamId || tokenName.trim().length === 0 || creating) return;
    setCreating(true);
    try {
      const result = await api.createTeamToken(teamId, {
        name: tokenName.trim(),
        expiresAt: tokenExpiry ? new Date(tokenExpiry).toISOString() : undefined,
      });
      setRawToken(result.token);
      trackEvent(ANALYTICS_EVENTS.apiTokenCreated, { teamId });
      toast.success(`Created ${result.apiToken.name}`);
      void tokens.mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create token");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (): Promise<void> => {
    if (!teamId || !revoking) return;
    try {
      await api.revokeTeamToken(teamId, revoking.id);
      trackEvent(ANALYTICS_EVENTS.apiTokenRevoked, { teamId });
      toast.success(`Revoked ${revoking.name}`);
      void tokens.mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to revoke token");
      throw err;
    }
  };

  return (
    <div className="page fade-in">
      <div className="phead">
        <div className="phead-l">
          <h1 className="ptitle">Team settings</h1>
          <p className="psub">Manage your team, members, and API access.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="empty">Loading team…</div>
      ) : error ? (
        <div className="empty">
          <div style={{ marginBottom: 10 }}>
            Couldn&apos;t load your teams — {error.message}
          </div>
          <button className="btn btn-outline btn-sm" onClick={refresh}>
            Retry
          </button>
        </div>
      ) : memberships.length === 0 || !active || !team || !teamId ? (
        <div className="empty">You don&apos;t belong to any teams yet.</div>
      ) : (
        <>
          <div
            className="two-col"
            style={{ marginBottom: 18, alignItems: "start" }}
          >
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">
                  <Users size={16} />
                  {team.name}
                </span>
                <span className="panel-act">
                  {role ? (
                    <span className={roleClass(role)}>{role}</span>
                  ) : null}
                </span>
              </div>
              <div style={{ padding: "6px 18px 16px" }}>
                <div className="kv">
                  <span className="kv-k">Slug</span>
                  <span className="kv-v mono">{team.slug}</span>
                </div>
                <div className="kv">
                  <span className="kv-k">Monthly budget</span>
                  <span className="kv-v mono">
                    {team.budgetUsdMonthly != null
                      ? formatUsd(team.budgetUsdMonthly)
                      : "—"}
                  </span>
                </div>
                <div className="kv">
                  <span className="kv-k">Members</span>
                  <span className="kv-v mono">{memberships.length}</span>
                </div>
                <div className="kv">
                  <span className="kv-k">Created</span>
                  <span className="kv-v mono">{absoluteTime(team.createdAt)}</span>
                </div>
                <div className="kv">
                  <span className="kv-k">Team ID</span>
                  <span className="kv-v">
                    <span className="mono">{team.id}</span>
                    <CopyBtn text={team.id} />
                  </span>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">
                  <Users size={16} />
                  Members
                </span>
              </div>
              <div style={{ padding: "8px 14px 12px" }}>
                {user ? (
                  (() => {
                    const name = user.name ?? user.email;
                    const handle = user.githubLogin ?? user.email;
                    return (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 11,
                          padding: "9px 4px",
                          borderBottom: "1px solid var(--line-soft)",
                        }}
                      >
                        <span
                          className="avatar-sm"
                          style={{ background: avatarGradient(handle) }}
                        >
                          {initials(name)}
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {name}
                          </div>
                          <div
                            className="mono"
                            style={{ fontSize: 11, color: "var(--tx-dim)" }}
                          >
                            @{handle}
                          </div>
                        </div>
                        {role ? (
                          <span className={roleClass(role)}>{role}</span>
                        ) : null}
                      </div>
                    );
                  })()
                ) : (
                  <div className="empty">No members to show.</div>
                )}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">
                <KeyRound size={16} />
                API tokens
              </span>
              <span className="panel-act">
                {canManage(role) ? (
                  <button
                    className="btn btn-primary btn-sm"
                    type="button"
                    onClick={() => {
                      setCreateOpen((o) => !o);
                      setRawToken(null);
                    }}
                  >
                    <Plus size={13} />
                    Create token
                  </button>
                ) : null}
              </span>
            </div>

            {createOpen && canManage(role) ? (
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--line-soft)",
                }}
              >
                {rawToken === null ? (
                  <div style={{ display: "grid", gap: 12, maxWidth: 460 }}>
                    <div style={{ display: "grid", gap: 5 }}>
                      <label
                        htmlFor="tk-name"
                        style={{ fontSize: 12, color: "var(--tx-dim)" }}
                      >
                        Name
                      </label>
                      <input
                        id="tk-name"
                        style={inputStyle}
                        value={tokenName}
                        onChange={(e) => setTokenName(e.target.value)}
                        placeholder="CI pipeline"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                    <div style={{ display: "grid", gap: 5 }}>
                      <label
                        htmlFor="tk-exp"
                        style={{ fontSize: 12, color: "var(--tx-dim)" }}
                      >
                        Expiry <span style={{ color: "var(--tx-faint)" }}>(optional)</span>
                      </label>
                      <input
                        id="tk-exp"
                        type="date"
                        style={inputStyle}
                        value={tokenExpiry}
                        min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
                        onChange={(e) => setTokenExpiry(e.target.value)}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        type="button"
                        disabled={tokenName.trim().length === 0 || creating}
                        onClick={() => void handleCreate()}
                      >
                        {creating ? "Creating…" : "Create token"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={resetCreate}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 11, maxWidth: 560 }}>
                    <div
                      role="alert"
                      style={{
                        display: "flex",
                        gap: 9,
                        alignItems: "flex-start",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--warn, #b7791f)",
                        background: "rgba(183,121,31,0.12)",
                        fontSize: 12.5,
                      }}
                    >
                      <ShieldAlert size={15} style={{ marginTop: 1, flexShrink: 0 }} />
                      <span>
                        Copy this token now and store it securely — it is shown once and
                        cannot be recovered.
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <code
                        className="mono"
                        style={{
                          ...inputStyle,
                          overflowX: "auto",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {rawToken}
                      </code>
                      <CopyBtn text={rawToken} />
                    </div>
                    <div>
                      <button className="btn btn-outline btn-sm" type="button" onClick={resetCreate}>
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {tokens.isLoading ? (
              <div className="empty">Loading tokens…</div>
            ) : tokens.error ? (
              <div className="empty">Couldn&apos;t load tokens.</div>
            ) : tokenItems.length === 0 ? (
              <div className="empty">No API tokens yet.</div>
            ) : (
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Prefix</th>
                    <th>Last used</th>
                    <th>Expires</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tokenItems.map((tk) => (
                    <tr key={tk.id} style={{ cursor: "default" }}>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 9,
                          }}
                        >
                          <KeyRound size={14} style={{ color: "var(--tx-dim)" }} />
                          <span style={{ fontWeight: 600 }}>{tk.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="c-mono">{tk.prefix}…</span>
                      </td>
                      <td>
                        <span className="c-mono" style={{ color: "var(--tx-dim)" }}>
                          {tk.lastUsedAt ? relativeTime(tk.lastUsedAt) : "never"}
                        </span>
                      </td>
                      <td>
                        <span className="c-mono" style={{ color: "var(--tx-dim)" }}>
                          {tk.expiresAt ? absoluteTime(tk.expiresAt) : "never"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {canManage(role) ? (
                          <button
                            className="copybtn"
                            type="button"
                            style={{ marginLeft: "auto" }}
                            aria-label={`Revoke ${tk.name}`}
                            onClick={() => setRevoking(tk)}
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div
              style={{
                padding: "13px 16px",
                borderTop: "1px solid var(--line-soft)",
                display: "flex",
                alignItems: "center",
                gap: 9,
                color: "var(--tx-dim)",
              }}
            >
              <Shield size={14} />
              <span style={{ fontSize: 12 }} className="mono">
                Tokens are shown once at creation. Store them securely.
              </span>
            </div>
          </div>

          <ConfirmDialog
            open={revoking !== null}
            onOpenChange={(o) => (o ? null : setRevoking(null))}
            title={`Revoke ${revoking?.name ?? "token"}?`}
            description="Any integration using this token will immediately lose access. This cannot be undone."
            confirmLabel="Revoke token"
            confirmVariant="destructive"
            onConfirm={handleRevoke}
          />
        </>
      )}
    </div>
  );
}
