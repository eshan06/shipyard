// Package api is a minimal, dependency-free client for the Shipyard control
// plane. It speaks the REST surface (JSON over HTTP, Bearer-token auth) and the
// SSE streams (live logs / status) that the dashboard itself uses — the CLI is
// a peer of the web UI, not a privileged backdoor.
package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client calls the Shipyard API.
type Client struct {
	// BaseURL is the API origin, e.g. "http://localhost:4000".
	BaseURL string
	// Token is a Shipyard API token (Authorization: Bearer). API tokens are
	// team-scoped and carry explicit scopes such as previews:read.
	Token string
	// HTTPClient is the underlying transport. Zero value gets a sane default.
	HTTPClient *http.Client
}

// New builds a Client with a default timeout suitable for one-shot requests.
// SSE streaming calls override the timeout via context instead.
func New(baseURL, token string) *Client {
	return &Client{
		BaseURL:    strings.TrimRight(baseURL, "/"),
		Token:      token,
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// APIError is a structured error returned by the control plane
// (`{"error":{"code":"...","message":"..."}}`) plus the HTTP status.
type APIError struct {
	Status  int
	Code    string
	Message string
}

func (e *APIError) Error() string {
	if e.Code != "" {
		return fmt.Sprintf("%s (%s, HTTP %d)", e.Message, e.Code, e.Status)
	}
	return fmt.Sprintf("HTTP %d", e.Status)
}

// errorEnvelope mirrors the API's error response shape.
type errorEnvelope struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// do performs a JSON request and decodes the response into out (when non-nil).
// Non-2xx responses are surfaced as *APIError.
func (c *Client) do(ctx context.Context, method, path string, body, out any) error {
	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("encode request: %w", err)
		}
		reader = bytes.NewReader(payload)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, reader)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	c.authorize(req)

	client := c.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return decodeError(res)
	}
	if out == nil {
		io.Copy(io.Discard, res.Body) //nolint:errcheck // drain for keep-alive
		return nil
	}
	return json.NewDecoder(res.Body).Decode(out)
}

// authorize attaches the Bearer token when present.
func (c *Client) authorize(req *http.Request) {
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}
}

// decodeError turns a non-2xx response into an *APIError, tolerating
// non-JSON bodies (proxies, panics).
func decodeError(res *http.Response) error {
	apiErr := &APIError{Status: res.StatusCode}
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 64<<10))
	var envelope errorEnvelope
	if err := json.Unmarshal(raw, &envelope); err == nil && envelope.Error.Message != "" {
		apiErr.Code = envelope.Error.Code
		apiErr.Message = envelope.Error.Message
	} else {
		apiErr.Message = strings.TrimSpace(string(raw))
	}
	return apiErr
}

// ── Previews ────────────────────────────────────────────────────────────────

// Project is the embedded project projection on a preview.
type Project struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Slug   string `json:"slug"`
	TeamID string `json:"teamId"`
}

// Preview is a preview environment row as returned by the API. Only the
// fields the CLI renders are declared; unknown fields are ignored.
type Preview struct {
	ID                     string   `json:"id"`
	Name                   string   `json:"name"`
	Slug                   string   `json:"slug"`
	Status                 string   `json:"status"`
	URL                    *string  `json:"url"`
	Branch                 *string  `json:"branch"`
	CommitSha              *string  `json:"commitSha"`
	IsPinned               bool     `json:"isPinned"`
	ServiceCount           int      `json:"serviceCount"`
	LatestDeploymentStatus *string  `json:"latestDeploymentStatus"`
	Project                *Project `json:"project"`
	UpdatedAt              string   `json:"updatedAt"`
}

// listEnvelope is the paginated list response shape.
type listEnvelope[T any] struct {
	Data []T `json:"data"`
}

// ListPreviews returns up to limit previews, optionally filtered by status
// (e.g. "RUNNING"). Status is passed through verbatim; the API validates it.
func (c *Client) ListPreviews(ctx context.Context, status string, limit int) ([]Preview, error) {
	query := url.Values{}
	if limit > 0 {
		query.Set("limit", fmt.Sprint(limit))
	}
	if status != "" {
		query.Set("status", strings.ToUpper(status))
	}
	var out listEnvelope[Preview]
	err := c.do(ctx, http.MethodGet, "/api/v1/previews?"+query.Encode(), nil, &out)
	return out.Data, err
}

// GetPreview fetches one preview by id. When the argument does not look like
// an id and the direct fetch 404s, callers may resolve by slug via
// ResolvePreview instead.
func (c *Client) GetPreview(ctx context.Context, id string) (*Preview, error) {
	var out Preview
	if err := c.do(ctx, http.MethodGet, "/api/v1/previews/"+url.PathEscape(id), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ResolvePreview accepts an id OR a slug and returns the preview. Slug
// resolution lists and matches client-side (the API has no slug filter).
func (c *Client) ResolvePreview(ctx context.Context, ref string) (*Preview, error) {
	preview, err := c.GetPreview(ctx, ref)
	if err == nil {
		return preview, nil
	}
	var apiErr *APIError
	if !asAPIError(err, &apiErr) || apiErr.Status != http.StatusNotFound {
		return nil, err
	}
	all, listErr := c.ListPreviews(ctx, "", 100)
	if listErr != nil {
		return nil, listErr
	}
	for i := range all {
		if all[i].Slug == ref {
			return &all[i], nil
		}
	}
	return nil, err // original 404
}

// PreviewAction runs one of the preview lifecycle actions:
// stop, redeploy, destroy, or pin.
func (c *Client) PreviewAction(ctx context.Context, id, action string) error {
	return c.do(ctx, http.MethodPost, "/api/v1/previews/"+url.PathEscape(id)+"/"+action, nil, nil)
}

// asAPIError is errors.As without importing errors twice at call sites.
func asAPIError(err error, target **APIError) bool {
	e, ok := err.(*APIError)
	if ok {
		*target = e
	}
	return ok
}
