// Package cli implements the shipyard command surface. Commands are plain
// functions over the api.Client so they are unit-testable against httptest
// servers; main.go only wires flag parsing and dispatch.
package cli

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"text/tabwriter"
	"time"

	"github.com/eshan06/shipyard/cli/internal/api"
)

// Version is stamped by -ldflags at release build time.
var Version = "dev"

// Options carry the global connection settings every command needs.
type Options struct {
	API   string
	Token string
	JSON  bool
	Out   io.Writer
}

// envOr returns the environment value or a fallback.
func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// BindGlobal registers the shared flags on a subcommand FlagSet.
func BindGlobal(fs *flag.FlagSet, opts *Options) {
	fs.StringVar(&opts.API, "api", envOr("SHIPYARD_API_URL", "http://localhost:4000"),
		"Shipyard API origin (env SHIPYARD_API_URL)")
	fs.StringVar(&opts.Token, "token", os.Getenv("SHIPYARD_TOKEN"),
		"API token (env SHIPYARD_TOKEN)")
	fs.BoolVar(&opts.JSON, "json", false, "emit raw JSON instead of a table")
}

// client builds the API client for these options.
func (o *Options) client() *api.Client {
	return api.New(o.API, o.Token)
}

// writer returns the output sink (stdout unless a test injected one).
func (o *Options) writer() io.Writer {
	if o.Out != nil {
		return o.Out
	}
	return os.Stdout
}

// ── previews ────────────────────────────────────────────────────────────────

// PreviewsList renders `shipyard previews list`.
func PreviewsList(ctx context.Context, opts Options, status string, limit int) error {
	previews, err := opts.client().ListPreviews(ctx, status, limit)
	if err != nil {
		return err
	}
	if opts.JSON {
		return json.NewEncoder(opts.writer()).Encode(previews)
	}
	return RenderPreviewTable(opts.writer(), previews)
}

// PreviewsGet renders `shipyard previews get <id|slug>`.
func PreviewsGet(ctx context.Context, opts Options, ref string) error {
	preview, err := opts.client().ResolvePreview(ctx, ref)
	if err != nil {
		return err
	}
	if opts.JSON {
		return json.NewEncoder(opts.writer()).Encode(preview)
	}
	w := opts.writer()
	fmt.Fprintf(w, "%-14s %s\n", "ID", preview.ID)
	fmt.Fprintf(w, "%-14s %s\n", "Name", preview.Name)
	fmt.Fprintf(w, "%-14s %s\n", "Slug", preview.Slug)
	fmt.Fprintf(w, "%-14s %s\n", "Status", preview.Status)
	if preview.Project != nil {
		fmt.Fprintf(w, "%-14s %s\n", "Project", preview.Project.Name)
	}
	fmt.Fprintf(w, "%-14s %s\n", "Branch", strVal(preview.Branch))
	fmt.Fprintf(w, "%-14s %s\n", "Commit", shortSha(strVal(preview.CommitSha)))
	fmt.Fprintf(w, "%-14s %s\n", "URL", strVal(preview.URL))
	fmt.Fprintf(w, "%-14s %d\n", "Services", preview.ServiceCount)
	fmt.Fprintf(w, "%-14s %s\n", "Updated", preview.UpdatedAt)
	return nil
}

// PreviewAction runs stop/redeploy/destroy/pin for `shipyard previews <verb>`.
// Destroy is irreversible, so it demands confirm (the --yes flag).
func PreviewAction(ctx context.Context, opts Options, ref, action string, confirmed bool) error {
	preview, err := opts.client().ResolvePreview(ctx, ref)
	if err != nil {
		return err
	}
	if action == "destroy" && !confirmed {
		return errors.New("destroy permanently tears down the preview — re-run with --yes")
	}
	if err := opts.client().PreviewAction(ctx, preview.ID, action); err != nil {
		return err
	}
	fmt.Fprintf(opts.writer(), "%s queued for %s (%s)\n", action, preview.Slug, preview.ID)
	return nil
}

// ── logs / status streaming ─────────────────────────────────────────────────

// logEvent mirrors the SSE log payload (see the API's serializeLogEvent).
type logEvent struct {
	Seq     int64  `json:"seq"`
	Ts      string `json:"ts"`
	Level   string `json:"level"`
	Source  string `json:"source"`
	Message string `json:"message"`
}

// statusEvent mirrors the SSE status payload.
type statusEvent struct {
	Status string  `json:"status"`
	URL    *string `json:"url"`
	At     string  `json:"at"`
}

// Logs tails a preview's deployment logs (`shipyard logs <id|slug>`): SSE
// backfill of persisted chunks, then live lines until Ctrl-C.
func Logs(ctx context.Context, opts Options, ref string) error {
	preview, err := opts.client().ResolvePreview(ctx, ref)
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(ctx, os.Interrupt)
	defer stop()

	w := opts.writer()
	err = opts.client().Stream(ctx, "/api/v1/previews/"+preview.ID+"/logs", func(ev api.Event) bool {
		if ev.Name != "log" && ev.Name != "" {
			return true // ignore non-log events (e.g. stream markers)
		}
		if opts.JSON {
			fmt.Fprintln(w, ev.Data)
			return true
		}
		var line logEvent
		if json.Unmarshal([]byte(ev.Data), &line) != nil {
			fmt.Fprintln(w, ev.Data) // not JSON — print raw
			return true
		}
		fmt.Fprintf(w, "%s %-5s %s\n", timeOnly(line.Ts), line.Level, line.Message)
		return true
	})
	if errors.Is(err, context.Canceled) {
		return nil // Ctrl-C is a clean exit for a tail
	}
	return err
}

// Status prints a preview's status (`shipyard status <id|slug>`), or with
// watch=true keeps streaming transitions until Ctrl-C.
func Status(ctx context.Context, opts Options, ref string, watch bool) error {
	preview, err := opts.client().ResolvePreview(ctx, ref)
	if err != nil {
		return err
	}
	w := opts.writer()
	if !watch {
		fmt.Fprintf(w, "%s %s\n", preview.Slug, preview.Status)
		return nil
	}
	ctx, stop := signal.NotifyContext(ctx, os.Interrupt)
	defer stop()
	err = opts.client().Stream(ctx, "/api/v1/previews/"+preview.ID+"/status", func(ev api.Event) bool {
		var s statusEvent
		if json.Unmarshal([]byte(ev.Data), &s) != nil {
			return true
		}
		url := ""
		if s.URL != nil {
			url = "  " + *s.URL
		}
		fmt.Fprintf(w, "%s %s%s\n", timeOnly(s.At), s.Status, url)
		return true
	})
	if errors.Is(err, context.Canceled) {
		return nil
	}
	return err
}

// ── rendering helpers ───────────────────────────────────────────────────────

// RenderPreviewTable writes the aligned previews table.
func RenderPreviewTable(w io.Writer, previews []api.Preview) error {
	tw := tabwriter.NewWriter(w, 0, 4, 2, ' ', 0)
	fmt.Fprintln(tw, "STATUS\tSLUG\tPROJECT\tBRANCH\tSERVICES\tURL")
	for _, p := range previews {
		project := ""
		if p.Project != nil {
			project = p.Project.Name
		}
		fmt.Fprintf(tw, "%s\t%s\t%s\t%s\t%d\t%s\n",
			p.Status, p.Slug, project, strVal(p.Branch), p.ServiceCount, strVal(p.URL))
	}
	return tw.Flush()
}

// strVal renders optional strings ("-" when absent).
func strVal(s *string) string {
	if s == nil || *s == "" {
		return "-"
	}
	return *s
}

// shortSha trims a commit sha for display.
func shortSha(sha string) string {
	if len(sha) > 7 {
		return sha[:7]
	}
	return sha
}

// timeOnly renders an ISO timestamp as HH:MM:SS local time.
func timeOnly(iso string) string {
	t, err := time.Parse(time.RFC3339Nano, iso)
	if err != nil {
		if len(iso) >= 19 {
			return iso[11:19]
		}
		return iso
	}
	return t.Local().Format("15:04:05")
}

// Usage is the top-level help text.
const Usage = `shipyard — terminal client for the Shipyard preview platform

Usage:
  shipyard previews list [--status STATUS] [--limit N] [--json]
  shipyard previews get <id|slug> [--json]
  shipyard previews stop|redeploy|pin <id|slug>
  shipyard previews destroy <id|slug> --yes
  shipyard logs <id|slug> [--json]        tail deployment logs (SSE)
  shipyard status <id|slug> [--watch]     current status / live transitions
  shipyard version

Auth:
  SHIPYARD_API_URL   API origin (default http://localhost:4000)
  SHIPYARD_TOKEN     API token — create one under Settings → API tokens
`

// Fail prints an error consistently and exits non-zero.
func Fail(err error) {
	fmt.Fprintln(os.Stderr, "shipyard:", err)
	os.Exit(1)
}
