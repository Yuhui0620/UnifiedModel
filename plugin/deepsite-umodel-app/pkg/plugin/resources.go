package plugin

import (
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// proxyClient is shared across resource calls.
var proxyClient = &http.Client{Timeout: 60 * time.Second}

// hopByHopHeaders are connection-scoped and must not be forwarded.
var hopByHopHeaders = map[string]bool{
	"Connection":          true,
	"Keep-Alive":          true,
	"Proxy-Authenticate":  true,
	"Proxy-Authorization": true,
	"Te":                  true,
	"Trailer":             true,
	"Transfer-Encoding":   true,
	"Upgrade":             true,
}

func copyHeaders(dst, src http.Header) {
	for k, vv := range src {
		if hopByHopHeaders[http.CanonicalHeaderKey(k)] {
			continue
		}
		for _, v := range vv {
			dst.Add(k, v)
		}
	}
}

// proxyTo returns a handler that reverse-proxies the request to base + (request
// path with stripPrefix removed), preserving method/query/body. When bearer is
// non-empty an Authorization header is injected. An empty base means the upstream
// is not configured.
func (a *App) proxyTo(base, stripPrefix, bearer string) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		if base == "" {
			http.Error(w, "upstream not configured", http.StatusBadGateway)
			return
		}

		rest := strings.TrimPrefix(req.URL.Path, stripPrefix)
		u, err := url.Parse(strings.TrimRight(base, "/") + rest)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		u.RawQuery = req.URL.RawQuery

		outReq, err := http.NewRequestWithContext(req.Context(), req.Method, u.String(), req.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		copyHeaders(outReq.Header, req.Header)
		// Never leak Grafana's session/credentials to the upstream.
		outReq.Header.Del("Cookie")
		outReq.Header.Del("Authorization")
		if bearer != "" {
			outReq.Header.Set("Authorization", "Bearer "+bearer)
		}

		resp, err := proxyClient.Do(outReq)
		if err != nil {
			http.Error(w, "upstream unreachable: "+err.Error(), http.StatusBadGateway)
			return
		}
		defer func() { _ = resp.Body.Close() }()

		copyHeaders(w.Header(), resp.Header)
		w.WriteHeader(resp.StatusCode)
		_, _ = io.Copy(w, resp.Body)
	}
}

// handlePing is a lightweight health probe for the resource channel.
func (a *App) handlePing(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"message": "ok"}`))
}

// registerRoutes wires the reverse-proxy routes onto the resource mux. The
// frontend MModelApi targets /api/plugins/<id>/resources, so its calls to
// /api/v1/... and /healthz arrive here and are forwarded to the MModel server.
func (a *App) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/ping", a.handlePing)
	mux.HandleFunc("/api/", a.proxyTo(a.settings.APIURL, "", a.apiKey))
	mux.HandleFunc("/healthz", a.proxyTo(a.settings.APIURL, "", a.apiKey))
}