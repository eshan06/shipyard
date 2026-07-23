package api

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

// serveSSE writes a canned SSE body.
func serveSSE(t *testing.T, body string) *Client {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Accept"); got != "text/event-stream" {
			t.Errorf("Accept = %q", got)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer tok_test" {
			t.Errorf("Authorization = %q", got)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, body)
	}))
	t.Cleanup(server.Close)
	return New(server.URL, "tok_test")
}

func TestStreamParsesEventsAndSkipsHeartbeats(t *testing.T) {
	c := serveSSE(t, ""+
		": connected\n\n"+
		"event: log\nid: 7\ndata: {\"seq\":7,\"message\":\"pulling image\"}\n\n"+
		": hb\n\n"+
		"event: log\ndata: line one\ndata: line two\n\n")

	var events []Event
	err := c.Stream(context.Background(), "/api/v1/previews/p/logs", func(ev Event) bool {
		events = append(events, ev)
		return true
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 2 {
		t.Fatalf("got %d events, want 2: %+v", len(events), events)
	}
	if events[0].Name != "log" || events[0].ID != "7" {
		t.Errorf("event 0 = %+v", events[0])
	}
	if events[1].Data != "line one\nline two" {
		t.Errorf("multi-line data = %q", events[1].Data)
	}
}

func TestStreamStopsWhenHandlerReturnsFalse(t *testing.T) {
	c := serveSSE(t, "event: log\ndata: a\n\nevent: log\ndata: b\n\n")

	var count int
	err := c.Stream(context.Background(), "/x", func(ev Event) bool {
		count++
		return false // stop after the first event
	})
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("handler ran %d times, want 1", count)
	}
}

func TestStreamSurfacesHTTPErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":{"code":"UNAUTHENTICATED","message":"no token"}}`))
	}))
	defer server.Close()
	c := New(server.URL, "")

	err := c.Stream(context.Background(), "/x", func(Event) bool { return true })
	apiErr, ok := err.(*APIError)
	if !ok || apiErr.Status != 401 {
		t.Fatalf("want 401 APIError, got %#v", err)
	}
}
