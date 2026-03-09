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
exports.createManagedFileTracker = createManagedFileTracker;
exports.readInstallState = readInstallState;
exports.toProjectRelativePath = toProjectRelativePath;
exports.listFilesRecursive = listFilesRecursive;
exports.copyManagedFile = copyManagedFile;
exports.writeManagedFile = writeManagedFile;
exports.getManagedFiles = getManagedFiles;
exports.cleanupStaleManagedFiles = cleanupStaleManagedFiles;
exports.removeManagedPath = removeManagedPath;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
function createManagedFileTracker(targetDir) {
    return {
        targetDir,
        files: new Map(),
        summary: {
            written: 0,
            unchanged: 0,
            removed: 0,
        },
    };
}
function readInstallState(targetDir, logger) {
    const installStatePath = path.join(targetDir, '.codebuddy', 'install.json');
    if (!fs.existsSync(installStatePath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(installStatePath, 'utf-8'));
    }
    catch (error) {
        logger === null || logger === void 0 ? void 0 : logger.warn(`读取 install.json 失败: ${error.message}`);
        return null;
    }
}
function toProjectRelativePath(targetDir, absolutePath) {
    return path.relative(targetDir, absolutePath).replace(/\\/g, '/');
}
function listFilesRecursive(rootDir) {
    if (!fs.existsSync(rootDir)) {
        return [];
    }
    const results = [];
    const stack = [rootDir];
    while (stack.length > 0) {
        const current = stack.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
            }
            else if (entry.isFile()) {
                results.push(fullPath);
            }
        }
    }
    return results.sort();
}
function copyManagedFile(tracker, sourcePath, destinationPath) {
    const content = fs.readFileSync(sourcePath);
    return writeManagedFile(tracker, destinationPath, content);
}
function writeManagedFile(tracker, destinationPath, content) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
    const relativePath = toProjectRelativePath(tracker.targetDir, destinationPath);
    const record = {
        path: relativePath,
        sha256: (0, crypto_1.createHash)('sha256').update(buffer).digest('hex'),
        size: buffer.length,
    };
    let shouldWrite = true;
    if (fs.existsSync(destinationPath)) {
        const existing = fs.readFileSync(destinationPath);
        const existingHash = (0, crypto_1.createHash)('sha256').update(existing).digest('hex');
        shouldWrite = existingHash !== record.sha256;
    }
    if (shouldWrite) {
        const destinationDir = path.dirname(destinationPath);
        if (!fs.existsSync(destinationDir)) {
            fs.mkdirSync(destinationDir, { recursive: true });
        }
        fs.writeFileSync(destinationPath, buffer);
        tracker.summary.written += 1;
    }
    else {
        tracker.summary.unchanged += 1;
    }
    tracker.files.set(relativePath, record);
    return shouldWrite;
}
function getManagedFiles(tracker) {
    return Array.from(tracker.files.values()).sort((left, right) => left.path.localeCompare(right.path));
}
function cleanupStaleManagedFiles(tracker, previousInstallState, options, logger) {
    var _a;
    if (!((_a = previousInstallState === null || previousInstallState === void 0 ? void 0 : previousInstallState.managedFiles) === null || _a === void 0 ? void 0 : _a.length)) {
        return [];
    }
    const currentPaths = new Set(tracker.files.keys());
    const preservePrefixes = ((options === null || options === void 0 ? void 0 : options.preservePrefixes) || []).map(prefix => prefix.replace(/\\/g, '/'));
    const removed = [];
    for (const managedFile of previousInstallState.managedFiles) {
        if (currentPaths.has(managedFile.path)) {
            continue;
        }
        if (preservePrefixes.some(prefix => managedFile.path.startsWith(prefix))) {
            continue;
        }
        if (!managedFile.path.startsWith('.codebuddy/')) {
            logger === null || logger === void 0 ? void 0 : logger.warn(`跳过清理非 .codebuddy 管理文件: ${managedFile.path}`);
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
        }
        catch (error) {
            logger === null || logger === void 0 ? void 0 : logger.warn(`清理陈旧文件失败: ${managedFile.path} - ${error.message}`);
        }
    }
    return removed.sort();
}
function removeManagedPath(targetDir, absolutePath) {
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
function ensureWritableRecursive(targetPath) {
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
        }
        catch (_a) { }
        return;
    }
    try {
        fs.chmodSync(targetPath, 0o666);
    }
    catch (_b) { }
}
function pruneEmptyParents(targetDir, startDir) {
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
