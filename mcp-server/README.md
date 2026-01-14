# Frontend Standards MCP Server

一个基于 MCP (Model Context Protocol) 的前端架构规则服务器，为 AI 编程助手（如 CodeBuddy、Claude Desktop）提供动态的前端架构规则和最佳实践。

## 🎯 核心功能

- **智能依赖检测**: 自动识别项目的 Vue 版本（2/3）和 UI 库
- **三层规则架构**: 基础层、业务层、动作层的渐进式规则加载
- **按需查询**: 通过 MCP 工具动态获取规则，无需生成静态文件
- **详略级别控制**: 支持 summary/quick/full 三级内容详细度
- **规则搜索**: 快速搜索规则库，找到相关规则

## 📦 安装

```bash
# 克隆项目
git clone <repository-url>
cd mcp-server

# 安装依赖
npm install --registry=https://registry.npmjs.org

# 编译
npm run build
```

## 🚀 使用方法

### 方式 1: 在 Claude Desktop 中使用

编辑 Claude Desktop 的配置文件（`~/Library/Application Support/Claude/claude_desktop_config.json` 或 Windows 上的对应路径）：

```json
{
  "mcpServers": {
    "fe-standards": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

### 方式 2: 在 CodeBuddy 中使用

如果 CodeBuddy 支持 MCP，在其配置文件中添加：

```json
{
  "mcpServers": {
    "fe-standards": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

### 方式 3: 直接运行测试

```bash
# 启动服务器
npm start

# 服务器将监听 stdio，等待 MCP 客户端连接
```

## 🛠️ 可用工具

### 1. `get_project_rules`

获取项目的前端架构规则（基于依赖自动检测）

**参数**:
- `projectPath` (必需): 项目根目录路径
- `taskType` (可选): 任务类型 (`all`, `refactoring`, `debugging`, `testing`, `new-feature`, `code-review`)
- `detailLevel` (可选): 详略级别 (`summary`, `quick`, `full`)，默认 `full`

**示例**:
```typescript
const rules = await use_mcp_tool('fe-standards', 'get_project_rules', {
  projectPath: '/path/to/project',
  taskType: 'refactoring',
  detailLevel: 'quick'
});
```

### 2. `detect_dependencies`

检测项目依赖和技术栈

**参数**:
- `projectPath` (必需): 项目根目录路径

**返回**:
```json
{
  "dependencies": ["vue", "ant-design-vue", ...],
  "vueProfile": {
    "version": 3,
    "type": "standard"
  },
  "detectedLibraries": ["antdv"],
  "projectName": "my-project",
  "projectVersion": "1.0.0"
}
```

### 3. `get_rule_by_id`

按 ID 获取单个规则

**参数**:
- `ruleId` (必需): 规则 ID（如 `layer1_base/vue3/vue3-script-setup`）
- `detailLevel` (可选): 详略级别，默认 `full`

**示例**:
```typescript
const rule = await use_mcp_tool('fe-standards', 'get_rule_by_id', {
  ruleId: 'layer1_base/vue3/vue3-script-setup',
  detailLevel: 'quick'
});
```

### 4. `search_rules`

搜索规则库

**参数**:
- `query` (必需): 搜索关键词
- `layer` (可选): 限定层级 (`layer1_base`, `layer2_business`, `layer3_action`)

**返回**:
```json
[
  {
    "ruleId": "layer1_base/vue3/vue3-script-setup",
    "file": "vue3-script-setup.md",
    "path": "/path/to/rule.md",
    "summary": "Vue 3 组件必须使用 <script setup> 编写",
    "matches": 5
  }
]
```

## 📁 项目结构

```
mcp-server/
├── src/
│   ├── index.ts              # MCP 服务器入口
│   └── core/
│       ├── rule-service.ts   # 规则服务
│       ├── rule-loader.ts    # 规则加载器（复用）
│       └── types.ts          # 类型定义
├── rules/                    # 规则库
│   ├── layer1_base/          # 基础层规则
│   ├── layer2_business/      # 业务层规则
│   └── layer3_action/        # 动作层规则
├── config/
│   └── loader-config.json    # 规则加载配置
├── dist/                     # 编译输出
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 开发

```bash
# 监听模式编译
npm run watch

# 编译
npm run build

# 启动服务器
npm start
```

## 📝 规则库说明

### Layer 1: 基础层
- **architecture/**: 架构规范（目录结构、模块划分）
- **typescript/**: TypeScript 类型安全规范
- **vue3/**: Vue 3 最佳实践（Script Setup）
- **vue2/**: Vue 2 兼容规则（Options API）

### Layer 2: 业务层
- **antdv.md**: Ant Design Vue 使用规范
- **tdesign.md**: TDesign 使用规范
- **vant.md**: Vant 使用规范

### Layer 3: 动作层
- **refactoring.md**: 重构检查清单
- **debugging.md**: 调试检查清单
- **testing.md**: 测试策略

## 🎨 使用示例

### 在 AI 对话中使用

当你在 Claude Desktop 或 CodeBuddy 中与 AI 对话时，AI 可以自动调用这些工具：

```
用户: 帮我重构这个 Vue 3 组件

AI: 让我先获取相关的重构规则...
[调用 get_project_rules 工具]
[调用 get_rule_by_id 获取 Vue 3 规则]

根据规则，我建议...
```

### 手动测试工具

你也可以在代码中直接测试：

```typescript
import { RuleService } from './core/rule-service.js';

const service = new RuleService();

// 检测依赖
const deps = await service.detectDependencies('/path/to/project');
console.log(deps);

// 获取规则
const rules = await service.getProjectRules('/path/to/project', 'refactoring', 'quick');
console.log(rules);

// 搜索规则
const results = await service.searchRules('Vue 3 组件');
console.log(results);
```

## 🚨 注意事项

1. **路径问题**: 确保 `projectPath` 是绝对路径
2. **规则库位置**: 规则库必须位于 `mcp-server/rules/` 目录
3. **MCP 兼容性**: 确认你的 AI 工具支持 MCP 协议
4. **性能**: 首次加载规则可能需要几秒钟，后续会使用缓存

## 📄 许可证

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如有问题，请提交 Issue 或联系维护者。
