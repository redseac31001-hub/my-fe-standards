import * as fs from 'fs';
import * as path from 'path';
import type {
  AuditHistoryEntry,
  ReportManagerAuditSnapshot,
  RetentionPolicy,
} from '../types/reports';
import { DEFAULT_RETENTION_POLICY } from '../types/reports';

export const AUDIT_CANDIDATE_PATHS = [
  'audit/latest/audit-summary.json',
  'audit/audit-summary.json',
];
export const AUDIT_STANDARD_LATEST_DIR = '.codebuddy/reports/audit/latest';
export const AUDIT_HISTORY_ROOT = '.codebuddy/reports/audit/history';

function readAuditSummaryFile(filePath: string): ReportManagerAuditSnapshot | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ReportManagerAuditSnapshot;
    if (parsed && typeof parsed.generatedAt === 'string' && parsed.overview && Array.isArray(parsed.findings)) {
      return parsed;
    }
  } catch {
    // ignore malformed report
  }

  return null;
}

export function readLatestAuditReport(targetDir: string): ReportManagerAuditSnapshot | null {
  for (const relativePath of AUDIT_CANDIDATE_PATHS) {
    const absolutePath = path.join(targetDir, '.codebuddy', 'reports', relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const parsed = readAuditSummaryFile(absolutePath);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

export function readAuditHistory(targetDir: string, limit: number = 10): AuditHistoryEntry[] {
  const historyRoot = path.join(targetDir, AUDIT_HISTORY_ROOT);
  if (!fs.existsSync(historyRoot)) {
    return [];
  }

  const entries: AuditHistoryEntry[] = [];

  for (const dirent of fs.readdirSync(historyRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) {
      continue;
    }

    const summaryPath = path.join(historyRoot, dirent.name, 'audit-summary.json');
    if (!fs.existsSync(summaryPath)) {
      continue;
    }

    const summary = readAuditSummaryFile(summaryPath);
    if (!summary) {
      continue;
    }

    entries.push({
      relativePath: path.posix.join('audit/history', dirent.name, 'audit-summary.json'),
      generatedAt: summary.generatedAt,
      overallStatus: summary.overview.overallStatus,
      findingsCount: summary.overview.findingsCount,
      validatorStatus: summary.overview.validatorStatus,
      validatorDirection: summary.overview.validatorDirection,
    });
  }

  entries.sort((left, right) => {
    const leftTime = new Date(left.generatedAt).getTime();
    const rightTime = new Date(right.generatedAt).getTime();
    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
    if (Number.isNaN(leftTime)) return 1;
    if (Number.isNaN(rightTime)) return -1;
    return rightTime - leftTime;
  });

  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : entries.length;
  return entries.slice(0, normalizedLimit);
}

export function cleanupAuditHistory(
  targetDir: string,
  retention: RetentionPolicy['audits'] = DEFAULT_RETENTION_POLICY.audits,
): number {
  const historyRoot = path.join(targetDir, AUDIT_HISTORY_ROOT);
  if (!fs.existsSync(historyRoot)) {
    return 0;
  }

  const entries = fs.readdirSync(historyRoot, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => {
      const directoryPath = path.join(historyRoot, dirent.name);
      const summaryPath = path.join(directoryPath, 'audit-summary.json');
      const summary = fs.existsSync(summaryPath) ? readAuditSummaryFile(summaryPath) : null;
      const generatedAt = summary?.generatedAt ?? null;
      const time = generatedAt ? new Date(generatedAt).getTime() : fs.statSync(directoryPath).mtime.getTime();
      return {
        directoryPath,
        time,
      };
    })
    .sort((left, right) => right.time - left.time);

  const maxAgeMs = retention.maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let removed = 0;

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const tooMany = index >= retention.maxCount;
    const tooOld = Number.isFinite(entry.time) ? (now - entry.time > maxAgeMs) : false;
    if (!tooMany && !tooOld) {
      continue;
    }

    fs.rmSync(entry.directoryPath, { recursive: true, force: true });
    removed += 1;
  }

  return removed;
}
