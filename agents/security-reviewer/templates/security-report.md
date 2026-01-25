# 安全审查报告

**项目名称**：[项目名称]
**审查日期**：[YYYY-MM-DD]
**审查范围**：[文件/目录范围]
**Agent 版本**：security-reviewer v1.0.0

---

## 执行摘要

| 严重程度 | 发现数量 |
|----------|----------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 0 |
| 🔵 Low | 0 |
| **总计** | **0** |

### 结论

[审查结论：通过/需修复/阻断发布]

---

## 详细发现

### 🔴 Critical 级别

#### [C-001] [漏洞标题]

- **文件**：`src/components/Example.vue`
- **行号**：42
- **类别**：XSS
- **描述**：[漏洞描述]

**问题代码**：
```vue
<div v-html="userInput"></div>
```

**修复建议**：
```vue
<div v-text="userInput"></div>
```

---

### 🟠 High 级别

#### [H-001] [漏洞标题]

- **文件**：`src/utils/api.ts`
- **行号**：15
- **类别**：敏感数据泄露
- **描述**：[漏洞描述]

**问题代码**：
```typescript
const API_KEY = 'sk-xxxxx';
```

**修复建议**：
```typescript
const API_KEY = import.meta.env.VITE_API_KEY;
```

---

### 🟡 Medium 级别

[无发现 或 详细列表]

---

### 🔵 Low 级别

[无发现 或 详细列表]

---

## 修复优先级

| 优先级 | 发现 ID | 预计工时 | 责任人 |
|--------|---------|----------|--------|
| P0 | C-001 | 1h | - |
| P1 | H-001 | 2h | - |

---

## 附录

### A. 扫描范围

```
src/
├── components/
├── views/
├── utils/
└── api/
```

### B. 检测规则版本

- XSS 规则集：v1.0.0
- CSRF 规则集：v1.0.0
- 敏感数据规则集：v1.0.0

### C. 排除项

- `node_modules/`
- `dist/`
- `*.test.ts`
- `*.spec.ts`
