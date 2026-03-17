import * as fs from 'fs';
import * as path from 'path';
import type {
  ValidatorGateDelta,
  ValidatorGateHistoryEntry,
  ValidatorGateSummary,
} from '../types/reports';
import { DEFAULT_RETENTION_POLICY, RetentionPolicy } from '../types/reports';

export const VALIDATOR_GATE_CANDIDATE_PATHS = [
  'validators/latest/validator-gate-summary.json',
  'validators/validator-gate-summary.json',
];
export const VALIDATOR_GATE_STANDARD_LATEST_DIR = '.codebuddy/reports/validators/latest';
export const VALIDATOR_GATE_HISTORY_ROOT = '.codebuddy/reports/validators/history';

function readValidatorGateSummaryFile(filePath: string): ValidatorGateSummary | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ValidatorGateSummary;
    if (parsed && typeof parsed.generatedAt === 'string') {
      return parsed;
    }
  } catch {
    // ignore malformed report
  }

  return null;
}

export function readLatestValidatorGateReport(targetDir: string): ValidatorGateSummary | null {
  for (const relativePath of VALIDATOR_GATE_CANDIDATE_PATHS) {
    const absolutePath = path.join(targetDir, '.codebuddy', 'reports', relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const parsed = readValidatorGateSummaryFile(absolutePath);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

export function readValidatorGateHistory(targetDir: string, limit: number = 10): ValidatorGateHistoryEntry[] {
  const historyRoot = path.join(targetDir, VALIDATOR_GATE_HISTORY_ROOT);
  if (!fs.existsSync(historyRoot)) {
    return [];
  }

  const entries: ValidatorGateHistoryEntry[] = [];

  for (const dirent of fs.readdirSync(historyRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) {
      continue;
    }

    const summaryPath = path.join(historyRoot, dirent.name, 'validator-gate-summary.json');
    if (!fs.existsSync(summaryPath)) {
      continue;
    }

    const summary = readValidatorGateSummaryFile(summaryPath);
    if (!summary) {
      continue;
    }

    entries.push({
      relativePath: path.posix.join('validators/history', dirent.name, 'validator-gate-summary.json'),
      generatedAt: summary.generatedAt,
      scope: summary.scope,
      strictMode: summary.strictMode,
      effectiveOk: summary.effectiveOk,
      errorCount: summary.errorCount,
      warningCount: summary.warningCount,
      issueCount: summary.issueCount,
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

export function getPreviousValidatorGateEntry(
  latest: ValidatorGateSummary | null,
  history: ValidatorGateHistoryEntry[],
): ValidatorGateHistoryEntry | null {
  if (!latest || history.length === 0) {
    return null;
  }

  return history.find((entry) => entry.generatedAt !== latest.generatedAt) || null;
}

function computeValidatorGateSeverityScore(entry: {
  effectiveOk: boolean;
  errorCount: number;
  warningCount: number;
  issueCount: number;
}): number {
  const failPenalty = entry.effectiveOk ? 0 : 1_000_000;
  return failPenalty + (entry.errorCount * 10_000) + (entry.warningCount * 100) + entry.issueCount;
}

export function buildValidatorGateDelta(
  latest: ValidatorGateSummary | null,
  previous: ValidatorGateHistoryEntry | null,
): ValidatorGateDelta | null {
  if (!latest || !previous) {
    return null;
  }

  const errorDelta = latest.errorCount - previous.errorCount;
  const warningDelta = latest.warningCount - previous.warningCount;
  const issueDelta = latest.issueCount - previous.issueCount;
  const effectiveOkChanged = latest.effectiveOk !== previous.effectiveOk;

  const latestScore = computeValidatorGateSeverityScore(latest);
  const previousScore = computeValidatorGateSeverityScore(previous);

  let direction: ValidatorGateDelta['direction'] = 'stable';
  if (latestScore > previousScore) {
    direction = 'regressed';
  } else if (latestScore < previousScore) {
    direction = 'improved';
  }

  return {
    previousGeneratedAt: previous.generatedAt,
    errorDelta,
    warningDelta,
    issueDelta,
    effectiveOkChanged,
    direction,
  };
}

export function cleanupValidatorGateHistory(
  targetDir: string,
  retention: RetentionPolicy['validators'] = DEFAULT_RETENTION_POLICY.validators,
): number {
  const historyRoot = path.join(targetDir, VALIDATOR_GATE_HISTORY_ROOT);
  if (!fs.existsSync(historyRoot)) {
    return 0;
  }

  const entries = fs.readdirSync(historyRoot, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => {
      const directoryPath = path.join(historyRoot, dirent.name);
      const summaryPath = path.join(directoryPath, 'validator-gate-summary.json');
      const summary = fs.existsSync(summaryPath) ? readValidatorGateSummaryFile(summaryPath) : null;
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
