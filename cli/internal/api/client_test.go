package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// newTestClient wires a Client at a httptest server.
func newTestClient(t *testing.T, handler http.HandlerFunc) *Client {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	c := New(server.URL, "tok_test")
	return c
}

func TestListPreviewsSendsAuthAndDecodes(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer tok_test" {
			t.Errorf("Authorization = %q, want Bearer tok_test", got)
		}
		if r.URL.Path != "/api/v1/previews" {
			t.Errorf("path = %q", r.URL.Path)
		}
		if got := r.URL.Query().Get("status"); got != "RUNNING" {
			t.Errorf("status = %q, want RUNNING (upcased)", got)
		}
		json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{{
				"id": "prev_1", "slug": "web-pr-1", "status": "RUNNING",
				"serviceCount": 3,
				"project":      map[string]any{"id": "p1", "name": "Web", "slug": "web", "teamId": "t1"},
			}},
		})
	})

	previews, err := c.ListPreviews(context.Background(), "running", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(previews) != 1 || previews[0].Slug != "web-pr-1" || previews[0].Project.Name != "Web" {
		t.Fatalf("unexpected decode: %+v", previews)
	}
}

func TestErrorEnvelopeBecomesAPIError(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte(`{"error":{"code":"FORBIDDEN","message":"missing scope previews:write"}}`))
	})

	err := c.PreviewAction(context.Background(), "prev_1", "stop")
	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("want *APIError, got %T (%v)", err, err)
	}
	if apiErr.Status != 403 || apiErr.Code != "FORBIDDEN" {
		t.Fatalf("unexpected APIError: %+v", apiErr)
	}
}

func TestErrorToleratesNonJSONBody(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		w.Write([]byte("upstream exploded"))
	})

	err := c.PreviewAction(context.Background(), "prev_1", "stop")
	apiErr, ok := err.(*APIError)
	if !ok || apiErr.Status != 502 || apiErr.Message != "upstream exploded" {
		t.Fatalf("unexpected: %#v", err)
	}
}

func TestResolvePreviewFallsBackToSlug(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/previews/web-pr-9":
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(`{"error":{"code":"NOT_FOUND","message":"no such preview"}}`))
		case "/api/v1/previews":
			json.NewEncoder(w).Encode(map[string]any{
				"data": []map[string]any{
					{"id": "prev_8", "slug": "web-pr-8", "status": "RUNNING"},
					{"id": "prev_9", "slug": "web-pr-9", "status": "STOPPED"},
				},
			})
		default:
			t.Errorf("unexpected path %q", r.URL.Path)
			w.WriteHeader(http.StatusTeapot)
		}
	})

	preview, err := c.ResolvePreview(context.Background(), "web-pr-9")
	if err != nil {
		t.Fatal(err)
	}
	if preview.ID != "prev_9" {
		t.Fatalf("resolved %q, want prev_9", preview.ID)
	}
}

func TestResolvePreviewPropagatesNotFound(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/previews":
			json.NewEncoder(w).Encode(map[string]any{"data": []map[string]any{}})
		default:
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(`{"error":{"code":"NOT_FOUND","message":"no such preview"}}`))
		}
	})

	_, err := c.ResolvePreview(context.Background(), "nope")
	apiErr, ok := err.(*APIError)
	if !ok || apiErr.Status != 404 {
		t.Fatalf("want 404 APIError, got %#v", err)
	}
}
