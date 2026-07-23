package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/eshan06/shipyard/cli/internal/api"
)

func ptr(s string) *string { return &s }

func TestRenderPreviewTableAlignsColumns(t *testing.T) {
	var buf bytes.Buffer
	err := RenderPreviewTable(&buf, []api.Preview{
		{Status: "RUNNING", Slug: "web-pr-412", Branch: ptr("feat/pdp"), ServiceCount: 4,
			URL:     ptr("https://web-pr-412.preview.acme.dev"),
			Project: &api.Project{Name: "Storefront"}},
		{Status: "FAILED", Slug: "pay-pr-230", ServiceCount: 2,
			Project: &api.Project{Name: "Payments API"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	out := buf.String()
	lines := strings.Split(strings.TrimSpace(out), "\n")
	if len(lines) != 3 {
		t.Fatalf("want header + 2 rows, got %d lines:\n%s", len(lines), out)
	}
	if !strings.HasPrefix(lines[0], "STATUS") {
		t.Errorf("header missing: %q", lines[0])
	}
	if !strings.Contains(lines[1], "web-pr-412") || !strings.Contains(lines[1], "Storefront") {
		t.Errorf("row 1 = %q", lines[1])
	}
	// Absent optionals render as "-".
	if !strings.Contains(lines[2], "-") {
		t.Errorf("row 2 should show '-' for missing branch/url: %q", lines[2])
	}
}

func TestPreviewActionDestroyRequiresYes(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only the resolve GET should arrive — never the destroy POST.
		if r.Method == http.MethodPost {
			t.Errorf("unexpected POST %s without --yes", r.URL.Path)
		}
		json.NewEncoder(w).Encode(api.Preview{ID: "prev_1", Slug: "web-pr-1"})
	}))
	defer server.Close()

	opts := Options{API: server.URL, Token: "t", Out: &bytes.Buffer{}}
	err := PreviewAction(context.Background(), opts, "prev_1", "destroy", false)
	if err == nil || !strings.Contains(err.Error(), "--yes") {
		t.Fatalf("want --yes guard error, got %v", err)
	}
}

func TestPreviewActionPostsAndReports(t *testing.T) {
	var posted string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			posted = r.URL.Path
			w.WriteHeader(http.StatusAccepted)
			w.Write([]byte(`{}`))
			return
		}
		json.NewEncoder(w).Encode(api.Preview{ID: "prev_1", Slug: "web-pr-1"})
	}))
	defer server.Close()

	var out bytes.Buffer
	opts := Options{API: server.URL, Token: "t", Out: &out}
	if err := PreviewAction(context.Background(), opts, "prev_1", "redeploy", false); err != nil {
		t.Fatal(err)
	}
	if posted != "/api/v1/previews/prev_1/redeploy" {
		t.Errorf("posted to %q", posted)
	}
	if !strings.Contains(out.String(), "redeploy queued for web-pr-1") {
		t.Errorf("output = %q", out.String())
	}
}

func TestTimeOnlyHandlesISOAndGarbage(t *testing.T) {
	if got := timeOnly("2026-07-22T18:04:05.123Z"); len(got) != 8 || strings.Count(got, ":") != 2 {
		t.Errorf("timeOnly ISO = %q, want HH:MM:SS", got)
	}
	if got := timeOnly("garbage"); got != "garbage" {
		t.Errorf("timeOnly garbage = %q", got)
	}
}
