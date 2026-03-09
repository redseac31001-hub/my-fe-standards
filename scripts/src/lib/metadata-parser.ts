import { AgentMetadata, ProjectLang, SkillMetadata, SkillRole, SkillWorkspaceScope } from '../types';
import {
  extractYamlBlockScalar,
  extractYamlScalar,
  extractYamlSection,
  listYamlKeys,
  parseFrontmatterBlock,
  parseYamlList,
} from './frontmatter-utils';

const SKILL_ROLE_SET = new Set<SkillRole>([
  'frontend',
  'backend',
  'fullstack',
  'qa',
  'architect',
  'product',
  'devops',
]);

const PROJECT_LANG_SET = new Set<ProjectLang>([
  'typescript',
  'javascript',
  'java',
  'python',
  'go',
  'rust',
  'dotnet',
  'unknown',
]);

const SKILL_WORKSPACE_SCOPE_SET = new Set<SkillWorkspaceScope>([
  'workspace-union',
  'project-targeted',
  'both',
]);

function normalizeSkillRole(value: string): SkillRole | null {
  const normalized = value.trim().toLowerCase();
  return SKILL_ROLE_SET.has(normalized as SkillRole) ? normalized as SkillRole : null;
}

function normalizeProjectLang(value: string): ProjectLang | null {
  const normalized = value.trim().toLowerCase();
  return PROJECT_LANG_SET.has(normalized as ProjectLang) ? normalized as ProjectLang : null;
}

function normalizeWorkspaceScope(value: string): SkillWorkspaceScope | null {
  const normalized = value.trim().toLowerCase();
  return SKILL_WORKSPACE_SCOPE_SET.has(normalized as SkillWorkspaceScope)
    ? normalized as SkillWorkspaceScope
    : null;
}

function normalizeStringList(values: string[]): string[] | undefined {
  const normalized = [...new Set(values.map(value => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}

export function parseSkillMetadata(skillId: string, content: string): SkillMetadata | null {
  const fm = parseFrontmatterBlock(content);
  if (!fm.ok) return null;

  const frontmatter = fm.frontmatter;
  const name = extractYamlScalar(frontmatter, 'name');
  const description = extractYamlScalar(frontmatter, 'description');
  if (!name || !description) return null;

  const metadataBlock = extractYamlSection(frontmatter, 'metadata');
  const metadataTriggers = metadataBlock ? parseYamlList(metadataBlock, 'triggers', 2) : [];
  const legacyTriggers = parseYamlList(frontmatter, 'triggers');
  const triggers = metadataTriggers.length > 0 ? metadataTriggers : legacyTriggers;

  const metadataTools = metadataBlock ? parseYamlList(metadataBlock, 'tools', 2) : [];
  const legacyTools = parseYamlList(frontmatter, 'tools');
  const tools = metadataTools.length > 0 ? metadataTools : legacyTools;

  const metadataRelated = metadataBlock ? parseYamlList(metadataBlock, 'related', 2) : [];
  const legacyRelated = parseYamlList(frontmatter, 'related');
  const related = metadataRelated.length > 0 ? metadataRelated : legacyRelated;

  const metadataLanguages = metadataBlock ? parseYamlList(metadataBlock, 'languages', 2) : [];
  const languages = metadataLanguages
    .map(normalizeProjectLang)
    .filter((value): value is ProjectLang => value !== null);

  const metadataFrameworks = metadataBlock ? parseYamlList(metadataBlock, 'frameworks', 2) : [];
  const frameworks = normalizeStringList(metadataFrameworks);

  const metadataRoles = metadataBlock ? parseYamlList(metadataBlock, 'roles', 2) : [];
  const roles = metadataRoles
    .map(normalizeSkillRole)
    .filter((value): value is SkillRole => value !== null);

  const metadataScenarios = metadataBlock ? parseYamlList(metadataBlock, 'scenarios', 2) : [];
  const scenarios = normalizeStringList(metadataScenarios);

  const workspaceScopeRaw = metadataBlock ? extractYamlScalar(metadataBlock, 'workspace_scope', 2) : undefined;
  const workspaceScope = workspaceScopeRaw ? normalizeWorkspaceScope(workspaceScopeRaw) ?? undefined : undefined;

  return {
    id: skillId,
    name,
    description,
    triggers,
    tools,
    related,
    languages: languages.length > 0 ? languages : undefined,
    frameworks,
    roles: roles.length > 0 ? roles : undefined,
    scenarios,
    workspaceScope,
  };
}

export function parseAgentMetadata(agentId: string, content: string): AgentMetadata | null {
  const fm = parseFrontmatterBlock(content);
  if (!fm.ok) return null;

  const frontmatter = fm.frontmatter;
  const name = extractYamlScalar(frontmatter, 'name');
  const description = extractYamlScalar(frontmatter, 'description');
  if (!name || !description) return null;

  const triggers = parseYamlList(frontmatter, 'triggers');

  const permissionsBlock = extractYamlSection(frontmatter, 'permissions');
  const permissions = permissionsBlock ? parseYamlList(permissionsBlock, 'tools', 2) : [];
  const relatedSkills = permissionsBlock ? parseYamlList(permissionsBlock, 'skills', 2) : [];

  const dependenciesBlock = extractYamlSection(frontmatter, 'dependencies');
  const relatedRules = dependenciesBlock
    ? listYamlKeys(dependenciesBlock, 2).flatMap(key => parseYamlList(dependenciesBlock, key, 2))
    : [];

  const workflowSummary = extractYamlBlockScalar(frontmatter, 'workflow_summary');

  const implicitTriggers: Array<{ pattern: string; confidence: number }> = [];
  const bodyYamlMatch = content.match(/```yaml\s*\n([\s\S]*?)```/);
  if (bodyYamlMatch) {
    const bodyYaml = bodyYamlMatch[1];
    const implicitSection = bodyYaml.match(/implicit:\s*\n((?:\s+-[\s\S]*?)(?=\n\S|\n```|$))/);
    if (implicitSection) {
      const patternRegex = /- pattern:\s*["'](.+?)["']\s*\n\s+confidence:\s*([\d.]+)/g;
      let patternMatch: RegExpExecArray | null;
      while ((patternMatch = patternRegex.exec(implicitSection[1]))) {
        implicitTriggers.push({ pattern: patternMatch[1], confidence: parseFloat(patternMatch[2]) });
      }
    }
  }

  return {
    id: agentId,
    name,
    description,
    triggers,
    implicitTriggers: implicitTriggers.length > 0 ? implicitTriggers : undefined,
    permissions,
    workflowSummary,
    relatedSkills: relatedSkills.length > 0 ? relatedSkills : undefined,
    relatedRules: relatedRules.length > 0 ? relatedRules : undefined,
  };
}
