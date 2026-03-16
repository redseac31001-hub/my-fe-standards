import * as fs from 'fs';
import * as path from 'path';

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

function main(): void {
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
  const hasProblems = missingLockfile || invalidDeps.length > 0 || missingDeps.length > 0;

  const lines = [
    'MCP Server Dependency Doctor',
    `Project: ${packageJson.name || 'mcp-server'}@${packageJson.version || 'unknown'}`,
    `Lockfile: ${missingLockfile ? 'missing' : 'present'}`,
    `Dependency state: ${hasProblems ? 'needs_attention' : 'ok'}`,
    '',
  ];

  if (invalidDeps.length > 0) {
    lines.push(`Invalid dependencies (${invalidDeps.length}):`);
    for (const issue of invalidDeps) {
      lines.push(`- ${issue.name}: installed=${issue.installed || 'unknown'}, declared=${issue.declared}`);
    }
    lines.push('');
  }

  if (missingDeps.length > 0) {
    lines.push(`Missing dependencies (${missingDeps.length}):`);
    for (const issue of missingDeps) {
      lines.push(`- ${issue.name}: required=${issue.declared}`);
    }
    lines.push('');
  }

  if (missingLockfile) {
    lines.push('Lockfile issue:');
    lines.push(`- missing ${path.relative(repoRoot, packageLockPath).replace(/\\/g, '/')}`);
    lines.push('');
  }

  if (hasProblems) {
    lines.push('Suggested next step:');
    lines.push('- In a normal networked environment, run `cd mcp-server && npm install` and commit the refreshed dependency baseline.');
  } else {
    lines.push('Suggested next step:');
    lines.push('- Dependency baseline is consistent.');
  }

  console.log(lines.join('\n'));
  process.exit(hasProblems ? 1 : 0);
}

main();
