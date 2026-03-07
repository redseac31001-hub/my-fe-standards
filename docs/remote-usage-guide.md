# 业务系统远程接入指南

> 本文档说明如何在业务项目中通过 `codebuddy-loader.bundle.js` 从远程规则源拉取规则，并生成 `.codebuddy/rules/project-rules.md`。

## 概述

`codebuddy-loader.bundle.js` 当前支持两种使用方式：

1. 远程模式（业务项目接入推荐）：通过 `--remote <URL>` 从静态 HTTP 源读取：
   - `manifest.json`
   - `packs/content-pack-*.json`（优先）
   - 旧版逐文件内容树（回退）
2. 本地模式（规则库开发/调试）：在规则库仓库内运行，读取本地 `rules/` + `config/`。

远程模式的当前策略是：

1. 先拉取 `manifest.json`
2. 按当前 `--profile` 优先下载对应 content pack
3. 解包到业务项目本地缓存
4. 继续按本地文件模式安装
5. 如果 pack 缺失或校验失败，自动回退到逐文件拉取

运行后会在业务项目生成：

```text
.codebuddy/
├── rules/
│   └── project-rules.md    # 主规则文件
└── rules_cache/            # Layer 2/3 按需读取缓存（如果命中依赖/默认清单）
```

## 快速开始

### 一键执行（推荐）

无需在业务项目里落脚本文件，直接远程拉取并执行：

```bash
curl -fsSL https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/feature/codebuddy-glm/scripts/dist/codebuddy-loader.bundle.js | node - --remote https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/feature/codebuddy-glm
```

### 分步执行（适合落地到项目/CI）

```bash
# 1) 下载脚本到业务项目根目录
curl -O https://your-server.com/standards/scripts/dist/codebuddy-loader.bundle.js

# 2) 执行生成（显式指定远程源）
node codebuddy-loader.bundle.js --remote https://your-server.com/standards
```

也可以通过 npm script 固化：

```json
{
  "scripts": {
    "rules:update": "node codebuddy-loader.bundle.js --remote https://your-server.com/standards"
  }
}
```

### 验证接入成功

执行成功后，检查以下文件是否生成：

```text
your-project/
└── .codebuddy/
    └── rules/
        └── project-rules.md
```

## 服务端准备（静态托管）

推荐的静态托管结构如下（路径需与 `--remote` 对应）：

```text
https://your-server.com/standards/
├── manifest.json
└── packs/
    ├── content-pack-core.json
    ├── content-pack-analysis.json
    ├── content-pack-orchestrator.json
    └── content-pack-full.json
```

兼容旧版回退时，仍可同时托管逐文件内容树：

```text
https://your-server.com/standards/
├── rules/
├── custom-skills/
├── agents/
├── scripts/dist/
├── workflows/
├── taskbooks/
├── agent-calls/
└── .claude/commands/
```

在规则仓库中执行：

```bash
npm run build
```

会生成/更新：

- `manifest.json`
- `packs/content-pack-core.json`
- `packs/content-pack-analysis.json`
- `packs/content-pack-orchestrator.json`
- `packs/content-pack-full.json`

`manifest.json` 会包含 pack 元数据（文件名、sha256、大小、entryCount），loader 会据此校验下载结果。

如需跨域（业务项目与规则源不同域），请在静态服务器上配置 CORS。

## 命令行参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `--remote <URL>` | 远程规则库地址（远程模式必需） | `--remote https://example.com/standards` |
| `--profile <name>` | 远程安装档位：`core / analysis / orchestrator / full` | `--profile analysis` |
| `--task <type>` | 按任务类型筛选规则 | `--task refactoring` |
| `--threshold <n>` | 相关性阈值 (0-1) | `--threshold 0.7` |
| `--timeout <ms>` | 请求超时（默认 10000） | `--timeout 30000` |
| `--verbose, -v` | 详细日志 | `-v` |
| `--help, -h` | 显示帮助 | `-h` |

支持的 `--task` 类型：`refactoring` / `debugging` / `testing` / `new-feature` / `code-review`。

默认 `--profile` 为 `analysis`。

兼容说明：

- `--enable-orchestrator` 仍可使用，但等价于 `--profile full`

## 高级用法

### 任务筛选（--task）

```bash
node codebuddy-loader.js --remote https://your-server.com/standards --task refactoring
```

### 指定远程 profile（--profile）

```bash
# 最小 validator/runtime
node codebuddy-loader.js --remote https://your-server.com/standards --profile core

# 默认分析型安装
node codebuddy-loader.js --remote https://your-server.com/standards --profile analysis

# 编排运行时
node codebuddy-loader.js --remote https://your-server.com/standards --profile orchestrator
```

### 相关性阈值（--threshold）

```bash
# 更严格
node codebuddy-loader.js --remote https://your-server.com/standards --task refactoring --threshold 0.7

# 更宽松
node codebuddy-loader.js --remote https://your-server.com/standards --task debugging --threshold 0.3
```

## 故障排查

### HTTP 404 / manifest.json 不存在

原因通常是：
- `--remote` 指向的基地址不对
- 服务端未部署 `manifest.json`
- `npm run build` 未执行或产物未同步

### content pack 校验失败 / 自动回退

如果日志里出现类似：

- `远程内容包不可用，回退逐文件拉取`

说明 loader 已检测到 pack 缺失或 `sha256` 校验失败。此时会自动尝试旧版逐文件远程安装。

排查重点：

- `manifest.json` 中的 `packs.*.sha256` 是否与实际文件一致
- `packs/` 目录是否已同步
- 远程源是否仍同时保留旧版逐文件内容树，供回退使用

### 网络超时

```bash
node codebuddy-loader.js --remote https://example.com/standards --timeout 30000
```

### 代理环境

```bash
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080
node codebuddy-loader.js --remote https://example.com/standards
```

## 最佳实践

1. CI/CD 定时更新：建议在流水线中定期执行 `rules:update`，同步 `manifest.json` 和 `packs/`。
2. 版本锁定：如需稳定性，使用固定分支或 tag 的静态部署地址。
3. 回退窗口：如果你在迁移远程源，建议短期内同时保留 `packs/` 和旧版逐文件树，确保 loader 能自动回退。
4. git 忽略：加载器会尝试将 `.codebuddy/` 追加到业务项目的 `.gitignore`，避免提交生成文件；如你希望提交生成文件，可在项目侧移除该忽略项，或使用 `git add -f .codebuddy/` 强制添加。
