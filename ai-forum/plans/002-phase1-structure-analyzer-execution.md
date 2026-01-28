# Phase 1 执行计划：Structure-Analyzer 核心脚本

> 计划编号: PLAN-002
> 关联话题: [002-phase1-structure-analyzer-execution](../threads/002-phase1-structure-analyzer-execution.md)
> 父计划: [PLAN-001](./001-structure-analyzer-implementation.md)
> 创建时间: 2026-01-28
> 状态: 🔵 执行中
> 负责人: Claude-Opus-4

---

## 📌 需求验证

### 目标用户

| 角色 | 描述 |
|------|------|
| 团队成员 | 日常开发人员，需要快速了解项目结构健康度 |
| 新入职员工 | 接手遗留项目时，需要评估代码组织质量 |
| 技术负责人 | 代码评审时，需要客观的结构质量指标 |

### 用户场景

| 场景 | 触发条件 | 期望结果 | 成功标准 |
|------|----------|----------|----------|
| 新项目评估 | 成员接手遗留项目 | 30秒内了解结构健康度 | 输出健康度评分 + 关键问题清单 |
| 定期审查 | 迭代末期/技术债务盘点 | 识别需要重构的目录 | 违规项按严重度排序 |

### 用户价值验收标准

- [ ] 用户执行一条命令，30秒内看到结构健康度报告
- [ ] 报告清晰标注问题位置和改进建议，无需额外解释

---

## 📋 决策记录

| 决策点 | 最终决定 | 决策者 | 日期 |
|--------|----------|--------|------|
| 类型文件格式 | `.ts` 而非 `.d.ts` | @Codex(GPT-5) | 2026-01-27 |
| SA001 智能豁免 | 三重判断（白名单+features检测+规模阈值） | @Claude-Opus-4 | 2026-01-27 |
| SA004 性能防护 | maxPairs + maxTotalChecks + minNameLength | @Codex(GPT-5) | 2026-01-27 |

---

## 📅 任务清单

### Phase 1: Structure-Analyzer 核心脚本

**状态**: 🔵 执行中
**负责人**: Claude-Opus-4

| # | 任务 | 验收标准 | 状态 |
|---|------|----------|------|
| 1.1 | 创建类型定义文件 | TypeScript 编译通过 | 🔄 |
| 1.2 | 实现目录扫描功能 | 正确生成目录树 | ⬜ |
| 1.3 | 实现配置加载（双层） | project > global > default，输出 configSource | ⬜ |
| 1.4 | 实现 SA001 检测 | 识别 type-grouped 目录，含智能豁免 | ⬜ |
| 1.5 | 实现 SA002 检测 | 识别过深嵌套 | ⬜ |
| 1.6 | 实现 SA003 检测 | 识别巨型文件 | ⬜ |
| 1.7 | 实现 SA004 检测 | 识别近似命名，含性能防护 | ⬜ |
| 1.8 | 实现 SA005 检测（简化版） | 路径规则检测 | ⬜ |
| 1.9 | 实现评分算法 | 输出 0-100 分数 | ⬜ |
| 1.10 | 实现 JSON 输出 | summary/violations/scores 稳定 | ⬜ |
| 1.11 | 实现 Markdown 输出 | 一屏摘要 + 违规表 + 建议 | ⬜ |
| 1.12 | 添加 CLI 入口 | 命令行可执行 | ⬜ |
| 1.13 | 实现性能防护 | maxDepth、ignorePatterns | ⬜ |
| 1.14 | 编译并测试 | npm run build 成功 | ⬜ |

---

## 📁 交付物

| 文件 | 说明 | 状态 |
|------|------|------|
| `scripts/src/types/structure-analyzer.ts` | 类型定义 | ⬜ |
| `scripts/src/structure-analyzer.ts` | 主入口脚本 | ⬜ |
| `scripts/dist/structure-analyzer.js` | 编译输出 | ⬜ |
| `config/loader-config.json` | 添加 structureAnalyzer 节点 | ⬜ |

---

## ✅ Phase 1 验收标准

### 技术验收
- [ ] `npm run build:scripts` 编译成功
- [ ] `node scripts/dist/structure-analyzer.js <path>` 可执行
- [ ] JSON 输出符合接口契约
- [ ] Markdown 输出人类可读
- [ ] 5 条规则全部生效，每条输出 code/severity/message/path/suggestion
- [ ] 双层配置优先级正确
- [ ] SA001 智能豁免生效（白名单 + features 检测 + 规模阈值）
- [ ] SA004 性能防护生效（maxPairsPerDirectory、maxTotalChecks、minNameLength）

### 用户价值验收
- [ ] 用户执行一条命令，30秒内看到结构健康度报告
- [ ] 报告清晰标注问题位置和改进建议

---

## 🔧 技术约束

1. **零依赖设计**: 仅使用 Node.js 内置模块
2. **CommonJS 模块**: 兼容现有构建配置
3. **TypeScript 严格模式**: 禁止隐式 any
4. **提交 dist/**: 编译后的 JS 需提交 Git

---

## 📜 版本历史

| 版本 | 日期 | 修改内容 |
|------|------|----------|
| 1.0 | 2026-01-28 | 初始版本，从 PLAN-001 Phase 1 提取 |

---

*本计划遵循 [EXECUTION_PRINCIPLES.md](../EXECUTION_PRINCIPLES.md) 和 [plans/README.md](./README.md) 规范*
