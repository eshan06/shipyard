"use client";

import { Github, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import { api, ApiError } from "@/lib/api";
import { useMe } from "@/lib/hooks";

/**
 * Whether the dev-login (password-less) path is available. Mirrors the API's
 * `DEV_AUTH` gate: in production `POST /auth/dev-login` is disabled, so the form
 * would be broken AND would leak internal seeded emails — render it only in dev.
 */
const DEV_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_DEV_AUTH === "true" ||
  process.env.NODE_ENV === "development";

/** Seeded demo accounts shown as login hints (from `packages/db/prisma/seed.ts`). */
const DEMO_ACCOUNTS: ReadonlyArray<{ email: string; role: string }> = [
  { email: "alice@acme.dev", role: "Owner" },
  { email: "bob@acme.dev", role: "Admin" },
  { email: "carol@acme.dev", role: "Member" },
  { email: "erin@acme.dev", role: "Viewer" },
];

/** Resolve a safe in-app redirect target from the `?next=` param. */
function safeNext(next: string | null): string {
  // Only allow same-origin, absolute in-app paths. Block both `//evil.com` and
  // the backslash form `/\evil.com` (browsers normalize `\` to `/`, so the
  // latter is also protocol-relative → an open redirect). Require a single
  // leading `/` NOT followed by another `/` or `\`.
  if (next && /^\/(?![/\\])/.test(next) && !next.includes("\\")) return next;
  return "/";
}

/**
 * The login page: a centered card with a "Sign in with GitHub" button and — in
 * dev only — a password-less dev-login form. Honours a `?next=` deep link and,
 * if the visitor is already authenticated, bounces straight into the app.
 */
function LoginInner(): React.JSX.Element {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNext(search.get("next"));
  const me = useMe();

  const [email, setEmail] = React.useState(
    DEV_AUTH_ENABLED ? "alice@acme.dev" : "",
  );
  const [submitting, setSubmitting] = React.useState(false);

  // Already authenticated → skip the login page and honour `next`.
  React.useEffect(() => {
    if (me.data) router.replace(next);
  }, [me.data, next, router]);

  const onSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await api.devLogin(email.trim());
      // Buffered now; flushed once the authenticated app mounts after redirect.
      trackEvent(ANALYTICS_EVENTS.signedIn, { method: "dev" });
      toast.success(`Welcome back, ${user.name ?? user.email}`);
      router.push(next);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Login failed. Is the API running?";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span
            className="flex size-12 items-center justify-center rounded-xl bg-primary text-2xl text-primary-foreground shadow-sm"
            aria-hidden
          >
            ⚓
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Shipyard</h1>
            <p className="text-sm text-muted-foreground">
              Preview environments for every pull request.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              {DEV_AUTH_ENABLED
                ? "Continue with GitHub, or use a seeded dev account."
                : "Continue with GitHub to access your dashboard."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Button asChild variant="outline" className="w-full">
              <a href={api.githubAuthUrl()}>
                <Github className="size-4" />
                Sign in with GitHub
              </a>
            </Button>

            {DEV_AUTH_ENABLED ? (
              <>
                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    or dev login
                  </span>
                  <Separator className="flex-1" />
                </div>

                <form onSubmit={onSubmit} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {submitting ? "Signing in…" : "Continue"}
                  </Button>
                </form>
              </>
            ) : null}
          </CardContent>
          {DEV_AUTH_ENABLED ? (
            <CardFooter className="flex-col items-start gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Demo accounts
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_ACCOUNTS.map((acct) => (
                  <button
                    key={acct.email}
                    type="button"
                    onClick={() => setEmail(acct.email)}
                    className="rounded-md border border-border bg-secondary/50 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    {acct.email}{" "}
                    <span className="text-muted-foreground/70">
                      · {acct.role}
                    </span>
                  </button>
                ))}
              </div>
            </CardFooter>
          ) : null}
        </Card>
      </div>
    </main>
  );
}

/**
 * Login page wrapper. `useSearchParams` requires a Suspense boundary to keep the
 * route from opting the whole page into forced dynamic rendering at build.
 */
export default function LoginPage(): React.JSX.Element {
  return (
    <React.Suspense fallback={null}>
      <LoginInner />
    </React.Suspense>
  );
}
