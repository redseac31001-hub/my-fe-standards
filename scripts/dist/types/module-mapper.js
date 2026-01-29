"use strict";
/**
 * Module Mapper 类型定义
 *
 * 功能模块图谱分析器的接口和类型
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MAPPER_CONFIG = void 0;
/**
 * 默认配置
 */
exports.DEFAULT_MAPPER_CONFIG = {
    modulePatterns: [
        { pattern: 'views', type: 'page', recursive: true },
        { pattern: 'pages', type: 'page', recursive: true },
        { pattern: 'features', type: 'feature', recursive: true },
        { pattern: 'modules', type: 'feature', recursive: true },
        { pattern: 'components', type: 'shared', recursive: false },
        { pattern: 'composables', type: 'util', recursive: false },
        { pattern: 'hooks', type: 'util', recursive: false },
        { pattern: 'utils', type: 'util', recursive: false },
        { pattern: 'api', type: 'api', recursive: true },
        { pattern: 'services', type: 'api', recursive: true },
        { pattern: 'store', type: 'store', recursive: true },
        { pattern: 'stores', type: 'store', recursive: true },
        { pattern: 'layouts', type: 'layout', recursive: false },
    ],
    entryPatterns: [
        'index.vue',
        'index.tsx',
        'index.ts',
        'App.vue',
        '*.page.vue',
        '*.view.vue',
    ],
    ignorePatterns: [
        'node_modules',
        'dist',
        '.git',
        '.vscode',
        '__tests__',
        '*.test.*',
        '*.spec.*',
    ],
    thresholds: {
        maxFilesPerModule: 50,
        maxLinesPerModule: 5000,
        maxDependencies: 10,
        maxDependents: 20,
    },
};
