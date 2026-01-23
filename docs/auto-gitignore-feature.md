# 自动更新 .gitignore 功能说明

## 功能概述

规则加载器 (rule-loader) 现在会**自动更新业务项目的 `.gitignore` 文件**，将生成的 `.codebuddy/` 目录添加到忽略列表中，避免将 AI 生成的规则文件提交到版本控制系统。

---

## 功能特性

### 1. 自动检测和更新

**触发时机**:
- 每次运行规则加载器时自动执行
- 在生成 `project-rules.md` 文件后立即更新 `.gitignore`

**智能判断**:
- ✅ 如果 `.gitignore` 不存在 → 创建新文件并添加条目
- ✅ 如果 `.gitignore` 存在但不包含 `.codebuddy/` → 追加条目
- ✅ 如果 `.gitignore` 已包含 `.codebuddy/` → 跳过更新

### 2. 添加的内容

```gitignore
# Architect Rule Loader - Generated files
.codebuddy/
```

**说明**:
- 第一行是注释，说明这是规则加载器生成的条目
- 第二行是忽略规则，忽略整个 `.codebuddy/` 目录

### 3. 安全特性

**非侵入式**:
- 不会修改或删除现有的 `.gitignore` 内容
- 只在文件末尾追加新条目
- 保持现有文件格式和换行符

**错误处理**:
- 如果更新失败（权限问题等），只会输出警告，不会中断规则加载流程
- 使用 `logWarn` 输出错误信息，不影响主流程

---

## 使用示例

### 示例 1: 新项目（无 .gitignore）

**初始状态**:
```
my-project/
├── package.json
└── src/
```

**运行规则加载器**:
```bash
node rule-loader.js
```

**结果**:
```
my-project/
├── .gitignore          # ✅ 新创建
├── .codebuddy/
│   ├── rules/
│   ├── rules_cache/
│   └── skills/
├── package.json
└── src/
```

**生成的 .gitignore**:
```gitignore
# Architect Rule Loader - Generated files
.codebuddy/
```

---

### 示例 2: 现有项目（已有 .gitignore）

**初始状态**:
```
my-project/
├── .gitignore          # 已存在
├── package.json
└── src/
```

**现有 .gitignore 内容**:
```gitignore
node_modules/
dist/
.env
```

**运行规则加载器**:
```bash
node rule-loader.js
```

**更新后的 .gitignore**:
```gitignore
node_modules/
dist/
.env

# Architect Rule Loader - Generated files
.codebuddy/
```

---

### 示例 3: 已包含 .codebuddy/（跳过更新）

**现有 .gitignore 内容**:
```gitignore
node_modules/
.codebuddy/
```

**运行规则加载器**:
```bash
node rule-loader.js --verbose
```

**输出**:
```
[Architect:DEBUG] .gitignore already includes .codebuddy/, skipping update
```

**结果**: 不会重复添加，保持原样

---

## 技术实现

### 核心函数

**位置**: `scripts/src/rule-loader.ts:269-317`

```typescript
/**
 * 更新项目的 .gitignore 文件，添加 .codebuddy 目录
 */
function updateGitignore(projectDir: string): void {
  const gitignorePath = path.join(projectDir, '.gitignore');
  const entriesToAdd = [
    '# Architect Rule Loader - Generated files',
    '.codebuddy/',
  ];

  try {
    let gitignoreContent = '';
    let needsUpdate = false;

    // 读取现有 .gitignore 文件（如果存在）
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');

      // 检查是否已包含 .codebuddy/
      if (!gitignoreContent.includes('.codebuddy/')) {
        needsUpdate = true;
      }
    } else {
      // .gitignore 不存在，需要创建
      needsUpdate = true;
    }

    if (needsUpdate) {
      // 确保文件末尾有换行符
      if (gitignoreContent && !gitignoreContent.endsWith('\n')) {
        gitignoreContent += '\n';
      }

      // 添加新条目
      if (gitignoreContent) {
        gitignoreContent += '\n';
      }
      gitignoreContent += entriesToAdd.join('\n') + '\n';

      // 写入文件
      fs.writeFileSync(gitignorePath, gitignoreContent, 'utf-8');
      logVerbose('Updated .gitignore to include .codebuddy/');
    } else {
      logVerbose('.gitignore already includes .codebuddy/, skipping update');
    }
  } catch (error) {
    logWarn(`Failed to update .gitignore: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

### 调用位置

**位置**: `scripts/src/rule-loader.ts:1318`

```typescript
// 输出
const outputDir = path.join(targetDir, OUTPUT_DIR_NAME);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const outputPath = path.join(outputDir, OUTPUT_FILE_NAME);
fs.writeFileSync(outputPath, finalContent, 'utf-8');

// 更新 .gitignore
updateGitignore(targetDir);  // ⭐ 在这里调用

log('');
log('═══════════════════════════════════════════════════════════════════');
log(`✅ Success! Rules written to ${outputPath}`);
```

---

## 为什么需要忽略 .codebuddy/

### 1. 生成文件不应提交

`.codebuddy/` 目录包含的是**自动生成的文件**，类似于 `node_modules/` 或 `dist/`：

```
.codebuddy/
├── rules/
│   └── project-rules.md        # 自动生成
├── rules_cache/                # 自动生成
│   ├── layer1_base/
│   └── layer3_action/
└── skills/                     # 自动复制
```

**理由**:
- 这些文件可以随时通过 `npm run rules:update` 重新生成
- 不同开发者可能使用不同的规则版本
- 避免 Git 冲突和不必要的 diff

### 2. 减小仓库体积

`.codebuddy/` 目录可能包含大量文件：
- `project-rules.md`: 12-19 KB
- `rules_cache/`: 50-100 KB
- `skills/`: 数百 KB

**影响**:
- 如果提交到 Git，会增加仓库体积
- 每次更新规则都会产生新的 commit
- 影响 clone 和 pull 速度

### 3. 保持灵活性

不同开发者可能需要不同的规则配置：
- 使用不同的任务类型 (`--task`)
- 使用不同的详略级别 (`--detail-level`)
- 使用不同的相关性阈值 (`--threshold`)

**解决方案**:
- 每个开发者在本地生成自己的规则
- 通过 `.gitignore` 忽略生成文件
- 只提交规则源文件 (`rules/` 目录)

---

## 常见问题

### Q1: 如果我想提交 .codebuddy/ 怎么办？

**A**: 不建议提交，但如果确实需要：

1. **方案 1**: 从 `.gitignore` 中删除 `.codebuddy/` 条目
2. **方案 2**: 使用 `git add -f .codebuddy/` 强制添加

### Q2: 如果 .gitignore 被意外修改了怎么办？

**A**: 重新运行规则加载器即可：

```bash
npm run rules:update
```

脚本会自动检测并重新添加 `.codebuddy/` 条目。

### Q3: 这个功能会影响现有的 .gitignore 吗？

**A**: 不会。功能是**非侵入式**的：
- 只在文件末尾追加新条目
- 不会修改或删除现有内容
- 保持现有文件格式

### Q4: 如果更新失败会怎样？

**A**: 不会影响规则加载流程：
- 只会输出警告信息
- 规则文件仍然正常生成
- 可以手动添加 `.codebuddy/` 到 `.gitignore`

### Q5: 可以禁用这个功能吗？

**A**: 当前版本不支持禁用。如果不需要，可以：
- 手动从 `.gitignore` 中删除条目
- 或者修改源码注释掉 `updateGitignore(targetDir)` 调用

---

## 测试验证

### 测试场景 1: 新项目

```bash
# 创建测试项目
mkdir test-project && cd test-project
npm init -y
echo '{"dependencies": {"vue": "^3.0.0"}}' > package.json

# 运行规则加载器
node /path/to/rule-loader.js --verbose

# 验证结果
cat .gitignore
# 输出:
# # Architect Rule Loader - Generated files
# .codebuddy/
```

### 测试场景 2: 现有项目

```bash
# 创建现有 .gitignore
echo "node_modules/" > .gitignore

# 运行规则加载器
node /path/to/rule-loader.js --verbose

# 验证结果
cat .gitignore
# 输出:
# node_modules/
#
# # Architect Rule Loader - Generated files
# .codebuddy/
```

### 测试场景 3: 已包含条目

```bash
# 再次运行
node /path/to/rule-loader.js --verbose

# 输出:
# [Architect:DEBUG] .gitignore already includes .codebuddy/, skipping update

# 验证结果（不会重复添加）
cat .gitignore
# 输出:
# node_modules/
#
# # Architect Rule Loader - Generated files
# .codebuddy/
```

---

## 最佳实践

### 1. 团队协作

**推荐做法**:
- ✅ 将规则源文件 (`rules/` 目录) 提交到 Git
- ✅ 将 `.codebuddy/` 添加到 `.gitignore`（自动完成）
- ✅ 每个开发者在本地运行 `npm run rules:update` 生成规则

**避免做法**:
- ❌ 提交 `.codebuddy/` 目录到 Git
- ❌ 手动编辑 `.codebuddy/` 中的文件

### 2. CI/CD 集成

**在 CI/CD 流程中**:
```yaml
# .github/workflows/ci.yml
steps:
  - name: Checkout code
    uses: actions/checkout@v2

  - name: Install dependencies
    run: npm install

  - name: Generate rules
    run: npm run rules:update

  - name: Run tests
    run: npm test
```

**说明**:
- CI/CD 环境中也会生成 `.codebuddy/` 目录
- 但不会提交到 Git（因为在 `.gitignore` 中）
- 每次 CI 运行都会重新生成最新规则

### 3. 多环境支持

**开发环境**:
```bash
npm run rules:update
```

**生产环境**:
```bash
npm run rules:update -- --task new-feature --detail-level quick
```

**测试环境**:
```bash
npm run rules:update -- --task testing --detail-level full
```

---

## 总结

自动更新 `.gitignore` 功能提供了：

1. ✅ **自动化**: 无需手动编辑 `.gitignore`
2. ✅ **智能化**: 自动检测是否需要更新
3. ✅ **安全性**: 非侵入式，不影响现有内容
4. ✅ **容错性**: 更新失败不影响主流程
5. ✅ **最佳实践**: 遵循 Git 忽略生成文件的惯例

**建议**: 保持默认行为，让规则加载器自动管理 `.gitignore`。
