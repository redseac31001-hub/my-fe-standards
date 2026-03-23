import * as fs from 'fs';
import * as path from 'path';

type CliArgs = {
  strict: boolean;
  json: boolean;
};

type PackageJsonLike = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type LockfileLike = {
  packages?: Record<string, { version?: string }>;
};

type DependencyIssue = {
  name: string;
  declared: string;
  installed: string | null;
  kind: 'missing' | 'invalid';
};

type DoctorResult = {
  project: string;
  version: string;
  lockfilePresent: boolean;
  dependencyState: 'ok' | 'needs_attention';
  releaseImpact: 'none' | 'non_blocking_exception';
  strictMode: boolean;
  effectiveOk: boolean;
  invalidDependencies: DependencyIssue[];
  missingDependencies: DependencyIssue[];
  suggestedNextSteps: string[];
};

function parseArgs(argv: string[]): CliArgs {
  return {
    strict: argv.includes('--strict'),
    json: argv.includes('--json'),
  };
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function parseVersion(version: string): [number, number, number] | null {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(left: [number, number, number], right: [number, number, number]): number {
  for (let i = 0; i < 3; i++) {
    if (left[i] > right[i]) return 1;
    if (left[i] < right[i]) return -1;
  }
  return 0;
}

function satisfiesRange(installedVersion: string, declaredRange: string): boolean {
  const normalizedRange = declaredRange.trim();
  if (!normalizedRange) return false;

  if (/^\d+\.\d+\.\d+$/.test(normalizedRange)) {
    return installedVersion === normalizedRange;
  }

  const installed = parseVersion(installedVersion);
  const rangeVersion = parseVersion(normalizedRange.replace(/^[~^]/, ''));
  if (!installed || !rangeVersion) {
    return false;
  }

  if (normalizedRange.startsWith('^')) {
    if (installed[0] !== rangeVersion[0]) return false;
    return compareVersions(installed, rangeVersion) >= 0;
  }

  if (normalizedRange.startsWith('~')) {
    if (installed[0] !== rangeVersion[0] || installed[1] !== rangeVersion[1]) return false;
    return compareVersions(installed, rangeVersion) >= 0;
  }

  return installedVersion === normalizedRange;
}

function getInstalledVersion(lockfile: LockfileLike | null, nodeModulesDir: string, packageName: string): string | null {
  const lockfileKey = `node_modules/${packageName}`;
  const fromLock = lockfile?.packages?.[lockfileKey]?.version;
  if (typeof fromLock === 'string' && fromLock.trim()) {
    return fromLock.trim();
  }

  const packageJsonPath = path.join(nodeModulesDir, ...packageName.split('/'), 'package.json');
  const packageJson = readJsonFile<PackageJsonLike>(packageJsonPath);
  return typeof packageJson?.version === 'string' ? packageJson.version : null;
}

function buildResult(
  packageJson: PackageJsonLike,
  missingLockfile: boolean,
  invalidDeps: DependencyIssue[],
  missingDeps: DependencyIssue[],
  strictMode: boolean,
): DoctorResult {
  const hasProblems = missingLockfile || invalidDeps.length > 0 || missingDeps.length > 0;

  return {
    project: packageJson.name || 'mcp-server',
    version: packageJson.version || 'unknown',
    lockfilePresent: !missingLockfile,
    dependencyState: hasProblems ? 'needs_attention' : 'ok',
    releaseImpact: hasProblems ? 'non_blocking_exception' : 'none',
    strictMode,
    effectiveOk: hasProblems ? !strictMode : true,
    invalidDependencies: invalidDeps,
    missingDependencies: missingDeps,
    suggestedNextSteps: hasProblems
      ? [
          'For business-project release and normal repository work, treat this as a documented non-blocking exception.',
          'If the task touches mcp-server itself or must prove a clean-environment MCP setup, run `cd mcp-server && npm install` in a normal networked environment and commit the refreshed dependency baseline.',
        ]
      : [
          'Dependency baseline is consistent.',
        ],
  };
}

function formatTextReport(result: DoctorResult): string {
  const lines = [
    'MCP Server Dependency Doctor',
    `Project: ${result.project}@${result.version}`,
    `Lockfile: ${result.lockfilePresent ? 'present' : 'missing'}`,
    `Dependency state: ${result.dependencyState}`,
    `Release impact: ${result.releaseImpact}`,
    `Strict mode: ${result.strictMode ? 'on' : 'off'}`,
    `Effective result: ${result.effectiveOk ? 'ok' : 'fail'}`,
    '',
  ];

  if (result.invalidDependencies.length > 0) {
    lines.push(`Invalid dependencies (${result.invalidDependencies.length}):`);
    for (const issue of result.invalidDependencies) {
      lines.push(`- ${issue.name}: installed=${issue.installed || 'unknown'}, declared=${issue.declared}`);
    }
    lines.push('');
  }

  if (result.missingDependencies.length > 0) {
    lines.push(`Missing dependencies (${result.missingDependencies.length}):`);
    for (const issue of result.missingDependencies) {
      lines.push(`- ${issue.name}: required=${issue.declared}`);
    }
    lines.push('');
  }

  if (!result.lockfilePresent) {
    lines.push('Lockfile issue:');
    lines.push('- missing mcp-server/package-lock.json');
    lines.push('');
  }

  lines.push('Suggested next step:');
  for (const step of result.suggestedNextSteps) {
    lines.push(`- ${step}`);
  }

  if (result.releaseImpact === 'non_blocking_exception' && !result.strictMode) {
    lines.push('');
    lines.push('Note: default mode keeps this check non-blocking for mainline repository and business-project release decisions.');
    lines.push('Use `--strict` only when the task specifically targets mcp-server dependency hygiene.');
  }

  return lines.join('\n');
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const mcpServerDir = path.join(repoRoot, 'mcp-server');
  const packageJsonPath = path.join(mcpServerDir, 'package.json');
  const packageLockPath = path.join(mcpServerDir, 'package-lock.json');
  const hiddenLockfilePath = path.join(mcpServerDir, 'node_modules', '.package-lock.json');
  const nodeModulesDir = path.join(mcpServerDir, 'node_modules');

  if (!fs.existsSync(packageJsonPath)) {
    console.error(`[mcp-server-deps-doctor] missing package.json: ${packageJsonPath}`);
    process.exit(1);
  }

  const packageJson = readJsonFile<PackageJsonLike>(packageJsonPath);
  if (!packageJson) {
    console.error(`[mcp-server-deps-doctor] failed to read package.json: ${packageJsonPath}`);
    process.exit(1);
  }

  const hiddenLockfile = readJsonFile<LockfileLike>(hiddenLockfilePath);
  const declaredDependencies = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {}),
  };

  const missingLockfile = !fs.existsSync(packageLockPath);
  const dependencyIssues: DependencyIssue[] = [];

  for (const [name, declaredRange] of Object.entries(declaredDependencies)) {
    const installedVersion = getInstalledVersion(hiddenLockfile, nodeModulesDir, name);
    if (!installedVersion) {
      dependencyIssues.push({
        name,
        declared: declaredRange,
        installed: null,
        kind: 'missing',
      });
      continue;
    }

    if (!satisfiesRange(installedVersion, declaredRange)) {
      dependencyIssues.push({
        name,
        declared: declaredRange,
        installed: installedVersion,
        kind: 'invalid',
      });
    }
  }

  const invalidDeps = dependencyIssues.filter(issue => issue.kind === 'invalid');
  const missingDeps = dependencyIssues.filter(issue => issue.kind === 'missing');
  const result = buildResult(packageJson, missingLockfile, invalidDeps, missingDeps, args.strict);

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatTextReport(result));
  }

  process.exit(result.effectiveOk ? 0 : 1);
}

main();
