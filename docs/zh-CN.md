# SkyLoupe

在真实页面上标注 React 界面，预览设计变量，并把源码位置交给 Codex，而不是让它去猜选择器。

[English](../README.md)

从 GitHub 安装命令行。SkyLoupe 自己的包不依赖 npm 作为主要发布渠道。

```bash
npm i github:pollackcarlos21-create/skyloupe#dist
```

单个压缩包和 JSR 的步骤在 [RELEASING.md](RELEASING.md)。

```bash
pnpm install
pnpm --filter skyloupe build
pnpm exec skyloupe demo
```

`pnpm exec skyloupe demo --offline` 用录好的改码样本跑完热更新闭环，不需要 Codex CLI，也不访问外网，跑完即退出。

## 组成

| 包 | 作用 |
| --- | --- |
| `@skyloupe/core` | 类型、预览回滚、画布命中防护。没有运行时依赖。 |
| `@skyloupe/react` | `AnnotationContainer`、`Annotatable`、`useAnnotationControls`、`AnnotatableCanvas`。 |
| `@skyloupe/vite` | 开发态写入 `data-skyloupe-source` 和 `.skyloupe/session.json`。 |
| `@skyloupe/devtools` | 没有原生 API 时的 polyfill 和 Shadow DOM 胶囊。 |
| `skyloupe` | `init`、`bridge`、`mcp`、`doctor`、`demo`。 |

`@skyloupe/core` 的 gzip 小于 2 KB。core 与 React 生产入口合计 gzip 小于 4 KB。

## 和 agentation 的对照

下表来自项目计划，不是对 agentation 当前仓库的复查。

|  | SkyLoupe | agentation |
| --- | --- | --- |
| 许可证 | MIT | PolyForm |
| `document.oai.annotation` | 对接的接口 | 不是目标接口 |
| `registerControls` | 设计变量滑块，带预览和回滚 | 无 |
| `registerSurface` | 画布里的子图形，例如 Q3 柱 | 无 |
| Codex | 只监听 `127.0.0.1` 的 `codex app-server`，或复制 Markdown | 无本地桥 |

## 命令

```bash
pnpm exec skyloupe init
pnpm exec skyloupe bridge
pnpm exec skyloupe mcp
pnpm exec skyloupe doctor ./src
pnpm exec skyloupe demo
pnpm exec skyloupe demo --offline
```

`init` 会识别 Vite、Next.js 或 webpack，以及包管理器，从 GitHub 压缩包安装对应的包，写入 `skyloupe:bridge`。Vite 的 `plugins` 是数组字面量时直接改配置，否则只打印 diff。`bridge` 只绑定 `127.0.0.1`，检查 `Host` 和 `Origin`，写请求必须带 `X-SkyLoupe-Token`。

演示里故意留了两个规范问题，给诊断抽屉用：`Legacy note` 的嵌套 metadata（`OAI-META-001`），以及容器外的 `Launch badge`（`OAI-DOM-001`）。它们不是待修的缺陷。
