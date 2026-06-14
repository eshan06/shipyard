"use client";

import { Pause, Play, Radio, Trash2 } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDeploymentLogs, type StreamState } from "@/lib/sse";
import { logTime } from "@/lib/time";
import { cn } from "@/lib/utils";

import type { LogEvent } from "@/lib/api-types";

/** Tailwind text color per log level. */
const LEVEL_COLOR: Record<string, string> = {
  DEBUG: "text-muted-foreground",
  INFO: "text-foreground/80",
  WARN: "text-warning",
  ERROR: "text-destructive",
};

/** A small connection-state pill for the log stream. */
function ConnectionPill({ state }: { state: StreamState }): React.JSX.Element {
  const map: Record<StreamState, { label: string; variant: "success" | "muted" | "info" | "destructive" }> = {
    open: { label: "Live", variant: "success" },
    connecting: { label: "Connecting", variant: "info" },
    closed: { label: "Idle", variant: "muted" },
    error: { label: "Reconnecting", variant: "destructive" },
  };
  const { label, variant } = map[state];
  return (
    <Badge variant={variant} className="gap-1.5">
      <Radio className="size-3" />
      {label}
    </Badge>
  );
}

/** A single rendered log line. */
function LogLine({ line }: { line: LogEvent }): React.JSX.Element {
  return (
    <div className="flex gap-3 px-3 py-0.5 hover:bg-white/5">
      <span className="shrink-0 select-none text-muted-foreground/60">
        {logTime(line.ts)}
      </span>
      <span
        className={cn(
          "shrink-0 select-none font-semibold uppercase",
          LEVEL_COLOR[line.level] ?? "text-muted-foreground",
        )}
      >
        {line.level.padEnd(5)}
      </span>
      <span className="whitespace-pre-wrap break-all">{line.message}</span>
    </div>
  );
}

/** Props for {@link LogViewer}. */
export interface LogViewerProps {
  /** The deployment whose logs to stream (nullish keeps the stream closed). */
  deploymentId: string | null | undefined;
  /** Optional heading shown above the panel. */
  title?: string;
  /** Panel height class (default `h-96`). */
  heightClass?: string;
}

/**
 * A live log streaming panel for a deployment. Streams over SSE (backfill +
 * live tail), color-codes by level, auto-scrolls to the newest line, and lets
 * the user pause/resume the tail and clear the buffer. Auto-scroll suspends
 * while paused and while the user has scrolled up to read history.
 */
export function LogViewer({
  deploymentId,
  title = "Live logs",
  heightClass = "h-96",
}: LogViewerProps): React.JSX.Element {
  const [paused, setPaused] = React.useState(false);
  const { logs, state, clear } = useDeploymentLogs(deploymentId, {
    enabled: !paused,
  });
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [stickToBottom, setStickToBottom] = React.useState(true);

  // Auto-scroll to the newest line when stuck to the bottom and not paused.
  React.useEffect(() => {
    if (!stickToBottom || paused) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs, stickToBottom, paused]);

  const onScroll = (): void => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setStickToBottom(atBottom);
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-medium">{title}</span>
          <ConnectionPill state={paused ? "closed" : state} />
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Resume log stream" : "Pause log stream"}
          >
            {paused ? (
              <Play className="size-4" />
            ) : (
              <Pause className="size-4" />
            )}
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={clear}
            aria-label="Clear logs"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={cn(
          "scrollbar-thin overflow-y-auto bg-[hsl(222,33%,8%)] p-1 font-mono text-xs leading-relaxed text-foreground",
          heightClass,
        )}
      >
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
            {deploymentId
              ? paused
                ? "Stream paused."
                : "Waiting for log output…"
              : "No deployment to stream."}
          </div>
        ) : (
          logs.map((line) => <LogLine key={line.seq} line={line} />)
        )}
      </div>
    </div>
  );
}
