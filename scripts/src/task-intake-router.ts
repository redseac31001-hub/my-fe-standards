#!/usr/bin/env node

import { isDirectCliEntry } from './lib/cli-entry';
import {
  createDefaultTaskIntakeInput,
  normalizeContractState,
  normalizeTaskIntakeKind,
  normalizeUncertainty,
  routeTaskIntake,
} from './lib/task-intake-routing';
import { TaskIntakeRoutingDecision, TaskIntakeRoutingInput } from './types';

type ParsedCli = {
  command: string | null;
  positionals: string[];
  flags: Record<string, string | boolean | string[]>;
};

function parseCli(args: string[]): ParsedCli {
  const parsed: ParsedCli = { command: null, positionals: [], flags: {} };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (!arg.startsWith('--') && !parsed.command) {
      parsed.command = arg;
      continue;
    }

    if (!arg.startsWith('--')) {
      parsed.positionals.push(arg);
      continue;
    }

    const eqIndex = arg.indexOf('=');
    const rawKey = eqIndex >= 0 ? arg.slice(2, eqIndex) : arg.slice(2);
    const key = rawKey.trim();

    let value: string | boolean = true;
    if (eqIndex >= 0) {
      value = arg.slice(eqIndex + 1);
    } else if (args[i + 1] && !args[i + 1].startsWith('--')) {
      value = args[i + 1];
      i += 1;
    }

    const existing = parsed.flags[key];
    if (typeof existing === 'undefined') {
      parsed.flags[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(String(value));
      parsed.flags[key] = existing;
    } else {
      parsed.flags[key] = [String(existing), String(value)];
    }
  }

  if (!parsed.command) parsed.command = 'route';
  return parsed;
}

function flagAsString(flags: ParsedCli['flags'], key: string): string | undefined {
  const value = flags[key];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function flagAsBool(flags: ParsedCli['flags'], key: string): boolean {
  return flags[key] === true;
}

function flagAsNumber(flags: ParsedCli['flags'], key: string): number | null {
  const raw = flagAsString(flags, key);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function flagAsStringArray(flags: ParsedCli['flags'], key: string): string[] {
  const value = flags[key];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value;
  return [];
}

function showHelp(): void {
  console.log(`
Task Intake Router - 直执行 vs 编排路径建议器

用法:
  node scripts/dist/task-intake-router.js [command] [options]
  npm run intake:route -- --description "replace mock login API" --files 4 --contract explicit

命令:
  route                       输出建议路径（默认）

选项:
  --title <text>              任务标题
  --description <text>        任务描述；未提供时使用位置参数
  --kind <kind>               api-adaptation | bugfix | refactor | feature | review | analysis
  --contract <state>          explicit | partial | none（默认 partial）
  --uncertainty <level>       low | medium | high（默认 medium）
  --files <n>                 预计改动文件数
  --modules <n>               预计跨模块数（>1 时建议升级编排）
  --domains <n>               预计跨业务域数（>1 时建议升级编排）
  --endpoints <n>             预计涉及接口数
  --handoff                   需要阶段性交接
  --parallel                  需要并行协作
  --tracking                  需要持久 task tracking
  --architecture-change       涉及架构边界调整
  --state-change              涉及状态流/状态模型重设计
  --routing-change            涉及路由/导航调整
  --workflow-change           涉及 workflow/执行路径调整
  --hint <text>               额外路由提示（可重复）
  --json                      输出 JSON
  --help, -h                  显示帮助
`.trim());
}

function buildInput(parsed: ParsedCli): TaskIntakeRoutingInput {
  const description = (flagAsString(parsed.flags, 'description') ?? parsed.positionals.join(' ').trim()) || null;
  const title = flagAsString(parsed.flags, 'title') ?? (description ? description.slice(0, 80) : null);

  return createDefaultTaskIntakeInput({
    title,
    description,
    kind: normalizeTaskIntakeKind(flagAsString(parsed.flags, 'kind')),
    contractState: normalizeContractState(flagAsString(parsed.flags, 'contract')),
    uncertainty: normalizeUncertainty(flagAsString(parsed.flags, 'uncertainty')),
    estimatedFileCount: flagAsNumber(parsed.flags, 'files'),
    estimatedModuleCount: flagAsNumber(parsed.flags, 'modules'),
    estimatedDomainCount: flagAsNumber(parsed.flags, 'domains'),
    estimatedEndpointCount: flagAsNumber(parsed.flags, 'endpoints'),
    requiresHandoff: flagAsBool(parsed.flags, 'handoff'),
    requiresParallelWork: flagAsBool(parsed.flags, 'parallel'),
    requiresDurableTracking: flagAsBool(parsed.flags, 'tracking'),
    changesArchitecture: flagAsBool(parsed.flags, 'architecture-change'),
    changesStateModel: flagAsBool(parsed.flags, 'state-change'),
    changesRouting: flagAsBool(parsed.flags, 'routing-change'),
    changesWorkflow: flagAsBool(parsed.flags, 'workflow-change'),
    routeHints: flagAsStringArray(parsed.flags, 'hint'),
  });
}

function printDecision(decision: TaskIntakeRoutingDecision): void {
  console.log(
    `[task-intake-router] recommendation: ${decision.recommendedPath} (confidence=${decision.confidence}, kind=${decision.inferredKind})`,
  );
  for (const reason of decision.reasons) {
    console.log(`- ${reason}`);
  }

  if (decision.hardEscalationTriggers.length > 0) {
    console.log('[task-intake-router] escalation triggers:');
    for (const trigger of decision.hardEscalationTriggers) {
      console.log(`  - ${trigger}`);
    }
  }

  console.log('[task-intake-router] suggested next steps:');
  for (const step of decision.suggestedNextSteps) {
    console.log(`  - ${step}`);
  }

  console.log('[task-intake-router] suggested validation:');
  for (const step of decision.suggestedValidation) {
    console.log(`  - ${step}`);
  }
}

export function parseTaskIntakeCliArgs(args: string[]): ParsedCli {
  return parseCli(args);
}

export function routeTaskIntakeCli(parsed: ParsedCli): TaskIntakeRoutingDecision {
  return routeTaskIntake(buildInput(parsed));
}

function main(): void {
  const parsed = parseCli(process.argv.slice(2));

  if (flagAsBool(parsed.flags, 'help') || parsed.command === 'help') {
    showHelp();
    process.exit(0);
  }

  if (parsed.command !== 'route') {
    console.error(`错误: 未知命令: ${parsed.command}`);
    showHelp();
    process.exit(1);
  }

  const input = buildInput(parsed);
  if (!input.title && !input.description) {
    console.error('错误: 请提供 --description 或位置参数描述任务。');
    showHelp();
    process.exit(1);
  }

  const decision = routeTaskIntake(input);
  if (flagAsBool(parsed.flags, 'json')) {
    console.log(JSON.stringify(decision, null, 2));
    return;
  }

  printDecision(decision);
}

if (isDirectCliEntry('task-intake-router.js')) {
  main();
}
