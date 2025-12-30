# Thought Process

## 用户需求分析
用户不仅需要静态的规则文件，更需要一个“工具”，能够根据目标项目的状态（比如是否安装了 Vue），自动提取相应的规则并“注入”到该项目中。
这实际上是一个简单的 CLI 工具需求。

## 技术方案
1.  **输入**: 目标项目路径（默认为当前执行路径）。
2.  **配置源**: 当前仓库 (`my-fe-standards`) 的 `rules` 文件夹路径。
3.  **探测逻辑**:
    - 读取 `package.json` -> `dependencies` / `devDependencies`。
    - 关键词映射:
        - `vue` -> 包含 `rules/01_vue`
        - `typescript` -> 包含 `rules/02_typescript`
        - `nuxt` -> 包含 `rules/xx_nuxt` (如有)
    - 默认包含: `rules/03_architecture`, `rules/00_meta` 中的通用部分。
4.  **输出**:
    - 在目标目录生成 `.codebuddy/generated-rules.md`。
    - 或者生成 `.cursorrules`（目前流行的 AI 规则文件格式）。

## 实现步骤
1.  创建 `scripts` 目录。
2.  编写 `scripts/rule-loader.js`。
3.  使用 Node.js 原生 `fs` 和 `path` 模块，无需额外依赖，确保易于移植。

## 关键代码逻辑 (Draft)
```javascript
const projectRules = [];
if (pkg.dependencies.vue) {
  projectRules.push(...loadRules('01_vue'));
}
if (pkg.devDependencies.typescript) {
  projectRules.push(...loadRules('02_typescript'));
}
fs.writeFileSync('.codebuddy/rules.md', projectRules.join('\n\n'));
```

这将完美回答用户关于“自动解析...拼装”的问题。
