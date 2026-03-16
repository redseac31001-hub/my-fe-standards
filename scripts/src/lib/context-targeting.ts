import { SkillMetadata, SkillRole, SubProject, WorkspaceInfo } from '../types';
import { normalizeStackLabel, normalizeStackTag } from './project-detection';

export function collectSkillContextProjects(workspaceInfo: WorkspaceInfo): SubProject[] {
  return workspaceInfo.projects;
}

export function collectProjectFrameworkTags(
  project: Pick<SubProject, 'stackTags' | 'frameworkLabel' | 'vueProfile' | 'uiLibLabels'>,
): Set<string> {
  const tags = new Set<string>(project.stackTags || []);
  if (project.frameworkLabel) tags.add(normalizeStackLabel(project.frameworkLabel));
  if (project.vueProfile) tags.add(`vue${project.vueProfile.version}`);
  for (const uiLib of project.uiLibLabels) {
    tags.add(normalizeStackLabel(uiLib));
  }
  return tags;
}

export function matchesSkillLanguages(
  skill: Pick<SkillMetadata, 'languages'>,
  projects: Array<Pick<SubProject, 'lang'>>,
): boolean {
  if (!skill.languages || skill.languages.length === 0) return true;
  const languages = new Set(projects.map(project => project.lang));
  return skill.languages.some(language => languages.has(language));
}

export function matchesSkillFrameworks(
  skill: Pick<SkillMetadata, 'frameworks'>,
  projects: Array<Pick<SubProject, 'stackTags' | 'frameworkLabel' | 'vueProfile' | 'uiLibLabels'>>,
): boolean {
  if (!skill.frameworks || skill.frameworks.length === 0) return true;
  const frameworkTags = new Set<string>();
  for (const project of projects) {
    for (const tag of collectProjectFrameworkTags(project)) {
      frameworkTags.add(tag);
    }
  }
  return skill.frameworks.some(framework => frameworkTags.has(normalizeStackLabel(framework)));
}

export function matchesSkillStack(
  skill: Pick<SkillMetadata, 'languages' | 'frameworks'>,
  projects: Array<Pick<SubProject, 'lang' | 'stackTags' | 'frameworkLabel' | 'vueProfile' | 'uiLibLabels'>>,
): boolean {
  const hasLanguages = Boolean(skill.languages && skill.languages.length > 0);
  const hasFrameworks = Boolean(skill.frameworks && skill.frameworks.length > 0);

  if (!hasLanguages && !hasFrameworks) return true;
  if (hasLanguages && hasFrameworks) {
    return matchesSkillLanguages(skill, projects) || matchesSkillFrameworks(skill, projects);
  }
  if (hasLanguages) return matchesSkillLanguages(skill, projects);
  return matchesSkillFrameworks(skill, projects);
}

export function matchesSkillWorkspaceScope(
  skill: Pick<SkillMetadata, 'workspaceScope'>,
  workspaceInfo: Pick<WorkspaceInfo, 'totalProjectCount' | 'scope'>,
): boolean {
  if (!skill.workspaceScope || skill.workspaceScope === 'both') return true;
  if (workspaceInfo.totalProjectCount <= 1) return true;
  return skill.workspaceScope === workspaceInfo.scope;
}

export function matchesSkillRole(
  skill: Pick<SkillMetadata, 'roles'>,
  targetRole: SkillRole | null,
): boolean {
  if (!targetRole || !skill.roles || skill.roles.length === 0) return true;
  if (targetRole === 'fullstack') {
    return skill.roles.includes('fullstack') || skill.roles.includes('frontend') || skill.roles.includes('backend');
  }
  return skill.roles.includes(targetRole);
}

export function shouldIncludeSkill(
  skill: SkillMetadata,
  workspaceInfo: WorkspaceInfo,
  targetRole: SkillRole | null,
): boolean {
  const projects = collectSkillContextProjects(workspaceInfo);
  return matchesSkillWorkspaceScope(skill, workspaceInfo)
    && matchesSkillStack(skill, projects)
    && matchesSkillRole(skill, targetRole);
}

export function matchesBusinessRuleSelector(
  project: Pick<SubProject, 'lang' | 'projectKind' | 'stackTags' | 'dependencies'>,
  selector: string,
): boolean {
  const normalizedSelector = selector.trim();
  if (!normalizedSelector) return false;

  const separatorIndex = normalizedSelector.indexOf(':');
  const selectorType = separatorIndex >= 0
    ? normalizeStackTag(normalizedSelector.slice(0, separatorIndex))
    : '';
  const selectorValue = separatorIndex >= 0
    ? normalizedSelector.slice(separatorIndex + 1).trim()
    : normalizedSelector;

  if (!selectorValue) return false;

  const hasDependency = (packageName: string): boolean => Boolean(project.dependencies[packageName]);
  const normalizedValue = normalizeStackTag(selectorValue);

  switch (selectorType) {
    case '':
      return hasDependency(selectorValue);
    case 'dependency':
    case 'dep':
    case 'package':
    case 'pkg':
      return hasDependency(selectorValue);
    case 'stack':
    case 'framework':
    case 'uilib':
      return project.stackTags.some(tag => normalizeStackTag(tag) === normalizedValue);
    case 'lang':
    case 'language':
      return normalizeStackTag(project.lang) === normalizedValue;
    case 'kind':
    case 'projectkind':
      return normalizeStackTag(project.projectKind) === normalizedValue;
    default:
      return false;
  }
}

export function collectMatchedBusinessRules(
  project: Pick<SubProject, 'lang' | 'projectKind' | 'stackTags' | 'dependencies'>,
  businessSelectors: Record<string, string[]>,
): Array<{ selector: string; rule: string }> {
  const matches: Array<{ selector: string; rule: string }> = [];
  const seenRules = new Set<string>();

  for (const [selector, ruleFolders] of Object.entries(businessSelectors)) {
    if (!matchesBusinessRuleSelector(project, selector)) continue;

    for (const rule of ruleFolders) {
      if (seenRules.has(rule)) continue;
      seenRules.add(rule);
      matches.push({ selector, rule });
    }
  }

  return matches;
}
