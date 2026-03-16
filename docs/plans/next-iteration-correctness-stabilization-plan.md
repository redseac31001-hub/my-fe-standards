---
title: 下一迭代正确性与稳定性收敛计划
date: 2026-03-11
source: docs/bright-shimmying-wand.md
---

# 下一迭代正确性与稳定性收敛计划

目标：基于当前评审结论，把下一迭代收敛到“功能正确 + 主链路可回归 + 测试重新可用”三个结果，不在本迭代内扩展新能力，也不把大规模重构混入执行范围。

## 2026-03-12 执行结果补记

本计划对应的问题在 `2026-03-12` 已取得以下收敛结果：

1. 正确性修复已落地并回归通过：
   - `AgentRuntime` 已按安装产物优先读取 `.codebuddy/rules_cache/...`
   - `mcp-server` 已修复 ESM / `__dirname` 兼容性
   - 已补充最小回归测试，覆盖上述两类缺陷，以及脚本分发时必须包含运行时 `lib/*` 依赖
2. 主测试链路已恢复：
   - `npm run build` 通过
   - `npm run test:correctness` 通过
   - `npm run test:full` 通过
3. `2026-03-11` 记录的 `9/9` 失败，在 `2026-03-12` 复盘后确认当前稳定根因不是 `EPERM`，而是业务项目中的 `.codebuddy/scripts/*.js` 缺少一并分发的 `scripts/dist/lib/*.js` 运行时依赖，导致 `MODULE_NOT_FOUND`
4. `mcp-server` 依赖基线问题仍单独存在：
   - `npm run doctor:mcp-server-deps` 仍会提示 `needs_attention`
   - 该问题与当前 loader / orchestrator 主链路测试恢复相互独立
   - 在离线环境下不能可靠模拟“干净安装 + 正确 lockfile 刷新”，应在正常联网环境执行 `cd mcp-server && npm install` 后提交新的 `package-lock.json`

结论：

- 本迭代关于“功能正确 + 主链路可回归 + 测试重新可用”的目标已达成
- `mcp-server` 依赖基线刷新应作为后续独立收尾项处理，而不是继续阻塞当前主链路迭代

## 迭代原则

1. 先修正确性缺陷，再谈工程债务。
2. 先恢复主测试链路，再启动大规模拆分。
3. 本迭代只做最小必要测试补强，不做测试体系全面迁移。
4. 不为了兼容当前错误契约去复制或绕过问题。

## 本迭代范围

本计划只覆盖：

- `AgentRuntime` 规则读取路径修正
- `mcp-server` 的 ESM / `__dirname` 兼容性修正
- 针对上述缺陷的最小回归测试
- `EPERM` / 安装快照写入问题定位与修复
- `node test/run-tests.js` 主链路恢复

本计划不覆盖：

- `Vitest` 全面引入
- `codebuddy-loader.ts` / `task-executor.ts` / `taskbook-manager.ts` 大规模拆分
- 日志系统统一
- Content Pack 按技术栈分包
- `Context` 接口重构
- Worker / Model Router 新能力扩展

## 修正后的事实基线

1. 当前仓库构建可通过：
   - `npm run build`
2. `2026-03-11` 的历史基线曾出现主测试链路未恢复：
   - `node test/run-tests.js` 在 `2026-03-11` 的当前 Windows 工作区实测为 `9/9` 失败
3. `2026-03-12` 的当前基线已恢复主测试链路：
   - `npm run test:correctness` 通过
   - `npm run test:full` 通过
4. 已定位的高优先级正确性问题：
   - `AgentRuntime` 仍从 `projectRoot/rules/...` 读取规则，而业务项目实际安装规则位于 `.codebuddy/rules_cache/...`
   - `mcp-server` 为 ESM 包，但 `mcp-server/src/index.ts` 仍使用 `__dirname`
5. 对主链路失败根因的最终收敛结果：
   - 当前稳定复现并已修复的根因，是业务项目内 `.codebuddy/scripts/*.js` 缺少随分发一并带上的 `scripts/dist/lib/*.js` 运行时依赖
6. 已复现但未在 `2026-03-12` 当前链路中继续阻塞的历史症状：
   - 创建 `.codebuddy/skill-snapshots/...` 时曾出现 `EPERM`

## 总体策略

按“最小改动恢复正确性”推进：

1. 先修最明确的功能缺陷
2. 再补最小回归测试，钉住已修问题
3. 再做 `EPERM` 根因收敛和主测试恢复
4. 最后输出下一迭代后的进入条件，决定是否进入 Vitest / 模块拆分阶段

## Phase 0：基线固化

### 目标

把本迭代开始前的失败状态、复现步骤和受影响路径固化清楚，避免边修边漂移。

### 改动

- 记录当前 `build` / `run-tests` 结果
- 记录 `AgentRuntime` 规则读取当前路径与安装产物路径
- 记录 `mcp-server` 的 ESM 运行前提
- 记录 `EPERM` 复现命令、路径和错误信息

### 涉及文件

- `docs/bright-shimmying-wand.md`
- 本计划文档

### 完成标准

- 每个高优先级问题都有可复现描述
- 已知哪些是“确定 bug”，哪些只是“已复现症状”

### 回退点

- 文档阶段，无代码回退成本

## Phase 1：修复 AgentRuntime 规则路径一致性

### 目标

让 Agent 在业务项目中能读取到“实际安装后的规则”，而不是继续依赖源仓库目录。

### 改动

1. 调整 `AgentRuntime.loadDeclaredRules()` 的规则搜索路径：
   - 优先读取安装产物目录
   - 与 loader 生成的 `.codebuddy/rules_cache/...` 结构对齐
2. 明确规则搜索顺序，避免根目录 `rules/` 抢占已安装规则
3. 不新增“把规则复制回业务项目根目录 `rules/`”的兼容方案

### 涉及文件

- `scripts/src/agent-runtime.ts`
- 如有必要：`scripts/src/lib/install-roots.ts`
- 如有必要：`scripts/src/codebuddy-loader.ts`

### 验收标准

- 在业务项目目录下，Agent 能读取到其声明依赖的已安装规则
- 不依赖业务项目根目录存在 `rules/`
- 不引入第二套规则来源

### 风险

- 规则目录映射理解不完整会导致部分 Agent 仍回退到旧路径

### 回退点

- 仅回退 `AgentRuntime` 规则搜索顺序与路径映射变更

## Phase 2：修复 MCP ESM 兼容性

### 目标

让 `mcp-server` 在其 ESM 运行模型下按预期启动和执行本地脚本定位逻辑。

### 改动

1. 替换 `__dirname` 用法：
   - `import.meta.url`
   - `fileURLToPath`
   - `dirname`
2. 核对脚本路径解析逻辑在 ESM 下仍指向正确的 `scripts/dist/*`
3. 保持现有 MCP 工具契约不变

### 涉及文件

- `mcp-server/src/index.ts`

### 验收标准

- `mcp-server` 在 ESM 模式下启动不报 `ReferenceError: __dirname is not defined`
- `analyze_project_structure` 相关脚本路径可正确解析

### 风险

- Windows 路径与 URL 转换细节可能引入新问题

### 回退点

- 仅回退 ESM 路径解析改动

## Phase 3：补最小回归测试

### 目标

针对已知缺陷建立最小保护网，防止刚修完又回归。

### 改动

1. 为 AgentRuntime 规则路径修复增加 1-2 个精确测试
2. 为 MCP ESM 启动 / 路径解析增加 1-2 个精确测试
3. 测试形式优先选择简单 Node 脚本或现有测试体系可接入方式
4. 本阶段不要求引入 `Vitest`

### 涉及文件

- `test/` 下新增或调整最小测试脚本
- 如有必要：`mcp-server/package.json`

### 验收标准

- 已修缺陷都有对应回归 case
- 回归 case 可在当前仓库环境下单独运行

### 风险

- 若一开始就强行引入新测试框架，会把“修缺陷”变成“做平台工程”

### 回退点

- 测试脚本独立回退，不影响主逻辑

## Phase 4：定位并修复 EPERM，恢复主测试链路

### 目标

明确 `EPERM` 的真实根因，并恢复 `node test/run-tests.js` 主链路。

### 改动

1. 缩小复现范围：
   - 是目录创建权限问题
   - 是 snapshot 命名 / 清理策略问题
   - 是工作区已有脏状态叠加问题
2. 修复 `skill-snapshots` / `agent-snapshots` 相关写入路径问题
3. 重新运行主测试链路，验证是否由单点故障导致连锁失败

### 涉及文件

- `scripts/src/codebuddy-loader.ts`
- 如有必要：`scripts/src/lib/install-sync.ts`
- 如有必要：`scripts/src/lib/install-roots.ts`
- `test/run-tests.js`

### 验收标准

- `EPERM` 问题有明确根因说明
- `node test/run-tests.js` 不再卡在当前已复现的 snapshot 写入错误
- 主测试链路恢复到可继续收敛的状态

### 风险

- `9/9` 失败可能不止一个根因
- Windows 工作区环境因素可能与代码问题叠加
- `mcp-server` 当前缺少独立 `package-lock.json`，且本地已安装依赖与 `package.json` 存在漂移；在离线环境下不适合强行补锁文件，应在正常联网环境先刷新依赖基线
- 已补充 `npm run doctor:mcp-server-deps` 用于显式暴露这类依赖漂移，避免继续隐性依赖本地脏 `node_modules`

### 2026-03-12 收尾说明

- 本阶段已达到“主测试链路恢复”目标
- 当前可稳定归因并已修复的问题，是 `.codebuddy/scripts` 分发遗漏运行时 `lib/*` 依赖，而不是继续稳定复现 `EPERM`
- `mcp-server` 依赖基线漂移保留为独立收尾项：若当前工作不涉及 MCP Server，可暂不阻塞主链路；若准备交接、发布或直接使用 MCP Server，则必须先在联网环境刷新依赖基线

### 回退点

- 将 snapshot 写入修复保持为最小差异，避免同时触碰大规模分发逻辑

## Phase 5：迭代收尾与下一阶段准入判断

### 目标

在本迭代结束时明确“是否可以进入 Vitest / 模块拆分阶段”。

### 产出

1. 一份缺陷修复结果记录
2. 一份测试恢复结果记录
3. 下一阶段是否启动的 Go / No-Go 结论

### Go 条件

满足以下条件，才进入下一迭代的工程治理阶段：

1. `AgentRuntime` 规则路径问题已修复并有回归保护
2. `mcp-server` ESM 兼容问题已修复并有回归保护
3. `EPERM` 根因已明确，主测试链路恢复到可接受状态
4. 没有通过“复制规则到错误路径”之类的临时兼容方案来掩盖问题

否则：

- 不进入大规模重构
- 继续收敛正确性和测试稳定性

## 推荐执行顺序

1. Phase 0：基线固化
2. Phase 1：修复 AgentRuntime 规则路径
3. Phase 2：修复 MCP ESM 兼容性
4. Phase 3：补最小回归测试
5. Phase 4：修复 EPERM 并恢复主测试链路
6. Phase 5：收尾与准入判断

## 最终交付物

完成后应至少产出：

1. 可工作的 AgentRuntime 规则读取路径
2. 可在 ESM 模式下启动的 `mcp-server`
3. 3-5 个针对缺陷的最小回归用例
4. 一份 `EPERM` 根因与修复记录
5. 一份主测试链路恢复结果
6. 下一阶段 Go / No-Go 结论
