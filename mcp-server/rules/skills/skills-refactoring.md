# Skills: 重构任务执行指南

> Skill ID: skills-refactoring
> 任务类型: refactoring
> 优先级: High

## 📋 任务识别

当用户请求包含以下关键词时，激活此 Skill：
- 重构、refactor、refactoring
- 优化、optimize、optimization
- 清理、cleanup、clean up
- 改进、improve、improvement
- 简化、simplify

## 🎯 执行目标

重构任务的核心目标是在**不改变外部行为**的前提下，改进代码的内部结构、可读性和可维护性。

## 📖 执行流程

### 第 1 步：理解现有代码

**必须执行**：
1. 完整阅读目标代码文件
2. 理解代码的功能和业务逻辑
3. 识别代码的依赖关系
4. 查看相关的测试文件（如果存在）

**输出**：
- 对现有代码的功能描述
- 识别的主要问题点

### 第 2 步：分析重构需求

**必须执行**：
1. 明确用户的重构目标（性能优化、可读性提升、架构调整等）
2. 识别代码异味（Code Smells）：
   - 重复代码（Duplicated Code）
   - 过长函数（Long Method）
   - 过大类（Large Class）
   - 过长参数列表（Long Parameter List）
   - 发散式变化（Divergent Change）
   - 霰弹式修改（Shotgun Surgery）
3. 评估重构的风险和影响范围

**输出**：
- 重构计划清单
- 风险评估

### 第 3 步：应用重构规则

**必须参考的规则**（按优先级）：

#### 🔥 必读规则
1. **架构规范** (architecture/feature-based-structure)
   - 确保重构后的代码符合 Feature-Based 目录结构
   - 相关代码应该放在同一个模块下

2. **Vue 3 最佳实践** (vue3/vue3-script-setup)
   - 使用 `<script setup>` 语法
   - 使用 Composition API
   - 正确使用 ref/reactive
   - 合理拆分 composables

3. **TypeScript 类型安全** (typescript/strict-types)
   - 添加完整的类型定义
   - 避免使用 any
   - 使用类型推导

#### ⭐ 参考规则
4. **重构检查清单** (refactoring checklist)
   - 遵循重构的最佳实践
   - 确保每一步都可测试

### 第 4 步：执行重构

**执行原则**：
1. **小步前进**：每次只做一个小的重构
2. **频繁测试**：每次重构后立即测试
3. **保持功能不变**：确保外部行为不变

**常见重构手法**：
1. **提取函数** (Extract Function)
   - 将复杂逻辑提取为独立函数
   - 函数名应清晰表达意图

2. **提取变量** (Extract Variable)
   - 将复杂表达式提取为命名变量
   - 提高代码可读性

3. **内联函数/变量** (Inline Function/Variable)
   - 移除不必要的中间层

4. **移动函数** (Move Function)
   - 将函数移动到更合适的位置

5. **重命名** (Rename)
   - 使用更清晰的命名

6. **拆分阶段** (Split Phase)
   - 将复杂流程拆分为多个阶段

### 第 5 步：验证重构结果

**必须执行**：
1. 运行所有相关测试
2. 手动测试关键功能
3. 检查代码质量：
   - 代码是否更易读？
   - 代码是否更易维护？
   - 代码是否更符合规范？
4. 使用 ESLint/TypeScript 检查

**输出**：
- 测试结果
- 代码质量对比

### 第 6 步：文档和总结

**必须执行**：
1. 更新相关注释（如果需要）
2. 更新文档（如果有）
3. 总结重构内容：
   - 重构了什么？
   - 为什么这样重构？
   - 带来了什么改进？

## 💡 重构最佳实践

### 1. 重构前的准备
- ✅ 确保有测试覆盖
- ✅ 提交当前代码（保存检查点）
- ✅ 理解现有代码的功能

### 2. 重构中的原则
- ✅ 小步前进，频繁测试
- ✅ 一次只做一种重构
- ✅ 保持功能不变
- ✅ 随时可以回退

### 3. 重构后的验证
- ✅ 运行所有测试
- ✅ 代码审查
- ✅ 性能对比（如果是性能优化）

## ⚠️ 重构陷阱

### 避免过度重构
- ❌ 不要为了重构而重构
- ❌ 不要过早优化
- ❌ 不要过度抽象

### 避免破坏性重构
- ❌ 不要在重构时添加新功能
- ❌ 不要在重构时修复 bug（除非必要）
- ❌ 不要改变外部行为

### 避免盲目重构
- ❌ 不要在不理解代码的情况下重构
- ❌ 不要在没有测试的情况下重构
- ❌ 不要在时间紧迫时大规模重构

## 📌 执行模板

当用户请求重构时，按照以下模板回复：

```
我将按照 skills-refactoring.md 文档来执行重构任务。

【第 1 步：理解现有代码】
[阅读代码，理解功能...]

【第 2 步：分析重构需求】
识别的代码异味：
- [列出问题]

重构计划：
- [列出计划]

【第 3 步：应用重构规则】
将参考以下规则：
- architecture/feature-based-structure
- vue3/vue3-script-setup
- typescript/strict-types

【第 4 步：执行重构】
[执行重构，小步前进...]

【第 5 步：验证重构结果】
[运行测试，验证结果...]

【第 6 步：文档和总结】
重构总结：
- 重构了什么：[说明]
- 为什么这样重构：[说明]
- 带来的改进：[说明]
```

## 🔗 相关资源

- [重构检查清单](../layer3_action/refactoring.md)
- [架构规范](../layer1_base/architecture/feature-based-structure.md)
- [Vue 3 最佳实践](../layer1_base/vue3/vue3-script-setup.md)
- [TypeScript 类型安全](../layer1_base/typescript/strict-types.md)

## 📚 推荐阅读

- 《重构：改善既有代码的设计》（Martin Fowler）
- 《代码整洁之道》（Robert C. Martin）
