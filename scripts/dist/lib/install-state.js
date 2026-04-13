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
exports.INSTALL_STATE_SCHEMA_VERSION = void 0;
exports.createInstallSnapshotId = createInstallSnapshotId;
exports.buildSnapshotSortKey = buildSnapshotSortKey;
exports.listSnapshotEntries = listSnapshotEntries;
exports.gcSnapshotEntries = gcSnapshotEntries;
exports.computeDepsFingerprint = computeDepsFingerprint;
exports.buildInstallState = buildInstallState;
exports.writeInstallState = writeInstallState;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const install_sync_1 = require("./install-sync");
exports.INSTALL_STATE_SCHEMA_VERSION = '1.2.0';
function createInstallSnapshotId(options = {}) {
    var _a, _b, _c, _d;
    const now = (_a = options.now) !== null && _a !== void 0 ? _a : new Date();
    const timestamp = now
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d+Z$/, 'Z');
    const entropy = (0, crypto_1.createHash)('sha256')
        .update(`${(_b = options.pid) !== null && _b !== void 0 ? _b : process.pid}-${(_c = options.randomValue) !== null && _c !== void 0 ? _c : Math.random()}-${(_d = options.epochMs) !== null && _d !== void 0 ? _d : Date.now()}`)
        .digest('hex')
        .slice(0, 8);
    return `${timestamp}-${entropy}`;
}
function buildSnapshotSortKey(name, absolutePath) {
    if (/^\d{8}T\d{6}Z-[a-f0-9]+$/i.test(name)) {
        return `0-${name}`;
    }
    try {
        const stat = fs.statSync(absolutePath);
        return `1-${String(Math.trunc(stat.mtimeMs)).padStart(16, '0')}-${name}`;
    }
    catch (_a) {
        return `2-${name}`;
    }
}
function listSnapshotEntries(targetDir, snapshotRootDir) {
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
            relativePath: (0, install_sync_1.toProjectRelativePath)(targetDir, absolutePath),
            sortKey: buildSnapshotSortKey(entry.name, absolutePath),
        };
    })
        .sort((left, right) => right.sortKey.localeCompare(left.sortKey));
}
function gcSnapshotEntries(targetDir, snapshotRootDir, activeRootDir, retainCount, logger) {
    if (!activeRootDir) {
        return [];
    }
    const normalizedRetainCount = Math.max(1, retainCount);
    const entries = listSnapshotEntries(targetDir, snapshotRootDir);
    if (entries.length <= normalizedRetainCount) {
        return [];
    }
    const keep = new Set();
    const activeEntry = entries.find(entry => entry.relativePath === activeRootDir);
    if (activeEntry) {
        keep.add(activeEntry.relativePath);
    }
    else {
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
    const removed = [];
    for (const entry of entries) {
        if (keep.has(entry.relativePath)) {
            continue;
        }
        try {
            if ((0, install_sync_1.removeManagedPath)(targetDir, entry.absolutePath)) {
                removed.push(entry.relativePath);
            }
        }
        catch (error) {
            logger.warn(`清理旧快照失败: ${entry.relativePath} - ${error.message}`);
        }
    }
    return removed.sort();
}
function normalizeDependencyRecord(record) {
    return Object.fromEntries(Object.entries(record || {}).sort(([left], [right]) => left.localeCompare(right)));
}
function readPackageJsonForFingerprint(packageJsonPath) {
    if (!fs.existsSync(packageJsonPath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    }
    catch (_a) {
        return null;
    }
}
function computeDepsFingerprint(targetDir, workspaceInfo) {
    var _a;
    const packages = new Map();
    if ((_a = workspaceInfo === null || workspaceInfo === void 0 ? void 0 : workspaceInfo.projects) === null || _a === void 0 ? void 0 : _a.length) {
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
    return (0, crypto_1.createHash)('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');
}
function buildInstallState(params) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const { version, installedAt = new Date().toISOString(), ctx, targetDir, depsFingerprint = null, outputPath, workspaceIndexPath, skillsRootDir, skillsSnapshotRetention, agentsRootDir, agentsSnapshotRetention, layer1RulesCount, layer2IndexCount, layer3IndexCount, skillsCount, agentsCount, distributedScripts, distributedWorkflows, distributedTaskBooks, distributedAgentCalls, distributedCommands, managedFiles, workspaceInfo, } = params;
    const profile = ctx.profile;
    const mode = ctx.isRemote ? 'remote' : 'local';
    const rulesFile = (0, install_sync_1.toProjectRelativePath)(targetDir, outputPath);
    const workspaceIndexFile = workspaceIndexPath
        ? (0, install_sync_1.toProjectRelativePath)(targetDir, workspaceIndexPath)
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
            manifestVersion: ((_a = ctx.remoteManifest) === null || _a === void 0 ? void 0 : _a.version) || null,
            manifestGeneratedAt: ((_b = ctx.remoteManifest) === null || _b === void 0 ? void 0 : _b.generatedAt) || null,
            contentPackFile: ((_c = ctx.remoteContentPack) === null || _c === void 0 ? void 0 : _c.file) || null,
            contentPackFormat: ((_d = ctx.remoteContentPack) === null || _d === void 0 ? void 0 : _d.format) || null,
            contentPackSha256: ((_e = ctx.remoteContentPack) === null || _e === void 0 ? void 0 : _e.sha256) || null,
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
    const contentHash = (0, crypto_1.createHash)('sha256')
        .update(JSON.stringify(hashPayload))
        .digest('hex');
    return {
        schemaVersion: exports.INSTALL_STATE_SCHEMA_VERSION,
        version,
        installedAt,
        mode,
        profile,
        enableOrchestrator: ctx.enableOrchestrator,
        contentHash,
        depsFingerprint,
        source: {
            remoteBaseUrl: ctx.isRemote ? ctx.remoteBaseUrl : null,
            manifestVersion: ((_f = ctx.remoteManifest) === null || _f === void 0 ? void 0 : _f.version) || null,
            manifestGeneratedAt: ((_g = ctx.remoteManifest) === null || _g === void 0 ? void 0 : _g.generatedAt) || null,
            contentPackFile: ((_h = ctx.remoteContentPack) === null || _h === void 0 ? void 0 : _h.file) || null,
            contentPackFormat: ((_j = ctx.remoteContentPack) === null || _j === void 0 ? void 0 : _j.format) || null,
            contentPackSha256: ((_k = ctx.remoteContentPack) === null || _k === void 0 ? void 0 : _k.sha256) || null,
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
function writeInstallState(targetDir, installState) {
    const installStatePath = path.join(targetDir, '.codebuddy', 'install.json');
    const installStateDir = path.dirname(installStatePath);
    if (!fs.existsSync(installStateDir)) {
        fs.mkdirSync(installStateDir, { recursive: true });
    }
    fs.writeFileSync(installStatePath, JSON.stringify(installState, null, 2), 'utf-8');
    return installStatePath;
}
