# 当前项目分析报告模板

> Structure Analyzer Agent 输出模板

---

## 当前项目分析报告

### 1. 基本信息

| 项目 | 值 |
|------|-----|
| **项目名称** | {{projectName}} |
| **分析时间** | {{analyzedAt}} |
| **配置来源** | {{configSource}} |

### 2. 工程健康度评分卡（8 维）

**工程健康度总分: {{scores.total}}/100**

> 若脚本返回 `scores.scorecard.dimensions`，本节必须作为项目级总评输出。
> 最终报告禁止出现内部推理或过程性话术，只保留结论、证据、建议。

| 维度 | 得分 | 状态 | 说明 |
|------|------|------|------|
| 架构与目录结构 | {{scorecard.architecture}}/15 | {{scorecard.architectureStatus}} | 目录深度与 feature 分层 |
| 代码质量 | {{scorecard.codeQuality}}/20 | {{scorecard.codeQualityStatus}} | ESLint / Prettier / lint / 文件规模 |
| 类型安全 | {{scorecard.typeSafety}}/15 | {{scorecard.typeSafetyStatus}} | strict / TS 覆盖率 / any |
| 测试覆盖 | {{scorecard.testCoverage}}/15 | {{scorecard.testCoverageStatus}} | 测试文件 / coverage |
| 依赖健康度 | {{scorecard.dependencyHealth}}/10 | {{scorecard.dependencyHealthStatus}} | 锁文件 / 版本声明 |
| 构建与性能 | {{scorecard.buildPerformance}}/10 | {{scorecard.buildPerformanceStatus}} | 构建配置 / 分包懒加载 |
| 命名规范 | {{scorecard.namingConvention}}/10 | {{scorecard.namingConventionStatus}} | 命名一致性 / 相似命名冲突 |
| 文档完整性 | {{scorecard.documentation}}/5 | {{scorecard.documentationStatus}} | README / docs / 注释信号 |

### 2.1 评分细项

- 每个维度至少展开 2-5 条子项得分
- 低分项必须说明扣分原因
- 命名规范必须展示主流命名风格占比或风格分布
- 代码质量必须展示 ESLint / Prettier / Lint 违规 / 大文件占比 / pre-commit 等细项

### 3. 结构健康度（4 维）

**结构健康度: {{scores.structureTotal}}/100**

| 维度 | 得分 | 说明 |
|------|------|------|
| 特性结构 | {{scores.breakdown.featureStructure}}/25 | 是否采用 Feature-Based 结构 |
| 目录深度 | {{scores.breakdown.depth}}/25 | 目录嵌套是否合理 |
| 文件大小 | {{scores.breakdown.fileSize}}/25 | 是否存在巨型文件 |
| 命名规范 | {{scores.breakdown.naming}}/25 | 命名是否清晰区分 |

### 4. 摘要统计

- **总文件数**: {{summary.totalFiles}}
- **总目录数**: {{summary.totalDirectories}}
- **最大深度**: {{summary.maxDepth}}

### 5. 关键问题

**发现 {{violations.length}} 个问题**

| 严重度 | 规则 | 位置 | 问题 | 建议 |
|--------|------|------|------|------|
{{#each violations}}
| {{this.severity}} | {{this.code}} | {{this.path}} | {{this.message}} | {{this.suggestion}} |
{{/each}}

### 5.1 孤立模块与低分模块

- 如果 module-mapper 返回孤立模块，必须列出具体模块名
- 如果报告引用“低分模块”，必须列出模块名、行数、健康度和主要原因

### 6. 结论

- **项目级判断**: 工程健康度优先反映项目整体状态
- **结构判断**: 结构健康度仅反映目录与文件组织质量
- **是否建议动结构**: {{recommendation.summary}}

### 7. 下一步行动

{{#if (lt scores.total 50)}}
1. 优先补齐工程短板，再规划结构治理
2. 优先处理 error 级别问题
3. 如需详细规划，可转交 @planner Agent
{{else if (lt scores.total 70)}}
1. 逐步补齐测试、类型和 lint 基础能力
2. 拆分超大文件，收敛目录组织
3. 按模块逐步治理，不建议一次性大迁移
{{else}}
1. 保持当前架构
2. 对低分维度做渐进式优化
3. 定期复查避免退化
{{/if}}

---

*报告由 Structure Analyzer Agent 生成*
*禁止将 4 维结构分直接表述为“项目总健康度”*
*禁止在最终报告中输出内部推理或过程性话术*
