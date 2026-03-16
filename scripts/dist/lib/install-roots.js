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
exports.resolveInstalledSkillsRootDir = resolveInstalledSkillsRootDir;
exports.resolveInstalledSkillsSnapshotRetention = resolveInstalledSkillsSnapshotRetention;
exports.resolveInstalledAgentsRootDir = resolveInstalledAgentsRootDir;
exports.resolveInstalledAgentsSnapshotRetention = resolveInstalledAgentsSnapshotRetention;
exports.resolveInstalledRulesCacheRootDir = resolveInstalledRulesCacheRootDir;
exports.getProjectInstallState = getProjectInstallState;
exports.getProjectAgentRootCandidates = getProjectAgentRootCandidates;
exports.getProjectSkillRootCandidates = getProjectSkillRootCandidates;
exports.getProjectRuleRootCandidates = getProjectRuleRootCandidates;
exports.getProjectAgentRootCandidatePaths = getProjectAgentRootCandidatePaths;
exports.getProjectSkillRootCandidatePaths = getProjectSkillRootCandidatePaths;
exports.getProjectRuleRootCandidatePaths = getProjectRuleRootCandidatePaths;
exports.listAgentDefinitionCandidatePaths = listAgentDefinitionCandidatePaths;
exports.listAgentPromptCandidatePaths = listAgentPromptCandidatePaths;
const path = __importStar(require("path"));
const install_sync_1 = require("./install-sync");
function normalizeRelativeRoot(relativeRoot) {
    if (typeof relativeRoot !== 'string')
        return null;
    const normalized = relativeRoot.trim().replace(/\\/g, '/');
    return normalized ? normalized : null;
}
function dedupeRelativeRoots(relativeRoots) {
    const seen = new Set();
    const result = [];
    for (const relativeRoot of relativeRoots) {
        const normalized = normalizeRelativeRoot(relativeRoot);
        if (!normalized || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        result.push(normalized);
    }
    return result;
}
function resolveInstalledSkillsRootDir(installState) {
    if (!installState)
        return null;
    return normalizeRelativeRoot(installState.outputs.skillsRootDir)
        || (installState.stats.skills > 0 ? '.codebuddy/skills' : null);
}
function resolveInstalledSkillsSnapshotRetention(installState) {
    if (!installState)
        return null;
    if (typeof installState.outputs.skillsSnapshotRetention === 'number') {
        return installState.outputs.skillsSnapshotRetention;
    }
    return resolveInstalledSkillsRootDir(installState) ? 3 : null;
}
function resolveInstalledAgentsRootDir(installState) {
    if (!installState)
        return null;
    return normalizeRelativeRoot(installState.outputs.agentsRootDir)
        || (installState.stats.agents > 0 ? '.codebuddy/agents' : null);
}
function resolveInstalledAgentsSnapshotRetention(installState) {
    if (!installState)
        return null;
    if (typeof installState.outputs.agentsSnapshotRetention === 'number') {
        return installState.outputs.agentsSnapshotRetention;
    }
    return resolveInstalledAgentsRootDir(installState) ? 3 : null;
}
function resolveInstalledRulesCacheRootDir(installState) {
    if (!installState)
        return null;
    const hasInstalledRuleCache = installState.stats.layer1Rules > 0
        || installState.stats.layer2Indexes > 0
        || installState.stats.layer3Indexes > 0;
    return hasInstalledRuleCache ? '.codebuddy/rules_cache' : null;
}
function getProjectInstallState(projectRoot) {
    return (0, install_sync_1.readInstallState)(projectRoot);
}
function getProjectAgentRootCandidates(projectRoot, installState) {
    const resolvedInstallState = typeof installState === 'undefined'
        ? getProjectInstallState(projectRoot)
        : installState;
    return dedupeRelativeRoots([
        resolveInstalledAgentsRootDir(resolvedInstallState),
        '.codebuddy/agents',
        'agents',
    ]);
}
function getProjectSkillRootCandidates(projectRoot, installState) {
    const resolvedInstallState = typeof installState === 'undefined'
        ? getProjectInstallState(projectRoot)
        : installState;
    return dedupeRelativeRoots([
        resolveInstalledSkillsRootDir(resolvedInstallState),
        '.codebuddy/skills',
        '.codebuddy/custom-skills',
        'custom-skills',
    ]);
}
function getProjectRuleRootCandidates(projectRoot, installState) {
    const resolvedInstallState = typeof installState === 'undefined'
        ? getProjectInstallState(projectRoot)
        : installState;
    return dedupeRelativeRoots([
        resolveInstalledRulesCacheRootDir(resolvedInstallState),
        '.codebuddy/rules_cache',
        'rules',
    ]);
}
function getProjectAgentRootCandidatePaths(projectRoot, installState) {
    return getProjectAgentRootCandidates(projectRoot, installState)
        .map(relativeRoot => path.join(projectRoot, relativeRoot));
}
function getProjectSkillRootCandidatePaths(projectRoot, installState) {
    return getProjectSkillRootCandidates(projectRoot, installState)
        .map(relativeRoot => path.join(projectRoot, relativeRoot));
}
function getProjectRuleRootCandidatePaths(projectRoot, installState) {
    return getProjectRuleRootCandidates(projectRoot, installState)
        .map(relativeRoot => path.join(projectRoot, relativeRoot));
}
function listAgentDefinitionCandidatePaths(projectRoot, agentId, installState) {
    return getProjectAgentRootCandidatePaths(projectRoot, installState)
        .map(rootDir => path.join(rootDir, agentId, 'AGENT.md'));
}
function listAgentPromptCandidatePaths(projectRoot, agentId, promptFileName, installState) {
    return getProjectAgentRootCandidatePaths(projectRoot, installState)
        .map(rootDir => path.join(rootDir, agentId, 'prompts', promptFileName));
}
