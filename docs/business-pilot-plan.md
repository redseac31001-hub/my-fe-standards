---
title: 业务项目试点验证方案（Go / No-Go）
date: 2026-03-07
---

# 业务项目试点验证方案（Go / No-Go）

目标：把当前仓库的“仓库内回归通过”推进到“真实业务项目可控试点”，并明确什么情况下继续扩展，什么情况下暂停收敛。

适用场景：

- 已确认 `my-fe-standards` 本仓库构建与回归通过
- 准备在 1 个真实业务前端项目中验证 remote/load/analyze/workflow 闭环
- 希望先做低风险试点，而不是直接全量推广

## 1. 试点项目选择

优先选择满足以下条件的业务项目：

1. 有稳定 `npm test` 和 `npm run build`
2. 项目规模中等，依赖关系真实，但不是最高风险核心链路
3. 有明确项目负责人，能配合处理接入问题
4. 允许在项目根目录生成 `.codebuddy/`
5. 网络可访问远程规则源，或能使用本地/内网部署模式

不建议首轮试点选择：

- 没有测试和构建脚本的仓库
- 发布窗口中的核心交易链路项目
- 多人同时大规模改造中的高波动仓库

## 2. 入场前置条件

在开始前，先确认：

1. 固定 `my-fe-standards` 使用的 commit / tag，避免试点期间规则源漂移
2. 业务项目当前主干可正常安装依赖、运行测试、执行构建
3. 已指定试点负责人：
   - 平台侧 1 人
   - 业务侧 1 人
4. 明确本轮试点范围只验证“小需求闭环”或“受控重构闭环”
5. 约定保留试点证据：
   - `.codebuddy/reports/taskbooks/*.acceptance.json`
   - `.codebuddy/reports/metrics/latest-summary.json`
   - 接入日志和异常清单

## 3. 推荐执行顺序

### Phase A：接入与安装验证

在业务项目根目录执行：

```bash
npm run remote
```

若业务项目未封装脚本，则直接执行：

```bash
curl -fsSL <loader-bundle-url> | node - --remote <rules-base-url> --profile analysis
```

通过标准：

- `.codebuddy/rules/project-rules.md` 生成成功
- `.codebuddy/install.json` 存在
- `.codebuddy/scripts/`、`.codebuddy/workflows/`、`.codebuddy/taskbooks/` 结构完整
- 未修改业务源码，仅生成 `.codebuddy/` 和 `.gitignore` 相关内容

### Phase B：分析链路验证

执行：

```bash
node .codebuddy/scripts/contract-validator.js --workflows --taskbooks
node .codebuddy/scripts/structure-analyzer.js .
node .codebuddy/scripts/module-mapper.js .
node .codebuddy/scripts/report-manager.js status
```

通过标准：

- 契约校验通过
- 能产出 architecture / modules / health 报告
- 分析脚本耗时可接受，且不会阻塞正常开发

### Phase C：单需求闭环验证

建议选择一个小而完整的真实需求，例如：

- 一个已知小 Bug 修复
- 一个低风险页面字段调整
- 一个局部组件重构

执行路径：

```bash
node .codebuddy/scripts/taskbook-manager.js create --title "业务试点验证" --description "真实业务试点" --type refactoring
node .codebuddy/scripts/taskbook-manager.js add-task <taskBookId> --title "生成架构/模块报告" --type analysis
node .codebuddy/scripts/taskbook-manager.js add-task <taskBookId> --title "实现小范围真实改动" --type implement --files "src/..." --modules "feature/..."
node .codebuddy/scripts/taskbook-manager.js confirm <taskBookId>
node .codebuddy/scripts/task-executor.js <taskBookId>
node .codebuddy/scripts/taskbook-manager.js report <taskBookId> --write
```

通过标准：

- TaskBook 能正常创建、确认、推进、生成验收报告
- 若进入 `blocked`，能通过 `unblock` 或补充 `result.json` 后恢复
- `full_passed` 或团队等价 gate 能给出可信结果

### Phase D：重复安装与恢复验证

至少再执行一次安装更新：

```bash
npm run remote
```

并验证：

- `.codebuddy/install.json` 正常更新
- 不会破坏已有业务代码
- 已生成的 reports / taskbooks / metrics 可继续读取

## 4. Go / No-Go 判定

满足以下全部条件，可进入下一批业务项目：

1. 安装链路稳定：
   - 同一业务项目至少成功安装 2 次
2. 分析链路稳定：
   - `structure-analyzer`、`module-mapper`、`report-manager` 均可执行
3. 闭环链路稳定：
   - 至少 1 个真实小需求完成从 TaskBook 到 acceptance report 的闭环
4. 风险可控：
   - 未出现误改业务源码
   - 未出现无法恢复的阻塞状态
5. 证据完整：
   - 验收报告、metrics、问题清单都已留存

出现以下任一情况，判定 `No-Go`，先暂停扩展：

1. 重复安装会破坏业务项目已有 `.codebuddy/` 状态
2. gate 命令与业务项目实际脚本长期不匹配，导致闭环不可用
3. `task-executor` 高频卡在人工恢复且原因不清晰
4. remote 拉取不稳定，content pack / fallback 经常失败
5. 业务方无法从报告和执行结果中获得可用价值

## 5. 试点产出物

首轮试点结束后，建议至少沉淀以下内容：

1. 业务项目基本信息：
   - 项目名
   - 技术栈
   - Node / npm 版本
2. 安装方式：
   - remote / local / intranet
   - profile 类型
3. 验证结果：
   - 安装是否通过
   - 分析是否通过
   - 单需求闭环是否通过
4. 关键证据文件路径
5. 问题分类：
   - 接入问题
   - workflow/gate 问题
   - 业务项目脚本问题
   - AI 执行质量问题
6. 下一步建议：
   - 扩大试点
   - 收敛修复
   - 暂停推广

## 6. 推荐的首轮边界

首轮试点建议控制在：

- 1 个业务项目
- 1 个小需求或 1 个小范围重构
- 0.5 到 1 个工作日内完成

不要在首轮同时验证：

- 多项目 Workspace
- 大型跨模块改造
- 高风险发布场景
- 多模型路由策略

## 7. 配套文档

- 接入细节：`docs/business-project-guide.md`
- 远程模式：`docs/remote-usage-guide.md`
- 端到端验收：`docs/e2e-validation-playbook.md`
- Workflow 说明：`docs/workflows-guide.md`
- Worker 自动执行：`docs/worker-executor.md`
- 执行指标：`docs/execution-metrics.md`
- TaskBook 并发协作：`docs/taskbook-collaboration-sop.md`
