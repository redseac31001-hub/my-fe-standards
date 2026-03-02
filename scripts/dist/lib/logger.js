"use strict";
/**
 * 日志工具模块
 *
 * 提供结构化日志工厂，基于 Context 配置控制 verbose 输出
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
exports.logError = logError;
function createLogger(ctx) {
    return {
        log: (msg) => console.log(`[CodeBuddy] ${msg}`),
        verbose: (msg) => { if (ctx.isVerbose)
            console.log(`[CodeBuddy:DEBUG] ${msg}`); },
        error: (msg) => console.error(`[CodeBuddy:ERROR] ${msg}`),
        warn: (msg) => console.warn(`[CodeBuddy:WARN] ${msg}`),
    };
}
/**
 * parseArgs 之前需要的裸日志（尚无 ctx）
 */
function logError(message) {
    console.error(`[CodeBuddy:ERROR] ${message}`);
}
