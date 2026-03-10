# 远程接入指南

本文档说明如何在业务项目中通过 `codebuddy-loader.bundle.js` 从远程产物源安装 `.codebuddy/` 运行时。

如果你需要从规范仓打包、上传到内网服务器，再到业务项目安装的完整流程，请同时阅读 [私有化发布与业务安装指南](./private-deployment-guide.md)。

## 概览

`codebuddy-loader.bundle.js` 支持两种模式：

1. 远程模式，推荐给业务项目。
   通过 `--remote <URL>` 读取：
   - `manifest.json`
   - `packs/content-pack-*.json`
   - 旧版逐文件内容树（仅在允许回退时使用）
2. 本地模式，推荐给规范仓开发和调试。
   直接读取仓库内的 `rules/`、`agents/`、`custom-skills/`、`scripts/` 等源文件。

远程模式当前的安装顺序是：

1. 拉取 `manifest.json`
2. 按 `--profile` 优先下载对应 content pack
3. 解包到业务项目本地缓存
4. 按本地文件模式继续分发安装
5. 如果 pack 不可用且未启用 `--pack-only`，则回退到逐文件拉取

安装成功后，业务项目会生成：

```text
.codebuddy/
├─ rules/
│  └─ project-rules.md
├─ scripts/
├─ agents/
├─ custom-skills/
├─ cache/
└─ install.json
```

## 推荐产物结构

如果你准备把 `my-fe-standards` 源码仓私有化，只对业务项目开放构建产物，推荐最小暴露以下目录：

```text
https://your-server.com/standards/
├─ manifest.json
├─ scripts/
│  └─ dist/
│     ├─ codebuddy-install.js
│     └─ codebuddy-loader.bundle.js
└─ packs/
   ├─ content-pack-core.json
   ├─ content-pack-analysis.json
   ├─ content-pack-orchestrator.json
   └─ content-pack-full.json
```

如果还需要兼容旧版逐文件回退，再额外保留：

```text
rules/
custom-skills/
agents/
scripts/dist/
workflows/
taskbooks/
agent-calls/
.claude/commands/
```

## 快速开始

### 推荐：使用跨平台安装脚本

`codebuddy-install.js` 适合直接给业务项目使用。它会自动下载 `codebuddy-loader.bundle.js`，然后执行安装。

默认会补齐这组推荐参数：

```text
--profile analysis --rule-level quick --pack-only
```

macOS / Linux：

```bash
curl -fsSL https://your-server.com/standards/scripts/dist/codebuddy-install.js | node - --remote https://your-server.com/standards
```

Windows PowerShell：

```powershell
irm https://your-server.com/standards/scripts/dist/codebuddy-install.js | node - --remote https://your-server.com/standards
```

如果你想先下载再执行：

```bash
curl -O https://your-server.com/standards/scripts/dist/codebuddy-install.js
node codebuddy-install.js --remote https://your-server.com/standards
```

### 直接远程执行

```bash
curl -fsSL https://your-server.com/standards/scripts/dist/codebuddy-loader.bundle.js | node - --remote https://your-server.com/standards
```

### 先下载再执行

```bash
curl -O https://your-server.com/standards/scripts/dist/codebuddy-loader.bundle.js
node codebuddy-loader.bundle.js --remote https://your-server.com/standards
```

### 固化到 npm script

```json
{
  "scripts": {
    "codebuddy:install": "node codebuddy-install.js --remote https://your-server.com/standards",
    "codebuddy:update": "node codebuddy-loader.bundle.js --remote https://your-server.com/standards"
  }
}
```

## 私有产物源

如果内网服务器需要 Bearer Token，可以使用下面两种方式之一：

```bash
node codebuddy-loader.bundle.js \
  --remote https://intra.example.com/standards \
  --remote-bearer-token YOUR_TOKEN
```

```bash
CODEBUDDY_REMOTE_BEARER_TOKEN=YOUR_TOKEN \
node codebuddy-loader.bundle.js --remote https://intra.example.com/standards
```

说明：

- `--remote-bearer-token` 优先级高于环境变量。
- Token 会附带到远程 `manifest.json`、content pack 和回退文件请求。
- Authorization 只会发送到 `--remote` 同源地址；如果服务端把受保护资源重定向到其他域名，Token 不会跨域透传。
- 当前实现是标准 HTTP Bearer 认证，不包含私有 Git 仓 API 的专用认证流程。

## Pack-Only 模式

如果你希望业务项目只能消费 `manifest.json + packs/*`，而不允许回退到 `rules/`、`agents/` 等逐文件目录，使用：

```bash
node codebuddy-loader.bundle.js \
  --remote https://intra.example.com/standards \
  --pack-only
```

或：

```bash
node codebuddy-loader.bundle.js \
  --remote https://intra.example.com/standards \
  --strict-pack-only
```

启用后：

- 远程源必须提供当前 `--profile` 对应的 content pack
- pack 下载、校验或解包失败时，安装直接失败
- 不再回退到逐文件拉取
- `install.json` 会记录 `strictRemotePack: true`

这适合公司内网只开放构建产物、不开放源码目录树的场景。

## 常用参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `--remote <URL>` | 远程规则源地址 | `--remote https://example.com/standards` |
| `--remote-bearer-token <token>` | 为远程请求附带 Bearer Token | `--remote-bearer-token abc123` |
| `--pack-only` | 仅允许 `manifest + packs` 分发 | `--pack-only` |
| `--profile <name>` | 安装档位：`core / analysis / orchestrator / full` | `--profile analysis` |
| `--task <type>` | 按任务类型筛选规则 | `--task refactoring` |
| `--threshold <n>` | 相关性阈值，范围 `0-1` | `--threshold 0.7` |
| `--rule-level <lvl>` | Layer 1 主入口裁剪等级：`summary / quick / full` | `--rule-level quick` |
| `--timeout <ms>` | 请求超时，默认 `10000` | `--timeout 30000` |
| `--verbose, -v` | 输出详细日志 | `-v` |

默认 `--profile` 为 `analysis`。

## 故障排查

### `manifest.json` 404

通常是以下原因：

- `--remote` 指向的基地址不正确
- 服务端尚未部署 `manifest.json`
- `npm run build` 后的产物没有同步到远程源

### content pack 校验失败

如果日志提示 sha256 不匹配，优先检查：

- `manifest.json` 中的 `packs.*.sha256`
- `packs/` 目录是否与 manifest 同步发布
- CDN 或对象存储是否存在旧缓存

### `--pack-only` 下直接失败

这是预期行为，说明：

- 远程源没有当前 profile 对应 pack
- pack 文件损坏
- pack 中缺失必需资源

这时不会再回退逐文件拉取。

### 请求超时

```bash
node codebuddy-loader.bundle.js --remote https://example.com/standards --timeout 30000
```

## 发布建议

1. 在规范仓 CI 中执行 `npm run build`
2. 只发布 `manifest.json`、`packs/*` 和 `scripts/dist/codebuddy-loader.bundle.js`
3. 如果业务侧全部切到 `--pack-only`，就不再对外开放逐文件目录
4. 通过固定 tag、固定静态目录或版本化路径控制回滚窗口
