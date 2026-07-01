## Project knowledge

This repository contains a **Grafana plugin** — the MModel console shipped as a Grafana app (id `deepsite-umodel-app`, `type: app` + Go backend). You must Read @./.config/AGENTS/instructions.md before doing changes.

For architecture, build/deploy, key configuration files, and **how the frontend adapts to Grafana**, read [docs/development-guide.md](./docs/development-guide.md). Key facts to keep in mind:

- **All backend access goes through the Go backend reverse-proxy** (`pkg/plugin/resources.go`, `proxyTo`) to the MModel server (`jsonData.apiUrl`, optional `secureJsonData.apiKey` injected server-side). There are **no `plugin.json` `routes`** and **no native Prometheus/Loki/Tempo data source** — metric/log/trace are graph entities queried via `/api/v1/query`.
- **Two frontend styles:** form/simple pages (`src/pages/*`) are rewritten natively on `@grafana/ui` + `useStyles2`; heavy visualizations are ported into `src/features/{explorer,entityTopo}` and **theme-bridged** via `src/design/ThemeBridge.tsx` — `UModelRoot` maps the ported `--om-*` tokens to `GrafanaTheme2` and injects them on `document.body` for portaled overlays.
- **Zero hardcoded colors** — everything derives from the theme (Grafana best-practices). WebGL/canvas that can't read CSS (cosmos.gl) gets its color injected from `useTheme2()` (e.g. `CosmosEngineConfig.backgroundColor`). Use `Combobox`, not the deprecated `Select`.
- The root `eslint.config.mjs` relaxes newer react-hooks rules **only** for `src/features/{explorer,entityTopo}/**/*.tsx` (ported imperative viz); `react-hooks/exhaustive-deps` stays an error with per-line justified disables.
- Do **not** edit `.config/**` or the plugin `id`/`type`. Changing `plugin.json` requires a Grafana restart. Build the backend on a host with Go ≥ 1.26 (the dev container ships Go 1.21.6).