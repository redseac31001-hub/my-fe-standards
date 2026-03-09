# rules_cache 机制说明

## 一、功能概述

`.codebuddy/rules_cache/` 是规则加载器生成的**本地缓存目录**，用于存放 Layer 2/3 的规则原文文件，配合 `project-rules.md` 中的索引，实现“按需读取（Lazy Load）”。

核心目的：
- Layer 1（Base）规则直接嵌入 `project-rules.md`（Eager Load），确保核心规范常驻
- Layer 2/3 规则不直接嵌入，只在 `project-rules.md` 写索引；当任务需要时，AI 再去读取缓存文件

## 二、目录结构

加载器运行后，业务项目会生成：

```text
.codebuddy/
├── rules/
│   └── project-rules.md
└── rules_cache/
    ├── layer2_business/
    │   ├── antdv.md
    │   └── vant.md
    └── layer3_action/
        ├── debugging.md
        ├── refactoring.md
        ├── self-verification.md
        └── testing.md
```

说明：
- `layer2_business/` 是否生成文件，取决于业务项目是否命中对应 Layer2 selector（例如依赖 `ant-design-vue`、`vant`，或 `kind:backend`、`stack:springboot`）
- `layer3_action/` 会根据配置的默认清单写入缓存

## 三、在 project-rules.md 中如何引用

`project-rules.md` 会包含一张索引表，指向缓存路径，例如：

```markdown
| 规则名称 | 本地路径 | 说明 |
|---------|---------|------|
| antdv | `.codebuddy/rules_cache/layer2_business/antdv.md` | 业务规范 |
| backend-service | `.codebuddy/rules_cache/layer2_business/backend-service.md` | 通用后端规范 |
| refactoring | `.codebuddy/rules_cache/layer3_action/refactoring.md` | 任务检查清单 |
```

当实际任务需要细节时，AI 再读取对应缓存文件即可。

## 四、清理与重建

缓存目录可安全删除，重新运行加载器会自动重建：

```bash
rm -rf .codebuddy/rules_cache
node codebuddy-loader.js --remote https://your-server.com/standards
```
