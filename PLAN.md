# SkyLoupe 开发计划

> 任务要求把附件 `uploads/PLAN.md`（环境中的路径为 `/workspace/uploads/PLAN_7c35.md`）复制到仓库根目录。实现 M0 时该文件不在文件系统上，`/workspace` 也不存在，因此无法逐字复制原文。本文只保留任务里已经写明的约束，避免编造一份会被后续里程碑误当成原文的计划。未覆盖的选择记在 `docs/decisions.md`，一行一条。

## 已明确的约束

- 项目名 SkyLoupe。命令行名 `skyloupe`。npm scope `@skyloupe/*`。
- 不使用计划里列出的已被占用的名字，其中包括 annotaKit。
- `@skyloupe/core` 与 `@skyloupe/react` 运行时零第三方依赖。`react` 只作为 `@skyloupe/react` 的 peerDependency。
- 技术栈按任务点名的部分：pnpm workspace、TypeScript、tsup、vitest、体积门禁 `pnpm check:size`、GitHub Actions CI。
- 工作区包含 5 个子包。

## M0（对应任务中的第 10 节，只做这一段）

初始化 pnpm workspace、TypeScript、tsup 构建、vitest、体积门禁脚本，以及 GitHub Actions。完成标准：

- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm check:size`

以上命令全部通过。不开始 M1。

## 原文缺失时的目录（本仓库实际采用）

见 `docs/decisions.md`。五个子包是 `@skyloupe/schema`、`@skyloupe/core`、`@skyloupe/dom`、`@skyloupe/react`、`@skyloupe/cli`。
