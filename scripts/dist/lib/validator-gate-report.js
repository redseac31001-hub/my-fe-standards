"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALIDATOR_GATE_HISTORY_ROOT = exports.VALIDATOR_GATE_STANDARD_LATEST_DIR = exports.VALIDATOR_GATE_CANDIDATE_PATHS = void 0;
exports.readLatestValidatorGateReport = readLatestValidatorGateReport;
exports.readValidatorGateHistory = readValidatorGateHistory;
exports.getPreviousValidatorGateEntry = getPreviousValidatorGateEntry;
exports.buildValidatorGateDelta = buildValidatorGateDelta;
exports.cleanupValidatorGateHistory = cleanupValidatorGateHistory;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const reports_1 = require("../types/reports");
exports.VALIDATOR_GATE_CANDIDATE_PATHS = [
    'validators/latest/validator-gate-summary.json',
    'validators/validator-gate-summary.json',
];
exports.VALIDATOR_GATE_STANDARD_LATEST_DIR = '.codebuddy/reports/validators/latest';
exports.VALIDATOR_GATE_HISTORY_ROOT = '.codebuddy/reports/validators/history';
function readValidatorGateSummaryFile(filePath) {
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (parsed && typeof parsed.generatedAt === 'string') {
            return parsed;
        }
    }
    catch (_a) {
        // ignore malformed report
    }
    return null;
}
function readLatestValidatorGateReport(targetDir) {
    for (const relativePath of exports.VALIDATOR_GATE_CANDIDATE_PATHS) {
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
function readValidatorGateHistory(targetDir, limit = 10) {
    const historyRoot = path.join(targetDir, exports.VALIDATOR_GATE_HISTORY_ROOT);
    if (!fs.existsSync(historyRoot)) {
        return [];
    }
    const entries = [];
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
        if (Number.isNaN(leftTime) && Number.isNaN(rightTime))
            return 0;
        if (Number.isNaN(leftTime))
            return 1;
        if (Number.isNaN(rightTime))
            return -1;
        return rightTime - leftTime;
    });
    const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : entries.length;
    return entries.slice(0, normalizedLimit);
}
function getPreviousValidatorGateEntry(latest, history) {
    if (!latest || history.length === 0) {
        return null;
    }
    return history.find((entry) => entry.generatedAt !== latest.generatedAt) || null;
}
function computeValidatorGateSeverityScore(entry) {
    const failPenalty = entry.effectiveOk ? 0 : 1000000;
    return failPenalty + (entry.errorCount * 10000) + (entry.warningCount * 100) + entry.issueCount;
}
function buildValidatorGateDelta(latest, previous) {
    if (!latest || !previous) {
        return null;
    }
    const errorDelta = latest.errorCount - previous.errorCount;
    const warningDelta = latest.warningCount - previous.warningCount;
    const issueDelta = latest.issueCount - previous.issueCount;
    const effectiveOkChanged = latest.effectiveOk !== previous.effectiveOk;
    const latestScore = computeValidatorGateSeverityScore(latest);
    const previousScore = computeValidatorGateSeverityScore(previous);
    let direction = 'stable';
    if (latestScore > previousScore) {
        direction = 'regressed';
    }
    else if (latestScore < previousScore) {
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
function cleanupValidatorGateHistory(targetDir, retention = reports_1.DEFAULT_RETENTION_POLICY.validators) {
    const historyRoot = path.join(targetDir, exports.VALIDATOR_GATE_HISTORY_ROOT);
    if (!fs.existsSync(historyRoot)) {
        return 0;
    }
    const entries = fs.readdirSync(historyRoot, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => {
        var _a;
        const directoryPath = path.join(historyRoot, dirent.name);
        const summaryPath = path.join(directoryPath, 'validator-gate-summary.json');
        const summary = fs.existsSync(summaryPath) ? readValidatorGateSummaryFile(summaryPath) : null;
        const generatedAt = (_a = summary === null || summary === void 0 ? void 0 : summary.generatedAt) !== null && _a !== void 0 ? _a : null;
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
