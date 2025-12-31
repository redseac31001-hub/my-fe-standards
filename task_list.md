# Task List

- [ ] 初始化项目目录结构 `rules/` (Vue, TS, Architecture) <!-- id: 0 -->
- [ ] 创建项目的 `README.md` 说明文档 <!-- id: 1 -->
- [ ] 设计并创建标准规则模板 `rules/00_meta/rule-template.md` <!-- id: 2 -->
- [ ] 编写 Vue 核心规则: `rules/01_vue/vue3-script-setup.md` <!-- id: 3 -->
- [ ] 编写 TS 核心规则: `rules/02_typescript/strict-types.md` <!-- id: 4 -->
- [x] 编写架构规则: `rules/03_architecture/feature-based-structure.md` <!-- id: 5 -->
- [x] 创建 `.codebuddy` 配置建议（如有必要） <!-- id: 6 -->
- [x] 开发规则加载脚本 `scripts/rule-loader.js` <!-- id: 7 -->
- [x] 编写脚本使用文档 <!-- id: 8 -->
- [x] **Refactor**: 重组规则目录为三层结构 (`layer1_base`, `layer2_business`, `layer3_action`) <!-- id: 9 -->
- [x] **Update**: 升级 `rule-loader.js` 支持分层输出 <!-- id: 10 -->
- [x] **Logic**: 升级 `rule-loader.js` 支持 Vue2/3 版本检测 <!-- id: 13 -->
- [x] **Data**: 新增 TDesign (Business) 和 Refactoring (Action) 规则示例 <!-- id: 11 -->
- [x] **Prompt**: 编写 System Prompt 定义架构师角色 <!-- id: 12 -->

---

## 阶段 1: 脚本健壮性改进 (2025-12-30)
- [x] 添加 `--help` / `-h` 参数显示帮助信息 <!-- id: 14 -->
- [x] 添加 `--verbose` / `-v` 调试模式 <!-- id: 15 -->
- [x] 添加 `--timeout` 网络请求超时配置 <!-- id: 16 -->
- [x] `package.json` 不存在时给出友好警告而非静默失败 <!-- id: 17 -->
- [x] 网络请求失败/超时时提供更清晰的错误信息 <!-- id: 18 -->
- [x] 统一日志输出格式 (`log`, `logWarn`, `logError`, `logVerbose`) <!-- id: 19 -->
- [x] 整理 README.md 文档结构 <!-- id: 20 -->

## 阶段 2: 规则内容填充 (2025-12-30)
- [ ] 补充 `refactoring.md` 内容 (暂不执行) <!-- id: 21 -->
- [ ] 扩充 `tdesign.md` 内容 (暂不执行) <!-- id: 22 -->
- [x] 新增 `antdv.md` 规则文件 (Ant Design Vue) <!-- id: 27 -->
- [x] 新增 `vant.md` 规则文件 (移动端) <!-- id: 28 -->
- [x] 清理 `loader-config.json` 中 element-plus 无效配置 <!-- id: 23 -->
- [x] 更新 manifest.json <!-- id: 29 -->

## 阶段 3: Claude Code 最佳实践对齐 (待执行)
- [ ] 支持本地覆盖规则 (`.codebuddy/local-rules.md`) <!-- id: 24 -->
- [ ] 生成的规则中包含常用命令 <!-- id: 25 -->
- [ ] 添加 `--check-update` 版本检测 <!-- id: 26 -->

