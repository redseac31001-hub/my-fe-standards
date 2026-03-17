import * as fs from 'fs';
import * as path from 'path';
import type { ValidatorGateSummary } from '../types/reports';

export const VALIDATOR_GATE_CANDIDATE_PATHS = [
  'validators/latest/validator-gate-summary.json',
  'validators/validator-gate-summary.json',
];

export function readLatestValidatorGateReport(targetDir: string): ValidatorGateSummary | null {
  for (const relativePath of VALIDATOR_GATE_CANDIDATE_PATHS) {
    const absolutePath = path.join(targetDir, '.codebuddy', 'reports', relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf-8')) as ValidatorGateSummary;
      if (parsed && typeof parsed.generatedAt === 'string') {
        return parsed;
      }
    } catch {
      // ignore malformed reports and keep searching
    }
  }

  return null;
}
