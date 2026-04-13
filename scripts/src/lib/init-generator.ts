import * as fs from 'fs';
import * as path from 'path';
import { PackageJson } from '../types';
import { Logger } from './logger';
import { readInstallState } from './install-sync';

export interface InitOptions {
  targetDir: string;
  bootstrapPackageName: string;
  gitHooks: boolean;
  ci: boolean;
  scripts: boolean;
  force: boolean;
  dryRun: boolean;
}

export interface InitResult {
  generated: string[];
  skipped: string[];
  injected: string[];
  notes: string[];
}

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function toProjectRelativePath(targetDir: string, filePath: string): string {
  return toPosixPath(path.relative(targetDir, filePath));
}

function readProjectPackageJson(targetDir: string): { path: string; data: PackageJson } {
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('未找到 package.json。当前版本的 init 仅支持 Node 项目。');
  }

  try {
    return {
      path: packageJsonPath,
      data: JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as PackageJson,
    };
  } catch (error) {
    throw new Error(`解析 package.json 失败: ${(error as Error).message}`);
  }
}

function buildNpxCodeBuddyCommand(packageName: string, subCommand: string): string {
  return `npx --yes --package ${packageName} codebuddy-loader ${subCommand}`.trim();
}

function buildWorkflowTemplate(packageName: string): string {
  return [
    'name: CodeBuddy Gate',
    'on: [push, pull_request]',
    'jobs:',
    '  validate:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v4',
    '        with:',
    '          node-version: 20',
    '      - run: npm ci',
    `      - run: ${buildNpxCodeBuddyCommand(packageName, 'install --if-deps-changed')}`,
    '      - run: node .codebuddy/scripts/validator-gate.js run --json',
    `      - run: ${buildNpxCodeBuddyCommand(packageName, 'doctor --json')}`,
    '',
  ].join('\n');
}

function createHookFileContent(existingContent: string | null, command: string, huskyShimPathExists: boolean): string | null {
  if (existingContent && existingContent.includes(command)) {
    return null;
  }

  if (!existingContent) {
    const headerLines = ['#!/usr/bin/env sh'];
    if (huskyShimPathExists) {
      headerLines.push('. "$(dirname -- "$0")/_/husky.sh"');
    }
    headerLines.push('', command, '');
    return headerLines.join('\n');
  }

  let nextContent = existingContent;
  if (!nextContent.endsWith('\n')) {
    nextContent += '\n';
  }
  if (!nextContent.endsWith('\n\n')) {
    nextContent += '\n';
  }
  nextContent += `${command}\n`;
  return nextContent;
}

function upsertFile(
  targetDir: string,
  filePath: string,
  content: string,
  force: boolean,
  dryRun: boolean,
  result: InitResult,
): void {
  const relativePath = toProjectRelativePath(targetDir, filePath);
  if (fs.existsSync(filePath) && !force) {
    result.skipped.push(relativePath);
    return;
  }

  result.generated.push(relativePath);
  if (dryRun) {
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

function tryMakeExecutable(filePath: string): void {
  try {
    fs.chmodSync(filePath, 0o755);
  } catch {}
}

function ensureInstallState(targetDir: string): void {
  const installState = readInstallState(targetDir);
  if (!installState) {
    throw new Error('未找到 .codebuddy/install.json，请先执行 install。');
  }
}

export function runInit(options: InitOptions, logger: Logger): InitResult {
  ensureInstallState(options.targetDir);

  const result: InitResult = {
    generated: [],
    skipped: [],
    injected: [],
    notes: [],
  };
  const packageJson = readProjectPackageJson(options.targetDir);

  if (options.scripts) {
    const nextPackageJson: PackageJson = {
      ...packageJson.data,
      scripts: { ...(packageJson.data.scripts || {}) },
    };
    const desiredScripts: Record<string, string> = {
      'codebuddy:install': buildNpxCodeBuddyCommand(options.bootstrapPackageName, 'install'),
      'codebuddy:doctor': buildNpxCodeBuddyCommand(options.bootstrapPackageName, 'doctor'),
      'codebuddy:validate': 'node .codebuddy/scripts/validator-gate.js run',
    };

    for (const [scriptName, scriptCommand] of Object.entries(desiredScripts)) {
      const currentCommand = nextPackageJson.scripts?.[scriptName];
      if (currentCommand === scriptCommand) {
        continue;
      }
      if (currentCommand && !options.force) {
        result.skipped.push(`package.json:scripts.${scriptName}`);
        continue;
      }
      nextPackageJson.scripts![scriptName] = scriptCommand;
      result.injected.push(scriptName);
    }

    if (result.injected.length > 0) {
      result.generated.push('package.json');
      if (!options.dryRun) {
        fs.writeFileSync(packageJson.path, `${JSON.stringify(nextPackageJson, null, 2)}\n`, 'utf-8');
      }
    }
  }

  if (options.ci) {
    const workflowPath = path.join(options.targetDir, '.github', 'workflows', 'codebuddy-gate.yml');
    upsertFile(
      options.targetDir,
      workflowPath,
      buildWorkflowTemplate(options.bootstrapPackageName),
      options.force,
      options.dryRun,
      result,
    );
  }

  if (options.gitHooks) {
    const huskyDir = path.join(options.targetDir, '.husky');
    if (!fs.existsSync(huskyDir) || !fs.statSync(huskyDir).isDirectory()) {
      result.notes.push('未检测到 .husky/，已跳过 git hooks 生成。');
    } else {
      const huskyShimPathExists = fs.existsSync(path.join(huskyDir, '_', 'husky.sh'));
      const hookTargets = [
        {
          filePath: path.join(huskyDir, 'pre-commit'),
          command: 'node .codebuddy/scripts/validator-gate.js run --scope rules',
        },
        {
          filePath: path.join(huskyDir, 'pre-push'),
          command: buildNpxCodeBuddyCommand(options.bootstrapPackageName, 'doctor'),
        },
      ];

      for (const hookTarget of hookTargets) {
        const relativePath = toProjectRelativePath(options.targetDir, hookTarget.filePath);
        const existingContent = fs.existsSync(hookTarget.filePath)
          ? fs.readFileSync(hookTarget.filePath, 'utf-8')
          : null;
        const nextContent = createHookFileContent(existingContent, hookTarget.command, huskyShimPathExists);
        if (!nextContent) {
          result.skipped.push(relativePath);
          continue;
        }

        result.generated.push(relativePath);
        if (options.dryRun) {
          continue;
        }

        fs.mkdirSync(path.dirname(hookTarget.filePath), { recursive: true });
        fs.writeFileSync(hookTarget.filePath, nextContent, 'utf-8');
        tryMakeExecutable(hookTarget.filePath);
      }
    }
  }

  logger.verbose(`init generated=${result.generated.length}, skipped=${result.skipped.length}, injected=${result.injected.length}`);
  return {
    generated: [...new Set(result.generated)].sort((left, right) => left.localeCompare(right)),
    skipped: [...new Set(result.skipped)].sort((left, right) => left.localeCompare(right)),
    injected: [...new Set(result.injected)].sort((left, right) => left.localeCompare(right)),
    notes: [...new Set(result.notes)],
  };
}
