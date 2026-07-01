# UModel Grafana 插件 — 开发者指南

面向**接手继续开发**本插件的工程师。涵盖：环境依赖与安装、构建与部署、关键配置文件、脚手架/模块架构，以及**最核心的**——前端如何适配 Grafana（尤其拓扑图等无 `@grafana/ui` 原生组件的部分是怎么适配的）。

> 插件 id：`deepsite-umodel-app`（type `app` + Go 后端）。由 `@grafana/create-plugin` 脚手架生成。
> 它把原独立前端 `web/`（Vite + React 18）以 Grafana app 插件形式重新落地，所有后端访问经插件 Go 后端反代到 **mmodel-server**。

---

## 1. 架构总览

```
┌─────────────────────────── Grafana ───────────────────────────┐
│  浏览器 (插件前端: React 18 + react-router, webpack/AMD 打包)    │
│    getBackendSrv().fetch(/api/plugins/deepsite-umodel-app/      │
│                          resources/api/v1/...)                  │
│            │                                                    │
│            ▼  (Grafana 同源 + 会话鉴权)                          │
│  插件 Go 后端 (backend:true, CallResource)                      │
│    pkg/plugin/resources.go: proxyTo() 透明反向代理              │
│            │  注入可选 Bearer(secureJsonData.apiKey)、删 Cookie │
└────────────┼───────────────────────────────────────────────────┘
             ▼
   mmodel-server  (cmd/mmodel-server, REST :8080)
     /api/v1/{workspaces|query|mmodel|entitystore|samples|agent}
     可观测数据(metric/log/trace)亦走 /api/v1/query → OpenSearch
```

要点：
- 浏览器**不直连** mmodel-server；统一经 `/api/plugins/<id>/resources/*` → 插件 Go 后端反代。好处：复用 Grafana 鉴权、无 CORS、密钥只在服务端。
- 本项目**没有** Prometheus/Loki/Tempo：metric/log/trace 被建模为图实体，经 `/api/v1/query/*`（后端再查 OpenSearch），所以**不引入任何原生 datasource/dashboard**。
- 插件 = 前端（webpack 打的 `module.js`）+ Go 后端（`mage` 打的 `gpx_umodel_<os>_<arch>`），都产出到 `dist/`。

---

## 2. 环境依赖与安装

**分工**：开发机（dev box）只负责**构建产物**；产物同步到 `192.168.31.128`，由该机 **Docker 运行 Grafana** 加载。这样绕开"脚手架 dev 容器内置 Go 1.21.6 无法编译 `go.mod` 要求的 1.26.3"。

### dev box（构建机）
| 工具 | 要求 | 作用 |
|---|---|---|
| Node | ≥22（`.nvmrc`=22；24 兼容） | 前端构建（webpack）+ 质量门 |
| npm | 随 Node | 包管理（非 web 的 pnpm） |
| Go | ≥1.26（满足 `go.mod` 1.26.3） | 后端编译 |
| **mage** | 必需 | 后端构建编排：`go install github.com/magefile/mage@latest`，把 `go env GOPATH`/bin 加 PATH |
| git | — | 版本控制 |
| Docker | **不需要**（运行在 128） | — |

一次性安装（联网，在 dev box 执行；`.npmrc` 已 `ignore-scripts=true`）：
```bash
cd plugin/deepsite-umodel-app
npm install   # 脚手架依赖 + 已在 package.json 的运行时依赖
              # 含: @xyflow/react @hpcc-js/wasm-graphviz @cosmos.gl/graph js-yaml lucide-react
```
> 这几个是**移植重型可视化**所需、会被 webpack 打进 bundle 的依赖。Monaco **不装** `@monaco-editor/react`——改用 `@grafana/ui` 的 `CodeEditor`（见 §6.5）。

### 192.168.31.128（运行机）
- 仅需 **Docker + Docker Compose**（无需 Node/Go/mage，只加载预编译 `dist/`）。
- **mmodel-server** 必须在该机运行且可达（`cmd/mmodel-server`，映射端口当前为 **18080**）。

---

## 3. 构建与部署

### 构建（dev box）
```bash
npm run dev      # 前端 webpack watch → dist/（开发）
npm run build    # 前端 production → dist/module.js 等
mage -v          # 后端跨平台编译 → dist/gpx_umodel_<os>_<arch>（含 linux_amd64）
```
**Go 版本坑**：`.config/Dockerfile`（dev 容器）内置 Go 1.21.6，容器内重建后端会失败。对策：**在 dev box host 用 `mage -v` 预编译**（`build.BuildAll` 默认产全平台），容器只加载挂载的二进制。

### 部署到 128
1. 同步含 `gpx_umodel_linux_amd64` 的 `dist/` + `provisioning/` 到 128。
2. **给 Linux 二进制补执行位**：`chmod +x dist/gpx_umodel_linux_amd64`（从 Windows 同步会丢 +x，否则 `backend:true` 健康检查失败）。
3. 运行二选一：
   - 脚手架 compose：`docker compose up -d`（首次需联网拉 `grafana-enterprise:13.0.2`），Grafana 在 `:3000`，已挂 `../dist`→插件目录、已放行未签名。
   - 挂现有 Grafana：`dist/` 放到 `/var/lib/grafana/plugins/deepsite-umodel-app`，设 `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=deepsite-umodel-app`，重启。

### 配置（关键取值坑）
反代由 **Grafana 服务端（容器内）** 发起，`apiUrl` 必须是 **Grafana 容器能解析到的地址，绝不能填 `localhost`**：
| 场景 | apiUrl |
|---|---|
| dev box 本地 Grafana（Docker Desktop） | `http://host.docker.internal:8080` |
| 部署机 128 | `http://192.168.31.128:18080` |

- committed 的 `provisioning/plugins/apps.yaml` 用部署值（128:18080）；dev 用 AppConfig 页运行时填 host.docker.internal。
- **改 `plugin.json` 必须重启 Grafana** 才生效。

---

## 4. 关键配置文件

### 脚手架托管、**禁止修改**（`.config/**`，DO-NOT-EDIT）
| 文件 | 作用 |
|---|---|
| `.config/webpack/webpack.config.ts` | webpack 主配置：`library.type:'amd'`、swc-loader、css/sass-loader、`externals`、`experiments.asyncWebAssembly:true`（graphviz WASM 靠它）、`%VERSION%/%PLUGIN_ID%` 替换、拷贝 `plugin.json`/img |
| `.config/bundler/externals.ts` | 把 `@grafana/*`、`react`、`react-dom`、`rxjs` 等设为 external（由宿主提供，**版本钉死 13.0.2 / React 18，不可换**） |
| `.config/docker-compose-base.yaml` | 开发 Grafana 容器：端口、挂载 `../dist`/`../provisioning`、放行未签名、日志级别 |
| `.config/Dockerfile` | 构建 Grafana 镜像；dev 模式装 Go 1.21.6 + mage（注意版本坑） |
| `.config/tsconfig.json` / `eslint.config.mjs` / `jest.*` | TS / ESLint / Jest 基础配置 |
| `.config/types/*.d.ts` | 图片/字体等资源导入声明（**未声明 `*.css`**，见下） |

> 扩展这些配置要用"extend"机制（见 grafana.com/developers/plugin-tools 的 extend-configurations），不是直接改 `.config/`。

### 项目自有、可改
| 文件 | 作用 |
|---|---|
| `src/plugin.json` | 插件清单：`id`/`type`/`backend`/`executable`；`includes`（左侧导航各页，路径 `/a/<id>/<route>`）；`dependencies.grafanaDependency`。**无 `routes`**（反代走 Go 后端，不用 plugin-proxy）。改它需重启 Grafana |
| `package.json` | 前端依赖与脚本（build/dev/test/typecheck/lint/e2e/server/sign） |
| `Magefile.go` / `go.mod` | 后端构建（`build.BuildAll`）/ Go module（`github.com/deepsite/umodel`, go 1.26.3） |
| `provisioning/plugins/apps.yaml` | 自动启用插件 + 注入 `jsonData.apiUrl` / `secureJsonData.apiKey` |
| `eslint.config.mjs`（根） | 在脚手架基础上**为移植目录域内放宽** react-hooks 新规则（见 §6.6） |
| `src/declarations.d.ts` | 补 `declare module '*.css'`（脚手架只声明了图片/字体），让 `import './x.css'` 通过 TS |

---

## 5. 模块架构

### 前端 `src/`
```
src/
  module.tsx                 ← 插件入口：new AppPlugin().setRootPage(App).addConfigPage(AppConfig)
  plugin.json  constants.ts  ← 清单 / ROUTES 枚举 + PLUGIN_BASE_URL
  declarations.d.ts          ← *.css 模块声明

  components/
    App/App.tsx              ← react-router <Routes>：8 路由 + 默认重定向 Explorer + Suspense
    AppConfig/AppConfig.tsx  ← 配置页（jsonData.apiUrl + secureJsonData.apiKey）
    MModelPage.tsx           ← 页面外壳：<PluginPage> + Workspace 选择器 + 未选门控 + UModelRoot
    WorkspaceSelect.tsx      ← @grafana/ui Combobox 工作区选择器
    QueryResultTable.tsx     ← 共享：SPL 结果表（Query / Data store 复用）
    Placeholder.tsx  testIds.ts

  context/WorkspaceContext.tsx ← 工作区列表 + 选中态（localStorage）+ 共享 MModelApi，经 Context 透传

  api/
    constants.ts             ← RESOURCE_BASE = /api/plugins/<id>/resources
    client.ts                ← MModelApi：getBackendSrv().fetch 封装 + ApiError 归一化
    types.ts                 ← 后端 REST 的 TS 类型

  lib/{json,storage}.ts      ← 纯工具（stringify/parseJson/useLocalStorageState）
  utils/notify.ts            ← getAppEvents() 成功/错误 toast
  utils/utils.routing.ts     ← prefixRoute()

  design/                    ← 「移植 + 主题桥接」基础（见 §6.4）
    ThemeBridge.tsx          ← UModelRoot：把 --om-* 令牌映射到 GrafanaTheme2，并注入 document.body
    components/index.tsx     ← web 自研 UI 门面（CSS 类实现，原样移植）
    components.css           ← 门面样式（.om-* 类）

  pages/                     ← 每个导航页一个入口组件（接 MModelPage + useWorkspace）
    ExplorerPage  TopoPage  QueryPage  DataPage
    ImportsPage  AgentPage  SettingsPage  DocsPage

  features/                  ← 重型可视化（整目录移植 + 桥接）
    explorer/                ← MModel 图编辑器：@xyflow/react + @hpcc-js/wasm-graphviz + explorer.css
    entityTopo/              ← 实体拓扑：cosmos.gl WebGL 引擎（cosmosTopo/）+ entityTopo.css
```

**两类页面**：
- **@grafana/ui 原生重写**（`pages/` 里直接实现）：Query、Data store、Imports、Agent、Settings、Docs/API map。
- **移植 + 桥接**（`pages/` 薄包一层，真实现在 `features/`）：Explorer、Topology。

### 后端 `pkg/`
```
pkg/main.go               ← app.Manage("deepsite-umodel-app", plugin.NewApp)
pkg/plugin/app.go         ← App：读 jsonData.apiUrl + secureJsonData.apiKey；CheckHealth
pkg/plugin/resources.go   ← proxyTo() 反向代理；registerRoutes 把 /api/、/healthz 转发到 apiUrl
pkg/plugin/resources_test.go ← ping + 反代转发 + 未配置 502 单测
```

---

## 6. 前端如何适配 Grafana（核心）

### 6.1 总原则
1. **两种策略并存**，按页面性质选：
   - 简单页/表单页 → **用 `@grafana/ui` 原生重写**（最干净、原生主题）。
   - 重型可视化（无 `@grafana/ui` 等价物）→ **移植原 React 组件 + 主题桥接**，保留核心实现。
2. **零硬编码、全部从主题派生**（遵循 Grafana best-practices）：颜色/间距/圆角/阴影取 `theme.colors.* / theme.spacing() / theme.shape.radius.* / theme.shadows.*`；HTML/CSS 用 `useStyles2` 或 `var(--om-*)`；明暗主题由 Grafana 驱动，组件零改动跟随。

### 6.2 数据通路（替代原 Vite 代理）
- 前端基址 `RESOURCE_BASE = /api/plugins/<id>/resources`（`src/api/constants.ts`，id 从 `plugin.json` import 作单一真源）。
- `MModelApi`（`src/api/client.ts`）用 `getBackendSrv().fetch()`（rxjs `lastValueFrom`，`responseType:'text'` 容忍 204），调 `${RESOURCE_BASE}/api/v1/...`。
- 插件 Go 后端 `resources.go` 的 `proxyTo()` 把 `/api/*`、`/healthz` 透明反代到 `apiUrl`，删 `Cookie`/`Authorization`，可选注入 `Bearer apiKey`。

### 6.3 路由与外壳
- `module.tsx`：`AppPlugin().setRootPage(App).addConfigPage(...)`。
- `App.tsx`：react-router v6 `<Routes>`，每页一个 `<Route>`，`*` → `Navigate to /explorer`。
- 每页用 `<PluginPage>`（`@grafana/runtime`）拿 Grafana 页头/面包屑。
- **工作区**：原 web 用"选 workspace 才进主界面"。这里下沉为 `WorkspaceContext`（列表+选中态，localStorage）+ `WorkspaceSelect`（Combobox，放在 `MModelPage` 的页头 actions）+ 未选时空态门控。`plugin.json` 的 `includes` 与 `ROUTES` 一一对应。

### 6.4 主题适配的两条路径
**A) `@grafana/ui` 重写**（Query/Data/Imports/Agent/Settings/Docs）
- 用 `Field/Input/TextArea/Button/Checkbox/RadioButtonGroup/Badge/Tab+TabsBar/InteractiveTable/ConfirmModal/Stack/Text` 等。
- 自定义样式一律 `useStyles2((theme: GrafanaTheme2) => ...)` + `@emotion/css`。
- **`Select` 一律用 `Combobox`**（前者已废弃）。
- 挂载即拉取的 effect 加 `// eslint-disable-next-line react-hooks/set-state-in-effect`（fetch-on-mount 是正当模式）。

**B) 移植 + 主题桥接**（Explorer/Topology）—— `src/design/ThemeBridge.tsx`
- 原 web 用一套 `--om-*` 设计令牌 + `--ume-*`/`--eto-*` 布局令牌（浅色硬编码）。
- `UModelRoot` 把 ~30 个 `--om-*` 令牌**从 `GrafanaTheme2` 计算**并注入根 `div` 的内联 CSS 变量；`MModelPage` 用它包裹所有页面内容。`--ume-*`/`--eto-*` 大多 `var(--om-*)`，于是整套 CSS 跟随主题。
- 关键细节：**portal 到 `document.body` 的浮层**（节点菜单/focus 面板）在 `.umodel-root` 之外、拿不到 `--om-*`，所以 `UModelRoot` 还把 `--om-*` 用 `useEffect` 注入 `document.body`（仅自定义属性，Grafana 不读取，无污染）。
- 移植时把 web 残留的写死浅色（`--ume-color-bg-subtle:#fafafa`、`background:#fff`、`border:#e5e7eb`…）逐一改成 `var(--om-*)`。

### 6.5 ★ 没有 `@grafana/ui` 原生组件的部分怎么适配
这是本插件最关键的经验，分三类：

**(1) Monaco 编辑器 → `@grafana/ui` CodeEditor**
- JSON/YAML 编辑：`@monaco-editor/react` 的 `Editor` → `@grafana/ui` `CodeEditor`（已内置、由 Grafana 托管 monaco worker，避免从 CDN 拉 monaco 在内网失败）。
- **DiffEditor 无原生等价物** → 用**并排两个只读 `CodeEditor`**（加 `.ume-diff-sxs` 布局）。

**(2) Explorer 图编辑（React Flow + Graphviz WASM）—— 保留，桥接主题**
- `@xyflow/react`（React Flow）渲染 + `@hpcc-js/wasm-graphviz`（WASM 布局）原样保留（webpack 已开 `asyncWebAssembly`）。
- 布局/画布的 `ume-*` CSS 经 `--om-*` 跟随主题。
- React Flow 的 `Background` 网格点色、`MiniMap` 节点色等**是 props 不是 CSS** → 在组件里 `const theme = useTheme2()`，传 `theme.colors.border.medium`/`theme.colors.text.secondary`。

**(3) Topology 拓扑图（cosmos.gl WebGL）—— 最难，重点看**
- 渲染引擎 `CosmosEngine` 是**命令式类**（非 React），整目录移植保留（`features/entityTopo/cosmosTopo/`）。
- **WebGL 画布背景色不能用 CSS 变量**（它是传给 GL 上下文的字面量，不是 CSS）。原来 `const BG_COLOR='#ffffff'` 硬编码 → 暗色下整个拓扑区发白。
  适配做法（**通用范式**）：给引擎加可配置项，由能用 `useTheme2()` 的 React 组件把主题色注入：
  - `types.ts`：`CosmosEngineConfig.backgroundColor?: string`
  - `cosmosEngine.ts`：构造函数 `this.backgroundColor = config?.backgroundColor ?? BG_COLOR`，Graph 配置用 `backgroundColor: this.backgroundColor`
  - `cosmosTopoGraph.tsx`：`const theme = useTheme2()`，`new CosmosEngine(host, { backgroundColor: theme.colors.background.primary, ... })`
- 其余 HTML/CSS 部分照旧：`eto-*` CSS 令牌桥接到 `--om-*`；模块级内联样式常量（隔离条/渲染浮层）用 `var(--om-*)`（元素在主题树内可解析）。
- **命令式引擎 ↔ React 的桥接模式**：引擎每帧 `setTick(t=>t+1)`，组件里 `useMemo(() => engine.getXxx(), [engine, tick])` 用 `tick` 强制重算来读最新引擎状态（这类 memo 会被 `exhaustive-deps` 判为"多余依赖"，是**故意**的，加针对性豁免）。

> **一句话范式**：凡 **WebGL/Canvas 这类不吃 CSS** 的渲染，从 `useTheme2()` 取色**注入**进去；凡 **HTML/CSS** 的，用 `var(--om-*)`（桥接令牌）或 `useStyles2(GrafanaTheme2)`。一律不写死 hex。

### 6.6 eslint 域内放宽（移植代码的取舍）
新版 react-hooks 规则（对齐 React Compiler）对命令式可视化**系统性误报**（渲染期读 ref 定位浮层、fetch/布局 effect、引擎接线）。根 `eslint.config.mjs` 仅对 `src/features/{explorer,entityTopo}/**/*.tsx`（**只组件文件，纯逻辑 `.ts` 保持全严格**）关掉：`react-hooks/refs`、`react-hooks/set-state-in-effect`、`react-hooks/use-memo`、`react/display-name`。
**`react-hooks/exhaustive-deps` 保持 error**（最能抓 stale-closure bug）：少数故意违规（tick 订阅、派生 key 控触发、引擎只随 data 重建）逐行 `// eslint-disable-next-line` 并写明理由——新代码仍被规则拦。

---

## 7. 开发工作流

### 质量门（dev box，无需 Docker）
```bash
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # eslint（lint:fix 可自动修格式/import 顺序）
npm run test:ci     # jest
npm run build       # webpack production → dist/
mage -v             # 后端编译（否则 backend:true 健康检查失败）
```
### e2e 回归测试（`@grafana/plugin-e2e` + Playwright）

e2e 在**真实 Grafana** 里跑：`playwright.config.ts` 有两个 project——`auth`（用默认 admin 登录、把 cookie 存 `playwright/.auth/`）与 `chromium`（带 admin 身份跑 `tests/*.spec.ts`）。测试从 `./fixtures` 导入 `test`/`expect`（**不要**从 `@playwright/test` 直接导），用 `gotoPage`/`appConfigPage` 等 fixture。写测试的选择器约定见 `.config/AGENTS/e2e-testing.md`。

**测试文件**
| 文件 | 类型 | 依赖后端 |
|---|---|---|
| `tests/appNavigation.spec.ts` | 冒烟：7 个门控页渲染 "No workspace selected"、选择器存在、API map 渲染 | **否**（Provider 不自动选 workspace，未选即空态，与后端可达无关） |
| `tests/appConfig.spec.ts` | 冒烟：配置页保存 apiUrl/apiKey（reset 条件化） | 否 |
| `tests/appQuery.spec.ts` | 功能：配置 apiUrl → 选 workspace → Query 执行 SPL → 断言结果表出行 | **是**，需可达且有数据的 mmodel-server；**按需开启**（见下） |

**前提**
1. 先构建 `dist/`（`npm run build` + `mage -v`）——`npm run server` 会挂 `../dist`。
2. 有一个**装了本插件的** Grafana 在跑（用本插件的 `npm run server`，或指向已挂本插件 `dist/` 的 Grafana）。
3. 首次装浏览器：`npx playwright install chromium`。

**运行**
```bash
# 终端1：起装了本插件的 Grafana
npm run server                              # docker compose；docker ps 看真实端口
GRAFANA_VERSION=12.3.0 npm run server       # 按最低支持版(plugin.json grafanaDependency)测

# 终端2：GRAFANA_URL 指向那个 Grafana 的真实端口
GRAFANA_URL=http://<host>:<port> npm run e2e
npm run e2e -- --ui                          # 交互 UI 模式
npx playwright show-report                   # 看 HTML 报告
```
- **跨机器**：dev box 跑测试、Grafana 在 128 → `GRAFANA_URL=http://192.168.31.128:<port> npm run e2e`（dev box 只需装 Playwright 浏览器）；同机可用 `localhost:<port>`。

**功能测试按需开启**（`appQuery.spec.ts`）——不设环境变量时 `test.skip` 跳过：
```bash
E2E_MMODEL_API_URL=http://192.168.31.128:18080 \  # 容器可达地址，与配置页 apiUrl 同理
  GRAFANA_URL=http://192.168.31.128:<port> npm run e2e -- appQuery
# 可选：E2E_WORKSPACE=<名称> 指定选哪个 workspace（默认第一个；需有可查的 .mmodel 数据）
```

**易踩坑**
- **目录/server/GRAFANA_URL 三者要都是本插件这一套**：跑参考项目/别的 server 起的 Grafana 装的是别的插件，本插件的路由/页面不存在，用例会全挂。
- `ECONNREFUSED` = 该 host:port 没在监听 → `docker ps` 看真实端口、`curl http://<host>:<port>/api/health` 验证连通。
- 脚手架自带的旧测试若引用了已删页面（`ROUTES.One`/`PageOne` 文案）会失败，需按现有导航重写。
- **插件 app 配置是全局单条记录**（一个 org 一份）。`fullyParallel` 下多个测试若都改 `apiUrl` 会**互相覆盖**——让写配置的测试用**相同值**（如都取 `E2E_MMODEL_API_URL`），或串行；读配置的功能测试在列表没出时可 `page.reload()` 重拉一次以扛住并发重建的瞬时失败。

### 新增/移植一个页面的既定步骤
1. **@grafana/ui 重写型**：在 `src/pages/XxxPage.tsx` 用 `<MModelPage>` + `useWorkspace()` 取 `api/workspace`，用 `@grafana/ui` 组件实现；`useStyles2` 主题化。
2. **移植重型可视化型**（参考 Explorer/Topology）：
   - `cp -r web/src/features/<feat> src/features/<feat>`（import 路径 `../../api`/`../../lib`/`../../design/components` 天然对齐）。
   - 每个含 JSX 的 `.tsx` 补 `import React`（本插件经典 JSX runtime；与现有 `from 'react'` 合并避免 `no-duplicate-imports`）。
   - 删 `noUnusedLocals` 报的未用导入/死代码；`@monaco-editor/react` → `CodeEditor`；根路径静态资源 → `import`。
   - 新建 `src/pages/<Feat>Page.tsx` 接入 context；`App.tsx` 加 `<Route>`，`plugin.json` 加 `includes`（**改 plugin.json 需重启 Grafana**）。
   - CSS：写死浅色 → `var(--om-*)`；WebGL/Canvas 取色 → `useTheme2()` 注入。
   - 若新版 react-hooks 误报 web 既有写法，在根 `eslint.config.mjs` 的 override `files` 里加该目录（参考现有写法）。
3. 跑全套质量门 + 浏览器实测（暗色主题观感）。

---

## 8. 约束与坑速查
- **禁改** `.config/**`（脚手架托管）与 `plugin.json` 的 `id`/`type`。
- React/react-router/rxjs/`@grafana/*` 是 external，**版本钉死 13.0.2 / React 18**，不可换。
- **改 `plugin.json` 必须重启 Grafana**。
- `apiUrl` **不能填 `localhost`**（反代由 Grafana 容器发起）。
- **Go 版本坑**：容器 1.21.6 vs `go.mod` 1.26.3 → host 预编译后端。
- Linux 二进制从 Windows 同步后 `chmod +x`。
- 未签名插件需 `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=deepsite-umodel-app`。
- 本项目无 Prometheus/Loki/Tempo——可观测数据走 Go 反代，不要去接原生 datasource。

---

## 9. 参考
- Grafana 插件官方文档（训练数据可能过时，以此为准）：https://grafana.com/developers/plugin-tools/llms.txt
- `@grafana/ui` 组件：https://developers.grafana.com/ui/latest/index.html
- best-practices：https://grafana.com/developers/plugin-tools/key-concepts/best-practices