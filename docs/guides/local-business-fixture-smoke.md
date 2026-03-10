---
title: 本地业务夹具远程 Smoke
date: 2026-03-09
---

# 本地业务夹具远程 Smoke

目的：在真正碰业务仓库之前，先用仓库内维护的“业务项目影子夹具”在 `temp/` 跑一遍远程加载和最小闭环，尽量把结构差异、资源缺失、入口变化这类问题提前暴露。

## 1. 两层目录

- **事实源**：`test/fixtures/business-projects/`
- **运行态**：`temp/business-fixtures/`

不要直接修改 `temp/`。真正要维护的是 source fixture；运行时目录每次由脚本重新 stage。

## 2. 默认命令

```bash
npm run smoke:business-remote
```

它会做这些事：

1. 先执行 `npm run build`
2. 把默认 fixture 复制到 `temp/business-fixtures/<fixture>/`
3. 在本地起一个临时静态远程源，模拟真实 remote 仓库
4. 通过下载的 `codebuddy-loader.bundle.js` 执行远程加载
5. 校验 `.codebuddy/` 关键产物
6. 跑一次最小 `task-orchestrator` blocked -> 写回 -> completed smoke

运行完成后，`temp/business-fixtures/<fixture>/.fixture-run.json` 会记录本次 remote 地址、loader 地址、目标目录和 smoke 摘要。

如果你故意固定某个 `temp` 运行态目录，而当前环境又不允许脚本清理旧目录，直接换一个新的 `--target temp/business-fixtures/<new-name>` 即可；source fixture 不需要改。

## 3. 常用变体

只重跑脚本，不重新 build：

```bash
npm run smoke:business-remote:run
```

指定夹具：

```bash
npm run smoke:business-remote -- --fixture vue3-remote-smoke
```

换成真实 remote 仓库地址：

```bash
npm run smoke:business-remote -- --remote https://raw.githubusercontent.com/<org>/<repo>/<branch>
```

指定固定运行态目录：

```bash
npm run smoke:business-remote -- --target temp/business-fixtures/my-shadow-project
```

## 4. 什么时候改 source fixture

当真实业务项目的这些“关键信息结构”发生变化时，同步到 source fixture：

- `package.json` 的依赖、scripts、包管理器习惯
- `src/` 的关键目录层级
- `vite.config.ts`、`tsconfig.json`、workspace 标记文件
- 会影响 loader 检测和 workflow gate 的最小文件集合

只把“会影响加载和闭环行为”的最小结构带进来，不要复制整个真实业务仓库。
