# agency-agents 项目架构借鉴分析

## Context

用户希望学习 `E:\mygit\agency-agents` (The Agency) 项目的设计与架构，分析对当前项目 `E:\mygit\my-fe-standards` 的可借鉴价值。这是一份**分析报告**，而非实施计划——重点在于识别差异和机会，供用户决策后续行动。

---

## 两个项目的定位差异

| 维度 | agency-agents | my-fe-standards |
|------|---------------|-----------------|
| 定位 | 通用 AI 代理库（142+ 代理，12 业务部门） | 前端架构师规则库 + CodeBuddy GLM 知识源 |
| 技术栈 | Markdown + YAML + Bash (POSIX) | TypeScript + Node.js + npm |
| 依赖 | 绝对零依赖（纯文件复制） | 运行时零依赖（编译后 JS） |
| 分发目标 | 10 种 AI 编程工具 | 1 种（CodeBuddy GLM） |
| 执行能力 | 无（纯 prompt 指令） | 有（task-executor / contract-validator 脚本层） |

---

## 可借鉴的 10 个维度

### P1 - 近期高价值（投入产出比最高）

#### 1. 完整执行示例和场景化 Runbook

**差距**：agency-agents 有 `examples/` 目录（6 个完整工作流示例，其中 `nexus-spatial-discovery.md` 长达 853 行展示 8 个代理并行协作），还有 4 个场景化 runbook。my-fe-standards 文档丰富但**缺少端到端的执行示例**。

**建议**：
- 创建 `examples/` 目录，添加 2-3 个完整 TaskBook 执行记录
- 创建 `docs/runbooks/` 场景指南（功能开发、遗留重构、生产排查）
- 难度：低 | 纯文档工作，但能极大提升用户理解和采纳

#### 2. 多档工作流模板

**差距**：NEXUS 有 Full/Sprint/Micro 三档部署模式，my-fe-standards 只有一个 `default.workflow.json`（7 步完整流程）。小任务被迫走全流程。

**建议**：
- 新增 `micro.workflow.json`（3 步：Plan > Implement > Verify）
- 新增 `sprint.workflow.json`（5 步：Analyze > Plan > Implement > Review > Accept）
- 保留 `default.workflow.json` 作为 full 模式
- 难度：中 | 需修改 task-executor 的工作流解析逻辑

#### 3. 标准化代理间交接模板

**差距**：agency-agents 有 7 种标准化交接模板（`handoff-templates.md`），确保"不允许任何代理冷启动"。my-fe-standards 的代理间通过 TaskBook `actualWork` 字段传递上下文，缺少显式的交接元数据。

**建议**：
- 移植 Standard Handoff / QA Pass / QA Fail / Escalation 四种模板
- 在 TaskBook schema 中增加 `handoffs[]` 数组
- 难度：低 | 主要是 Markdown 模板 + schema 微调

#### 4. 多工具分发（SSMO 转换层）

**差距**：agency-agents 的 `convert.sh`（537 行）将统一 Markdown 源转换为 10 种工具格式。my-fe-standards 仅支持 CodeBuddy GLM。

**建议**：
- 设计 `tool-converter.ts`，复用现有 frontmatter 解析逻辑
- 优先支持 Claude Code（frontmatter 几乎兼容）> Cursor（.mdc 格式）
- 难度：中 | 核心参考文件：`agency-agents/scripts/convert.sh`

### P2 - 中期改进

#### 5. 代理人格化设计增强

**差距**：agency-agents 的代理有强个性（`emoji`/`vibe`/Communication Style/Success Metrics），my-fe-standards 偏功能描述。

**建议**：为 10 个代理补充 `emoji`/`vibe` frontmatter 字段、沟通风格和量化成功指标

#### 6. 分发后快速启动指南

**差距**：NEXUS 的 `QUICKSTART.md` 提供即用型 prompt 模板。my-fe-standards 安装完成后缺少类似引导。

**建议**：分发完成后自动生成 QUICKSTART.md，包含该档位可用的操作和 prompt 模板

#### 7. 工具检测逻辑（如果做多工具分发）

**建议**：在 `project-detection.ts` 中扩展检测 `~/.claude/`、`.cursor/`、`.windsurf` 等目录

### P3 - 远期考虑

#### 8. 代理内容完整性 Lint

my-fe-standards 现有验证体系已比 agency-agents 更完善，可选择性补充推荐章节检查。

#### 9. 内部贡献指南

如果计划扩大团队维护范围，借鉴 CONTRIBUTING.md 结构编写内部规范。

#### 10. 零依赖哲学

**无需借鉴**。my-fe-standards 的 "开发时 TS + 运行时零依赖 JS + content-pack + 增量同步" 策略已优于 agency-agents 的全量文件复制。

---

## my-fe-standards 的独有优势（不应丢失）

agency-agents **缺少**以下能力，这是 my-fe-standards 的差异化价值：

1. **可编程执行层**：task-executor / contract-validator 脚本层
2. **声明式质量门**：JSON schema 可自动验证
3. **安装状态管理**：install.json + SHA256 + 增量同步 + 漂移检测 + doctor 诊断
4. **三层规则架构**：eager/lazy/checklist 渐进加载
5. **技术栈自动检测**：Vue 2/3、UI 库、后端框架定向分发
6. **远程 content-pack**：`curl | node` 一行安装
7. **MCP Server 深度集成**：Ralph PRD + TaskBook + 结构分析

---

## 关键参考文件

| 用途 | 文件路径 |
|------|---------|
| SSMO 转换流水线 | `E:\mygit\agency-agents\scripts\convert.sh` |
| 交接模板 | `E:\mygit\agency-agents\strategy\coordination\handoff-templates.md` |
| NEXUS 编排策略 | `E:\mygit\agency-agents\strategy\nexus-strategy.md` |
| 代理设计规范 | `E:\mygit\agency-agents\CONTRIBUTING.md` |
| 完整示例 | `E:\mygit\agency-agents\examples\nexus-spatial-discovery.md` |
| 分发配置扩展点 | `E:\mygit\my-fe-standards\scripts\src\lib\distribution-profiles.ts` |
| 工作流定义 | `E:\mygit\my-fe-standards\workflows\templates\default.workflow.json` |
| 编排器定义 | `E:\mygit\my-fe-standards\agents\task-orchestrator\AGENT.md` |

---

## 结论

agency-agents 在**代理人格化设计**、**多工具兼容**、**编排灵活性**和**示例文档**方面值得借鉴。my-fe-standards 在**工程化执行层**、**安装状态管理**和**技术栈感知分发**方面显著领先。

最高投入产出比的改进：**添加完整执行示例**（纯文档，立即可做）和**多档工作流模板**（增强编排灵活性）。
