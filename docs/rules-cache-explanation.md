# rules_cache 功能说明

## 一、功能概述

`rules_cache` 是规则加载器的**本地缓存目录**，用于存储从远程或本地复制的规则文件，实现**Lazy Load（懒加载）索引模式**。

**核心作用**:
- 将规则文件缓存到本地，供 AI 按需读取
- 支持 Layer 2 (Business) 和 Layer 3 (Action) 的懒加载策略
- 避免将所有规则内容嵌入 `project-rules.md`，减小文件体积

---

## 二、工作原理

### 2.1 三层架构的加载策略

| 层级 | 加载模式 | 内容位置 | 说明 |
|------|---------|---------|------|
| **Layer 1 (Base)** | Eager Load | 嵌入 `project-rules.md` | 核心原则常驻内存，使用 `quick` 级别防止过长 |
| **Layer 2 (Business)** | Lazy Load | 缓存到 `rules_cache/` | 仅生成索引表，AI 按需读取 |
| **Layer 3 (Action)** | Lazy Load | 缓存到 `rules_cache/` | 仅生成索引表，AI 按需读取 |

### 2.2 缓存流程

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 规则加载器启动                                            │
│    - 本地模式: 从 rules/ 目录读取                            │
│    - 远程模式: 从 GitHub/服务器下载                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. 缓存规则文件到 .codebuddy/rules_cache/                   │
│    - layer1_base/     (Layer 1 规则)                        │
│    - layer2_business/ (Layer 2 规则)                        │
│    - layer3_action/   (Layer 3 规则)                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 生成 project-rules.md                                    │
│    - Layer 1: 嵌入精简内容 (quick 级别)                     │
│    - Layer 2/3: 仅生成索引表，指向缓存文件路径              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. AI 按需读取                                               │
│    - 根据任务类型，读取相关的缓存文件                        │
│    - 例如: 重构任务 → 读取 refactoring.md                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、目录结构

### 3.1 完整目录结构

```
.codebuddy/
├── rules/                          # 主规则文件
│   └── project-rules.md            # 生成的规则文件 (12-19 KB)
│
├── rules_cache/                    # 规则缓存目录 ⭐
│   ├── layer1_base/                # Layer 1 规则缓存
│   │   ├── api-request.md          # API 请求规范
│   │   ├── feature-based-structure.md  # 架构规范
│   │   ├── pinia.md                # Pinia 状态管理
│   │   ├── router.md               # Vue Router 规范
│   │   ├── strict-types.md         # TypeScript 严格类型
│   │   └── vue3-script-setup.md    # Vue 3 Script Setup
│   │
│   ├── layer2_business/            # Layer 2 规则缓存 (未使用)
│   │   # 注: 当前项目未检测到 ant-design-vue/vant 依赖
│   │   # 如果检测到，会缓存 antdv.md, vant.md
│   │
│   └── layer3_action/              # Layer 3 规则缓存
│       ├── debugging.md            # 调试检查清单
│       ├── refactoring.md          # 重构检查清单
│       ├── self-verification.md    # 自我验证协议
│       └── testing.md              # 测试策略
│
└── skills/                         # Skills 副本
    ├── component-refactoring/
    ├── frontend-code-review/
    ├── frontend-testing/
    └── skill-creator/
```

### 3.2 缓存文件示例

**文件**: `.codebuddy/rules_cache/layer1_base/vue3-script-setup.md`

```markdown
# Vue 3 Component Structure & Script Setup

> Tags: #Vue3 #CompositionAPI #ScriptSetup
> Priority: High

<!-- @level:summary -->
## Summary (摘要)

Vue 3 组件必须使用 `<script setup lang="ts">` 编写，禁止新增 Options API 代码。复杂逻辑抽取为 Composable 函数 (`use...`)。

<!-- @level:quick -->
## Quick Reference (快速参考)

### 核心规则

- **必须** 使用 `<script setup lang="ts">`
- **禁止** 新增 Options API 代码
- **必须** 复杂逻辑抽取为 Composable
- **推荐** 宏定义顺序：`defineProps` → `defineEmits` → `defineExpose`
...
```

---

## 四、在 project-rules.md 中的引用

### 4.1 Layer 1 (Eager Load)

**Layer 1 规则直接嵌入 `project-rules.md`**:

```markdown
<!-- Rule: vue3-script-setup -->
# Vue 3 Component Structure & Script Setup

> Tags: #Vue3 #CompositionAPI #ScriptSetup
> Priority: High

## Summary (摘要)

Vue 3 组件必须使用 `<script setup lang="ts">` 编写...

## Quick Reference (快速参考)

### 核心规则

- **必须** 使用 `<script setup lang="ts">`
...
```

### 4.2 Layer 2/3 (Lazy Load)

**Layer 2/3 规则仅生成索引表**:

```markdown
# 📚 规则参考手册索引 (Rule Reference Index)
> 以下规则包含具体的技术栈实现细节（如 UI 库用法、特定任务流程）。
> **请按需读取**：当你的任务涉及以下领域时，请主动读取对应的本地文件。

| 规则名称 | 本地文件路径 (Local Path) | 说明 |
|---|---|---|
| **Refactoring Checklist** | `.codebuddy/rules_cache/layer3_action/refactoring.md` | 重构检查清单与策略。关注可读性、可测试性、代码整洁度。 |
| **Debugging Checklist** | `.codebuddy/rules_cache/layer3_action/debugging.md` | 调试检查清单与策略。涵盖数据流追踪、常见问题排查、调试工具推荐。 |
| **Testing Strategy** | `.codebuddy/rules_cache/layer3_action/testing.md` | 测试策略与检查清单。涵盖测试金字塔、优先级、常见模式。用于确定测试范围和验收标准。 |
| **Self-Verification Protocol** | `.codebuddy/rules_cache/layer3_action/self-verification.md` | AI 自我验证协议。RCI 递归批评改进、提交前检查清单、安全审查。 |
```

---

## 五、AI 如何使用缓存

### 5.1 智能激活流程

1. **AI 读取 `project-rules.md`**:
   - 获取 Layer 1 的核心原则 (已嵌入)
   - 看到 Layer 2/3 的索引表

2. **AI 识别任务类型**:
   - 例如: 用户说 "重构这个组件"
   - AI 识别为 `refactoring` 任务

3. **AI 查看相关性评分**:
   - `project-rules.md` 中包含任务激活策略
   - 例如: refactoring 任务的必读规则是 `layer3_action/refactoring.md`

4. **AI 主动读取缓存文件**:
   ```
   Read file_path=".codebuddy/rules_cache/layer3_action/refactoring.md"
   ```

5. **AI 应用规则执行任务**:
   - 根据 refactoring.md 中的检查清单进行重构
   - 确保符合规范

### 5.2 示例对话

**用户**: "帮我重构这个 Vue 组件，它太复杂了"

**AI 内部流程**:
1. 读取 `project-rules.md` → 看到 Layer 1 的 Vue 3 规范
2. 识别任务类型 → `refactoring`
3. 查看索引表 → 发现 `refactoring.md` 相关性 1.0
4. 主动读取 `.codebuddy/rules_cache/layer3_action/refactoring.md`
5. 应用重构检查清单进行重构

---

## 六、优势和设计理由

### 6.1 为什么需要缓存？

**问题**: 如果将所有规则内容嵌入 `project-rules.md`，文件会非常大 (可能 50-100 KB)，导致:
- AI 上下文窗口浪费
- 加载速度慢
- 不相关的规则也被加载

**解决方案**: Lazy Load 索引模式
- `project-rules.md` 只包含核心原则 (Layer 1) 和索引表
- 详细规则缓存到本地，AI 按需读取
- 文件体积控制在 12-19 KB

### 6.2 优势

| 优势 | 说明 |
|------|------|
| **减小文件体积** | project-rules.md 从 50+ KB 减小到 12-19 KB |
| **按需加载** | AI 只读取当前任务相关的规则 |
| **提高效率** | 减少 AI 上下文窗口浪费 |
| **支持远程拉取** | 缓存机制支持从 GitHub 等远程源拉取规则 |
| **本地可读** | 缓存文件是标准 Markdown，开发者可直接查看 |

### 6.3 设计理念

**渐进式披露 (Progressive Disclosure)**:
- **Level 1 (Summary)**: 仅摘要，快速浏览
- **Level 2 (Quick)**: 摘要 + 快速参考，日常开发
- **Level 3 (Full)**: 完整内容，深入学习

**三层架构**:
- **Layer 1 (Base)**: 核心原则，Eager Load (常驻内存)
- **Layer 2 (Business)**: 业务规则，Lazy Load (按需读取)
- **Layer 3 (Action)**: 任务清单，Lazy Load (按需读取)

---

## 七、缓存管理

### 7.1 缓存更新

**本地模式**:
- 每次运行 `npm run test:local` 时，自动从 `rules/` 目录复制最新规则到缓存

**远程模式**:
- 每次运行远程拉取时，自动从远程下载最新规则到缓存
- 例如: `npm run test:remote:github`

### 7.2 缓存清理

**手动清理**:
```bash
# 删除缓存目录
rm -rf .codebuddy/rules_cache

# 重新生成
npm run test:local
```

**自动清理**:
- 当前版本没有自动清理机制
- 建议: 定期清理缓存 (例如每周一次)

### 7.3 缓存位置

**固定路径**: `.codebuddy/rules_cache/`

**不可配置**: 缓存路径是硬编码的，无法通过配置文件修改

---

## 八、常见问题

### Q1: 为什么 Layer 1 也有缓存？

**A**: Layer 1 虽然是 Eager Load (嵌入 `project-rules.md`)，但也会缓存到 `rules_cache/layer1_base/`，原因:
- 统一管理所有规则文件
- 方便开发者直接查看完整规则
- 支持未来可能的动态加载需求

### Q2: 缓存文件会过期吗？

**A**: 当前版本没有缓存过期机制，每次运行规则加载器时会覆盖缓存文件。

### Q3: 可以手动编辑缓存文件吗？

**A**: 不建议。缓存文件会在下次运行时被覆盖。如果需要修改规则，应该修改源文件 (`rules/` 目录)。

### Q4: 缓存占用多少空间？

**A**: 当前项目约 50-100 KB，包含 10 个规则文件。

### Q5: 为什么 layer2_business 目录是空的？

**A**: 因为当前项目的 `package.json` 中没有检测到 `ant-design-vue` 或 `vant` 依赖，所以没有加载 Layer 2 的业务规则。

---

## 九、技术实现

### 9.1 核心代码

**缓存函数** (`rule-loader.ts:1122-1152`):

```typescript
async function cacheRuleFile(layerDir: string, subPath: string): Promise<string> {
  const fileName = path.basename(subPath);
  const cacheSubDir = path.join(localRulesCacheDir, layerDir);
  if (!fs.existsSync(cacheSubDir)) fs.mkdirSync(cacheSubDir, { recursive: true });

  const localCachePath = path.join(cacheSubDir, fileName);
  const relativeCachePath = `.codebuddy/rules_cache/${layerDir}/${fileName}`;

  if (ctx.isRemote) {
    // 远程下载
    const fileUrl = `${ctx.remoteBaseUrl}/rules/${layerDir}/${subPath}`;
    const content = await fetchUrl(fileUrl);
    fs.writeFileSync(localCachePath, content, 'utf-8');
    logVerbose(`Downloaded rule to cache: ${relativeCachePath}`);
  } else {
    // 本地复制
    const srcPath = path.join(RULES_ROOT, layerDir, subPath);
    fs.copyFileSync(srcPath, localCachePath);
    logVerbose(`Cached local rule: ${relativeCachePath}`);
  }
  return relativeCachePath;
}
```

### 9.2 处理流程

**Layer 1 (Eager Load)**:
```typescript
if (loadMode === 'eager') {
  // 提取精简内容嵌入 project-rules.md
  const filtered = extractContentByLevel(fullContent, 'quick');
  layerContent += `\n<!-- Rule: ${ruleName} -->\n${filtered}\n`;
}
```

**Layer 2/3 (Lazy Load)**:
```typescript
else {
  // 仅生成索引
  layerIndex += `| **${ruleName}** | \`${cachedPath}\` | ${description} |\n`;
}
```

---

## 十、总结

`rules_cache` 是规则加载器的**核心缓存机制**，实现了:

1. ✅ **Lazy Load 索引模式** - 减小 `project-rules.md` 体积
2. ✅ **按需读取** - AI 只读取当前任务相关的规则
3. ✅ **支持远程拉取** - 从 GitHub 等远程源下载规则
4. ✅ **本地可读** - 开发者可直接查看缓存文件
5. ✅ **统一管理** - 所有规则文件集中缓存

**设计理念**: 渐进式披露 + 三层架构 + Eager/Lazy 混合加载

**最佳实践**: 定期清理缓存，保持规则最新
