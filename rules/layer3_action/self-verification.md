---
name: Self-Verification Protocol
description: AI 自我验证协议。RCI 递归批评改进、提交前检查清单、安全审查。
---

# Self-Verification Protocol (自我验证协议)

> Layer: Action
> Context: AI 完成任务后的自我检查与验证机制

<!-- @level:summary -->
## Summary (摘要)

采用 **RCI 协议**（递归式自我批评与改进）：生成 → 审查 → 改进 → 再审查。所有关键变更必须经过人类审核确认，不应盲目信任任何生成的代码。

**核心检查项**：类型安全 → Lint 通过 → 构建成功 → 测试通过 → 安全审查

<!-- @level:quick -->
## Quick Reference (快速参考)

### 提交前必检清单

| 检查项 | 工具可用时 | 工具不可用时的替代 |
|--------|----------|----------------------|
| **Type Safety** | `tsc --noEmit` 无错误 | 人工确认无 `any`，类型定义完整 |
| **Lint Clean** | `npm run lint` 通过 | 人工核对 Layer 1 规范 |
| **Build Success** | `npm run build` 成功 | `npm run dev` 无报错 |
| **No Console** | ESLint 规则检测 | 全局搜索 `console.log` |
| **No TODO** | ESLint 规则检测 | 全局搜索 `// TODO` |

### RCI 自问清单

1. 这段代码是否解决了用户的实际问题？
2. 是否有更简洁的实现方式？
3. 代码是否易于理解和维护？
4. 是否遵循了项目的既有模式和规范？
5. 边界条件和错误处理是否完善？
6. 是否有潜在的性能问题？
7. 是否有安全隐患？
8. 如果 6 个月后回来看这段代码，能快速理解吗？

### 安全必检项

- [ ] **No Hardcoded Secrets**: 无硬编码的密钥、密码、Token
- [ ] **Input Validation**: 所有用户输入经过验证和转义
- [ ] **Safe Dependencies**: 依赖包无已知安全漏洞 (`npm audit`)

<!-- @level:full -->
## 1. Philosophy (核心理念)

### Recursive Criticism and Improvement (RCI 协议)
采用递归式自我批评与改进策略：**生成 → 审查 → 改进 → 再审查**，直到满足质量标准。

### Human-in-the-Loop (人类终审)
AI 是助手而非决策者。所有关键变更必须经过人类审核确认。

### Trust but Verify (信任但验证)
不应盲目信任任何生成的代码。每次变更后必须通过工具验证。

---

## 2. Verification Lifecycle (验证生命周期)

```text
┌─────────────────────────────────────────────────────────────────┐
│                        任务生命周期                              │
├─────────┬─────────┬─────────┬─────────┬─────────┬──────────────┤
│  理解   │  计划   │  实现   │  验证   │  审查   │    交付      │
│ (Plan)  │(Design) │ (Code)  │(Verify) │(Review) │  (Deliver)   │
├─────────┼─────────┼─────────┼─────────┼─────────┼──────────────┤
│ □ 需求  │ □ 方案  │ □ 编码  │ □ 类型  │ □ 自查  │ □ 人类确认   │
│   确认  │   设计  │   实现  │   检查  │   回顾  │              │
│ □ 边界  │ □ 影响  │ □ 规范  │ □ Lint  │ □ 安全  │ □ 文档更新   │
│   明确  │   评估  │   遵循  │   通过  │   审查  │              │
│         │         │         │ □ 构建  │ □ 回归  │              │
│         │         │         │   成功  │   检查  │              │
└─────────┴─────────┴─────────┴─────────┴─────────┴──────────────┘
```

---

## 3. Pre-Commit Checklist (提交前检查清单)

### 3.0 Tool Availability Check (工具存在性检测) ⚠️ 必读

> [!IMPORTANT]
> 在执行验证命令前，**必须先检查目标项目是否具备相应工具**。工具缺失时不应跳过验证，而是采用替代方案。

**检测方法**：查看目标项目的 `package.json` 中的 `devDependencies` 和 `scripts`。

| 工具 | 检测依赖 | 检测脚本 | 若缺失的替代方案 |
|------|----------|----------|----------------------|
| TypeScript | `typescript` in devDeps | `scripts.typecheck` | 人工检查类型定义，确认无 `any` |
| ESLint | `eslint` in devDeps | `scripts.lint` | 人工检查代码规范，参考 Layer 1 规则 |
| Prettier | `prettier` in devDeps | - | 检查缩进和格式一致性 |
| 测试框架 | `vitest`/`jest` in devDeps | `scripts.test` | 手动功能验证 |
| 构建工具 | `vite`/`webpack` in devDeps | `scripts.build` | 确认无语法错误 |

### 3.1 Static Analysis (静态分析)

**执行顺序**：先检测 → 再执行 → 无法执行时采用替代方案

```bash
# ✅ 有 TypeScript 时：类型检查
# 前置检测：package.json 中存在 "typescript" 依赖
npx tsc --noEmit

# ❌ 无 TypeScript 时：替代方案
# → 人工检查：确认变量命名清晰，无隐式类型转换
```

```bash
# ✅ 有 ESLint 时：代码规范检查
# 前置检测：package.json 中存在 "eslint" 依赖 或 scripts.lint
npm run lint
# 或
npx eslint . --ext .ts,.tsx,.vue

# ❌ 无 ESLint 时：替代方案
# → 人工检查：参照 Layer 1 规范逐项核对
```

```bash
# ✅ 有 Prettier 时：格式化检查
# 前置检测：package.json 中存在 "prettier" 依赖
npx prettier --check "src/**/*.{ts,tsx,vue}"

# ❌ 无 Prettier 时：替代方案
# → 人工检查：确认缩进、空格、引号风格一致
```

### 3.2 Build Verification (构建验证)

```bash
# ✅ 有 build 脚本时
# 前置检测：package.json 中存在 scripts.build
npm run build

# ❌ 无 build 脚本时：替代方案
# → 运行开发服务器确认无报错：npm run dev
# → 或人工确认：无语法错误、导入路径正确
```

### 3.3 Mandatory Checklist (必检项 - 根据工具可用性调整)

> [!CAUTION]
> **不得跳过任何检查项**。工具不可用时必须采用替代方案。

| 检查项 | 工具可用时 | 工具不可用时的替代 |
|--------|----------|----------------------|
| **Type Safety** | `tsc --noEmit` 无错误 | 人工确认无 `any`，类型定义完整 |
| **Lint Clean** | `npm run lint` 通过 | 人工核对 Layer 1 规范 |
| **Build Success** | `npm run build` 成功 | `npm run dev` 无报错 |
| **No Console** | ESLint 规则检测 | 全局搜索 `console.log` |
| **No TODO** | ESLint 规则检测 | 全局搜索 `// TODO` |

---

## 4. Post-Change Verification (变更后验证)

### 4.1 Functional Verification (功能验证)

```bash
# ✅ 有测试框架时
# 前置检测：package.json 中存在 "vitest"/"jest" 或 scripts.test
npm run test

# ❌ 无测试框架时：替代方案
# → 手动验证：执行主要功能流程，确认无异常
```

*   [ ] **Unit Tests**: 相关单元测试全部通过 (或手动验证核心逻辑)
*   [ ] **Manual Test**: 手动验证核心功能正常
*   [ ] **Edge Cases**: 验证边界条件处理正确

### 4.2 Regression Check (回归检查)

*   [ ] **Existing Features**: 现有功能未被破坏
*   [ ] **Dependencies**: 依赖此模块的其他模块正常工作
*   [ ] **API Contract**: 对外接口未发生 Breaking Change

### 4.3 Performance Sanity (性能检查)

*   [ ] **Bundle Size**: 构建产物大小未显著增加
*   [ ] **No Memory Leak**: 无明显的内存泄漏风险
*   [ ] **No N+1**: 无 N+1 查询或循环调用问题

---

## 5. Security Review (安全审查)

### 5.1 Common Vulnerabilities Checklist (常见漏洞检查)

| 漏洞类型 | 检查点 | 示例 |
|----------|--------|------|
| **XSS** | 用户输入是否经过转义？ | `v-html` 使用需审慎 |
| **Injection** | 动态拼接的内容是否安全？ | 避免 `eval()`、`innerHTML` |
| **Exposure** | 敏感信息是否暴露？ | API Key、密码不可硬编码 |
| **CSRF** | 表单提交是否有 Token 保护？ | 关键操作需 CSRF Token |
| **Auth** | 权限检查是否完整？ | 路由守卫、API 鉴权 |

### 5.2 Security Checklist (安全必检项)

*   [ ] **No Hardcoded Secrets**: 无硬编码的密钥、密码、Token
*   [ ] **Input Validation**: 所有用户输入经过验证和转义
*   [ ] **Safe Dependencies**: 依赖包无已知安全漏洞 (`npm audit`)
*   [ ] **HTTPS Only**: 所有外部请求使用 HTTPS
*   [ ] **Auth Required**: 敏感操作有权限验证

---

## 6. Self-Critique Protocol (自我批评协议)

### 6.1 RCI Iteration (递归改进迭代)

完成代码后，问自己以下问题：

```
┌────────────────────────────────────────────────────────────┐
│                     RCI 自问清单                            │
├────────────────────────────────────────────────────────────┤
│ 1. 这段代码是否解决了用户的实际问题？                          │
│ 2. 是否有更简洁的实现方式？                                   │
│ 3. 代码是否易于理解和维护？                                   │
│ 4. 是否遵循了项目的既有模式和规范？                           │
│ 5. 边界条件和错误处理是否完善？                               │
│ 6. 是否有潜在的性能问题？                                    │
│ 7. 是否有安全隐患？                                         │
│ 8. 如果 6 个月后回来看这段代码，能快速理解吗？                  │
└────────────────────────────────────────────────────────────┘
```

### 6.2 Improvement Actions (改进动作)

如果上述任一问题答案为"否"，执行对应改进：

| 问题 | 改进动作 |
|------|----------|
| 未解决实际问题 | 重新理解需求，与用户确认 |
| 有更简洁方式 | 重构代码，消除冗余 |
| 难以理解 | 添加注释、重命名变量、拆分函数 |
| 未遵循规范 | 参照 Layer 1 基础规范修正 |
| 边界处理不完善 | 添加校验、错误处理逻辑 |
| 性能问题 | 优化算法、减少渲染、懒加载 |
| 安全隐患 | 参照本规则 Section 5 修复 |
| 难以回顾 | 添加文档或改进代码结构 |

---

## 7. Verification Commands Reference (验证命令参考)

> [!TIP]
> 执行前请先检查 `package.json`，确认工具可用。不可用时使用替代方案。

```bash
# ============ 完整验证流程 (根据工具可用性执行) ============

# Step 1: 类型检查 (需要 typescript)
# 检测: grep '"typescript"' package.json
npx tsc --noEmit
# 替代: 人工检查类型定义

# Step 2: 代码规范 (需要 eslint)
# 检测: grep '"eslint"' package.json 或 scripts.lint 存在
npm run lint
# 替代: 人工核对 Layer 1 规范

# Step 3: 格式化 (需要 prettier)
# 检测: grep '"prettier"' package.json
npx prettier --write "src/**/*.{ts,tsx,vue}"
# 替代: 人工检查格式一致性

# Step 4: 单元测试 (需要 vitest/jest)
# 检测: scripts.test 存在
npm run test
# 替代: 手动功能验证

# Step 5: 构建验证 (需要 scripts.build)
# 检测: scripts.build 存在
npm run build
# 替代: npm run dev 无报错

# Step 6: 安全审计 (始终可用)
npm audit
```

### 快速验证脚本 (可复制使用)

```bash
# 通用快速验证 - 根据项目实际配置调整
# Windows PowerShell:
if (npm run lint) { npm run build }

# Unix/Mac:
npm run lint && npm run build
```

---

## 8. Metadata

*   **Version**: 1.0
*   **Related Rules**: `testing.md`, `debugging.md`, `refactoring.md`
*   **Inspired By**: Cursor Pre-PR Self-Review, Claude RCI Protocol, Copilot Security Scanning, Devin Execution Plan Review
