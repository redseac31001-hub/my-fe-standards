# 前端架构规范 - CodeBuddy GLM-4.7 专用版

> 版本：1.0.0 | 适用：CodeBuddy (GLM-4.7) | 语言：简体中文

---

## 核心原则

### 最小改动原则（重要）

1. **仅修改与当前任务直接相关的代码**
2. **不要"顺手"修复无关问题**
3. **遗留代码保持现状，除非明确要求重构**
4. **使用 `replace_in_file` 进行针对性编辑，避免重写整个文件**

### 稳定优先原则

- **"能工作的代码" > "完美的代码"**
- 优先保持代码稳定性，而非追求理论完美
- 改动范围应与任务范围匹配

---

## 一、TypeScript 类型规范

### 必须遵守

- 新代码禁止使用 `any` 类型，使用 `unknown` + 类型守卫
- 开启 `strict: true`
- 导出函数必须有明确的返回类型

### 灵活处理

| 场景 | 处理方式 |
|------|----------|
| 遗留代码的 `any` | 仅在修改相关逻辑时顺便优化 |
| 与任务无关的代码 | 保持现状，不要修改 |
| 第三方库类型不完整 | 允许 `as unknown as T` |

### 示例

```typescript
// ✅ 正确
interface User {
  id: number
  name: string
}

function getUser(id: number): User | null {
  // ...
}

// ❌ 错误
function getData(input: any) {
  return input.data
}
```

---

## 二、Vue 组件规范

### Vue 3 项目

- 必须使用 `<script setup lang="ts">`
- 禁止新增 Options API 代码
- 复杂逻辑抽取为 Composable (`use...`)

### Vue 2 项目

- 推荐使用 `@vue/composition-api`
- 新组件使用 Composition API 风格
- 遗留 Options API 代码保持现状

### 组件模板

```vue
<script setup lang="ts">
// 1. 类型和 Props
interface Props {
  title: string
  count?: number
}
const props = withDefaults(defineProps<Props>(), { count: 0 })

// 2. Emits
const emit = defineEmits<{
  (e: 'update', value: number): void
}>()

// 3. 响应式状态
const visible = ref(false)

// 4. 计算属性
const displayTitle = computed(() => props.title.toUpperCase())

// 5. 方法
const handleClick = () => {
  emit('update', props.count + 1)
}
</script>
```

---

## 三、重构检查清单（分级）

### P0 级（必须）

- [ ] 修复已知 Bug（如未定义的函数、语法错误）
- [ ] 重构后功能与原代码完全一致
- [ ] 代码能正常编译，无类型错误

### P1 级（推荐，仅对新代码）

- [ ] 移除显式 `any` 类型
- [ ] 复杂逻辑抽取为 composables（仅当确实复杂时）
- [ ] 变量名清晰描述用途

### P2 级（可选，仅在明确要求时）

- [ ] 移除未使用的 imports
- [ ] 常量提取
- [ ] 完整类型定义

### 不需要重构的情况

- 简单的 UI 展示逻辑
- 已稳定运行的遗留代码
- 与当前任务无关的代码

---

## 四、防御性编程边界

### 必须防御（P0）

| 场景 | 处理方式 |
|------|----------|
| 用户输入 | 必须验证（表单、URL 参数） |
| 外部 API 响应 | 必须验证 + 可选链 |
| 异步操作 | 必须 try-catch |

### 不需要防御（避免过度）

| 场景 | 说明 |
|------|------|
| Vuex/Pinia store | 稳定的内部数据，不需要可选链 |
| 组件 props | 信任 TypeScript 类型检查 |
| 简单 UI 操作 | 不需要 try-catch |

### 示例对比

```typescript
// ❌ 过度防御：稳定的 store 不需要可选链
const payAmt = computed(() => store.state?.nopassword?.payAmt ?? 0)

// ✅ 正确：信任稳定的数据结构
const payAmt = computed(() => store.state.nopassword.payAmt)

// ❌ 过度防御：简单操作不需要 try-catch
const showModal = () => {
  try {
    visible.value = true
  } catch (error) {
    console.error('失败:', error)
  }
}

// ✅ 正确：简单操作直接执行
const showModal = () => {
  visible.value = true
}

// ✅ 正确：异步操作需要 try-catch
const fetchData = async () => {
  try {
    const result = await api.get('/data')
    return result.data
  } catch (error) {
    showError('请求失败')
    return null
  }
}
```

---

## 五、自我验证协议（限制版）

### 循环限制

- **最多执行 2 轮自我批评**，避免无限循环
- 超过 2 轮说明可能陷入过度优化

### 检查清单（分级）

#### P0 级（必须满足）

1. 代码是否解决了用户的实际问题？
2. 代码是否能正常编译和运行？
3. 是否有明显的 Bug？

#### P1 级（推荐，但不强制）

4. 是否遵循了项目的既有模式？
5. 关键路径的错误处理是否完善？

#### P2 级（不作为改进依据）

6. ~~是否有更简洁的实现方式？~~ → 除非明确要求
7. ~~6 个月后能快速理解吗？~~ → 不作为改进依据

### 停止迭代的信号

- 代码已能正常工作
- 进一步改进会大幅增加复杂度
- 改进超出当前任务范围
- 改进仅涉及风格偏好

---

## 六、文件操作规范（CodeBuddy 专用）

### 读取文件

```
使用 read_file 工具读取文件内容
如果需要编辑，先读取确认内容
```

### 编辑文件

```
使用 replace_in_file 进行针对性编辑
不要重写整个文件
如果编辑失败，重新读取文件后再试
同一文件不要连续编辑超过 3 次
```

### 搜索代码

```
使用 search_content 搜索代码内容
使用 search_file 按文件名搜索
优先搜索代码库，而非依赖自身知识
```

---

## 七、任务完成验证（必须执行）

### 每次任务完成后必须执行

1. **代码验证**
   - 确认修改的代码能正常编译
   - 确认没有引入新的类型错误
   - 确认功能正常工作

2. **文件检查**
   - 检查所有修改的文件是否保存
   - 确认没有遗漏的修改

3. **规则库项目专用**（如果修改的是规则库本身）
   - 执行 `npm run build:manifest` 更新 manifest.json
   - 执行 `npm run codebuddy` 验证规则加载
   - 确认生成的规则文件正确

### 验证命令

```bash
# 类型检查（如果项目有 TypeScript）
tsc --noEmit

# 代码规范检查（如果项目有 ESLint）
npm run lint

# 构建验证
npm run build

# 规则库专用：更新 manifest
npm run build:manifest

# 规则库专用：测试规则加载
npm run codebuddy
```

### 验证清单

| 检查项 | 必须 | 说明 |
|--------|------|------|
| 代码编译通过 | ✅ | 无语法错误、类型错误 |
| 功能正常 | ✅ | 修改后功能与预期一致 |
| 无遗漏修改 | ✅ | 所有相关文件都已更新 |
| manifest 更新 | ✅* | *仅规则库项目 |
| 规则加载测试 | ✅* | *仅规则库项目 |

---

## 八、提交前检查

### 必检项

| 检查项 | 验证方式 |
|--------|----------|
| 类型安全 | `tsc --noEmit` 或人工确认无 `any` |
| 代码规范 | `npm run lint` 或人工核对 |
| 构建成功 | `npm run build` 或 `npm run dev` 无报错 |
| 无 console.log | 搜索确认无调试代码 |

### 安全必检

- [ ] 无硬编码的密钥、密码、Token
- [ ] 用户输入经过验证
- [ ] 敏感操作有权限验证

---

## 八、常见场景处理

### 场景 1：审查并优化 Vue 组件

**正确做法**：
1. 先读取文件，理解现有逻辑
2. 识别明显的 Bug 和问题
3. 使用 `replace_in_file` 针对性修复
4. 不要重写整个组件

### 场景 2：添加新功能

**正确做法**：
1. 理解现有代码结构
2. 遵循项目既有模式
3. 新代码使用 TypeScript 严格类型
4. 添加必要的错误处理

### 场景 3：修复 Bug

**正确做法**：
1. 定位问题代码
2. 最小范围修复
3. 不要"顺手"重构其他代码
4. 验证修复有效

---

## 九、禁止事项

### 绝对禁止

- ❌ 重写整个文件（除非明确要求）
- ❌ 修改与任务无关的代码
- ❌ 为所有变量添加可选链和默认值
- ❌ 为所有函数添加 try-catch
- ❌ 无限循环的自我优化

### 应该避免

- ⚠️ 创建不必要的文档文件
- ⚠️ 过度抽象简单逻辑
- ⚠️ 追求理论完美而忽视实用性

---

## 版本信息

- **规则版本**：1.0.0
- **适用工具**：CodeBuddy (GLM-4.7)
- **基于分支**：feature/codebuddy-glm
- **更新日期**：2026-01-24
