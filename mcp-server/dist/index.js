#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { RuleService } from './core/rule-service.js';
// 从环境变量读取远程 URL
const REMOTE_URL = process.env.FE_STANDARDS_REMOTE_URL;
// 初始化 MCP 服务器
const server = new Server({
    name: 'fe-standards-mcp-server',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// 初始化规则服务
const ruleService = new RuleService(REMOTE_URL);
// 初始化远程模式（如果启用）
if (REMOTE_URL) {
    console.error(`[MCP] 正在初始化远程模式...`);
    await ruleService.initialize();
}
// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: 'get_project_rules',
            description: '获取项目的前端架构规则（基于依赖自动检测）',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: {
                        type: 'string',
                        description: '项目根目录路径',
                    },
                    taskType: {
                        type: 'string',
                        enum: ['all', 'refactoring', 'debugging', 'testing', 'new-feature', 'code-review'],
                        description: '任务类型（可选）',
                    },
                    detailLevel: {
                        type: 'string',
                        enum: ['summary', 'quick', 'full'],
                        description: '详略级别（可选，默认 full）',
                    },
                },
                required: ['projectPath'],
            },
        },
        {
            name: 'detect_dependencies',
            description: '检测项目依赖和技术栈',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: {
                        type: 'string',
                        description: '项目根目录路径',
                    },
                },
                required: ['projectPath'],
            },
        },
        {
            name: 'get_rule_by_id',
            description: '按 ID 获取单个规则',
            inputSchema: {
                type: 'object',
                properties: {
                    ruleId: {
                        type: 'string',
                        description: '规则 ID（如 layer1_base/vue3/vue3-script-setup）',
                    },
                    detailLevel: {
                        type: 'string',
                        enum: ['summary', 'quick', 'full'],
                        description: '详略级别（可选，默认 full）',
                    },
                },
                required: ['ruleId'],
            },
        },
        {
            name: 'search_rules',
            description: '搜索规则库',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: '搜索关键词',
                    },
                    layer: {
                        type: 'string',
                        enum: ['layer1_base', 'layer2_business', 'layer3_action'],
                        description: '限定层级（可选）',
                    },
                },
                required: ['query'],
            },
        },
    ],
}));
// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (!args) {
        return {
            content: [
                {
                    type: 'text',
                    text: 'Error: Missing arguments',
                },
            ],
            isError: true,
        };
    }
    try {
        switch (name) {
            case 'get_project_rules': {
                const rules = await ruleService.getProjectRules(args.projectPath, args.taskType, args.detailLevel || 'full');
                return {
                    content: [
                        {
                            type: 'text',
                            text: rules,
                        },
                    ],
                };
            }
            case 'detect_dependencies': {
                const deps = await ruleService.detectDependencies(args.projectPath);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(deps, null, 2),
                        },
                    ],
                };
            }
            case 'get_rule_by_id': {
                const rule = await ruleService.getRuleById(args.ruleId, args.detailLevel || 'full');
                return {
                    content: [
                        {
                            type: 'text',
                            text: rule,
                        },
                    ],
                };
            }
            case 'search_rules': {
                const results = await ruleService.searchRules(args.query, args.layer);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(results, null, 2),
                        },
                    ],
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
});
// 启动服务器
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('FE Standards MCP Server running on stdio');
}
main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map