"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectSkillContextProjects = collectSkillContextProjects;
exports.collectProjectFrameworkTags = collectProjectFrameworkTags;
exports.matchesSkillLanguages = matchesSkillLanguages;
exports.matchesSkillFrameworks = matchesSkillFrameworks;
exports.matchesSkillStack = matchesSkillStack;
exports.matchesSkillWorkspaceScope = matchesSkillWorkspaceScope;
exports.matchesSkillRole = matchesSkillRole;
exports.shouldIncludeSkill = shouldIncludeSkill;
exports.matchesBusinessRuleSelector = matchesBusinessRuleSelector;
exports.collectMatchedBusinessRules = collectMatchedBusinessRules;
const project_detection_1 = require("./project-detection");
function collectSkillContextProjects(workspaceInfo) {
    return workspaceInfo.projects;
}
function collectProjectFrameworkTags(project) {
    const tags = new Set(project.stackTags || []);
    if (project.frameworkLabel)
        tags.add((0, project_detection_1.normalizeStackLabel)(project.frameworkLabel));
    if (project.vueProfile)
        tags.add(`vue${project.vueProfile.version}`);
    for (const uiLib of project.uiLibLabels) {
        tags.add((0, project_detection_1.normalizeStackLabel)(uiLib));
    }
    return tags;
}
function matchesSkillLanguages(skill, projects) {
    if (!skill.languages || skill.languages.length === 0)
        return true;
    const languages = new Set(projects.map(project => project.lang));
    return skill.languages.some(language => languages.has(language));
}
function matchesSkillFrameworks(skill, projects) {
    if (!skill.frameworks || skill.frameworks.length === 0)
        return true;
    const frameworkTags = new Set();
    for (const project of projects) {
        for (const tag of collectProjectFrameworkTags(project)) {
            frameworkTags.add(tag);
        }
    }
    return skill.frameworks.some(framework => frameworkTags.has((0, project_detection_1.normalizeStackLabel)(framework)));
}
function matchesSkillStack(skill, projects) {
    const hasLanguages = Boolean(skill.languages && skill.languages.length > 0);
    const hasFrameworks = Boolean(skill.frameworks && skill.frameworks.length > 0);
    if (!hasLanguages && !hasFrameworks)
        return true;
    if (hasLanguages && hasFrameworks) {
        return matchesSkillLanguages(skill, projects) || matchesSkillFrameworks(skill, projects);
    }
    if (hasLanguages)
        return matchesSkillLanguages(skill, projects);
    return matchesSkillFrameworks(skill, projects);
}
function matchesSkillWorkspaceScope(skill, workspaceInfo) {
    if (!skill.workspaceScope || skill.workspaceScope === 'both')
        return true;
    if (workspaceInfo.totalProjectCount <= 1)
        return true;
    return skill.workspaceScope === workspaceInfo.scope;
}
function matchesSkillRole(skill, targetRole) {
    if (!targetRole || !skill.roles || skill.roles.length === 0)
        return true;
    if (targetRole === 'fullstack') {
        return skill.roles.includes('fullstack') || skill.roles.includes('frontend') || skill.roles.includes('backend');
    }
    return skill.roles.includes(targetRole);
}
function shouldIncludeSkill(skill, workspaceInfo, targetRole) {
    const projects = collectSkillContextProjects(workspaceInfo);
    return matchesSkillWorkspaceScope(skill, workspaceInfo)
        && matchesSkillStack(skill, projects)
        && matchesSkillRole(skill, targetRole);
}
function matchesBusinessRuleSelector(project, selector) {
    const normalizedSelector = selector.trim();
    if (!normalizedSelector)
        return false;
    const separatorIndex = normalizedSelector.indexOf(':');
    const selectorType = separatorIndex >= 0
        ? (0, project_detection_1.normalizeStackTag)(normalizedSelector.slice(0, separatorIndex))
        : '';
    const selectorValue = separatorIndex >= 0
        ? normalizedSelector.slice(separatorIndex + 1).trim()
        : normalizedSelector;
    if (!selectorValue)
        return false;
    const hasDependency = (packageName) => Boolean(project.dependencies[packageName]);
    const normalizedValue = (0, project_detection_1.normalizeStackTag)(selectorValue);
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
            return project.stackTags.some(tag => (0, project_detection_1.normalizeStackTag)(tag) === normalizedValue);
        case 'lang':
        case 'language':
            return (0, project_detection_1.normalizeStackTag)(project.lang) === normalizedValue;
        case 'kind':
        case 'projectkind':
            return (0, project_detection_1.normalizeStackTag)(project.projectKind) === normalizedValue;
        default:
            return false;
    }
}
function collectMatchedBusinessRules(project, businessSelectors) {
    const matches = [];
    const seenRules = new Set();
    for (const [selector, ruleFolders] of Object.entries(businessSelectors)) {
        if (!matchesBusinessRuleSelector(project, selector))
            continue;
        for (const rule of ruleFolders) {
            if (seenRules.has(rule))
                continue;
            seenRules.add(rule);
            matches.push({ selector, rule });
        }
    }
    return matches;
}
