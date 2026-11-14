# SkyLoupe 开发方案

> 工作名：**SkyLoupe**（命令行 `skyloupe`，npm 作用域 `@skyloupe/*`）。发布前请再次确认 npm 和 GitHub 名称可用。
>
> **已被占用的名称（不要用）：** `annotaKit`（已被 Svelte 工具 `annotakit.dev` 占用）、`agentation`（已被 `benjitaylor/agentation` 占用）、`cuepin`（已被 `cuepin.app` 占用）、`specpin`（已被 `lamngockhuong/specpin` 占用）、`annotation-bridge`（已被 `AAAAAAQQQQQ/annotation-bridge` 占用）。
>
> 一句话定位：**OpenAI 网页标注标准 `document.oai.annotation` 的声明式开发套件与全浏览器模拟器。一套代码在 ChatGPT / Codex 桌面内置浏览器里零开销直通原生能力，在普通 Chrome / Safari 里自动开启滑块调参、Canvas 拾取、规范体检，并一键把“源码定位 + 设计参数前后对比 + 截图”推给本地 Codex 直接改代码。**
>
> 英文 slogan：*Write once for OpenAI Browser Annotations. Preview tokens, pick canvas objects, and ship live UI diffs to Codex from any browser.*

---

## 0. 给实现者（ChatGPT / Codex）的说明

1. 按第 10 节的里程碑顺序（M0 到 M5）逐步实现。每完成一个里程碑，先运行 lint、类型检查、测试和体积检查，满足验收标准并等用户确认后，再进入下一个里程碑。
2. **严格遵守 OpenAI 官方协议规范，绝不凭想象捏造字段或接口：**
   - 浏览器端 `document.oai.annotation` 契约、HTML 属性和全部校验上限，以第 5 节整理的 [Annotations Extensibility 官方文档](https://learn.chatgpt.com/docs/annotations-extensibility) 为准。
   - 本地与 `codex app-server` 通信的 JSON-RPC 协议（注意线上消息不包含 `"jsonrpc": "2.0"` 字段，本地截图使用 `turn/start` 的 `localImage` 输入项），以第 6.5 节整理的 [Codex App Server 官方文档](https://developers.openai.com/codex/app-server) 为准。实现 M4 时先在本机运行 `codex app-server generate-json-schema --out ./tmp-schemas` 核对当前 CLI 版本的精确字段。
3. **生产零负担铁律：** `@skyloupe/core` 和 `@skyloupe/react` 会进入用户的生产构建产物，必须保持**零运行时第三方依赖**（`react` 作为 peerDependency），两个包合并后的 gzip 体积不得超过 **4 KB**。所有悬浮面板、模拟器、截图和桥接逻辑全部放在仅开发环境加载的 `@skyloupe/devtools` 和 `skyloupe` CLI 中。
4. 代码标识符、终端输出、调试面板文案和英文版 README 使用英文；本文档使用中文描述需求。
5. 遇到本文档未覆盖的细节决策时，选择最简单、最可逆的做法，并在 `docs/decisions.md` 中记录一行原因。

---

## 1. 调研结论：为什么选这个方向

调研时间为 2026 年 11 月。OpenAI 在 [DevDay 2026](https://learn.chatgpt.com/docs/whats-new/devday-2026)（2026 年 9 月 29 日）正式推出了网页标注扩展标准 [Annotations Extensibility](https://learn.chatgpt.com/docs/annotations-extensibility)（运行在 `document.oai.annotation` 命名空间下）。相关赛道现状如下：

| 类别 | 现状 | 代表项目 | 结论 |
|---|---|---|---|
| 通用网页点选复制选择器工具 | 已有成熟项目，但**完全不支持 `document.oai.annotation` 标准** | [agentation](https://github.com/benjitaylor/agentation)（且采用 PolyForm Shield 非开源商业限制协议）、`annotakit.dev`（Svelte 版） | 它们只抓 CSS 选择器和文字备注，不支持实时参数滑块（`registerControls`）、不支持 Canvas 内部图形拾取（`registerSurface`），在 ChatGPT 桌面内置浏览器中也无法激活原生体验 |
| ChatGPT 插件与应用界面框架 | 已被头部项目占领 | [alpic-ai/skybridge](https://github.com/alpic-ai/skybridge)（登上 OpenAI 官方博客，已支持 `openai/mcp-extensions`） | 它服务的是对话侧边栏和插件卡片里的 `window.openai`，完全不涉及普通网页上的 `document.oai.annotation` |
| 大型项目手动接入 `document.oai.annotation` | 刚开始手动写原生胶水代码，痛点明显 | [Remotion PR #11944](https://github.com/remotion-dev/remotion/pull/11944)、[WordPress Playground PR #4412](https://github.com/WordPress/wordpress-playground/pull/4412)、[OpenClaw PR #168886](https://github.com/openclaw/openclaw/pull/168886) | 全 GitHub 相关提及不到 10 处，**没有任何 React 封装库、规范校验器或普通浏览器模拟器** |
| 在普通浏览器和终端 Agent 中复用该体验 | 社区明确提出需求但尚无方案 | [OpenPaperDesign Issue #22](https://github.com/arcitai/openpaperdesign/issues/22) | 开发者离开 ChatGPT 桌面内置浏览器（用 Chrome + Codex CLI / Claude Code）时，`document.oai.annotation` 直接是 `undefined` |

### 核心痛点与机会

1. **原生接口极底层，遍布静默失败与死锁陷阱：**
   - `oai-annotation-metadata` 超过 6 个字段或含嵌套对象时会被浏览器**静默丢弃**，没有任何报错。
   - `oai-annotatable` 漏写外层 `oai-annotation-container` 时完全不生效。
   - `registerControls` 单文档限 64 个注册、1024 个目标关联；组件卸载调用 `dispose()` **不会自动还原预览态修改过的内联样式**；React 重渲染替换真实 DOM 节点后，旧节点解绑、新节点失效。
   - `registerSurface` 的异步 `hitTest` 全局只允许 1 个 Promise 在途（in-flight），一旦组件取消拾取时忘了 settle 该 Promise，**整个页面的 Canvas 拾取会永久卡死**。
2. **开发调试环境割裂：** 前端开发者 90% 的时间在 Chrome DevTools 里调试页面、在终端或 IDE 里跑 Codex，但 `document.oai.annotation` 只存在于 ChatGPT 桌面端内置浏览器里。

**选题结论：** 复刻 Skybridge 在 `window.openai` 上的成功路径，做 `document.oai.annotation` 领域的标准开源套件（采用宽松的 MIT 协议，直接与 PolyForm Shield 协议的 `agentation` 形成鲜明对比）。既帮接入方零样板代码搞定原生兼容与防坑校验，又让普通 Chrome 浏览器拥有一模一样的实时调参预览台，并直连本地 `codex app-server` 自动落盘改代码。

五维评分（满分 5 分）：

| 维度 | 通用选择器批注工具 | 插件 UI 框架 | **SkyLoupe** |
|---|---|---|---|
| 痛点普遍性 | 4 | 3 | **4.5**（前端、设计系统、数据可视化团队高频痛点） |
| 竞争空白 | 2 | 1 | **5**（`document.oai.annotation` 生态目前零封装、零模拟器） |
| 10 秒演示冲击力 | 3.5 | 4 | **5**（普通 Chrome 拉动间距与颜色滑块对比前后效果，点发送后 Codex 秒改源码并热更新） |
| 与 OpenAI 的相关性 | 2 | 5 | **5**（100% 对齐 DevDay 2026 新标准 + `codex app-server` 原生桥接） |
| 个人 2 到 3 周做出 MVP | 4 | 3 | **4.5**（纯 TypeScript 前端与轻量本地进程桥接，无需烧钱跑大模型评测） |

---

## 2. 产品定义

### 2.1 目标用户

- 使用 React、Next.js、Vite、Storybook 开发 Web 应用或组件库的个人开发者与前端团队。
- 在页面中包含 `<canvas>` 图表、画布编辑器、WebGL / 2D 图形，希望 AI 编码 Agent 能精确理解画布内单个图形对象的开发者。
- 日常混用 ChatGPT 桌面端浏览器、Codex CLI、Codex IDE 插件或 Claude Code 的开发者。

### 2.2 核心工作流

```
业务组件接入 @skyloupe/react（<Annotatable> / useAnnotationControls / <AnnotatableCanvas>）
         │
         ├─── 在 ChatGPT / Codex 桌面内置浏览器中打开
         │         └──> 自动检测原生 document.oai.annotation ──> 零开销直通官方原生标注编辑器
         │
         └─── 在普通 Chrome / Safari / Firefox 中打开（开发模式加载 @skyloupe/devtools）
                   ├──> 注入 100% 符合官方规范的 Polyfill + Shadow DOM 悬浮工具栏
                   ├──> 实时运行 18 项官方规范体检（拦截静默丢弃、Bidi 字符、Canvas 槽位死锁）
                   ├──> 鼠标点选组件或 Canvas 子图形 ──> 拉动颜色/间距/枚举/开关滑块实时预览（支持按住对比原状）
                   └──> 点击递交：
                         ├─ 模式 A（直连）：通过本地 `skyloupe bridge` 调 `codex app-server` `turn/start` 自动改源码
                         ├─ 模式 B（队列）：通过 `skyloupe mcp` 供 Codex CLI / Claude Code / Cursor 拉取
                         └─ 模式 C（免守护进程）：一键复制含源码行号、Token 前后对比和截图的结构化提示词
```

### 2.3 四种运行模式

| 模式 | 触发条件 | 系统行为 |
|---|---|---|
| `native-passthrough` | 检测到宿主浏览器已注入原生 `document.oai.annotation`，且未强制开启巡检浮窗 | 不覆盖原生对象，仅由 `@skyloupe/core` 执行生命周期安全托管与样式回滚 |
| `native-companion` | 存在原生 `document.oai.annotation`，且开启 `inspector: true` | 保留原生行为，仅在角落显示只读的“18 项规范诊断徽章”，帮助排查静默忽略问题 |
| `polyfill-standalone` | 普通浏览器（无原生 API），未连接本地 Bridge | 注入完整模拟层与悬浮标注面板，支持点选、滑块预览、原状对比，递交时复制结构化 Markdown 载荷与截图 |
| `polyfill-connected` | 普通浏览器，且检测到本地 `skyloupe bridge` 在线 | 在 `polyfill-standalone` 基础上解锁“Send to Codex”一键直推，在悬浮胶囊中流式显示 Codex 修改文件的进度，完成后自动退出预览态让 HMR 生效 |

### 2.4 非目标（v1 不做）

- 不做云端多人设计评审 SaaS、账号系统或云存储，100% 本地运行。
- 不做封闭 Shadow Root（`mode: 'closed'`）或跨域 `<iframe>` 内部穿透（官方规范本身明确不支持，体检器给出清晰提示即可）。
- v1 框架绑定只做原生 DOM（`@skyloupe/core`）和 React 18/19（`@skyloupe/react`）；Vue 与 Svelte 留到 v0.2 通过适配器扩展。
- 不修改或破解 ChatGPT 桌面客户端本身。

---

## 3. 用户体验

### 3.1 业务代码接入示例（30 秒上手）

```tsx
// App.tsx（开发环境挂一次 DevTools，生产构建自动树摇剔除）
import { AnnotationContainer, Annotatable, useAnnotationControls } from '@skyloupe/react';
import { SkyLoupeDevTools } from '@skyloupe/devtools';
import { useRef } from 'react';

export function PricingCard({ planId, price }: { planId: string; price: number }) {
  const cardRef = useRef<HTMLElement>(null);

  // 自动绑定 CSS 变量预览、原状对比与组件卸载回滚，且当 DOM 节点变化时自动同步注册目标
  useAnnotationControls(cardRef, {
    controlsHeading: 'Card appearance',
    controlsMode: 'replace',
    controls: [
      {
        type: 'range',
        label: 'Card padding (pixels)',
        callback: 'setCardPadding',
        reference: '--card-padding',
        cssVar: '--card-padding',
        unit: 'px',
        min: 8,
        max: 40,
        step: 4,
        currentValue: 20,
      },
      {
        type: 'color',
        label: 'Accent color',
        callback: 'setAccentColor',
        reference: '--card-accent',
        cssVar: '--card-accent',
        currentValue: '#2563eb',
      },
    ],
  });

  return (
    <Annotatable
      as="article"
      ref={cardRef}
      name={`Pricing Card (${planId})`}
      metadata={{ planId, monthlyPrice: price }}
      className="pricing-card"
    >
      <h3>{planId}</h3>
      <p>${price}/mo</p>
    </Annotatable>
  );
}

export default function Page() {
  return (
    <AnnotationContainer>
      <PricingCard planId="Pro" price={29} />
      {import.meta.env.DEV && <SkyLoupeDevTools bridgeUrl="http://127.0.0.1:4777" />}
    </AnnotationContainer>
  );
}
```

### 3.2 命令行一览

```bash
npx skyloupe init             # 自动检测 Vite / Next.js 项目，注入开发态组件与可选 Vite 源码定位插件
npx skyloupe bridge           # 启动本地安全桥接服务（默认 127.0.0.1:4777），连接 codex app-server
npx skyloupe mcp              # 启动 stdio MCP 服务器，供 Codex CLI / Claude Code / Cursor 拉取标注队列
npx skyloupe doctor [path]    # 静态扫描源码中的标注属性与控件定义，检查 18 条官方规范违规项
npx skyloupe demo             # 一键启动内置的演示画廊（含卡片 Token 调节 + Canvas 柱状图拾取 + 离线回放模式）
```

### 3.3 期望的终端输出示例

```text
$ npx skyloupe doctor ./src
✔ Scanned 48 TSX files in 140ms
✖ src/components/UserRow.tsx:18  [OAI-META-002] `oai-annotation-metadata` contains nested object key `profile`. OpenAI ignores non-flat metadata.
✖ src/components/Badge.tsx:9     [OAI-DOM-001]  `oai-annotatable` used without an ancestor `oai-annotation-container` (will have no effect).
⚠ src/charts/RevenueChart.tsx:64 [OAI-CTRL-005] Control reference `card padding` contains spaces (allowed: A-Za-z0-9_./:@$#-).
Summary: 2 errors, 1 warning across 3 files.

$ npx skyloupe bridge
✔ SkyLoupe local bridge listening on http://127.0.0.1:4777
✔ Pairing token written to .skyloupe/session.json (auto-injected by @skyloupe/vite)
✔ Connected to `codex app-server` (Codex CLI detected, cwd: /Users/me/my-app, sandbox: workspaceWrite)
  [14:22:08] Annotation #1 received on <Pricing Card (Pro)> (src/components/PricingCard.tsx:31)
             Controls diff: --card-padding 20px → 28px, --card-accent #2563eb → #0f766e
             Comment: "Give the Pro card more breathing room and use our teal brand token"
  [14:22:09] Started turn_8f1a on thread thr_019a... (attached localImage: /tmp/skyloupe/ann_1.png)
  [14:22:16] ✔ Codex updated src/styles/tokens.css and src/components/PricingCard.tsx (turn completed in 7.1s)
```

---

## 4. 系统架构与目录结构

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 宿主 Web 应用（React / Vite / Next.js / 原生 HTML+Canvas）              │
│  ┌───────────────────────┐        ┌──────────────────────────────────┐  │
│  │ @skyloupe/react       │───────>│ @skyloupe/core（零依赖，< 4KB）  │  │
│  │ 组件、Hooks、Canvas   │        │ 18项规范校验、样式回滚、防死锁槽 │  │
│  └───────────────────────┘        └────────────────┬─────────────────┘  │
│                                                    │                    │
│                       ┌────────────────────────────┴─────────────┐      │
│                       ▼（ChatGPT 内置浏览器）                    ▼（普通浏览器开发态）
│            原生 document.oai.annotation               @skyloupe/devtools │
│            零开销直通官方编辑器                       Polyfill + Shadow  │
│                                                       DOM 滑块面板 + 截图│
└──────────────────────────────────────────────────────────────────┬──────┘
                                                                   │ HTTP/SSE (127.0.0.1 + Pairing Token)
                                                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ skyloupe CLI（本地 Node 进程）                                          │
│  ├── bridge 模块 ──(stdio JSONL / ws)──> `codex app-server` (turn/start)│
│  ├── mcp 模块    ──(stdio MCP)─────────> Codex CLI / Claude Code / IDE  │
│  └── doctor 模块 ──(AST 静态检查)──────> 18 项官方规范合规报告          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.1 技术选型

- **语言与包管理：** TypeScript 5.x（strict 模式），Node.js 20+，ESM，使用 `pnpm` workspace 管理多包仓库。
- **各子包依赖策略：**
  - `@skyloupe/core`：**零依赖**。
  - `@skyloupe/react`：**零运行时依赖**，`peerDependencies: { "react": ">=18.0.0" }`。
  - `@skyloupe/vite`：`peerDependencies: { "vite": ">=5.0.0" }`，使用轻量正则/MagicString 或 Vite 内置 AST 定位 JSX 行列号，不引入重型 Babel 全量构建负担。
  - `@skyloupe/devtools`：UI 使用原生 Custom Elements + **Open Shadow DOM**（内联纯 CSS，零 Tailwind/Emotion 运行时污染，且确保宿主页面样式绝不破坏标注浮窗，浮窗也不影响宿主页面的计算样式）。
  - `skyloupe`（CLI）：`commander`（命令行）、`zod`（请求校验与 MCP schema）、`ws`（可选连接外部 `codex app-server --listen ws://...`）、`picocolors`（终端着色）、`@modelcontextprotocol/sdk`（`skyloupe mcp` 子命令使用）。
- **构建与测试：** `tsup` 打包（输出 ESM + `.d.ts`），`vitest` + `jsdom` 测试核心规范与 React 生命周期，附带体积门禁脚本 `scripts/check-size.mjs`。

### 4.2 仓库目录结构

```text
skyloupe/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  scripts/
    check-size.mjs               # 强校验 core + react gzip < 4096 bytes
  packages/
    core/                        # @skyloupe/core
      package.json
      src/
        index.ts
        types.ts                 # 完整的 document.oai.annotation 官方类型定义
        constants.ts             # 官方硬性配额常量与正则表达式
        validators.ts            # 18 项规范校验器（区分抛错 vs 静默忽略 vs 返回 false）
        previewManager.ts        # CSS 变量与自定义预览的基线保存、对比切换与重置回滚
        surfaceGuard.ts          # Canvas DPI 坐标换算与 250ms 单槽位 Abort-Safe 包装器
        runtime.ts               # 原生 API 探测与安全调用门面
      test/
        validators.test.ts
        previewManager.test.ts
        surfaceGuard.test.ts
    react/                       # @skyloupe/react
      package.json
      src/
        index.ts
        AnnotationContainer.tsx  # oai-annotation-container 与 oai-annotation-container-text
        Annotatable.tsx          # forwardRef 多态组件，安全序列化 oai-annotation-metadata
        useAnnotationControls.ts # 自动追踪 ref 元素变化调用 update({ targets })，卸载自动回滚
        AnnotatableCanvas.tsx    # 封装 registerSurface + invalidate + 虚拟目标控件路由
        useAnnotationMode.ts     # 订阅 oaiannotationmodechange 与 isActive()
      test/
        reactBindings.test.tsx
    vite/                        # @skyloupe/vite
      package.json
      src/
        index.ts                 # 开发态注入 data-skyloupe-source="rel/path.tsx:line:col" 与桥接发现配置
      test/
        vitePlugin.test.ts
    devtools/                    # @skyloupe/devtools
      package.json
      src/
        index.ts                 # <SkyLoupeDevTools /> 与 mountSkyLoupeDevTools() 原生入口
        polyfill/
          installPolyfill.ts     # 当 document.oai?.annotation 缺失时挂载 100% 兼容实现
          registry.ts            # 维护 64 注册上限、1024 目标上限、1 个在途 hitTest 槽位与死锁计时器
          picker.ts              # 容器优先级寻址、文本拖选 Range、Canvas hitTest 与 Space 键点击穿透
        overlay/
          shadowHost.ts          # Shadow DOM 挂载与亮暗色主题样式
          highlightLayer.ts      # 悬停框、选中框、对象名称角标
          editorPanel.ts         # 批注输入框、color/range/select/toggle 控件渲染、按住对比原状按钮
          diagnosticsDrawer.ts   # 实时展示当前页面的官方规范违规与警告列表
        capture/
          screenshot.ts          # Canvas 直接导出或局部视图快照生成（遵循 omitScreenshot）
          bundleBuilder.ts       # 组装 AnnotationBundle（含源码位置、Token Diff、可见 Select 标签）
        client/
          bridgeClient.ts        # 与本地 127.0.0.1:4777 通信并接收 Codex 流式修改状态
      test/
        polyfillSpec.test.ts     # 对照第 5 节逐条验证官方一致性
        pickerPrecedence.test.ts
    cli/                         # skyloupe（bin: skyloupe）
      package.json
      src/
        cli.ts
        commands/
          init.ts
          bridge.ts
          mcp.ts
          doctor.ts
          demo.ts
        bridge/
          httpServer.ts          # 仅绑定 127.0.0.1，校验 Origin 与 Pairing Token
          codexAppServer.ts      # 管理 codex app-server 子进程或 ws 连接，执行 initialize / thread / turn
          promptFormatter.ts     # 将 AnnotationBundle 转为精准改码指令
          store.ts               # 本地内存与 .skyloupe/queue.json 待处理标注队列
        mcp/
          server.ts              # 暴露 list_annotations / get_annotation / resolve_annotation 工具
        doctor/
          astScanner.ts          # 扫描 HTML/JSX/TSX 静态违规项
      test/
        codexAppServer.test.ts   # 使用录制好的 JSONL 消息测试握手、localImage 与流式通知
        httpSecurity.test.ts     # 测试非白名单 Origin、缺失 Token 全部 403 拦截
        doctor.test.ts
  demo/
    app/                         # 内置 Vite + React 演示站点（定价卡片 + Canvas 季度营收柱状图 + 富文本区）
    recorded-codex/              # 录制好的 codex app-server 交互样本，支持无账号离线演示完整闭环
  skills/
    skyloupe/
      SKILL.md                   # 配套 Codex / Claude Skill，教 Agent 高效消费标注载荷与接入新组件
  docs/
    decisions.md
    spec-compliance.md           # 18 项官方规范对照表（英文，供对外宣传专业度）
```

---

## 5. OpenAI 官方规范精确映射与校验矩阵（核心护城河）

这是 SkyLoupe 区别于市面上玩具级批注插件的根本所在。`@skyloupe/core` 的校验器与 `@skyloupe/devtools` 的 Polyfill **必须严格复现以下官方行为**，一处都不能含糊。

### 5.1 全局接口 TypeScript 完整定义（`packages/core/src/types.ts`）

```ts
export type AnnotationPrimitive = string | number | boolean | null;
export type AnnotationMetadata = Record<string, AnnotationPrimitive>;

export interface AnnotationRequestOptions {
  mode?: 'default' | 'advanced';
  enterAnnotationMode?: boolean;
  omitScreenshot?: boolean;
  metadata?: AnnotationMetadata;
  initialComment?: string;
}

export interface AnnotationAcceptance {
  accepted: boolean;
}

export interface ColorControl {
  type: 'color';
  label: string;
  callback: string;
  reference?: string;
  currentValue?: string;
  defaultValue?: string;
}

export interface RangeControl {
  type: 'range';
  label: string;
  callback: string;
  reference?: string;
  min: number;
  max: number;
  step: number;
  currentValue?: number;
  defaultValue?: number;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectControl {
  type: 'select';
  label: string;
  callback: string;
  reference?: string;
  options: SelectOption[];
  currentValue?: string;
  defaultValue?: string;
}

export interface ToggleControl {
  type: 'toggle';
  label: string;
  callback: string;
  reference?: string;
  currentValue?: boolean;
  defaultValue?: boolean;
}

export type AnnotationControlDefinition =
  | ColorControl
  | RangeControl
  | SelectControl
  | ToggleControl;

export type ControlsTargetInput =
  | Element
  | readonly Element[]
  | NodeListOf<Element>;

export interface RegisterControlsConfig {
  targets: ControlsTargetInput;
  controlsHeading?: string;
  controlsMode?: 'replace' | 'extend';
  controls: AnnotationControlDefinition[];
}

export interface UpdateControlsConfig {
  targets?: ControlsTargetInput; // 允许传 [] 解绑所有目标
  controlsHeading?: string;
  controlsMode?: 'replace' | 'extend';
  controls?: AnnotationControlDefinition[]; // 允许传 [] 清空控件
}

export interface ControlsRegistrationHandle {
  update(config: UpdateControlsConfig): void;
  dispose(): void;
}

export interface SurfaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SurfaceHitTestArgs {
  clientX: number;
  clientY: number;
  signal: AbortSignal;
}

export interface SurfaceHitTestResult {
  id: string;
  name?: string;
  role?: string;
  metadata?: AnnotationMetadata;
  rect?: SurfaceRect;
}

export interface SurfaceRenderSelectionArgs {
  hoveredId: string | null;
  selectedId: string | null;
}

export interface RegisterSurfaceConfig {
  element: HTMLElement;
  hitTest(
    args: SurfaceHitTestArgs
  ): SurfaceHitTestResult | null | Promise<SurfaceHitTestResult | null>;
  renderSelection?(args: SurfaceRenderSelectionArgs): void;
}

export interface SurfaceRegistrationHandle {
  invalidate(): void;
  dispose(): void;
}

export type AnnotationControlAction = 'preview' | 'preview-original' | 'reset';

export interface AnnotationControlChangeDetail {
  callback: string;
  value: string | number | boolean;
  action: AnnotationControlAction;
  virtualTarget?: {
    surfaceId: string;
    targetId: string;
  };
}

export interface OaiAnnotationNamespace {
  isActive(): boolean;
  toggle(force?: boolean): AnnotationAcceptance;
  request(
    target: Element | Range,
    options?: AnnotationRequestOptions
  ): AnnotationAcceptance;
  registerControls(config: RegisterControlsConfig): ControlsRegistrationHandle;
  registerSurface(config: RegisterSurfaceConfig): SurfaceRegistrationHandle;
}

declare global {
  interface Document {
    oai?: {
      annotation?: OaiAnnotationNamespace;
    };
  }
}
```

### 5.2 18 条官方硬性规则与错误语义矩阵

在实现 `validators.ts` 和 `polyfill/` 时，必须严格区分**同步抛错（Throw）**、**返回 `{ accepted: false }`** 与**静默忽略（Ignore + 在 DevTools 诊断抽屉告警）**三种官方行为：

| 规则编号 | 检查对象 | 官方精确规则 | 违反时的官方行为（Polyfill 必须一致） |
|---|---|---|---|
| `OAI-ENV-001` | 运行上下文 | 仅在安全顶层文档生效（`https:`、`http://localhost`、`http://127.0.0.1` 且 `window === window.top`） | 非顶层或非安全上下文不注入 API；Surface 在 iframe 内注册同步抛错 |
| `OAI-DOM-001` | `oai-annotatable` | 必须位于某个 `oai-annotation-container` 祖先内部才生效；单独存在无任何作用 | 保持默认元素拾取，DevTools 标出孤立属性告警 |
| `OAI-DOM-002` | 容器嵌套与冲突 | 最近一层 `oai-annotation-container` 或 `oai-annotation-container-text` 决定手势；**同一元素同时拥有两个属性时，`oai-annotation-container-text` 优先** | 按优先级执行文本选择 |
| `OAI-META-001` | `oai-annotation-metadata` 结构 | 必须是扁平 JSON 对象，最多 **6 个属性**；值只能是 `string`、有限 `number`（`Number.isFinite`）、`boolean` 或 `null`，严禁数组与嵌套对象 | 整份无效 metadata 被静默忽略，DevTools 标红报错 |
| `OAI-META-002` | `oai-annotation-metadata` 键值与体积 | 键长 `1..64`，以 ASCII 字母开头，仅含 ASCII 字母、数字、下划线、连字符及**词间单个空格**（正则：`/^[A-Za-z](?:[A-Za-z0-9_-]\| [A-Za-z0-9_-])*$/` 且长 `<= 64`）；字符串值长 `<= 256`；JSON 序列化 UTF-8 字节数 `<= 2048` | 静默忽略，DevTools 标红报错 |
| `OAI-REQ-001` | `toggle()` / `request()` 手势要求 | 必须在活跃的用户交互回调（如 click/keydown 同步栈或 `navigator.userActivation.isActive`）中调用；单次最多保持 1 个待处理请求或已打开编辑器 | 返回 `{ accepted: false }`，绝不抛未捕获异常 |
| `OAI-REQ-002` | `request(target, options)` 参数约束 | `initialComment` 长度 `<= 240` UTF-16 码元（`str.length <= 240`）；当 `target` 是 `Element` 时必须 `isConnected` 且与当前可视视口相交；当 `target` 是 `Range` 时必须非折叠、含非空白可见文本、与视口相交、长度 `<= 20,000` UTF-16 码元、不在封闭 Shadow Root 内，且 **`Range` 传 `mode: "advanced"` 必须拒绝**；`Range` 或 Shadow DOM 内元素的 `options.metadata` 必须被忽略 | 不满足条件返回 `{ accepted: false }`（忽略项按规范静默忽略） |
| `OAI-CTRL-001` | 文档级注册配额 | 单文档最多 **64** 个活跃 `registerControls` 注册，累计最多 **1,024** 个“注册到目标元素”关联；单次 `registerControls` 的 `targets` 必须为 **1..128** 个当前文档已连接元素（仅 `update` 允许传 `[]` 解绑） | **同步抛出 Error** |
| `OAI-CTRL-002` | 控件数量与序列化上限 | 单次注册最多 **12** 个控件，且同一注册内 `callback` 不可重复；仅允许该 `type` 定义的字段（多传无关字段视为非法）；`{ controls, controlsHeading, controlsMode }` 的 `JSON.stringify` 结果长度 `<= 16,384` UTF-16 码元 | **同步抛出 Error** |
| `OAI-CTRL-003` | 文本与控制符禁令 | `controlsHeading`、控件 `label`、下拉选项 `label` 执行 `trim()` 后长度必须为 **1..80** UTF-16 码元；严禁包含任何控制字符（`\u0000-\u001F`, `\u007F-\u009F`）或 Unicode 双向文本方向控制符（`\u200E`, `\u200F`, `\u061C`, `\u202A-\u202E`, `\u2066-\u2069`） | **同步抛出 Error** |
| `OAI-CTRL-004` | `callback` 与 `reference` 命名 | `callback` trim 后 `1..80` UTF-16 码元，匹配 `/^[A-Za-z][A-Za-z0-9_-]*$/`；可选 `reference` 长度 `1..80`，匹配 `/^[A-Za-z0-9_./:@$#-]{1,80}$/`（**严禁含空格**） | **同步抛出 Error** |
| `OAI-CTRL-005` | `range` 数值边界 | `min`、`max`、`currentValue`、`defaultValue` 必须是 `[-10000, 10000]` 内的有限数；`min < max`；`step` 在 `[0.001, 10000]` 内且 `step <= max - min`；起始值在 `[min, max]` 内（**不强制与 `step` 对齐**）；未提供起始值时回退为 `min` | **同步抛出 Error** |
| `OAI-CTRL-006` | `color` 与 `toggle` 边界 | `color` 仅允许 `#` 后接 3、4、6 或 8 位十六进制字符（未提供起始值回退为 `"#ffffff"`）；`toggle` 仅允许严格布尔值（未提供起始值回退为 `false`） | **同步抛出 Error** |
| `OAI-CTRL-007` | `select` 边界与标签语义 | `options` 为 **1..12** 项，`value` 互不相同且长 `<= 512` UTF-16 码元；`currentValue` / `defaultValue` 必须命中某个 `option.value`（未提供回退为首项）；**预览事件传 `option.value`，但最终送给 Agent 的标注记录必须写可见的 `option.label`**；省略 `currentValue` 时即使未改动初始项也要包含进标注结果 | 非法配置**同步抛出 Error**；事件与载荷严格分离 `value` 与 `label` |
| `OAI-CTRL-008` | `update()` 原子性与 `dispose()` | 在 `dispose()` 之后调用 `update()` **同步抛错**；当 `update()` 因参数非法抛错时，**必须完整保留上一次生效的 targets、controls、heading 和 mode，绝不破坏已有状态** | **同步抛出 Error** 并回滚本次变更 |
| `OAI-SURF-001` | `registerSurface` 宿主约束 | `element` 必须是当前顶层安全文档中已连接的 HTML 元素，且**不能位于 Shadow DOM 内部**（`element.getRootNode() === document`） | **同步抛出 Error** |
| `OAI-SURF-002` | `hitTest` 250ms 超时与单槽位锁 | 每次移动/点击调用 `hitTest({ clientX, clientY, signal })`，超过 **250ms** 或报错时回退为普通 DOM 选择；**全局同时只允许 1 个未决 `hitTest` Promise，在它 settle 之前拒绝发起新的 `hitTest`（即使已超时或 `signal` 已 abort）** | 超时超过 250ms 未 settle 时，DevTools 弹出醒目黄色死锁告警 |
| `OAI-MODE-001` | 空格键穿透与生命周期事件 | Annotation 模式下拦截页面点击（阻止触发按钮跳转/表单提交），但**按住 `Space` 键期间允许普通页面点击穿透执行，同时 `isActive()` 保持 `true`**；`isActive()` 必须在派发 `oaiannotationmodechange` 之前更新，且初始化与重复同值 `toggle(true)` 不派发多余事件 | 严格复现状态机顺序 |

---

## 6. 各模块详细设计

### 6.1 `@skyloupe/core`：零依赖校验、回滚与防死锁层

1. **`validators.ts`**：把 5.2 节的所有规则写成纯函数，同时返回结构化诊断列表 `Diagnostic[]`（含 `code`、`message`、`field`、`severity`）。既供 Polyfill 同步抛错使用，也供 `@skyloupe/devtools` 诊断抽屉和 `skyloupe doctor` 复用同一套权威规则，杜绝两套逻辑不一致。
2. **`previewManager.ts`（解决官方 API 最大易用性痛点）**：
   - 官方规范规定 `registration.dispose()` 只注销控件，不会撤销预览过程中往 DOM 上写的 CSS 改动；而且开发者必须自己同时处理 `preview`、`preview-original` 和 `reset` 三种动作。
   - `previewManager` 允许每个控件声明高层绑定（例如 `cssVar: '--card-padding', unit: 'px'` 或 `onApply(value, element)`）：
     - 首次收到 `preview` 时自动快照目标元素的内联基线值；
     - 收到 `preview` 时写入预览值；
     - 收到 `preview-original`（用户按住对比按钮）时临时恢复基线值；
     - 收到 `reset` 或组件卸载（`dispose`）时彻底恢复原始内联状态，清除残留属性。
3. **`surfaceGuard.ts`（解决 Canvas 死锁陷阱）**：
   - 提供 `createSafeHitTest(canvasRef, userHitTest)`：
     - 自动读取 `canvas.getBoundingClientRect()` 与 `canvas.width / canvas.height` 计算缩放比，把 `clientX / clientY` 换算成画布内部逻辑坐标 `canvasX / canvasY` 传给用户，同时提供 `toViewportRect(canvasRect)` 辅助函数生成符合官方要求的视口相对 `rect`。
     - 用 `Promise.race` 监听 `signal` 的 `abort` 事件：一旦浏览器触发取消，包装层立即 resolve `null`，**从根源上保证返回的 Promise 100% 准时 settle**，彻底杜绝宿主浏览器 `hitTest` 单槽位永久锁死。

### 6.2 `@skyloupe/react`：声明式 React 绑定

1. **`<AnnotationContainer textSelection={boolean} as={tag}>`**：输出 `oai-annotation-container` 或 `oai-annotation-container-text`。
2. **`<Annotatable name={string} metadata={Record} as={tag} ref={...}>`**：
   - 开发环境下调用 `validateMetadata(metadata)`，一旦发现超过 6 个字段或含嵌套对象，立刻在控制台打印带源码位置的精准提醒，避免在 ChatGPT 浏览器里被静默吞掉却毫不知情。
   - 合法时序列化写入 `oai-annotatable` 和 `oai-annotation-metadata` 属性。
3. **`useAnnotationControls(targetRefOrRefs, config)`**：
   - SSR 安全：在服务端渲染阶段（`typeof document === 'undefined'`）完全空操作。
   - 监听 `document.oai?.annotation`（以及 `@skyloupe/devtools` Polyfill 挂载完成派发的自定义就绪事件 `skyloupe:polyfill-ready`，确保不论组件与 DevTools 谁先挂载都能成功注册）。
   - 使用 `useLayoutEffect` 跟踪 `targetRef.current`：如果条件渲染导致底层真实 DOM 元素发生了替换，自动调用 `registration.update({ targets: [newEl] })`；当 `currentValue` 随业务状态改变时，自动调用 `registration.update({ controls })` 刷新基线。
   - 卸载时按顺序执行预览回滚、移除 `oaiannotationcontrolchange` 监听、调用 `registration.dispose()`。
4. **`<AnnotatableCanvas>`**：
   - 渲染 `<canvas>` 并注册 `registerSurface`。
   - 支持声明 `virtualObjects` 数组（适用于柱状图、散点图、流程图节点等常见矩形/多边形场景，免手写 `hitTest` 几何运算）或自定义 `hitTest` 函数。
   - 支持按当前选中虚拟对象动态切换控件，并根据 `event.detail.virtualTarget.targetId` 自动把 `oaiannotationcontrolchange` 事件路由到当初被捕获的那个图形对象上（即使此后用户已经点选了别的柱子，仍严格按官方规范更新原捕获对象）。

### 6.3 `@skyloupe/vite`：开发期源码行列号注入插件

AI 编码 Agent 改前端最快的方式不是靠 CSS 选择器猜文件，而是**直接拿到源码文件路径和行号**。

- 在 `command === 'serve'`（开发模式）下，对项目内 `.tsx` / `.jsx` 文件中的原生标签和 `<Annotatable>` 注入 `data-skyloupe-source="src/components/PricingCard.tsx:31:4"`。
- 在 `command === 'build'`（生产构建）下完全跳过，确保生产 HTML 干净无冗余。
- 同时通过虚拟模块或全局变量注入 `.skyloupe/session.json` 里的本地桥接端口和一次性配对令牌（Pairing Token），让页面上的 `<SkyLoupeDevTools />` 无需用户手动复制粘贴密钥就能安全连上本地 `skyloupe bridge`。

### 6.4 `@skyloupe/devtools`：全浏览器模拟器与规范体检台

1. **挂载策略（绝不污染宿主与原生环境）**：
   - 检查 `window.document.oai?.annotation` 是否已由 ChatGPT / Codex 桌面浏览器原生提供：
     - 若**已存在原生实现**：绝不篡改原生方法，默认进入 `native-companion` 轻量模式（仅可通过快捷键 `Alt+Shift+D` 展开规范体检抽屉）。
     - 若**不存在原生实现**（Chrome、Edge、Safari、Firefox）：挂载完整 `document.oai.annotation` Polyfill，随后派发 `CustomEvent('skyloupe:polyfill-ready')`。
2. **Shadow DOM 悬浮交互界面**：
   - 宿主节点 `<skyloupe-devtools-host>` 挂载在 `document.body` 末尾，`attachShadow({ mode: 'open' })`，`z-index: 2147483646`。
   - 右下角胶囊工具条：
     - **Annotate 开关按钮**（快捷键 `Alt+Shift+A`）：调用 `document.oai.annotation.toggle()`。激活期间顶部或胶囊显示清晰提示 `"Annotation Mode · Hold Space to interact with page"`。
     - **规范体检徽章（Diagnostics Badge）**：实时扫描 DOM 中的 `oai-*` 属性与活跃注册表。绿灯显示 `Spec OK`，发现违规时显示红点数字（例如 `2 Spec Issues`），点击展开每条违规的元素定位、错误码（如 `OAI-META-001`）和修复建议。
     - **Bridge 连接状态灯**：显示 `Codex Connected`（绿色，可直推修改）或 `Clipboard Mode`（灰色，点击复制提示词）。
   - 元素悬停与编辑面板：
     - 严格遵循第 5.2 节拾取规则：先测 `registerSurface` 的 `hitTest`（带 250ms 计时器与单槽位锁检测），未命中再查最近一层 `oai-annotation-container` / `oai-annotation-container-text`，否则回退到普通可见 DOM 元素。
     - 选中目标后弹出紧凑编辑器：顶部显示 `controlsHeading`（无则显示对象名或 HTML 标签名）与源码位置（如 `PricingCard.tsx:31`）；中部渲染注册的 `color`、`range`、`select`、`toggle` 控件（若该元素未注册自定义控件或采用 `controlsMode: "extend"`，则额外提供内置的常用字号、文字颜色、背景色、内外边距调节器，与 ChatGPT 桌面内置浏览器的 **Adjust** 面板体验一致）。
     - 每次拖动控件立即在目标元素上派发 `oaiannotationcontrolchange`（`action: 'preview'`）；面板提供 **Hold to Compare** 按钮，按下派发 `action: 'preview-original'`，松开恢复 `action: 'preview'`；取消或关闭编辑器派发 `action: 'reset'`。
3. **局部截图采集（`screenshot.ts`）**：
   - 若 `omitScreenshot === true`，严格不采集截图。
   - 若目标是 `<canvas>` 或 Surface 虚拟对象，直接通过 `canvas.toDataURL('image/png')` 裁剪或叠加上高亮框导出高清 PNG（零权限弹窗、毫秒级完成）。
   - 若目标是普通 DOM 元素，优先用轻量的计算样式克隆 + SVG `foreignObject` 渲染局部区域快照；遇到跨域图片污染时优雅降级为捕获几何边框示意图或提示用户可选开启一次 `getDisplayMedia` 标签页截图，绝不因为截图失败阻塞标注递交。

### 6.5 `skyloupe` CLI 与本地 `codex app-server` 安全桥接

#### 6.5.1 本地安全模型（极其重要，防止网页远程代码执行）

任何监听 `127.0.0.1` 并能驱动本地编码 Agent 改文件的服务，如果不做认证和来源校验，用户浏览任意恶意公网网页时都可能被跨站请求触发本机改码。`httpServer.ts` **必须同时实施三层防护**：

1. **仅绑定回环地址**：HTTP 服务硬编码绑定 `127.0.0.1`（绝不绑定 `0.0.0.0`），并校验 `Host` 请求头只能是 `127.0.0.1:<port>`（防御 DNS Rebinding 攻击）。
2. **严格的 `Origin` 白名单**：只接受 `http://localhost:<port>` 和 `http://127.0.0.1:<port>`（支持 `--allow-origin` 显式追加自定义本地开发域名），其他 `Origin` 或缺失 `Origin` 的浏览器 POST 请求一律返回 `403 Forbidden`。
3. **一次性会话配对令牌（Pairing Token）**：`skyloupe bridge` 启动时生成 32 字节随机高熵令牌，以 `0600` 权限写入 `<repo>/.skyloupe/session.json`（`init` 命令确保 `.skyloupe/` 加入 `.gitignore`）。`@skyloupe/vite` 自动在本地开发页面注入该令牌；未使用 Vite 插件时，终端打印一行短配对码，用户在浏览器浮窗输入一次即可存入当前 `sessionStorage`。所有写请求必须携带 `X-SkyLoupe-Token` 请求头并通过常量时间比对。

#### 6.5.2 对接 `codex app-server` 精确协议流程（`codexAppServer.ts`）

严格遵循 [Codex App Server 官方文档](https://developers.openai.com/codex/app-server)：

1. **连接方式**：
   - 默认通过 `child_process.spawn('codex', ['app-server'], { stdio: ['pipe', 'pipe', 'inherit'] })` 启动基于 stdio JSONL 的子进程。
   - 支持 `--codex-ws ws://127.0.0.1:4500` 连接用户已启动的外部 `codex app-server`。
   - **线上消息格式注意**：JSON-RPC 消息**不包含** `"jsonrpc": "2.0"` 头，直接发送 `{ "method": "...", "id": 1, "params": {...} }`。
2. **初始化握手**（每个连接仅执行一次）：
   ```json
   {
     "method": "initialize",
     "id": 0,
     "params": {
       "clientInfo": {
         "name": "skyloupe",
         "title": "SkyLoupe Browser Annotation Bridge",
         "version": "0.1.0"
       }
     }
   }
   ```
   收到 `id: 0` 的 `result` 后，立即发送通知 `{ "method": "initialized", "params": {} }`。
3. **会话（Thread）管理**：
   - 首次递交标注时调用 `thread/start`：
     ```json
     {
       "method": "thread/start",
       "id": 1,
       "params": {
         "cwd": "<repoRoot>",
         "approvalPolicy": "never",
         "sandbox": "workspace-write",
         "serviceName": "skyloupe"
       }
     }
     ```
     **不要硬编码模型名**（省略 `model` 字段以继承用户当前 Codex 配置的默认模型，例如 `gpt-6.1-sol` 或用户自选模型；支持通过 `--model` 覆盖）。
   - 同一开发周期内的后续标注默认复用同一个 `thread.id`（可通过浮窗按钮切换“New Thread”）。
4. **发起修改轮次（`turn/start`）与截图挂载**：
   - 若标注包含 PNG base64 截图，先将其落盘到系统临时目录（例如 `<os.tmpdir()>/skyloupe/ann_<uuid>.png`，权限 `0600`）。
   - 发送 `turn/start`，图片必须使用 `app-server` v2 的 `localImage` 变体（注意是驼峰 `localImage`，不是 `local_image`）：
     ```json
     {
       "method": "turn/start",
       "id": 2,
       "params": {
         "threadId": "thr_123",
         "cwd": "<repoRoot>",
         "sandboxPolicy": {
           "type": "workspaceWrite",
           "writableRoots": ["<repoRoot>"],
           "networkAccess": false
         },
         "input": [
           { "type": "text", "text": "<由 promptFormatter 生成的结构化改码指令>" },
           { "type": "localImage", "path": "/tmp/skyloupe/ann_1.png" }
         ]
       }
     }
     ```
   - 如果当前 `threadId` 上一轮仍在运行中（`inProgress`），可选择排队或调用 `turn/steer` 追加上下文。
5. **流式进度回传与自动预览清理**：
   - 监听 stdout 的通知事件：`item/agentMessage/delta`（实时文字说明）、`item/started` / `item/completed`（当 `item.type === "fileChange"` 时提取修改的文件路径列表）、`turn/completed`。
   - 通过 SSE 实时推回浏览器浮窗胶囊。当收到 `turn/completed` 且 `status === "completed"` 时，浏览器浮窗自动触发该标注的 `reset`（清除临时内联预览覆盖），让 Vite / Next.js HMR 热更新过来的真实源码样式直接呈现在页面上！

#### 6.5.3 `skyloupe mcp`（兼容 Claude Code / Cursor / 终端 Codex CLI）

对于不开启 `codex app-server` 自动改码、更喜欢自己在终端控制节奏的用户：
- 浏览器浮窗把标注提交到本地 `.skyloupe/queue.json`。
- `npx skyloupe mcp` 作为标准 stdio MCP Server 暴露 3 个工具：
  - `list_pending_annotations()`：列出当前待处理的页面标注摘要。
  - `get_annotation(id)`：返回完整的结构化标注信息与截图路径。
  - `resolve_annotation(id, summary)`：标记该标注已修复，通知浏览器浮窗移除图钉并清理预览态。

---

## 7. 发给 Agent 的结构化标注载荷（Annotation Bundle）

### 7.1 JSON 数据结构

```ts
export interface ControlChangeRecord {
  label: string;                       // 例如 "Card padding (pixels)"
  controlType: 'color' | 'range' | 'select' | 'toggle';
  callback: string;
  reference?: string;                  // 例如 "--card-padding"
  previousValue?: string | number | boolean; // select 类型记录可见的 option.label！
  requestedValue: string | number | boolean; // select 类型记录可见的 option.label！
  unchangedExplicitChoice?: boolean;   // 当控件省略 currentValue 时为 true
}

export interface AnnotationBundle {
  id: string;
  createdAt: string;
  pageUrl: string;
  viewport: { width: number; height: number; devicePixelRatio: number };
  target:
    | {
        kind: 'element';
        annotatableName?: string;      // 来自 oai-annotatable
        tagName: string;
        selector: string;
        sourceLocation?: string;       // 例如 "src/components/PricingCard.tsx:31:4"
        boundingBox: SurfaceRect;
        textExcerpt?: string;
      }
    | {
        kind: 'text-range';
        selectedText: string;
        surroundingContext: string;
        containerSourceLocation?: string;
      }
    | {
        kind: 'canvas-object';
        canvasSelector: string;
        canvasSourceLocation?: string;
        objectId: string;
        objectName?: string;
        objectRole?: string;
        boundingBox?: SurfaceRect;
      };
  metadata?: AnnotationMetadata;
  controlChanges: ControlChangeRecord[];
  comment?: string;
  screenshotPath?: string;             // 本地落盘路径（omitScreenshot 为 true 时为空）
}
```

### 7.2 生成给 Codex 的提示词模板（`promptFormatter.ts`）

```markdown
Apply the following UI annotation captured from the live page (`http://localhost:5173/pricing`, viewport 1440×900):

### Target
- **Object**: `Pricing Card (Pro)` (`<article.pricing-card>`)
- **Source location**: `src/components/PricingCard.tsx:31:4`
- **Metadata**: `{"planId":"Pro","monthlyPrice":29}`

### Requested Control & Token Changes
| Control | Token / Reference | Previous | Requested |
|---|---|---|---|
| Card padding (pixels) | `--card-padding` | `20` | `28` |
| Accent color | `--card-accent` | `#2563eb` | `#0f766e` |

### User Comment
> Give the Pro card more breathing room and use our teal brand token.

### Instructions
1. Update the underlying source code / CSS tokens referenced above so the rendered UI matches the requested values permanently (do not leave temporary inline debug styles).
2. Keep the change scoped to the annotated component or design token.
3. Verify that TypeScript compiles cleanly.
```

---

## 8. 安全、隐私与性能约束

1. **回环服务防跨站与防重绑定**：严格执行 6.5.1 节的三重校验（`127.0.0.1` 绑定、`Host` 校验、`Origin` 白名单、`X-SkyLoupe-Token` 常量时间比对）。单元测试中必须包含模拟外部恶意站点 `Origin: https://evil.example` 发包的拦截用例。
2. **敏感表单自动脱敏**：采集 `textExcerpt`、DOM 快照与截图时，自动遮盖 `input[type="password"]`、含 `autocomplete="cc-*"` 的支付字段，以及任何带有 `data-skyloupe-ignore` / `data-1p-ignore` 属性的元素；严格遵守官方 `omitScreenshot: true` 参数。
3. **沙箱边界**：`skyloupe bridge` 调用 `codex app-server` 时固定使用 `sandboxPolicy: { type: "workspaceWrite", writableRoots: [repoRoot], networkAccess: false }`，绝不开启 `dangerFullAccess`。
4. **生产零污染**：通过 `scripts/check-size.mjs` 在 CI 中检查 `@skyloupe/core` 和 `@skyloupe/react` 的打包产物，gzip 体积严格小于 4096 字节，且不包含任何 `window` / `document` 顶层立即执行副作用（确保 Next.js App Router SSR 零报错）。

---

## 9. 测试策略

1. **18 项官方规范一致性测试（`packages/core/test/validators.test.ts` & `packages/devtools/test/polyfillSpec.test.ts`）**：
   - 第 5.2 节表格中的**每一条规则**都必须有独立的通过用例和失败边界用例（包括：第 7 个 metadata 键、嵌套数组、带两个连续空格的 metadata 键、第 65 个 `registerControls`、第 1025 个目标元素、含 `\u202E` Bidi 反转字符的 `label`、含空格的 `reference`、`Range` 传 `mode: "advanced"`、`dispose()` 后调 `update()`、`update()` 失败时的旧状态原子保留、`select` 控件省略 `currentValue` 时的输出行为、按住 `Space` 键时的点击穿透）。
2. **Canvas 单槽位与 250ms 超时防死锁测试（`surfaceGuard.test.ts`）**：
   - 使用 `vi.useFakeTimers()` 模拟一个故意在 `signal.abort` 后永远不 resolve 的坏 `hitTest`：验证裸 Polyfill 会在 250ms 后回退 DOM 并在诊断抽屉记录死锁告警；同时验证经过 `@skyloupe/react` `<AnnotatableCanvas>` 包装后，abort 瞬间自动 resolve `null`，后续拾取永远畅通。
3. **React 生命周期与 SSR 测试（`reactBindings.test.tsx`）**：
   - 在无 `document` 环境下运行 `renderToString` 验证 SSR 安全。
   - 测试预览过程中卸载组件，验证内联 CSS 变量被完整恢复到基线值且 64 槽位计数减 1。
   - 测试组件重渲染切换底层 DOM 元素引用时，`registration.update({ targets })` 被自动触发。
4. **Codex App Server 桥接与安全测试（`packages/cli/test/`）**：
   - 用一个模拟子进程回放真实的 `codex app-server` JSONL 流，验证线上消息不含 `"jsonrpc": "2.0"`、`initialize` -> `initialized` -> `thread/start` -> `turn/start`（含 `localImage` 路径）完整跑通。
   - 验证伪造 `Origin`、伪造 `Host`、缺少或错误的 `X-SkyLoupe-Token` 均返回 `403`。
5. **离线演示测试**：`npx skyloupe demo --offline` 在未安装 Codex CLI、无外网的 CI 环境中能正常启动演示服务并跑通录制好的模拟改码热更新闭环。

---

## 10. 里程碑和验收标准

| 里程碑 | 内容 | 验收标准 | 预计工期 |
|---|---|---|---|
| **M0 仓库骨架与门禁** | 初始化 `pnpm` workspace、5 个子包目录、TypeScript 配置、`tsup` 构建、`vitest` 测试框架、体积检查脚本与 GitHub Actions CI | `pnpm build`、`pnpm test`、`pnpm check:size` 全部通过 | 0.5 天 |
| **M1 `@skyloupe/core` 核心规范层** | 完整类型定义、18 项规范校验器、`previewManager` 样式基线与回滚、`surfaceGuard` Canvas 坐标换算与防死锁包装 | 第 9.1、9.2 节单测 100% 通过，`core` 产物 gzip < 2 KB | 2.5 天 |
| **M2 `@skyloupe/react` 与 `@skyloupe/vite`** | `<AnnotationContainer>`、`<Annotatable>`、`useAnnotationControls`、`<AnnotatableCanvas>`、`useAnnotationMode` 及 Vite 源码行列号插件 | SSR 测试、重渲染目标追踪、卸载回滚、JSX 源码位置注入测试全部通过；`core + react` 合计 gzip < 4 KB | 2.5 天 |
| **M3 `@skyloupe/devtools` 全浏览器模拟器** | Polyfill 完整实现、容器与文本选区寻址、Space 键穿透、Shadow DOM 悬浮胶囊、4 类控件滑块面板、按住对比原状、18 项实时诊断抽屉、局部截图与复制载荷 | 在普通 Chrome 中打开测试页，无需后端即可点选元素与 Canvas 柱子、拉滑块实时预览、对比原状、查看违规告警并一键复制结构化 Markdown | 4 天 |
| **M4 `skyloupe` CLI（`bridge` / `mcp` / `doctor`）** | `127.0.0.1` 三重安全防护服务、`codex app-server` 握手与 `turn/start`（含 `localImage`）流式桥接、`skyloupe mcp` 工具、`skyloupe doctor` 静态扫描 | 在本机用真实 `codex app-server` 完成“浏览器拉滑块 -> 点 Send to Codex -> 自动改源码 -> HMR 生效并自动重置预览态”端到端闭环；安全拦截测试全部通过；**完成 M4 即可发布 v0.1** | 4 天 |
| **M5 内置 `demo`、配套 Skill 与发布打磨** | 打造高颜值 `demo/app`（定价卡片 + Canvas 营收图表 + 故意埋入 2 个规范错误供展示诊断器）、录制离线回放模式、编写 `skills/skyloupe/SKILL.md` 与中英文文档 | `npx skyloupe demo` 一键跑起完整体验；在 ChatGPT 桌面内置浏览器中打开同一地址，原生标注与控件零报错正常工作 | 2.5 天 |

总计约 **2.5 到 3 周**（单人配合 ChatGPT / Codex 实现）。

---

## 11. 内置 Demo 设计与增长发布计划

### 11.1 黄金 15 秒演示动图脚本（README 第一屏决定成败）

内置 `demo/app` 设计为一个单屏深色/浅色双模 SaaS 仪表盘，左半边是两张定价卡片（绑定 `--card-padding`、`--card-radius`、`--card-accent` 和按钮文案语气下拉框），右半边是一张原生 `<canvas>` 绘制的四季度营收柱状图（每根柱子都是独立的虚拟对象，可单独选中并调节配色与圆角）。

**15 秒录制脚本：**
1. **0-4 秒**：在普通 Chrome 中点右下角 `Annotate`，鼠标扫过卡片和 `<canvas>` 柱状图，画布里的单根 `Q3 Revenue` 柱子精准高亮出独立边框与数据角标。
2. **4-9 秒**：点击 `Pro` 定价卡片，弹出滑块面板，把圆角从 `8px` 拉到 `20px`、主色改成翡翠绿，按住 `Compare` 闪烁对比改前改后，输入一句 `"Make Pro stand out"`，点 **Send to Codex**。
3. **9-15 秒**：右下角胶囊实时跳动 `Codex editing PricingCard.tsx... Done (5.2s)`，代码编辑器分屏里对应的 CSS 变量自动更新，页面热重载无缝接管！最后切一秒镜头展示同一个 `localhost:5173` 在 ChatGPT 桌面端内置浏览器里零改动直接唤醒官方原生控件。

### 11.2 发布与引起 OpenAI 关注的动作

1. **技术对比表放进 README**：客观列出与 `agentation` 的对比（MIT 开源协议 vs PolyForm 限制协议、100% 兼容 OpenAI `document.oai.annotation` 标准、支持 `registerControls` 实时设计参数滑块、支持 `registerSurface` Canvas 子图形拾取、直连 `codex app-server`）。
2. **给知名开源项目提轻量示范 PR 或写实战复盘**：参考 [Remotion PR #11944](https://github.com/remotion-dev/remotion/pull/11944) 和 [WordPress Playground PR #4412](https://github.com/WordPress/wordpress-playground/pull/4412) 的手写实现，写一篇短文《We audited OpenAI's new `document.oai.annotation` spec and built the missing React & Chrome DevTools kit》，展示手写 150 行易踩坑 DOM 代码如何缩减成 15 行声明式组件。
3. **分发渠道**：
   - Hacker News（`Show HN: SkyLoupe – React kit, Chrome simulator, and Codex bridge for OpenAI Browser Annotations`）。
   - X（Twitter）发布 15 秒实录视频，直接 @OpenAIDevs、Codex 客户端团队及负责前端/Apps SDK 的开发者关系成员。
   - 将 `skills/skyloupe/SKILL.md` 发布到 Skills 生态，让用户在 Codex 里说一句“给这个页面加上浏览器标注支持”就能自动引入 `@skyloupe/react`。

---

## 12. 风险与应对

| 风险 | 应对措施 |
|---|---|
| OpenAI 后续微调 `document.oai.annotation` 规范配额或字段 | 所有配额与正则集中收敛在 `packages/core/src/constants.ts`；在原生环境下采用透传模式不拦截未知新字段，保证向前兼容 |
| 用户本机 Codex CLI 版本差异导致 `codex app-server` 个别字段变动 | M4 实现时通过 `codex app-server generate-json-schema` 对齐真实 schema；只依赖稳定核心方法（`initialize`、`thread/start`、`turn/start`），不开启 `experimentalApi`；若连接失败自动优雅降级为复制结构化 Markdown 与 `skyloupe mcp` 模式 |
| 复杂 CSS（如跨域图片、WebGL 画布）导致普通 DOM 截图不完整 | `<canvas>` 优先走原生 `toDataURL`（WebGL 提示开启 `preserveDrawingBuffer` 或在 `renderSelection` 帧内同步导出）；DOM 截图失败绝不阻塞核心的“源码行号 + Token 前后对比表”递交（文字与精确数值对比本身已经足够 Codex 准确改码） |
| 本地 HTTP 桥接端口被恶意网页滥用 | 严格执行 6.5.1 节的 `127.0.0.1` 绑定、`Host` 检查、`Origin` 白名单和 32 字节一次性 Pairing Token 四重门禁 |

---

## 13. 交给 ChatGPT / Codex 的第一条提示词（可直接复制）

```text
你是这个项目的主要实现者。请先完整阅读仓库根目录下的 PLAN.md（SkyLoupe 完整开发方案），然后严格按以下要求执行：

1. 现在先只实现 M0（第 10 节），严格遵循第 4.1 节的技术选型、第 4.2 节的 pnpm workspace 目录结构和第 8 节的体积门禁脚本。
2. M0 完成后，运行构建、lint、类型检查、测试和 `pnpm check:size`，确认全部通过后列出创建的文件清单，并停下来等我确认，不要提前写 M1。
3. 从 M1 开始，第 5.2 节表格里的全部 18 条 OpenAI 官方规范约束必须逐条落入代码和单元测试，区分清楚“同步抛错”、“返回 { accepted: false }”和“静默忽略并记录诊断告警”三种行为，绝不能简化或篡改。
4. 进入 M4 实现 `codex app-server` 桥接前，先提醒我在本机运行 `codex --version` 和 `codex app-server generate-json-schema --out ./tmp-schemas`，根据实测协议核对 `turn/start` 参数，并严格实现第 6.5.1 节的本地回环安全校验。
5. 遇到 PLAN.md 未覆盖的细节决策时，选最简单、最可逆的做法，并在 docs/decisions.md 中记录一行。
```
