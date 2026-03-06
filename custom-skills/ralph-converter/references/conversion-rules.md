# Conversion Rules

把 PRD 转成 Ralph 的 `prd.json` 时，严格按固定字段输出，避免额外自由发挥。

## Target Shape

```json
{
  "project": "[Project Name]",
  "branchName": "ralph/[feature-name-kebab-case]",
  "description": "[Feature description]",
  "userStories": [
    {
      "id": "US-001",
      "title": "[Story title]",
      "description": "As a [user], I want [feature] so that [benefit]",
      "acceptanceCriteria": [
        "Criterion 1",
        "Typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

## Mapping Rules

1. 每个用户故事映射为一个 JSON entry
2. `id` 使用连续编号：`US-001`、`US-002`
3. `branchName` 由 feature 名称转 kebab-case，并加前缀 `ralph/`
4. `passes` 固定为 `false`
5. `notes` 初始为空字符串
6. `priority` 先看依赖，再看原始顺序

## Acceptance Criteria Rules

每个故事都必须是可验证标准。

始终包含：

- `Typecheck passes`

按需包含：

- `Tests pass`
- `Verify in browser using dev-browser skill`

避免：

- `Works correctly`
- `Good UX`
- `Handles edge cases`

## Archive Previous Runs

写入新的 `prd.json` 前，检查是否存在旧结果：

1. 如果已有 `prd.json`，先读取 `branchName`
2. 如果新旧 `branchName` 不同，再检查 `progress.txt`
3. 若 `progress.txt` 不是空白头文件，则归档到 `archive/YYYY-MM-DD-feature-name/`
4. 一并保存旧的 `prd.json` 和 `progress.txt`

如果是走 `ralph.sh` 自动流程，通常会自动处理；手动更新时不要跳过这一步。

## Final Checklist

- 每个故事都能在一次迭代内完成
- 顺序符合依赖
- 所有验收标准可验证
- UI 故事带浏览器验证项
- 输出字段完整，没有自定义字段
