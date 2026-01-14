# MCP 服务器部署指南

## 📋 概述

本文档说明如何将 MCP 服务器发布到 npm，实现团队成员零克隆使用。

## 🎯 目标

**发布前**（当前状态）：
- ❌ 团队成员需要克隆项目
- ❌ 需要执行 `npm install`
- ❌ 需要执行 `npm run build`
- ❌ 需要配置本地路径

**发布后**（目标状态）：
- ✅ 团队成员只需配置 MCP
- ✅ npx 自动下载并运行
- ✅ 完全零克隆、零安装

## 🚀 快速开始

### 用户使用方式（发布后）

```json
{
  "mcpServers": {
    "fe-standards": {
      "command": "npx",
      "args": ["-y", "fe-standards-mcp-server"],
      "env": {
        "FE_STANDARDS_REMOTE_URL": "https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/feature/mcp-server"
      }
    }
  }
}
```

**就这样！** 无需任何其他操作。

---

## 📦 发布到 npm

### 步骤 1: 准备发布配置

#### 1.1 创建 `.npmignore` 文件

在 `mcp-server/` 目录下创建 `.npmignore`：

```
# 源码（不发布）
src/
tsconfig.json

# 开发文件
*.log
.DS_Store
.vscode/
.idea/

# 依赖
node_modules/

# 规则库（使用远程模式）
rules/
config/

# 文档（可选，如果想减小包体积）
# README.md
# DEPLOYMENT.md
```

**说明**：
- **包含** `dist/`（构建产物，必需）
- **排除** `src/`（源码，不需要）
- **排除** `rules/` 和 `config/`（使用远程模式获取）

#### 1.2 更新 `package.json`

添加以下字段：

```json
{
  "name": "fe-standards-mcp-server",
  "version": "1.0.0",
  "files": [
    "dist/"
  ],
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  }
}
```

**关键字段说明**：
- `files`: 指定发布到 npm 的文件（白名单）
- `prepublishOnly`: 发布前自动执行构建

### 步骤 2: 构建项目

```bash
cd E:\mygit\my-fe-standards\mcp-server

# 清理旧的构建产物
rm -rf dist/

# 构建
npm run build

# 验证构建产物
ls dist/
```

**预期输出**：
```
dist/
├── index.js
├── index.d.ts
└── core/
    ├── rule-service.js
    ├── rule-service.d.ts
    ├── types.js
    └── types.d.ts
```

### 步骤 3: 测试本地包

```bash
# 打包（不发布）
npm pack

# 会生成 fe-standards-mcp-server-1.0.0.tgz

# 测试安装
npm install -g ./fe-standards-mcp-server-1.0.0.tgz

# 测试运行
fe-standards-mcp-server
```

### 步骤 4: 发布到 npm

#### 首次发布

```bash
# 登录 npm（首次）
npm login

# 发布
npm publish
```

#### 后续更新

```bash
# 更新版本号
npm version patch   # 1.0.0 -> 1.0.1（修复 bug）
npm version minor   # 1.0.0 -> 1.1.0（新功能）
npm version major   # 1.0.0 -> 2.0.0（破坏性变更）

# 发布
npm publish
```

### 步骤 5: 验证发布

```bash
# 查看包信息
npm info fe-standards-mcp-server

# 测试 npx 运行
npx -y fe-standards-mcp-server
```

---

## 🔐 发布到私有 npm 仓库

### 方案 A: GitHub Packages

#### 1. 配置 package.json

```json
{
  "name": "@your-org/fe-standards-mcp-server",
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/my-fe-standards.git"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

#### 2. 创建 `.npmrc`

```
@your-org:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

#### 3. 发布

```bash
# 设置 GitHub Token
export GITHUB_TOKEN=your_github_token

# 发布
npm publish
```

#### 4. 用户配置

团队成员需要配置 `.npmrc`：

```
@your-org:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

MCP 配置：

```json
{
  "mcpServers": {
    "fe-standards": {
      "command": "npx",
      "args": ["-y", "@your-org/fe-standards-mcp-server"]
    }
  }
}
```

### 方案 B: 私有 npm 仓库（Verdaccio）

如果公司有私有 npm 仓库：

```bash
# 发布到私有仓库
npm publish --registry=https://npm.your-company.com
```

---

## 📝 版本管理策略

### 语义化版本（SemVer）

- **MAJOR** (1.0.0 -> 2.0.0): 破坏性变更
  - 修改 MCP 工具接口
  - 删除或重命名工具
  - 修改参数结构

- **MINOR** (1.0.0 -> 1.1.0): 新功能
  - 添加新的 MCP 工具
  - 添加新的规则
  - 增强现有功能

- **PATCH** (1.0.0 -> 1.0.1): 修复 bug
  - 修复错误
  - 性能优化
  - 文档更新

### 版本更新流程

```bash
# 1. 修改代码并测试
npm run build
npm test  # 如果有测试

# 2. 更新版本号（自动更新 package.json 和创建 git tag）
npm version patch -m "fix: 修复依赖检测问题"

# 3. 推送到 Git
git push && git push --tags

# 4. 发布到 npm
npm publish

# 5. 通知团队成员
# 发送更新日志
```

### 版本锁定（推荐）

在 MCP 配置中指定版本：

```json
{
  "mcpServers": {
    "fe-standards": {
      "command": "npx",
      "args": ["-y", "fe-standards-mcp-server@1.0.0"]
    }
  }
}
```

**优势**：
- 避免自动更新导致的兼容性问题
- 团队成员使用统一版本
- 可控的升级流程

---

## 🔄 更新和回滚

### 更新到最新版本

```bash
# 清除 npx 缓存
npx clear-npx-cache

# 或手动删除缓存
rm -rf ~/.npm/_npx/
```

### 回滚到旧版本

在 MCP 配置中指定旧版本：

```json
{
  "mcpServers": {
    "fe-standards": {
      "command": "npx",
      "args": ["-y", "fe-standards-mcp-server@1.0.0"]
    }
  }
}
```

### 撤销发布（慎用）

```bash
# 撤销指定版本（发布后 72 小时内）
npm unpublish fe-standards-mcp-server@1.0.1

# 撤销整个包（慎用！）
npm unpublish fe-standards-mcp-server --force
```

**注意**：npm 不鼓励撤销发布，建议发布新版本修复问题。

---

## 📊 包体积优化

### 检查包体积

```bash
# 打包并查看大小
npm pack
ls -lh fe-standards-mcp-server-*.tgz

# 查看包内容
tar -tzf fe-standards-mcp-server-*.tgz
```

### 优化建议

1. **排除不必要的文件**（通过 `.npmignore`）
   - 源码（`src/`）
   - 测试文件（`test/`, `*.spec.ts`）
   - 配置文件（`tsconfig.json`, `.eslintrc`）

2. **使用远程规则库**
   - 排除 `rules/` 和 `config/`
   - 通过 `FE_STANDARDS_REMOTE_URL` 环境变量获取

3. **压缩构建产物**
   - 使用 `terser` 或 `esbuild` 压缩
   - 移除 source map（生产环境）

---

## 🧪 测试发布流程

### 使用 npm link（本地测试）

```bash
# 在 mcp-server 目录
npm link

# 测试运行
fe-standards-mcp-server

# 取消链接
npm unlink -g fe-standards-mcp-server
```

### 使用 verdaccio（本地 npm 仓库）

```bash
# 安装 verdaccio
npm install -g verdaccio

# 启动本地仓库
verdaccio

# 发布到本地仓库
npm publish --registry=http://localhost:4873

# 测试安装
npx --registry=http://localhost:4873 fe-standards-mcp-server
```

---

## 🚨 常见问题

### Q1: 发布失败，提示包名已存在

**解决方案**：
- 使用 scoped 包名：`@your-org/fe-standards-mcp-server`
- 或修改包名：`fe-standards-mcp-server-v2`

### Q2: 用户报告版本不一致

**解决方案**：
- 在 MCP 配置中指定版本号
- 清除 npx 缓存：`npx clear-npx-cache`

### Q3: 包体积过大，下载慢

**解决方案**：
- 检查 `.npmignore`，排除不必要文件
- 使用远程规则库模式
- 压缩构建产物

### Q4: 私有代码泄露风险

**解决方案**：
- 使用私有 npm 仓库（GitHub Packages）
- 或使用方案 B（仅修改 MCP 配置，不发布）

---

## 📚 参考资源

- [npm 发布指南](https://docs.npmjs.com/cli/v9/commands/npm-publish)
- [语义化版本规范](https://semver.org/lang/zh-CN/)
- [GitHub Packages 文档](https://docs.github.com/en/packages)
- [npx 使用指南](https://docs.npmjs.com/cli/v9/commands/npx)

---

## 📞 支持

如有问题，请：
1. 查看本文档的常见问题部分
2. 提交 Issue 到项目仓库
3. 联系项目维护者
