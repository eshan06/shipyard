"use client";

import { KeyRound, Plus, ShieldAlert, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/states";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import { api, ApiError } from "@/lib/api";
import { absoluteTime, relativeTime } from "@/lib/time";

import { CopyButton } from "./copy-button";

import type { ApiToken } from "@/lib/api-types";

/** Loose extraction of an API error message. */
function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * The create-token dialog. Collects a name and optional expiry, mints the
 * token, then swaps to a one-time reveal of the raw secret with a copy action
 * and a clear warning that it will never be shown again.
 */
function CreateTokenDialog({
  teamId,
  open,
  onOpenChange,
  onCreated,
}: {
  teamId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}): React.JSX.Element {
  const [name, setName] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  // The raw token, held only in local state for a single reveal — never refetched.
  const [rawToken, setRawToken] = React.useState<string | null>(null);

  // Reset the form/reveal whenever the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setName("");
    setExpiresAt("");
    setRawToken(null);
    setBusy(false);
  }, [open]);

  const canSubmit = name.trim().length > 0 && !busy;

  const handleCreate = async (): Promise<void> => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const result = await api.createTeamToken(teamId, {
        name: name.trim(),
        // Send an ISO string only when an expiry was chosen.
        expiresAt: expiresAt
          ? new Date(expiresAt).toISOString()
          : undefined,
      });
      setRawToken(result.token);
      onCreated();
      trackEvent(ANALYTICS_EVENTS.apiTokenCreated, { teamId });
      toast.success(`Created ${result.apiToken.name}`);
    } catch (err) {
      toast.error(errMessage(err, "Failed to create token"));
    } finally {
      setBusy(false);
    }
  };

  // The dialog cannot be dismissed while minting, nor accidentally during the
  // one-time reveal of the raw secret (user must explicitly click Done).
  const dismissable = !busy;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!dismissable) return;
        onOpenChange(o);
      }}
    >
      <DialogContent>
        {rawToken === null ? (
          <>
            <DialogHeader>
              <DialogTitle>Create API token</DialogTitle>
              <DialogDescription>
                Mint a token for programmatic, non-interactive access to this
                team. The secret is shown once at creation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="token-name">Name</Label>
                <Input
                  id="token-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="CI pipeline"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">
                  A label to recognise this token later (e.g. where it&apos;s
                  used).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="token-expiry">
                  Expiry{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="token-expiry"
                  type="date"
                  value={expiresAt}
                  min={new Date(Date.now() + 86_400_000)
                    .toISOString()
                    .slice(0, 10)}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank for a token that never expires.
                </p>
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
              <Button onClick={() => void handleCreate()} disabled={!canSubmit}>
                Create token
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Copy your API token</DialogTitle>
              <DialogDescription>
                This is the only time the token will be shown.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
              >
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                <p className="text-foreground">
                  Copy this token now and store it somewhere safe. For your
                  security it is never displayed again and cannot be recovered.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="token-value">Token</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="token-value"
                    readOnly
                    value={rawToken}
                    className="font-mono text-xs"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <CopyButton
                    value={rawToken}
                    label="Copy API token"
                    successMessage="Token copied to clipboard"
                    variant="outline"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A single token row with a revoke action. */
function TokenRow({
  token,
  onRevoke,
  canManage,
}: {
  token: ApiToken;
  onRevoke: (token: ApiToken) => void;
  canManage: boolean;
}): React.JSX.Element {
  const expired =
    token.expiresAt != null && new Date(token.expiresAt).getTime() < Date.now();
  return (
    <TableRow>
      <TableCell className="font-medium">{token.name}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {token.prefix}…
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {token.lastUsedAt ? relativeTime(token.lastUsedAt) : "Never"}
      </TableCell>
      <TableCell className="text-xs">
        {token.expiresAt == null ? (
          <span className="text-muted-foreground">No expiry</span>
        ) : expired ? (
          <Badge variant="destructive">Expired</Badge>
        ) : (
          <span className="text-muted-foreground">
            {absoluteTime(token.expiresAt)}
          </span>
        )}
      </TableCell>
      {canManage ? (
        <TableCell className="text-right">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={() => onRevoke(token)}
            aria-label={`Revoke ${token.name}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </TableCell>
      ) : null}
    </TableRow>
  );
}

/**
 * API tokens for the active team. Lists active tokens (safe metadata only) and,
 * for ADMIN/OWNER roles, supports creating a token — revealing the raw secret
 * exactly once with a copy action and a warning — and revoking tokens behind a
 * confirmation dialog. Renders loading, empty, and error states.
 */
export function TokenManager({
  teamId,
  canManageTokens,
}: {
  teamId: string;
  canManageTokens: boolean;
}): React.JSX.Element {
  const tokens = useSWR(["team-tokens", teamId], () =>
    api.listTeamTokens(teamId),
  );
  const items = tokens.data?.data ?? [];

  const [createOpen, setCreateOpen] = React.useState(false);
  const [revoking, setRevoking] = React.useState<ApiToken | null>(null);

  const handleRevoke = async (): Promise<void> => {
    if (!revoking) return;
    try {
      await api.revokeTeamToken(teamId, revoking.id);
      trackEvent(ANALYTICS_EVENTS.apiTokenRevoked, { teamId });
      toast.success(`Revoked ${revoking.name}`);
      void tokens.mutate();
    } catch (err) {
      toast.error(errMessage(err, "Failed to revoke token"));
      throw err;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <KeyRound className="size-4 text-muted-foreground" />
            API tokens
          </h3>
          <p className="text-sm text-muted-foreground">
            {canManageTokens
              ? "Programmatic access tokens for this team."
              : "Programmatic access tokens (read-only for your role)."}
          </p>
        </div>
        {canManageTokens ? (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Create token
          </Button>
        ) : null}
      </div>

      {tokens.isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : tokens.error ? (
        <ErrorState
          description={
            tokens.error instanceof Error
              ? tokens.error.message
              : "Couldn't load tokens"
          }
          onRetry={() => void tokens.mutate()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No API tokens"
          description={
            canManageTokens
              ? "Create a token to grant non-interactive, programmatic access to this team."
              : "This team has no API tokens yet."
          }
          action={
            canManageTokens ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Create token
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Expires</TableHead>
                {canManageTokens ? (
                  <TableHead className="text-right">Actions</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((token) => (
                <TokenRow
                  key={token.id}
                  token={token}
                  onRevoke={setRevoking}
                  canManage={canManageTokens}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateTokenDialog
        teamId={teamId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void tokens.mutate()}
      />

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(o) => (o ? null : setRevoking(null))}
        title={`Revoke ${revoking?.name ?? "token"}?`}
        description="Any integration using this token will immediately lose access. This cannot be undone."
        confirmLabel="Revoke token"
        confirmVariant="destructive"
        onConfirm={handleRevoke}
      />
    </div>
  );
}
