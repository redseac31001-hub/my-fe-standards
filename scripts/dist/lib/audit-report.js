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
exports.AUDIT_HISTORY_ROOT = exports.AUDIT_STANDARD_LATEST_DIR = exports.AUDIT_CANDIDATE_PATHS = void 0;
exports.readLatestAuditReport = readLatestAuditReport;
exports.readAuditHistory = readAuditHistory;
exports.cleanupAuditHistory = cleanupAuditHistory;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const reports_1 = require("../types/reports");
exports.AUDIT_CANDIDATE_PATHS = [
    'audit/latest/audit-summary.json',
    'audit/audit-summary.json',
];
exports.AUDIT_STANDARD_LATEST_DIR = '.codebuddy/reports/audit/latest';
exports.AUDIT_HISTORY_ROOT = '.codebuddy/reports/audit/history';
function readAuditSummaryFile(filePath) {
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (parsed && typeof parsed.generatedAt === 'string' && parsed.overview && Array.isArray(parsed.findings)) {
            return parsed;
        }
    }
    catch (_a) {
        // ignore malformed report
    }
    return null;
}
function readLatestAuditReport(targetDir) {
    for (const relativePath of exports.AUDIT_CANDIDATE_PATHS) {
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
function readAuditHistory(targetDir, limit = 10) {
    const historyRoot = path.join(targetDir, exports.AUDIT_HISTORY_ROOT);
    if (!fs.existsSync(historyRoot)) {
        return [];
    }
    const entries = [];
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
function cleanupAuditHistory(targetDir, retention = reports_1.DEFAULT_RETENTION_POLICY.audits) {
    const historyRoot = path.join(targetDir, exports.AUDIT_HISTORY_ROOT);
    if (!fs.existsSync(historyRoot)) {
        return 0;
    }
    const entries = fs.readdirSync(historyRoot, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => {
        var _a;
        const directoryPath = path.join(historyRoot, dirent.name);
        const summaryPath = path.join(directoryPath, 'audit-summary.json');
        const summary = fs.existsSync(summaryPath) ? readAuditSummaryFile(summaryPath) : null;
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
