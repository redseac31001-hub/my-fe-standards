import * as path from 'path';
import { InstallState } from '../types';
import { readInstallState } from './install-sync';

function normalizeRelativeRoot(relativeRoot: string | null | undefined): string | null {
  if (typeof relativeRoot !== 'string') return null;
  const normalized = relativeRoot.trim().replace(/\\/g, '/');
  return normalized ? normalized : null;
}

function dedupeRelativeRoots(relativeRoots: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

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

export function resolveInstalledSkillsRootDir(installState: InstallState | null): string | null {
  if (!installState) return null;
  return normalizeRelativeRoot(installState.outputs.skillsRootDir)
    || (installState.stats.skills > 0 ? '.codebuddy/skills' : null);
}

export function resolveInstalledSkillsSnapshotRetention(installState: InstallState | null): number | null {
  if (!installState) return null;
  if (typeof installState.outputs.skillsSnapshotRetention === 'number') {
    return installState.outputs.skillsSnapshotRetention;
  }
  return resolveInstalledSkillsRootDir(installState) ? 3 : null;
}

export function resolveInstalledAgentsRootDir(installState: InstallState | null): string | null {
  if (!installState) return null;
  return normalizeRelativeRoot(installState.outputs.agentsRootDir)
    || (installState.stats.agents > 0 ? '.codebuddy/agents' : null);
}

export function resolveInstalledAgentsSnapshotRetention(installState: InstallState | null): number | null {
  if (!installState) return null;
  if (typeof installState.outputs.agentsSnapshotRetention === 'number') {
    return installState.outputs.agentsSnapshotRetention;
  }
  return resolveInstalledAgentsRootDir(installState) ? 3 : null;
}

export function resolveInstalledRulesCacheRootDir(installState: InstallState | null): string | null {
  if (!installState) return null;
  const hasInstalledRuleCache = installState.stats.layer1Rules > 0
    || installState.stats.layer2Indexes > 0
    || installState.stats.layer3Indexes > 0;
  return hasInstalledRuleCache ? '.codebuddy/rules_cache' : null;
}

export function getProjectInstallState(projectRoot: string): InstallState | null {
  return readInstallState(projectRoot);
}

export function getProjectAgentRootCandidates(projectRoot: string, installState?: InstallState | null): string[] {
  const resolvedInstallState = typeof installState === 'undefined'
    ? getProjectInstallState(projectRoot)
    : installState;
  return dedupeRelativeRoots([
    resolveInstalledAgentsRootDir(resolvedInstallState),
    '.codebuddy/agents',
    'agents',
  ]);
}

export function getProjectSkillRootCandidates(projectRoot: string, installState?: InstallState | null): string[] {
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

export function getProjectRuleRootCandidates(projectRoot: string, installState?: InstallState | null): string[] {
  const resolvedInstallState = typeof installState === 'undefined'
    ? getProjectInstallState(projectRoot)
    : installState;
  return dedupeRelativeRoots([
    resolveInstalledRulesCacheRootDir(resolvedInstallState),
    '.codebuddy/rules_cache',
    'rules',
  ]);
}

export function getProjectAgentRootCandidatePaths(projectRoot: string, installState?: InstallState | null): string[] {
  return getProjectAgentRootCandidates(projectRoot, installState)
    .map(relativeRoot => path.join(projectRoot, relativeRoot));
}

export function getProjectSkillRootCandidatePaths(projectRoot: string, installState?: InstallState | null): string[] {
  return getProjectSkillRootCandidates(projectRoot, installState)
    .map(relativeRoot => path.join(projectRoot, relativeRoot));
}

export function getProjectRuleRootCandidatePaths(projectRoot: string, installState?: InstallState | null): string[] {
  return getProjectRuleRootCandidates(projectRoot, installState)
    .map(relativeRoot => path.join(projectRoot, relativeRoot));
}

export function listAgentDefinitionCandidatePaths(projectRoot: string, agentId: string, installState?: InstallState | null): string[] {
  return getProjectAgentRootCandidatePaths(projectRoot, installState)
    .map(rootDir => path.join(rootDir, agentId, 'AGENT.md'));
}

export function listAgentPromptCandidatePaths(
  projectRoot: string,
  agentId: string,
  promptFileName: string,
  installState?: InstallState | null,
): string[] {
  return getProjectAgentRootCandidatePaths(projectRoot, installState)
    .map(rootDir => path.join(rootDir, agentId, 'prompts', promptFileName));
}
