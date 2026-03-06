# Progressive Disclosure

核心目标不是“文件越少越好”，而是“让 agent 只加载当前需要的信息”。

## Three Layers

1. **Frontmatter**：始终在上下文里，必须短而准
2. **SKILL.md body**：skill 触发后才加载，负责路由和流程骨架
3. **Bundled resources**：按需读取或直接执行

## What Belongs In SKILL.md

只保留：

- skill 解决什么问题
- 何时读哪个 reference
- 先做什么，后做什么
- 输出需要长什么样

## What Should Move Out

下面这些内容更适合移到 `references/`：

- 大段背景解释
- 多个框架或多个场景的分支说明
- 很长的示例
- 详细规则表

下面这些内容更适合放进 `scripts/`：

- 容易出错的重复操作
- 固定格式生成
- 数据转换、打包、提取、校验

下面这些内容更适合放进 `assets/`：

- 模板
- 样板文件
- 字体、图片、图标
- 需要被复制到最终输出中的资源

## Split Criteria

应该继续拆分的信号：

- `SKILL.md` 同时承担路由、细节规则、示例、模板
- 大部分任务只会用到文档的一部分
- 某类输出每次都在重复编写
- 某些内容更新频率明显不同

不该为了“文件少”反向合并。
