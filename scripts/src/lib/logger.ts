/**
 * 日志工具模块
 *
 * 提供结构化日志工厂，基于 Context 配置控制 verbose 输出
 */

import { Context } from '../types';

export interface Logger {
  log: (message: string) => void;
  verbose: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
}

export function createLogger(ctx: Readonly<Context>): Logger {
  return {
    log: (msg: string) => console.log(`[CodeBuddy] ${msg}`),
    verbose: (msg: string) => { if (ctx.isVerbose) console.log(`[CodeBuddy:DEBUG] ${msg}`); },
    error: (msg: string) => console.error(`[CodeBuddy:ERROR] ${msg}`),
    warn: (msg: string) => console.warn(`[CodeBuddy:WARN] ${msg}`),
  };
}

/**
 * parseArgs 之前需要的裸日志（尚无 ctx）
 */
export function logError(message: string): void {
  console.error(`[CodeBuddy:ERROR] ${message}`);
}
