# Changelog

## 1.0.0 (Unreleased)

Initial release — the MModel console migrated into a Grafana app plugin.

- **Data path:** all backend access is reverse-proxied through the plugin's Go backend (`pkg/plugin/resources.go`, `CallResource`) to the MModel server configured as `jsonData.apiUrl` (+ optional `secureJsonData.apiKey`, injected server-side). No `plugin.json` `routes`; no native Prometheus/Loki/Tempo data source — metric/log/trace are graph entities queried via `/api/v1/query`.
- **Frontend adapted to Grafana:** `AppPlugin.setRootPage` + react-router v6 + `PluginPage`; a `WorkspaceContext` + `Combobox` selector replaces the standalone workspace landing; requests go through `getBackendSrv()`.
- **Two adaptation styles:** form/simple pages (Query, Data store, Imports, Agent, Settings, API map) rewritten natively on `@grafana/ui` + `useStyles2`; heavy visualizations ported and theme-bridged — **Explorer** (React Flow `@xyflow/react` + Graphviz WASM, Monaco → `@grafana/ui` CodeEditor) and **Topology** (`@cosmos.gl/graph` WebGL).
- **Theme bridge:** `src/design/ThemeBridge.tsx` (`UModelRoot`) maps the ported `--om-*` tokens onto `GrafanaTheme2` (and injects them on `document.body` for portaled overlays); the cosmos.gl WebGL canvas background is themed via `CosmosEngineConfig.backgroundColor` from `useTheme2()`. Zero hardcoded colors — light/dark follow Grafana.
- **Backend:** Go reverse proxy with unit tests (`resources_test.go`).

See [docs/development-guide.md](./docs/development-guide.md) for architecture and the full frontend-adaptation write-up.