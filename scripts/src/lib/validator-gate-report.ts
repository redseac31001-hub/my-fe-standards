import * as fs from 'fs';
import * as path from 'path';
import type { ValidatorGateHistoryEntry, ValidatorGateSummary } from '../types/reports';

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
