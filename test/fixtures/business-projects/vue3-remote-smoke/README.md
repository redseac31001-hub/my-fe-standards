# Vue3 Remote Smoke Fixture

这个目录是“业务项目影子环境”的**事实源**，不要直接在 `temp/` 里维护。

运行 `npm run smoke:business-remote` 时，脚本会把这里复制到 `temp/business-fixtures/vue3-remote-smoke/`，再在那个运行态目录里执行远程加载和闭环 smoke。

## 保持这些信息接近真实业务项目

- `package.json` 的依赖、脚本入口、包管理器习惯
- `src/` 的关键目录结构
- `vite.config.ts`、`tsconfig.json` 等技术栈标记
- 真实会影响 loader 检测和 workflow gate 的最小文件集合

## 不要放进来

- `node_modules/`
- `.codebuddy/`
- 真实业务代码里的敏感配置
