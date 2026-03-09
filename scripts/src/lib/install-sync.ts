import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { InstallManagedFile, InstallState } from '../types';
import { Logger } from './logger';

export interface ManagedFileTracker {
  targetDir: string;
  files: Map<string, InstallManagedFile>;
  summary: {
    written: number;
    unchanged: number;
    removed: number;
  };
}

export function createManagedFileTracker(targetDir: string): ManagedFileTracker {
  return {
    targetDir,
    files: new Map<string, InstallManagedFile>(),
    summary: {
      written: 0,
      unchanged: 0,
      removed: 0,
    },
  };
}

export function readInstallState(targetDir: string, logger?: Logger): InstallState | null {
  const installStatePath = path.join(targetDir, '.codebuddy', 'install.json');
  if (!fs.existsSync(installStatePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(installStatePath, 'utf-8')) as InstallState;
  } catch (error) {
    logger?.warn(`读取 install.json 失败: ${(error as Error).message}`);
    return null;
  }
}

export function toProjectRelativePath(targetDir: string, absolutePath: string): string {
  return path.relative(targetDir, absolutePath).replace(/\\/g, '/');
}

export function listFilesRecursive(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const results: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }

  return results.sort();
}

export function copyManagedFile(tracker: ManagedFileTracker, sourcePath: string, destinationPath: string): boolean {
  const content = fs.readFileSync(sourcePath);
  return writeManagedFile(tracker, destinationPath, content);
}

export function writeManagedFile(
  tracker: ManagedFileTracker,
  destinationPath: string,
  content: string | Buffer,
): boolean {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
  const relativePath = toProjectRelativePath(tracker.targetDir, destinationPath);
  const record: InstallManagedFile = {
    path: relativePath,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    size: buffer.length,
  };

  let shouldWrite = true;
  if (fs.existsSync(destinationPath)) {
    const existing = fs.readFileSync(destinationPath);
    const existingHash = createHash('sha256').update(existing).digest('hex');
    shouldWrite = existingHash !== record.sha256;
  }

  if (shouldWrite) {
    const destinationDir = path.dirname(destinationPath);
    if (!fs.existsSync(destinationDir)) {
      fs.mkdirSync(destinationDir, { recursive: true });
    }
    fs.writeFileSync(destinationPath, buffer);
    tracker.summary.written += 1;
  } else {
    tracker.summary.unchanged += 1;
  }

  tracker.files.set(relativePath, record);
  return shouldWrite;
}

export function getManagedFiles(tracker: ManagedFileTracker): InstallManagedFile[] {
  return Array.from(tracker.files.values()).sort((left, right) => left.path.localeCompare(right.path));
}

export function cleanupStaleManagedFiles(
  tracker: ManagedFileTracker,
  previousInstallState: InstallState | null,
  options?: {
    preservePrefixes?: string[];
  },
  logger?: Logger,
): string[] {
  if (!previousInstallState?.managedFiles?.length) {
    return [];
  }

  const currentPaths = new Set(tracker.files.keys());
  const preservePrefixes = (options?.preservePrefixes || []).map(prefix => prefix.replace(/\\/g, '/'));
  const removed: string[] = [];

  for (const managedFile of previousInstallState.managedFiles) {
    if (currentPaths.has(managedFile.path)) {
      continue;
    }

    if (preservePrefixes.some(prefix => managedFile.path.startsWith(prefix))) {
      continue;
    }

    if (!managedFile.path.startsWith('.codebuddy/')) {
      logger?.warn(`跳过清理非 .codebuddy 管理文件: ${managedFile.path}`);
      continue;
    }

    const absolutePath = path.join(tracker.targetDir, managedFile.path);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    try {
      if (!removeManagedPath(tracker.targetDir, absolutePath)) {
        continue;
      }
      tracker.summary.removed += 1;
      removed.push(managedFile.path);
    } catch (error) {
      logger?.warn(`清理陈旧文件失败: ${managedFile.path} - ${(error as Error).message}`);
    }
  }

  return removed.sort();
}

export function removeManagedPath(targetDir: string, absolutePath: string): boolean {
  if (!fs.existsSync(absolutePath)) {
    return false;
  }

  ensureWritableRecursive(absolutePath);
  fs.rmSync(absolutePath, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 50,
  });

  if (fs.existsSync(absolutePath)) {
    return false;
  }

  pruneEmptyParents(targetDir, path.dirname(absolutePath));
  return true;
}

function ensureWritableRecursive(targetPath: string): void {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  const stat = fs.lstatSync(targetPath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath)) {
      ensureWritableRecursive(path.join(targetPath, entry));
    }
    try {
      fs.chmodSync(targetPath, 0o777);
    } catch {}
    return;
  }

  try {
    fs.chmodSync(targetPath, 0o666);
  } catch {}
}

function pruneEmptyParents(targetDir: string, startDir: string): void {
  const stopDir = path.join(targetDir, '.codebuddy');
  let current = startDir;

  while (current.startsWith(stopDir) && current !== stopDir) {
    if (!fs.existsSync(current)) {
      current = path.dirname(current);
      continue;
    }

    const entries = fs.readdirSync(current);
    if (entries.length > 0) {
      break;
    }

    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}
