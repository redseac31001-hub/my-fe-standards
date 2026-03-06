# Creation Lifecycle

无论是新建 skill 还是重构旧 skill，都按同一生命周期推进。

## 1. Understand

先收集具体使用样例：

- 用户会怎么触发它
- 会处理什么文件、什么任务
- 哪些场景最常见

没有例子，就很难写出好的 `description` 和路由。

## 2. Plan Resources

对每个典型任务都问一遍：

- 这里是否需要脚本
- 这里是否需要参考文档
- 这里是否需要模板或资产

## 3. Initialize Or Audit

- **新 skill**：运行 `scripts/init_skill.py`
- **旧 skill**：先看目录结构是否混杂、SKILL 是否过长、资源是否缺位

## 4. Implement Resources First

优先实现 `scripts/`、`references/`、`assets/`，再写 `SKILL.md`。

原因：

- 入口文件应该引用真实存在的资源
- 先有资源，路由才写得准

## 5. Write Lean SKILL.md

写成：

1. skill 是干什么的
2. 读哪个 reference
3. 先做什么后做什么
4. 输出要求是什么

## 6. Validate And Package

```bash
python scripts/quick_validate.py <skill-folder>
python scripts/package_skill.py <skill-folder>
```

如果有脚本，至少跑一组代表性输入。

## 7. Iterate

真实使用后，优先修这些问题：

- 触发描述不准
- 路由不清
- 缺少关键 reference
- 重复操作还没脚本化
