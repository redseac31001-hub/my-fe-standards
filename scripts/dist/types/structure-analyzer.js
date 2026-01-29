"use strict";
/**
 * Structure Analyzer 类型定义
 *
 * 项目结构分析器的核心接口定义
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
// ============ 默认配置 ============
/**
 * 默认配置
 */
exports.DEFAULT_CONFIG = {
    thresholds: {
        maxFileLines: 500,
        maxDirectoryDepth: 5,
        maxFileSizeKB: 100,
        similarityThreshold: 0.8,
    },
    enabledRules: ['SA001', 'SA002', 'SA003', 'SA004', 'SA005'],
    ignorePatterns: ['node_modules', 'dist', '.git', '*.min.js', '*.map', 'coverage', '.nyc_output'],
    typeGroupedPatterns: ['components', 'views', 'store', 'stores', 'utils', 'hooks', 'services', 'helpers', 'api', 'apis'],
    sa001Whitelist: ['components', 'shared', 'common', 'assets', 'styles', 'types', 'constants'],
    sa001MinFiles: 10,
    sa004: {
        enabled: true,
        similarityThreshold: 0.8,
        maxPairsPerDirectory: 50,
        maxTotalChecks: 500,
        minNameLength: 3,
    },
};
