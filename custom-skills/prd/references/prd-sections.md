# PRD Sections

按照下面的结构生成 PRD，重点是让后续开发者或 agent 能直接据此拆分和实现。

## Required Sections

### 1. Introduction / Overview

用 1-2 段说明功能、背景和要解决的问题。

### 2. Goals

列出具体目标，尽量可度量。避免写成泛泛口号。

### 3. User Stories

每个故事都应足够小，能在一次聚焦实现中完成。

格式：

```markdown
### US-001: [Title]
**Description:** As a [user], I want [feature] so that [benefit].

**Acceptance Criteria:**
- [ ] Specific, verifiable criterion
- [ ] Another concrete criterion
- [ ] Typecheck or lint passes
- [ ] Verify in browser using dev-browser skill
```

规则：

- 验收标准必须可验证，避免 `works correctly` 之类的笼统描述
- UI 相关故事必须包含 `Verify in browser using dev-browser skill`
- 如果故事主要是后端或数据层，可省略浏览器验证
- 每个故事标题和描述都要能独立理解，不依赖上下文脑补

### 4. Functional Requirements

使用编号要求，例如：

- `FR-1: The system must ...`
- `FR-2: When the user ... the system must ...`

要求可测试、无歧义。

### 5. Non-Goals

明确当前版本不做什么，防止范围膨胀。

### 6. Design Considerations

只在有明确 UI/UX 约束、设计稿、组件复用要求时写。

### 7. Technical Considerations

只记录会影响实现路径的事实，例如依赖、集成点、性能约束、兼容性限制。

### 8. Success Metrics

说明如何衡量需求落地后的效果。优先选择行为、效率、转化、错误率这类指标。

### 9. Open Questions

把仍未确定、但会影响后续实现的问题集中列出。

## Structured JSON Summary

在 Markdown 末尾追加一个 JSON 摘要块，供 task-orchestrator 自动消费：

```json
{
  "prdId": "prd-[feature-name]",
  "title": "Feature title",
  "goals": ["Goal 1"],
  "userStories": [
    {
      "id": "US-001",
      "title": "Story title",
      "description": "As a [user], I want [feature] so that [benefit]",
      "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
      "suggestedTaskType": "implement"
    }
  ],
  "functionalRequirements": ["FR-1: ..."],
  "nonGoals": ["Out of scope item"],
  "technicalConsiderations": ["Constraint"],
  "openQuestions": ["Open question"]
}
```

`suggestedTaskType` 只在有明显倾向时填写，例如 `implement`、`test`、`refactor`、`review`。

## Save Location

- 目录：`tasks/`
- 文件名：`prd-[feature-name].md`
- `feature-name` 使用 kebab-case

## Quality Bar

- 用户故事足够小，便于继续拆任务
- 目标与非目标同时清晰
- 验收标准具体、可检查
- 剩余不确定项明确暴露，而不是被省略
