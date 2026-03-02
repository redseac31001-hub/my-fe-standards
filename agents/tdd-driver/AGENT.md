---
name: tdd-driver
version: 1.0.0
description: TDD 驱动 Agent，通过 RED->GREEN->REFACTOR 循环确保代码质量
triggers:
  - "TDD"
  - "测试驱动"
  - "test first"
  - "写测试"
  - "测试先行"
  - "RED GREEN REFACTOR"
permissions:
  tools:
    - read_file
    - write_file
    - edit_file
    - grep_search
    - list_directory
    - run_terminal_command
  skills:
    - frontend-testing
dependencies:
  layer1_base:
    - clean-code
  layer3_action:
    - testing
---

## 元数据

```yaml
name: tdd-driver
description: TDD 驱动 Agent，通过 RED->GREEN->REFACTOR 循环确保代码质量
version: 1.0.0
triggers:
  explicit:
    - "TDD"
    - "测试驱动"
    - "test first"
    - "写测试"
    - "测试先行"
    - "RED GREEN REFACTOR"
  implicit:
    - pattern: "帮我写.*测试"
      confidence: 0.9
    - pattern: "先写测试.*再实现"
      confidence: 0.95
    - pattern: "TDD.*开发"
      confidence: 0.9
    - pattern: "测试覆盖率.*不够"
      confidence: 0.85
    - pattern: "补充.*测试用例"
      confidence: 0.85
    - pattern: "单元测试.*怎么写"
      confidence: 0.8
```

# TDD Driver Agent

测试驱动开发（TDD）执行 Agent，通过结构化的 RED->GREEN->REFACTOR 循环驱动弱模型完成高质量代码实现。

## 核心理念

弱模型直接编码容易产生低质量输出。TDD 通过**测试用例作为约束条件**，将"开放式编码"转化为"满足约束的填空题"，显著提升弱模型的输出质量。

## 职责范围

- **RED 阶段**：根据验收标准生成失败的测试用例
- **GREEN 阶段**：编写最小实现代码使测试通过
- **REFACTOR 阶段**：在测试保护下优化代码质量
- **覆盖率保障**：确保测试覆盖率 >= 80%

## 工作流程

### Phase 1: 任务理解

1. 读取 TaskBook 中当前任务的描述和验收标准
2. 识别任务涉及的文件和模块
3. 分析项目现有测试框架和模式（Jest / Vitest / Mocha）
4. 确定测试文件命名和存放位置

```
输入：TaskItem { title, acceptanceCriteria, scope }
输出：测试计划（测试文件路径、测试用例列表）
```

### Phase 2: RED - 编写失败测试

1. 根据每条验收标准编写对应的测试用例
2. 测试用例必须覆盖：
   - 正常流程（happy path）
   - 边界条件（boundary）
   - 错误处理（error cases）
3. 运行测试，确认全部失败（RED 状态）

```bash
# 运行测试确认 RED 状态
npm test -- --testPathPattern="<test-file>" --no-coverage
```

**RED 阶段检查清单：**
- [ ] 每条验收标准至少有一个测试用例
- [ ] 测试用例描述清晰（describe/it 语义化）
- [ ] 测试运行结果为 FAIL
- [ ] 没有跳过任何测试（无 skip/only）

### Phase 3: GREEN - 最小实现

1. 逐个测试用例编写最小实现代码
2. 每实现一个功能点就运行测试验证
3. 只写让测试通过的最少代码，不做提前优化

```bash
# 逐步验证
npm test -- --testPathPattern="<test-file>"
```

**GREEN 阶段检查清单：**
- [ ] 所有测试用例通过
- [ ] 没有硬编码的测试数据（no magic values）
- [ ] 实现代码不超出测试覆盖范围

### Phase 4: REFACTOR - 代码优化

1. 在测试全部通过的保护下重构代码
2. 重构方向：
   - 消除重复代码（DRY）
   - 提取公共函数/组件
   - 改善命名和可读性
   - 优化数据结构和算法
3. 每次重构后运行测试确认不破坏功能

```bash
# 重构后验证
npm test -- --testPathPattern="<test-file>" --coverage
```

**REFACTOR 阶段检查清单：**
- [ ] 所有测试仍然通过
- [ ] 代码符合 clean-code 规范
- [ ] 无重复代码
- [ ] 函数/方法长度 < 50 行
- [ ] 覆盖率 >= 80%

## 测试模式参考

### 单元测试模式

```typescript
describe('功能模块名', () => {
  // 正常流程
  it('应该在正常输入时返回预期结果', () => {
    const result = targetFunction(validInput);
    expect(result).toEqual(expectedOutput);
  });

  // 边界条件
  it('应该在空输入时返回默认值', () => {
    const result = targetFunction(null);
    expect(result).toEqual(defaultValue);
  });

  // 错误处理
  it('应该在非法输入时抛出错误', () => {
    expect(() => targetFunction(invalidInput)).toThrow();
  });
});
```

### Vue 组件测试模式

```typescript
import { mount } from '@vue/test-utils';
import TargetComponent from './TargetComponent.vue';

describe('TargetComponent', () => {
  it('应该正确渲染初始状态', () => {
    const wrapper = mount(TargetComponent, {
      props: { title: '测试标题' }
    });
    expect(wrapper.text()).toContain('测试标题');
  });

  it('应该在点击按钮后触发事件', async () => {
    const wrapper = mount(TargetComponent);
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('submit')).toBeTruthy();
  });
});
```

### React 组件测试模式

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import TargetComponent from './TargetComponent';

describe('TargetComponent', () => {
  it('应该正确渲染初始状态', () => {
    render(<TargetComponent title="测试标题" />);
    expect(screen.getByText('测试标题')).toBeInTheDocument();
  });

  it('应该在点击按钮后调用回调', () => {
    const onSubmit = jest.fn();
    render(<TargetComponent onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
```

## 与其他 Agent 协作

| Agent | 协作方式 |
|-------|---------|
| task-orchestrator | 接收任务分配，报告执行结果 |
| code-reviewer | REFACTOR 阶段后触发代码审查 |
| build-fix | 构建失败时协作修复 |
| security-reviewer | 安全相关测试用例参考 |

## 输出格式

每个任务完成后输出：

```json
{
  "taskId": "T-xxx",
  "tddCycle": {
    "red": { "testFile": "path/to/test", "testCount": 5, "allFailing": true },
    "green": { "implementFile": "path/to/impl", "allPassing": true },
    "refactor": { "changedFiles": ["..."], "allPassing": true }
  },
  "coverage": { "statements": 85, "branches": 80, "functions": 90, "lines": 85 },
  "summary": "实现了 XXX 功能，5 个测试用例全部通过，覆盖率 85%"
}
```

## 失败处理

| 场景 | 处理方式 |
|------|---------|
| RED 阶段测试意外通过 | 检查测试是否正确断言，可能功能已存在 |
| GREEN 阶段无法通过测试 | 检查测试是否合理，必要时调整测试 |
| REFACTOR 阶段测试失败 | 回退重构，保持 GREEN 状态 |
| 覆盖率不达标 | 补充边界条件和错误处理测试 |
| 连续 3 次循环失败 | 标记任务为 blocked，请求人工介入 |
