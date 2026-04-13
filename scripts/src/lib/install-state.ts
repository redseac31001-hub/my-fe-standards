import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { Context, InstallManagedFile, InstallState, PackageJson, WorkspaceInfo } from '../types';
import { Logger } from './logger';
import { removeManagedPath, toProjectRelativePath } from './install-sync';

export const INSTALL_STATE_SCHEMA_VERSION = '1.2.0';

export interface CreateInstallSnapshotIdOptions {
  now?: Date;
  pid?: number;
  randomValue?: number;
  epochMs?: number;
}

export interface SnapshotEntry {
  name: string;
  absolutePath: string;
  relativePath: string;
  sortKey: string;
}

export interface BuildInstallStateParams {
  version: string;
  installedAt?: string;
  ctx: Readonly<Context>;
  targetDir: string;
  depsFingerprint?: string | null;
  outputPath: string;
  workspaceIndexPath: string | null;
  skillsRootDir: string | null;
  skillsSnapshotRetention: number | null;
  agentsRootDir: string | null;
  agentsSnapshotRetention: number | null;
  layer1RulesCount: number;
  layer2IndexCount: number;
  layer3IndexCount: number;
  skillsCount: number;
  agentsCount: number;
  distributedScripts: string[];
  distributedWorkflows: string[];
  distributedTaskBooks: string[];
  distributedAgentCalls: string[];
  distributedCommands: string[];
  managedFiles: InstallManagedFile[];
  workspaceInfo: WorkspaceInfo;
}

export function createInstallSnapshotId(options: CreateInstallSnapshotIdOptions = {}): string {
  const now = options.now ?? new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  const entropy = createHash('sha256')
    .update(`${options.pid ?? process.pid}-${options.randomValue ?? Math.random()}-${options.epochMs ?? Date.now()}`)
    .digest('hex')
    .slice(0, 8);
  return `${timestamp}-${entropy}`;
}

export function buildSnapshotSortKey(name: string, absolutePath: string): string {
  if (/^\d{8}T\d{6}Z-[a-f0-9]+$/i.test(name)) {
    return `0-${name}`;
  }

  try {
    const stat = fs.statSync(absolutePath);
    return `1-${String(Math.trunc(stat.mtimeMs)).padStart(16, '0')}-${name}`;
  } catch {
    return `2-${name}`;
  }
}

export function listSnapshotEntries(targetDir: string, snapshotRootDir: string): SnapshotEntry[] {
  const snapshotsRoot = path.join(targetDir, snapshotRootDir);
  if (!fs.existsSync(snapshotsRoot)) {
    return [];
  }

  return fs.readdirSync(snapshotsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const absolutePath = path.join(snapshotsRoot, entry.name);
      return {
        name: entry.name,
        absolutePath,
        relativePath: toProjectRelativePath(targetDir, absolutePath),
        sortKey: buildSnapshotSortKey(entry.name, absolutePath),
      };
    })
    .sort((left, right) => right.sortKey.localeCompare(left.sortKey));
}

export function gcSnapshotEntries(
  targetDir: string,
  snapshotRootDir: string,
  activeRootDir: string | null,
  retainCount: number,
  logger: Logger,
): string[] {
  if (!activeRootDir) {
    return [];
  }

  const normalizedRetainCount = Math.max(1, retainCount);
  const entries = listSnapshotEntries(targetDir, snapshotRootDir);
  if (entries.length <= normalizedRetainCount) {
    return [];
  }

  const keep = new Set<string>();
  const activeEntry = entries.find(entry => entry.relativePath === activeRootDir);
  if (activeEntry) {
    keep.add(activeEntry.relativePath);
  } else {
    keep.add(activeRootDir);
  }

  for (const entry of entries) {
    if (keep.has(entry.relativePath)) {
      continue;
    }
    keep.add(entry.relativePath);
    if (keep.size >= normalizedRetainCount) {
      break;
    }
  }

  const removed: string[] = [];
  for (const entry of entries) {
    if (keep.has(entry.relativePath)) {
      continue;
    }
    try {
      if (removeManagedPath(targetDir, entry.absolutePath)) {
        removed.push(entry.relativePath);
      }
    } catch (error) {
      logger.warn(`清理旧快照失败: ${entry.relativePath} - ${(error as Error).message}`);
    }
  }

  return removed.sort();
}

function normalizeDependencyRecord(record: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record || {}).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function readPackageJsonForFingerprint(packageJsonPath: string): PackageJson | null {
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as PackageJson;
  } catch {
    return null;
  }
}

export function computeDepsFingerprint(targetDir: string, workspaceInfo?: WorkspaceInfo | null): string | null {
  const packages = new Map<string, { dependencies: Record<string, string>; devDependencies: Record<string, string> }>();

  if (workspaceInfo?.projects?.length) {
    for (const project of workspaceInfo.projects) {
      const packageJsonPath = path.join(project.absolutePath, 'package.json');
      const packageJson = project.packageJson || readPackageJsonForFingerprint(packageJsonPath);
      if (!packageJson) {
        continue;
      }

      packages.set(project.relativePath, {
        dependencies: normalizeDependencyRecord(packageJson.dependencies),
        devDependencies: normalizeDependencyRecord(packageJson.devDependencies),
      });
    }
  }

  if (packages.size === 0) {
    const rootPackageJson = readPackageJsonForFingerprint(path.join(targetDir, 'package.json'));
    if (!rootPackageJson) {
      return null;
    }

    packages.set('.', {
      dependencies: normalizeDependencyRecord(rootPackageJson.dependencies),
      devDependencies: normalizeDependencyRecord(rootPackageJson.devDependencies),
    });
  }

  const payload = {
    packages: [...packages.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([relativePath, deps]) => ({
        relativePath,
        dependencies: deps.dependencies,
        devDependencies: deps.devDependencies,
      })),
  };

  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

export function buildInstallState(params: BuildInstallStateParams): InstallState {
  const {
    version,
    installedAt = new Date().toISOString(),
    ctx,
    targetDir,
    depsFingerprint = null,
    outputPath,
    workspaceIndexPath,
    skillsRootDir,
    skillsSnapshotRetention,
    agentsRootDir,
    agentsSnapshotRetention,
    layer1RulesCount,
    layer2IndexCount,
    layer3IndexCount,
    skillsCount,
    agentsCount,
    distributedScripts,
    distributedWorkflows,
    distributedTaskBooks,
    distributedAgentCalls,
    distributedCommands,
    managedFiles,
    workspaceInfo,
  } = params;

  const profile: InstallState['profile'] = ctx.profile;
  const mode: InstallState['mode'] = ctx.isRemote ? 'remote' : 'local';
  const rulesFile = toProjectRelativePath(targetDir, outputPath);
  const workspaceIndexFile = workspaceIndexPath
    ? toProjectRelativePath(targetDir, workspaceIndexPath)
    : null;
  const normalizedManagedFiles = managedFiles
    .map(file => ({ path: file.path, sha256: file.sha256, size: file.size }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const stableManagedFiles = normalizedManagedFiles.filter(file => file.path !== rulesFile && file.path !== workspaceIndexFile);

  const hashPayload = {
    version,
    mode,
    profile,
    enableOrchestrator: ctx.enableOrchestrator,
    depsFingerprint,
    source: {
      remoteBaseUrl: ctx.isRemote ? ctx.remoteBaseUrl : null,
      manifestVersion: ctx.remoteManifest?.version || null,
      manifestGeneratedAt: ctx.remoteManifest?.generatedAt || null,
      contentPackFile: ctx.remoteContentPack?.file || null,
      contentPackFormat: ctx.remoteContentPack?.format || null,
      contentPackSha256: ctx.remoteContentPack?.sha256 || null,
    },
    options: {
      taskType: ctx.taskType,
      ruleLevel: ctx.ruleLevel,
      strictRemotePack: ctx.strictRemotePack,
      relevanceThreshold: ctx.relevanceThreshold,
      workspaceDiscovery: !ctx.disableWorkspace,
      workspaceScope: ctx.workspaceScope,
      targetProject: ctx.targetProject,
      targetRole: ctx.targetRole,
    },
    outputs: {
      rulesFile,
      workspaceIndexFile,
      skillsRootDir,
      skillsSnapshotRetention,
      agentsRootDir,
      agentsSnapshotRetention,
    },
    managedFiles: stableManagedFiles,
    stats: {
      layer1Rules: layer1RulesCount,
      layer2Indexes: layer2IndexCount,
      layer3Indexes: layer3IndexCount,
      skills: skillsCount,
      agents: agentsCount,
      scripts: distributedScripts.slice().sort(),
      workflows: distributedWorkflows.slice().sort(),
      taskbooks: distributedTaskBooks.slice().sort(),
      agentCalls: distributedAgentCalls.slice().sort(),
      commands: distributedCommands.slice().sort(),
      workspaceProjects: workspaceInfo.projects.map(project => project.relativePath).sort(),
    },
  };

  const contentHash = createHash('sha256')
    .update(JSON.stringify(hashPayload))
    .digest('hex');

  return {
    schemaVersion: INSTALL_STATE_SCHEMA_VERSION,
    version,
    installedAt,
    mode,
    profile,
    enableOrchestrator: ctx.enableOrchestrator,
    contentHash,
    depsFingerprint,
    source: {
      remoteBaseUrl: ctx.isRemote ? ctx.remoteBaseUrl : null,
      manifestVersion: ctx.remoteManifest?.version || null,
      manifestGeneratedAt: ctx.remoteManifest?.generatedAt || null,
      contentPackFile: ctx.remoteContentPack?.file || null,
      contentPackFormat: ctx.remoteContentPack?.format || null,
      contentPackSha256: ctx.remoteContentPack?.sha256 || null,
    },
    options: {
      taskType: ctx.taskType,
      ruleLevel: ctx.ruleLevel,
      strictRemotePack: ctx.strictRemotePack,
      relevanceThreshold: ctx.relevanceThreshold,
      workspaceDiscovery: !ctx.disableWorkspace,
      workspaceScope: ctx.workspaceScope,
      targetProject: ctx.targetProject,
      targetRole: ctx.targetRole,
    },
    outputs: {
      rulesFile,
      workspaceIndexFile,
      skillsRootDir,
      skillsSnapshotRetention,
      agentsRootDir,
      agentsSnapshotRetention,
    },
    managedFiles: normalizedManagedFiles,
    stats: {
      layer1Rules: layer1RulesCount,
      layer2Indexes: layer2IndexCount,
      layer3Indexes: layer3IndexCount,
      skills: skillsCount,
      agents: agentsCount,
      scripts: distributedScripts.length,
      workflows: distributedWorkflows.length,
      taskbooks: distributedTaskBooks.length,
      agentCalls: distributedAgentCalls.length,
      commands: distributedCommands.length,
      workspaceProjects: workspaceInfo.projects.length,
    },
  };
}

export function writeInstallState(targetDir: string, installState: InstallState): string {
  const installStatePath = path.join(targetDir, '.codebuddy', 'install.json');
  const installStateDir = path.dirname(installStatePath);
  if (!fs.existsSync(installStateDir)) {
    fs.mkdirSync(installStateDir, { recursive: true });
  }
  fs.writeFileSync(installStatePath, JSON.stringify(installState, null, 2), 'utf-8');
  return installStatePath;
}
