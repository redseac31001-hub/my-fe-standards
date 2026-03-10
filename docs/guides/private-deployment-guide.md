# 私有化发布与业务安装指南

本文档面向 `my-fe-standards` 的维护者和业务项目接入方，覆盖以下完整流程：

1. 在规范仓打包产物
2. 上传到公司内网静态源
3. 在业务项目安装和更新
4. 回滚与排障

## 当前是否可直接使用

可以。

当前工程已经支持以下实际场景：

- 源码仓保持私有
- 只对业务项目开放构建产物
- 远程源使用 `manifest.json + packs/*` 分发
- 远程请求携带 Bearer Token
- 使用 `--pack-only` 禁止逐文件回退

推荐的生产用法是：

```bash
node codebuddy-loader.bundle.js \
  --remote https://intra.example.com/my-fe-standards \
  --profile analysis \
  --rule-level quick \
  --pack-only \
  --remote-bearer-token YOUR_TOKEN
```

## 推荐发布形态

推荐把 `my-fe-standards` 分成两层：

1. 私有源码仓
   只给规范维护者使用。
2. 内网产物源
   只给业务项目安装使用。

业务项目最小只需要看到以下产物：

```text
manifest.json
scripts/dist/codebuddy-install.js
scripts/dist/codebuddy-loader.bundle.js
packs/content-pack-core.json
packs/content-pack-analysis.json
packs/content-pack-orchestrator.json
packs/content-pack-full.json
```

如果业务侧统一使用 `--pack-only`，就不需要再公开：

```text
rules/
custom-skills/
agents/
scripts/src/
workflows/
taskbooks/
agent-calls/
.claude/commands/
```

## 一、规范仓打包

### 1. 安装依赖

```bash
npm install
```

### 2. 构建产物

```bash
npm run build
```

这一步会生成或刷新：

```text
manifest.json
scripts/dist/codebuddy-install.js
scripts/dist/codebuddy-loader.bundle.js
packs/content-pack-core.json
packs/content-pack-analysis.json
packs/content-pack-orchestrator.json
packs/content-pack-full.json
```

如果你希望直接生成“可手动上传”的最终产品目录，执行：

```bash
npm run build:release
```

默认会生成：

```text
release/standards/
├─ manifest.json
├─ release-manifest.json
├─ scripts/dist/codebuddy-install.js
├─ scripts/dist/codebuddy-loader.bundle.js
└─ packs/
   ├─ content-pack-core.json
   ├─ content-pack-analysis.json
   ├─ content-pack-orchestrator.json
   └─ content-pack-full.json
```

如果你想输出到其他目录：

```bash
node scripts/dist/build-release.js --out E:/upload/my-fe-standards
```

### 3. 本地验收

建议至少执行：

```bash
node test/run-tests.js
```

如果你只想先做一次最小确认，至少检查：

```bash
node scripts/dist/codebuddy-loader.js --help
node scripts/dist/codebuddy-loader.js doctor --json
```

### 4. 建议固化发布目录

为了让上传动作简单，建议在 CI 或本地发布时只收集这些文件到一个单独目录，例如：

```text
release/standards/
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

## 二、上传到内网产物源

你可以放在以下任一位置：

- 公司内网 Nginx / Apache 静态站点
- 内网虚拟机目录
- 内网对象存储 / CDN
- 公司代码仓的 release artifacts 或原始文件服务

核心要求只有两个：

1. 业务项目能通过稳定 URL 访问这些文件
2. `--remote` 对应目录下能直接拿到 `manifest.json`

### 目录结构要求

假设远程地址为：

```text
https://intra.example.com/my-fe-standards
```

则服务端目录应为：

```text
https://intra.example.com/my-fe-standards/
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

### Linux / Nginx 示例

```bash
mkdir -p /srv/static/my-fe-standards/scripts/dist
mkdir -p /srv/static/my-fe-standards/packs

cp manifest.json /srv/static/my-fe-standards/
cp scripts/dist/codebuddy-install.js /srv/static/my-fe-standards/scripts/dist/
cp scripts/dist/codebuddy-loader.bundle.js /srv/static/my-fe-standards/scripts/dist/
cp packs/content-pack-*.json /srv/static/my-fe-standards/packs/
```

### Windows / 内网共享目录示例

```powershell
New-Item -ItemType Directory -Force -Path D:\static\my-fe-standards\scripts\dist | Out-Null
New-Item -ItemType Directory -Force -Path D:\static\my-fe-standards\packs | Out-Null

Copy-Item manifest.json D:\static\my-fe-standards\
Copy-Item scripts\dist\codebuddy-install.js D:\static\my-fe-standards\scripts\dist\
Copy-Item scripts\dist\codebuddy-loader.bundle.js D:\static\my-fe-standards\scripts\dist\
Copy-Item packs\content-pack-*.json D:\static\my-fe-standards\packs\
```

### 版本化发布建议

推荐不要每次都覆盖同一路径，至少保留一个版本目录：

```text
https://intra.example.com/my-fe-standards/3.3.0/
https://intra.example.com/my-fe-standards/2.0.1/
https://intra.example.com/my-fe-standards/current/
```

推荐策略：

- `current/` 指向当前稳定版
- 业务试点可先指向固定版本目录
- 确认稳定后再切换 `current/`

## 三、远程认证

如果内网静态源受保护，当前 loader 已支持 Bearer Token。

### 业务安装时传 Token

```bash
node codebuddy-loader.bundle.js \
  --remote https://intra.example.com/my-fe-standards \
  --remote-bearer-token YOUR_TOKEN
```

或：

```bash
CODEBUDDY_REMOTE_BEARER_TOKEN=YOUR_TOKEN \
node codebuddy-loader.bundle.js --remote https://intra.example.com/my-fe-standards
```

说明：

- CLI 参数优先级高于环境变量
- Token 会用于 `manifest.json`、content pack 以及允许回退时的逐文件请求
- Authorization 只会发送到 `--remote` 同源地址；如果内网网关把受保护资源跳转到其他域名，Token 不会跨域透传
- 如果你的远程源只开放 `manifest + packs`，建议业务侧固定使用 `--pack-only`

## 四、业务项目安装

### 推荐：跨平台安装脚本

优先推荐业务项目直接使用 `codebuddy-install.js`。

它会自动下载 loader，并默认附带：

```text
--profile analysis --rule-level quick --pack-only
```

macOS / Linux：

```bash
curl -fsSL https://intra.example.com/my-fe-standards/scripts/dist/codebuddy-install.js | \
node - --remote https://intra.example.com/my-fe-standards
```

Windows PowerShell：

```powershell
irm https://intra.example.com/my-fe-standards/scripts/dist/codebuddy-install.js | `
node - --remote https://intra.example.com/my-fe-standards
```

如需完整编排能力：

```bash
curl -fsSL https://intra.example.com/my-fe-standards/scripts/dist/codebuddy-install.js | \
node - --remote https://intra.example.com/my-fe-standards --profile full
```

### 推荐安装参数

对大多数业务仓，建议使用：

```bash
--profile analysis --rule-level quick --pack-only
```

原因：

- `analysis` 兼顾结构分析、审查、常规辅助能力
- `quick` 能减轻主规则入口体积
- `pack-only` 可以确保业务项目只依赖构建产物，不依赖逐文件目录树

### 方式 A：直接远程执行

适合一次性初始化：

```bash
curl -fsSL https://intra.example.com/my-fe-standards/scripts/dist/codebuddy-loader.bundle.js | \
node - --remote https://intra.example.com/my-fe-standards --profile analysis --rule-level quick --pack-only
```

### 方式 B：先下载 bundle，再执行

适合业务仓保留一个稳定安装脚本：

```bash
curl -O https://intra.example.com/my-fe-standards/scripts/dist/codebuddy-loader.bundle.js
node codebuddy-loader.bundle.js --remote https://intra.example.com/my-fe-standards --profile analysis --rule-level quick --pack-only
```

### 方式 C：PowerShell

```powershell
Invoke-WebRequest `
  -Uri https://intra.example.com/my-fe-standards/scripts/dist/codebuddy-loader.bundle.js `
  -OutFile .\codebuddy-loader.bundle.js

node .\codebuddy-loader.bundle.js `
  --remote https://intra.example.com/my-fe-standards `
  --profile analysis `
  --rule-level quick `
  --pack-only `
  --remote-bearer-token YOUR_TOKEN
```

### 固化到业务项目脚本

推荐在业务仓 `package.json` 中增加：

```json
{
  "scripts": {
    "codebuddy:update": "node codebuddy-loader.bundle.js --remote https://intra.example.com/my-fe-standards --profile analysis --rule-level quick --pack-only"
  }
}
```

如果使用 Token，建议从环境变量注入，不要写死在仓库脚本里。

## 五、安装后如何确认成功

安装成功后，业务项目应出现：

```text
.codebuddy/
├─ install.json
├─ rules/project-rules.md
├─ scripts/
└─ cache/content-packs/
```

然后执行：

```bash
node .codebuddy/scripts/codebuddy-loader.js status
```

如果业务仓没有保留 loader 脚本，也可以直接查看：

```text
.codebuddy/install.json
```

重点确认：

- `mode = remote`
- `profile = analysis` 或你指定的 profile
- `source.contentPackFile` 已有值
- `options.strictRemotePack = true`（如果你启用了 `--pack-only`）

### 建议补一条冒烟

```bash
node .codebuddy/scripts/structure-analyzer.js . --output json
```

如果这条能正常产出报告，说明远程分析运行时已具备基本可用性。

## 六、更新流程

推荐更新顺序：

1. 在 `my-fe-standards` 仓执行 `npm run build`
2. 重新上传新版本 `manifest.json`、`packs/*`、`codebuddy-loader.bundle.js`
3. 先在 1 个试点业务仓运行安装更新
4. 通过后，再推广到其他业务仓

业务侧更新命令通常不变：

```bash
node codebuddy-loader.bundle.js --remote https://intra.example.com/my-fe-standards --profile analysis --rule-level quick --pack-only
```

## 七、回滚策略

推荐至少保留最近两个稳定版本目录。

### 回滚方法

1. 将业务项目的 `--remote` 从新版本路径切回旧版本路径
2. 重新执行安装命令

例如：

```bash
node codebuddy-loader.bundle.js --remote https://intra.example.com/my-fe-standards/3.3.0 --profile analysis --rule-level quick --pack-only
```

如果你使用 `current/` 软链接或网关转发，也可以直接把 `current/` 指回旧版本。

## 八、常见问题

### 1. 可以只发布 bundle，不发布 manifest 和 packs 吗？

不行。

bundle 只是安装器；真正的规则、技能、Agent 产物仍来自 `manifest.json` 和 `packs/*`。

### 2. 可以让业务项目完全看不到规则内容吗？

当前不行。

当前架构是本地可读的分发模式，pack 安装后仍会把内容解包到业务项目本地 `.codebuddy/` 缓存。

### 3. 推荐默认用哪个 profile？

一般推荐：

- `analysis`: 默认业务安装
- `full`: 深度编排、复杂排障或完整能力验证

### 4. 推荐默认开 `--pack-only` 吗？

如果你的目标是：

- 源码仓私有
- 业务侧只消费构建产物
- 不对外开放逐文件目录树

那就应该默认开启。

## 九、生产建议

建议作为团队默认约束固化：

1. 源码仓保持私有
2. 只发布 `manifest.json`、`packs/*`、`codebuddy-loader.bundle.js`
3. 业务项目默认使用 `--profile analysis --rule-level quick --pack-only`
4. Token 通过环境变量或 CI Secret 注入
5. 所有发布路径采用版本化目录，保留回滚窗口
