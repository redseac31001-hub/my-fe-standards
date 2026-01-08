# Architect Rule Loader (前端架构师规则库)

这是一个标准化的前端专家规则库，旨在作为 **CodeBuddy** 等 AI 编程助手的知识源 (Context Source)。
通过维护一系列高质量、结构化的 `.md` 规则文件，我们确保 AI 助手在辅助编码时能够遵循团队的最佳实践、设计模式和代码规范。

## 🎯 核心目标

*   **统一规范**: 确保所有团队成员（及 AI 助手）产出的代码风格一致。
*   **最佳实践**: 内置 Vue 3 + TypeScript 生态的架构师级建议。
*   **知识沉淀**: 将团队的隐性知识转化为显性的 Markdown 文档。

## 📂 目录结构（三层架构）

本规则库采用 **分层规则引擎** 设计，将规则按职责划分为三层：

```text
rules/
├── _meta/                 # 📋 元信息 (不被加载到项目)
│   └── rule-template.md   #    规则编写模板
│
├── layer1_base/           # 🧱 基础层 - 通用技术标准
│   ├── architecture/      #    架构规范 (目录结构等)
│   ├── typescript/        #    TypeScript 类型安全规范
│   ├── vue3/              #    Vue 3 最佳实践 (Script Setup)
│   └── vue2/              #    Vue 2 兼容规则 (Options API)
│
├── layer2_business/       # 🏢 业务层 - 项目特定规范
│   └── tdesign.md         #    TDesign UI 库使用规范
│
└── layer3_action/         # ⚡ 动作层 - 任务型检查清单
    ├── refactoring.md     #    重构检查清单
    ├── debugging.md       #    调试检查清单
    └── testing.md         #    测试策略
```

### 三层职责说明

| 层级 | 加载条件 | 内容 |
|------|----------|------|
| **Layer 1 (Base)** | 自动加载 | 通用的 Vue/TS/架构规范，根据项目 Vue 版本自动分流 |
| **Layer 2 (Business)** | 检测到特定依赖时加载 | 如检测到 `tdesign-vue-next`，则加载 TDesign 规范 |
| **Layer 3 (Action)** | 始终加载 | 供 AI Agent 根据用户任务（重构/调试/测试）调用 |

## 🛠️ 自动化工具 (Rule Loader v6)

本仓库提供了一个自动化脚本，能够：
- 扫描目标项目的 `package.json` 依赖
- **智能检测 Vue 2/Vue 3** 并加载对应规则
- 按三层架构拼装规则文件

### 项目结构

```text
scripts/
├── src/                    # TypeScript 源码
│   ├── rule-loader.ts      # 规则加载器
│   ├── generate-manifest.ts # 清单生成器
│   └── types/
│       └── index.ts        # 共享类型定义
├── dist/                   # 编译产物 (用户直接使用)
│   ├── rule-loader.js
│   └── generate-manifest.js
└── tsconfig.json
```

**使用方法:**

### 方式 A: 本地加载 (Local Mode)

1.  克隆本仓库到本地。
2.  安装依赖并编译：
```bash
npm install
npm run build:scripts
```
3.  运行命令：
```bash
node scripts/dist/rule-loader.js
```

### 方式 B: HTTP 远程加载 (Remote Fetch Mode) 🌟

适合 CI/CD 或快速接入，无需克隆整个仓库。

1.  **服务端准备**:
    在服务器上托管本仓库的 `rules/` 目录和通过 `npm run build:manifest` 生成的 `manifest.json`。
    比如托管在: `https://statics.example.com/standards/`

2.  **客户端使用**:
    在任意项目中，只需下载 `rule-loader.js` 脚本，然后运行：

```bash
# 例子
node rule-loader.js --remote https://statics.example.com/standards
```

> 脚本会自动请求远端的 manifest 清单，智能分析当前项目依赖，只下载需要的规则文件。


脚本将会在您的项目目录下生成 `.codebuddy/project-rules.md`。CodeBuddy 代码助手会自动读取此文件作为编程上下文。

## 🚀 如何使用 (For CodeBuddy)

在 VSCode 中使用 CodeBuddy 时，可以通过配置将本仓库的 `rules` 目录添加为上下文来源，或者在 Prompt 中引用特定的规则文件。

**例如：**
> "Refactor this component following the rules in @rules/layer1_base/vue3/vue3-script-setup.md"

## 📝 规则编写指南

请参考 `rules/_meta/rule-template.md` 编写新的规则。每条规则应包含：
1.  **Context**: 适用场景。
2.  **The Rule**: 具体的规范描述。
3.  **Reasoning**: 背后的原理（帮助 AI 理解权衡）。
4.  **Examples**: 正面 (✅) 与反面 (❌) 的代码示例。

## 🔧 快速接入 (One-Liner)

如果你的规则仓库已托管在 GitHub，业务项目可以通过以下一键命令拉取并生成规则：

```bash
# 替换 [USER] 和 [REPO] 为你的 GitHub 用户名和仓库名
# 替换 [BRANCH] 为分支名 (如 main 或 feature/remote-fetch)

curl -O https://raw.githubusercontent.com/[USER]/[REPO]/[BRANCH]/scripts/dist/rule-loader.js && \
node rule-loader.js --remote https://raw.githubusercontent.com/[USER]/[REPO]/[BRANCH]
```

**⚠️ 注意**: 必须使用 `raw.githubusercontent.com` 域名，而非 `github.com/...blob/...`，否则会下载 HTML 页面而非脚本代码。

### 示例 (本仓库)

```bash
curl -O https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/feature/remote-fetch/scripts/dist/rule-loader.js && \
node rule-loader.js --remote https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/feature/remote-fetch
```

## 🔐 私有仓库接入 (推荐) 🌟

对于私有仓库，使用 `architect-bootstrap.js` 引导脚本，利用本地 git 凭证自动拉取规则。

> 📖 **详细文档**: 完整的接入指南请参阅 [docs/remote-usage-guide.md](docs/remote-usage-guide.md)，包含 CI/CD 集成、故障排查、最佳实践等内容。

### 优势

- ✅ **无需配置 Token**: 利用本地已配置的 git 凭证 (SSH Key / Credential Helper)
- ✅ **统一命令**: 所有开发者执行相同的 `npm run rules:update`
- ✅ **自动缓存**: 规则文件本地缓存，避免重复拉取
- ✅ **支持私有仓库**: 完美支持 GitHub/GitLab/Gitee 私有仓库

### 业务项目接入步骤

**步骤 1**: 下载引导脚本到业务项目根目录

```bash
# 从公开位置下载，或手动复制
curl -O https://your-internal-server/architect-bootstrap.js
# 或者从规则仓库手动复制 scripts/dist/architect-bootstrap.js
```

**步骤 2**: 在业务项目 `package.json` 中添加配置

```json
{
  "scripts": {
    "rules:update": "node architect-bootstrap.js"
  },
  "architect": {
    "repo": "git@github.com:your-org/my-fe-standards.git",
    "branch": "main"
  }
}
```

**步骤 3**: 执行命令生成规则

```bash
npm run rules:update
```

### 配置选项

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `repo` | 规则仓库地址 (SSH 或 HTTPS) | - |
| `branch` | 分支名 | `main` |
| `useCache` | 是否启用缓存 | `true` |
| `cacheExpiry` | 缓存过期时间 (毫秒) | `3600000` (1小时) |

### 完整配置示例

```json
{
  "architect": {
    "repo": "git@github.com:your-org/my-fe-standards.git",
    "branch": "main",
    "useCache": true,
    "cacheExpiry": 3600000
  }
}
```

### Git 凭证配置

确保本地 git 凭证已正确配置：

**SSH 方式 (推荐)**:
```bash
# 检查 SSH key 是否已添加
ssh -T git@github.com

# 如果未配置，生成并添加 SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"
ssh-add ~/.ssh/id_ed25519
# 然后将公钥添加到 GitHub/GitLab
```

**HTTPS 方式**:
```bash
# 配置凭证缓存
git config --global credential.helper cache

# 或使用系统凭证管理器 (Windows)
git config --global credential.helper manager-core

# 或使用 macOS Keychain
git config --global credential.helper osxkeychain
```

## 📋 命令行帮助

```bash
node scripts/dist/rule-loader.js --help
```

可用选项：
- `--help, -h`: 显示帮助信息
- `--remote <URL>`: 从远程 URL 获取规则
- `--verbose, -v`: 启用详细日志
- `--timeout <ms>`: 设置网络请求超时 (默认 10000ms)

## 🔨 开发指南

### 构建脚本

```bash
# 安装依赖
npm install

# 编译 TypeScript 脚本
npm run build:scripts

# 生成 manifest.json
npm run build:manifest

# 一键构建 (脚本 + manifest)
npm run build
```

### 本地测试

```bash
# 本地模式测试
npm run test:local

# 远程模式测试
npm run test:remote
```

