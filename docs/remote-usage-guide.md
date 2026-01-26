# 业务系统远程接入指南

> 本文档详细说明如何在业务项目中远程拉取和使用 Architect 前端规则库。

## 目录

- [概述](#概述)
- [快速开始](#快速开始)
- [方式 A: HTTP 远程加载](#方式-a-http-远程加载)
- [方式 B: 私有仓库接入 (推荐)](#方式-b-私有仓库接入-推荐)
- [高级功能](#高级功能)
- [故障排查](#故障排查)
- [最佳实践](#最佳实践)

---

## 概述

### 功能简介

Architect Rule Loader 支持业务项目从远程获取前端规范规则，自动分析项目依赖并生成定制化的规则文件，供 CodeBuddy 等 AI 编程助手使用。

### 两种接入方式对比

| 特性 | HTTP 远程加载 | Git 私有仓库接入 |
|------|---------------|------------------|
| **适用场景** | 公开仓库、静态托管 | 私有仓库、企业内网 |
| **认证方式** | 无需认证 | 利用本地 git 凭证 |
| **核心脚本** | `rule-loader.js` | `architect-bootstrap.js` |
| **服务端要求** | 需托管静态文件 | 无需额外服务 |
| **缓存机制** | 无 | 本地缓存 (默认1小时) |
| **推荐程度** | 适合公开规则 | **推荐** (企业场景) |

### 适用场景选择

```
┌─────────────────────────────────────────────────────────────┐
│                    选择接入方式                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  规则仓库是否私有？                                          │
│       │                                                     │
│       ├── 是 ──→ 方式 B: 私有仓库接入 (推荐)                 │
│       │                                                     │
│       └── 否 ──→ 是否有静态托管服务？                        │
│                    │                                        │
│                    ├── 是 ──→ 方式 A: HTTP 远程加载          │
│                    │                                        │
│                    └── 否 ──→ 方式 B: 私有仓库接入           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 快速开始

### 最简接入 (一键远程执行，推荐)

无需下载任何文件，直接从远程拉取脚本并执行：

```bash
# 一键远程加载规则（curl 管道方式）
curl -fsSL https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/feature/codebuddy-glm/scripts/dist/codebuddy-loader.js | node - --remote https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/feature/codebuddy-glm
```

**优势**：
- ✅ 无需预先下载脚本
- ✅ 无临时文件
- ✅ 一步完成（下载+执行同时进行）
- ✅ 跨平台支持（Linux/macOS/Windows 10+）

### 私有仓库接入 (3步完成)

**步骤 1**: 下载引导脚本到业务项目根目录

```bash
# 从规则仓库复制 architect-bootstrap.js 到业务项目
cp /path/to/my-fe-standards/scripts/dist/architect-bootstrap.js ./
```

**步骤 2**: 配置 `package.json`

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

**步骤 3**: 执行命令

```bash
npm run rules:update
```

### 验证接入成功

执行成功后，检查以下文件是否生成：

```
your-project/
├── .architect-cache/          # 规则缓存目录
│   ├── rule-loader.js
│   ├── manifest.json
│   ├── config/
│   └── rules/
└── .codebuddy/.rules/
    └── project-rules.md       # 生成的规则文件 ✅
```

---

## 方式 A: HTTP 远程加载

适合规则仓库已托管在公开静态服务器的场景。

### 3.1 服务端准备

#### 托管文件结构

确保以下文件可通过 HTTP 访问：

```
https://your-server.com/standards/
├── manifest.json              # 必需：规则清单
├── rules/
│   ├── layer1_base/
│   │   ├── architecture/
│   │   ├── typescript/
│   │   └── vue3/
│   ├── layer2_business/
│   └── layer3_action/
└── config/
    └── loader-config.json
```

#### 生成 manifest.json

在规则仓库中执行：

```bash
npm run build:manifest
```

这会生成 `manifest.json`，包含所有规则文件的路径和元信息。

#### 配置 CORS (如需跨域)

如果业务项目和规则服务器不同源，需配置 CORS：

```nginx
# Nginx 配置示例
location /standards/ {
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods 'GET, OPTIONS';
}
```

### 3.2 客户端使用

#### 下载 rule-loader.js

```bash
# 方式 1: 从 GitHub 下载
curl -O https://raw.githubusercontent.com/your-org/my-fe-standards/main/scripts/dist/rule-loader.js

# 方式 2: 从内部服务器下载
curl -O https://your-server.com/standards/scripts/dist/rule-loader.js
```

#### 执行命令

```bash
node rule-loader.js --remote https://your-server.com/standards
```

#### 命令行参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `--remote <URL>` | 远程规则库地址 | `--remote https://example.com/standards` |
| `--task <type>` | 任务筛选 | `--task refactoring` |
| `--detail-level <level>` | 详略级别 | `--detail-level quick` |
| `--threshold <n>` | 相关性阈值 (0-1) | `--threshold 0.7` |
| `--timeout <ms>` | 请求超时 | `--timeout 15000` |
| `--verbose, -v` | 详细日志 | `-v` |
| `--help, -h` | 显示帮助 | `-h` |

### 3.3 CI/CD 集成示例

#### GitHub Actions

```yaml
# .github/workflows/update-rules.yml
name: Update Architect Rules

on:
  schedule:
    - cron: '0 9 * * 1'  # 每周一早上9点
  workflow_dispatch:      # 支持手动触发

jobs:
  update-rules:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Download rule-loader
        run: curl -O https://your-server.com/standards/scripts/dist/rule-loader.js

      - name: Update rules
        run: node rule-loader.js --remote https://your-server.com/standards

      - name: Commit changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .codebuddy/
          git diff --staged --quiet || git commit -m "chore: update architect rules"
          git push
```

#### GitLab CI

```yaml
# .gitlab-ci.yml
update-rules:
  stage: build
  image: node:18
  script:
    - curl -O https://your-server.com/standards/scripts/dist/rule-loader.js
    - node rule-loader.js --remote https://your-server.com/standards
  artifacts:
    paths:
      - .codebuddy/.rules/
  only:
    - schedules
```

---

## 方式 B: 私有仓库接入 (推荐)

利用本地 git 凭证从私有仓库拉取规则，无需配置 Token。

### 4.1 前置条件

#### Git 凭证配置

**SSH 方式 (推荐)**:

```bash
# 1. 检查是否已配置 SSH key
ssh -T git@github.com
# 预期输出: Hi username! You've successfully authenticated...

# 2. 如未配置，生成 SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# 3. 添加到 ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# 4. 将公钥添加到 GitHub/GitLab
cat ~/.ssh/id_ed25519.pub
# 复制输出内容，添加到 Git 服务器的 SSH Keys 设置中
```

**HTTPS 方式**:

```bash
# Windows (使用凭证管理器)
git config --global credential.helper manager-core

# macOS (使用钥匙串)
git config --global credential.helper osxkeychain

# Linux (缓存凭证)
git config --global credential.helper cache
```

### 4.2 接入步骤

#### 步骤 1: 下载引导脚本

```bash
# 从规则仓库复制
cp /path/to/my-fe-standards/scripts/dist/architect-bootstrap.js ./

# 或从内部服务器下载
curl -O https://internal-server/architect-bootstrap.js
```

#### 步骤 2: 配置 package.json

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

#### 步骤 3: 执行命令

```bash
npm run rules:update
```

首次执行会显示 Git 账号确认信息：

```
╔══════════════════════════════════════════════════════════════════╗
║                      Git 账号信息确认                             ║
╠══════════════════════════════════════════════════════════════════╣
║  用户名 (user.name):   Your Name                                 ║
║  邮箱 (user.email):    your@email.com                            ║
╠══════════════════════════════════════════════════════════════════╣
║  SSH Key:              ✅ 已配置                                  ║
║  Credential Helper:    manager-core                              ║
╠══════════════════════════════════════════════════════════════════╣
║  目标仓库: git@github.com:your-org/my-fe-standards.git           ║
║  目标分支: main                                                   ║
╚══════════════════════════════════════════════════════════════════╝

确认使用以上 Git 账号拉取规则? [Y/n]
```

### 4.3 配置选项详解

```json
{
  "architect": {
    "repo": "git@github.com:your-org/my-fe-standards.git",
    "branch": "main",
    "useCache": true,
    "cacheExpiry": 3600000,
    "skipConfirm": false
  }
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `repo` | string | - | 规则仓库地址 (SSH 或 HTTPS) |
| `branch` | string | `"main"` | 分支名 |
| `useCache` | boolean | `true` | 是否启用本地缓存 |
| `cacheExpiry` | number | `3600000` | 缓存过期时间 (毫秒)，默认 1 小时 |
| `skipConfirm` | boolean | `false` | 是否跳过用户确认 |

### 4.4 CI/CD 集成

#### 命令行参数

```bash
# 跳过确认 (CI/CD 必需)
node architect-bootstrap.js --yes

# 强制刷新缓存
node architect-bootstrap.js --force

# 组合使用
node architect-bootstrap.js -y -f
```

#### GitHub Actions 示例

```yaml
# .github/workflows/update-rules.yml
name: Update Architect Rules

on:
  schedule:
    - cron: '0 9 * * 1'
  workflow_dispatch:

jobs:
  update-rules:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.8.0
        with:
          ssh-private-key: ${{ secrets.RULES_REPO_SSH_KEY }}

      - name: Update rules
        run: node architect-bootstrap.js --yes --force

      - name: Commit changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .codebuddy/ .architect-cache/
          git diff --staged --quiet || git commit -m "chore: update architect rules"
          git push
```

---

## 高级功能

### 5.1 任务筛选 (--task)

根据当前任务类型，只加载相关规则，减少上下文噪音。

```bash
# 重构任务
node rule-loader.js --task refactoring

# 调试任务
node rule-loader.js --task debugging

# 新功能开发
node rule-loader.js --task new-feature
```

**支持的任务类型**:

| 类型 | 别名 | 说明 |
|------|------|------|
| `refactoring` | refactor, optimize, cleanup | 代码重构、优化 |
| `debugging` | debug, fix, bugfix | Bug 修复、问题排查 |
| `testing` | test, unit-test, e2e | 编写测试 |
| `new-feature` | feature, implement, add | 新功能开发 |
| `code-review` | review, pr | 代码审查 |

### 5.2 详略级别 (--detail-level)

控制规则内容的详细程度。

```bash
# 仅摘要 (最小上下文)
node rule-loader.js --detail-level summary

# 快速参考 (日常开发)
node rule-loader.js --detail-level quick

# 完整内容 (深入学习，默认)
node rule-loader.js --detail-level full
```

**级别说明**:

| 级别 | 内容 | 适用场景 |
|------|------|----------|
| `summary` | 仅规则摘要 | 快速浏览、Token 受限 |
| `quick` | 摘要 + 快速参考 | 日常开发 |
| `full` | 完整内容 | 深入学习、首次接入 |

### 5.3 相关性阈值 (--threshold)

调整规则筛选的严格程度。

```bash
# 严格筛选 (只加载高度相关的规则)
node rule-loader.js --task refactoring --threshold 0.7

# 宽松筛选 (加载更多可能相关的规则)
node rule-loader.js --task debugging --threshold 0.3
```

**阈值说明**:

| 阈值 | 说明 |
|------|------|
| `0.7` (strict) | 只加载高度相关规则 |
| `0.5` (default) | 平衡筛选 |
| `0.3` (loose) | 宽松筛选，加载更多规则 |

---

## 故障排查

### 常见错误及解决方案

#### 错误 1: Git clone failed

```
[Architect:ERROR] Git clone failed: Permission denied (publickey)
```

**原因**: SSH key 未配置或未添加到 Git 服务器

**解决方案**:
```bash
# 1. 检查 SSH key
ssh -T git@github.com

# 2. 如果失败，重新配置 SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"
ssh-add ~/.ssh/id_ed25519

# 3. 将公钥添加到 Git 服务器
```

#### 错误 2: HTTP 请求失败

```
[Architect:ERROR] HTTP 404: Failed to fetch https://example.com/standards/manifest.json
```

**原因**: 远程 URL 错误或 manifest.json 不存在

**解决方案**:
1. 确认 URL 正确
2. 确认 manifest.json 已生成 (`npm run build:manifest`)
3. 确认文件可公开访问

#### 错误 3: 网络超时

```
[Architect:ERROR] Request Timeout: URL did not respond within 10000ms
```

**原因**: 网络不稳定或服务器响应慢

**解决方案**:
```bash
# 增加超时时间
node rule-loader.js --remote https://example.com/standards --timeout 30000
```

#### 错误 4: 缓存问题

```
[Architect] Using cached rules (still valid).
```

但规则未更新。

**解决方案**:
```bash
# 强制刷新缓存
node architect-bootstrap.js --force
```

### 网络问题处理

如果在受限网络环境中：

1. **使用代理**:
   ```bash
   export HTTP_PROXY=http://proxy.example.com:8080
   export HTTPS_PROXY=http://proxy.example.com:8080
   node rule-loader.js --remote https://example.com/standards
   ```

2. **使用镜像 URL**:
   ```bash
   # 使用内部镜像
   node rule-loader.js --remote https://internal-mirror.example.com/standards
   ```

### 凭证问题处理

```bash
# 检查 git 配置
git config --list | grep credential

# 清除缓存的凭证 (Windows)
git credential-manager-core erase

# 重新配置
git config --global credential.helper manager-core
```

---

## 最佳实践

### 缓存策略建议

| 场景 | 建议缓存时间 | 配置 |
|------|--------------|------|
| 开发环境 | 1 小时 | `"cacheExpiry": 3600000` |
| CI/CD | 禁用缓存 | `--force` |
| 稳定项目 | 24 小时 | `"cacheExpiry": 86400000` |

### 更新频率建议

| 场景 | 建议频率 |
|------|----------|
| 活跃开发期 | 每天或每次 PR |
| 维护期 | 每周一次 |
| 稳定期 | 每月一次 |

### 团队协作建议

1. **统一配置**: 将 `architect` 配置提交到 `package.json`，确保团队使用相同配置

2. **Git 忽略**: 将缓存目录添加到 `.gitignore`
   ```gitignore
   # Architect cache
   .architect-cache/
   ```

3. **规则文件提交**: 建议将生成的规则文件提交到仓库
   ```bash
   git add .codebuddy/.rules/project-rules.md
   git commit -m "chore: update architect rules"
   ```

4. **CI/CD 自动更新**: 配置定时任务自动更新规则

5. **版本锁定**: 使用特定分支或 tag 确保规则稳定
   ```json
   {
     "architect": {
       "branch": "v1.0.0"
     }
   }
   ```

---

## 附录

### 完整配置示例

```json
{
  "name": "my-business-project",
  "scripts": {
    "rules:update": "node architect-bootstrap.js",
    "rules:update:force": "node architect-bootstrap.js --force",
    "rules:update:ci": "node architect-bootstrap.js --yes --force"
  },
  "architect": {
    "repo": "git@github.com:your-org/my-fe-standards.git",
    "branch": "main",
    "useCache": true,
    "cacheExpiry": 3600000,
    "skipConfirm": false
  }
}
```

### 相关文件

| 文件 | 说明 |
|------|------|
| `scripts/dist/rule-loader.js` | HTTP 远程加载脚本 |
| `scripts/dist/architect-bootstrap.js` | 私有仓库引导脚本 |
| `config/loader-config.json` | 加载器配置 |
| `manifest.json` | 规则清单 |

### 获取帮助

```bash
# 查看 rule-loader 帮助
node rule-loader.js --help

# 查看 architect-bootstrap 帮助
node architect-bootstrap.js --help
```
