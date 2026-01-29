# 项目结构审查报告模板

> Structure Analyzer Agent 输出模板

---

## 项目结构审查报告

### 1. 基本信息

| 项目 | 值 |
|------|-----|
| **项目名称** | {{projectName}} |
| **分析时间** | {{analyzedAt}} |
| **配置来源** | {{configSource}} |

### 2. 健康度评分

**总分: {{scores.total}}/100**

| 维度 | 得分 | 说明 |
|------|------|------|
| 特性结构 | {{scores.breakdown.featureStructure}}/25 | 是否采用 Feature-Based 结构 |
| 目录深度 | {{scores.breakdown.depth}}/25 | 目录嵌套是否合理 |
| 文件大小 | {{scores.breakdown.fileSize}}/25 | 是否存在巨型文件 |
| 命名规范 | {{scores.breakdown.naming}}/25 | 命名是否清晰区分 |

### 3. 摘要统计

- **总文件数**: {{summary.totalFiles}}
- **总目录数**: {{summary.totalDirectories}}
- **最大深度**: {{summary.maxDepth}}

#### 文件类型分布

{{#each summary.extensionStats}}
- {{@key}}: {{this}}
{{/each}}

#### 最大文件 Top 5

| 文件 | 行数 | 大小 |
|------|------|------|
{{#each summary.topLargestFiles}}
| {{this.path}} | {{this.lines}} | {{this.sizeKB}}KB |
{{/each}}

### 4. 违规项

**发现 {{violations.length}} 个问题**

| 严重度 | 规则 | 位置 | 问题 | 建议 |
|--------|------|------|------|------|
{{#each violations}}
| {{this.severity}} | {{this.code}} | {{this.path}} | {{this.message}} | {{this.suggestion}} |
{{/each}}

### 5. 状态判定

- **结构类型**: {{#if hasFeatureDir}}Feature-Based{{else}}Type-Grouped / 混合{{/if}}
- **健康度等级**: {{#if (gte scores.total 90)}}优秀{{else if (gte scores.total 70)}}良好{{else if (gte scores.total 50)}}一般{{else}}较差{{/if}}

### 6. 改造建议

{{#if (lt scores.total 70)}}
| 路径 | 适用场景 | 风险 | 预估工时 |
|------|----------|------|----------|
| 小步迁移 | 临近发布、测试不足 | 低 | 高 |
| 一次性迁移 | 新项目、测试完善 | 中 | 中 |
| 适配层过渡 | 历史包袱重 | 低 | 高 |
{{else}}
✅ 项目结构健康度良好，继续保持！
{{/if}}

### 7. 不建议动结构的场景

{{#if (lt scores.total 70)}}
- ⚠️ 距离发布 < 2 周
- ⚠️ 单元测试覆盖率 < 60%
- ⚠️ 存在未解决的 P0 Bug
{{/if}}

### 8. 下一步行动

{{#if (lt scores.total 50)}}
🔴 **急需改进**：
1. 建议制定重构计划，分阶段改进
2. 优先处理 error 级别的问题
3. 考虑引入架构规范和代码审查流程
4. 如需详细规划，可转交 @planner Agent
{{else if (lt scores.total 70)}}
🟡 **建议改进**：
1. 逐步重构按类型分组的目录
2. 拆分超大文件
3. 扁平化过深目录
{{else if (lt scores.total 90)}}
🟢 **持续优化**：
1. 保持现有架构
2. 新功能遵循 Feature-Based 模式
3. 定期进行结构审查
{{else}}
✅ **优秀**：
项目结构健康度优秀，继续保持！
{{/if}}

---

*报告由 Structure Analyzer Agent 生成*
*如需进一步协助，请咨询 @planner 或 @code-reviewer Agent*
