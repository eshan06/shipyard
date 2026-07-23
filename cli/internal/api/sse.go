package api

import (
	"bufio"
	"context"
	"net/http"
	"strings"
)

// Event is one server-sent event from a Shipyard stream.
type Event struct {
	// Name is the SSE `event:` field ("log", "status", …); empty for comments.
	Name string
	// Data is the (possibly multi-line, newline-joined) `data:` payload.
	Data string
	// ID is the SSE `id:` field when the server sets one (log sequence).
	ID string
}

// Stream opens an SSE endpoint and invokes handle for every event until the
// context is cancelled, the server closes the stream, or handle returns false.
// Heartbeat comments (`: …`) are dropped. The connection carries no timeout —
// cancellation is the caller's job via ctx.
func (c *Client) Stream(ctx context.Context, path string, handle func(Event) bool) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "text/event-stream")
	c.authorize(req)

	// Dedicated client: the default one has a 30s timeout that would kill a tail.
	client := &http.Client{Transport: transportOf(c.HTTPClient)}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return decodeError(res)
	}

	scanner := bufio.NewScanner(res.Body)
	scanner.Buffer(make([]byte, 0, 64<<10), 1<<20)

	var event Event
	var data []string
	flush := func() bool {
		if len(data) == 0 && event.Name == "" {
			return true
		}
		event.Data = strings.Join(data, "\n")
		keep := handle(event)
		event = Event{}
		data = nil
		return keep
	}

	for scanner.Scan() {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		line := scanner.Text()
		switch {
		case line == "":
			if !flush() {
				return nil
			}
		case strings.HasPrefix(line, ":"):
			// heartbeat/comment — ignore
		case strings.HasPrefix(line, "event:"):
			event.Name = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
		case strings.HasPrefix(line, "data:"):
			data = append(data, strings.TrimPrefix(strings.TrimPrefix(line, "data:"), " "))
		case strings.HasPrefix(line, "id:"):
			event.ID = strings.TrimSpace(strings.TrimPrefix(line, "id:"))
		}
	}
	if ctx.Err() != nil {
		return ctx.Err()
	}
	flush() // trailing event without blank-line terminator
	return scanner.Err()
}

// transportOf reuses the configured transport (tests inject one) or the default.
func transportOf(c *http.Client) http.RoundTripper {
	if c != nil && c.Transport != nil {
		return c.Transport
	}
	return http.DefaultTransport
}
