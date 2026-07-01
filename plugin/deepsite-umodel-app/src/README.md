# UModel

UModel brings the MModel object-graph semantic layer into Grafana as an app plugin. Explore your object models, browse runtime entities and topology, run queries, and use the agent gateway — all inside Grafana.

## Overview

The plugin's React frontend runs inside Grafana and reverse-proxies all backend access through its own Go backend to the MModel server, so it reuses Grafana's authentication with no CORS and no client-side tokens.

Pages:

- **Explorer** — MModel graph/table editor (React Flow + Graphviz layout).
- **Topology** — WebGL entity topology over `.topo` / `.entity`.
- **Query** / **Data store** — SPL over `.mmodel`, `.entity`, `.topo`.
- **Imports** / **Agent** / **Settings** / **API map**.

Metric/log/trace are modeled as graph entities and queried through the MModel server — no Prometheus/Loki/Tempo data source is required.

## Requirements

- Grafana `>= 12.3.0`.
- A reachable MModel server (`cmd/mmodel-server`); the plugin's Go backend proxies to it.

## Getting Started

1. Enable the app and open its **Configuration** page.
2. Set **API Url** to the MModel server base URL (reachable from the Grafana server — not `localhost` when Grafana runs in Docker). Optionally set an **API Key**.
3. Save; pick a workspace from the selector in the page header and start exploring.

## Documentation

- Development & architecture guide: `docs/development-guide.md`.
- Grafana app plugins: [https://grafana.com/developers/plugin-tools/](https://grafana.com/developers/plugin-tools/)