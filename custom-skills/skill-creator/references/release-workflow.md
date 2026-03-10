# Release Workflow

用这份最小流程完成 skill 的校验、打包和索引更新。

## 1. Finish The Skill

- 确认 `SKILL.md` 只保留路由、流程和输出约束
- 确认 `references/`、`scripts/`、`assets/` 都是被 `SKILL.md` 真正引用到的
- 需要跨出 skill 根目录的相对链接时，只在 `metadata.link_whitelist` 里显式放行；默认不要依赖外部文件

## 2. Validate

先做单 skill 校验：

```bash
python custom-skills/skill-creator/scripts/quick_validate.py custom-skills/<skill-name>
```

再做仓库级扫描：

```bash
node scripts/dist/skill-validator.js check --dir custom-skills
```

重点关注：

- frontmatter 是否只用了允许字段
- Markdown 链接是否存在
- 引用是否越出 skill 根目录
- 代码块是否闭合

## 3. Package

```bash
python custom-skills/skill-creator/scripts/package_skill.py custom-skills/<skill-name> temp/skills-dist
```

期望结果：

- 生成 `<skill-name>.skill`
- 包内不带 `__pycache__`、`.pyc`、`.pyo`

## 4. Update Inventory

如果 skill 对外可见或触发条件变化，更新：

- `custom-skills/skills-index.md`
- 需要同步的其它入口文档

只写当前事实，不补历史流水账。

## 5. Final Repo Check

准备合并前至少跑：

```bash
npm run build
node test/run-tests.js
```

如果只改单个 skill 且没有动脚本，实现层回归可按实际影响裁剪；但发布前最好仍跑一次完整回归。
