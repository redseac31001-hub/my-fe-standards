"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSkillMetadata = parseSkillMetadata;
exports.parseAgentMetadata = parseAgentMetadata;
const frontmatter_utils_1 = require("./frontmatter-utils");
function parseSkillMetadata(skillId, content) {
    const fm = (0, frontmatter_utils_1.parseFrontmatterBlock)(content);
    if (!fm.ok)
        return null;
    const frontmatter = fm.frontmatter;
    const name = (0, frontmatter_utils_1.extractYamlScalar)(frontmatter, 'name');
    const description = (0, frontmatter_utils_1.extractYamlScalar)(frontmatter, 'description');
    if (!name || !description)
        return null;
    const metadataBlock = (0, frontmatter_utils_1.extractYamlSection)(frontmatter, 'metadata');
    const metadataTriggers = metadataBlock ? (0, frontmatter_utils_1.parseYamlList)(metadataBlock, 'triggers', 2) : [];
    const legacyTriggers = (0, frontmatter_utils_1.parseYamlList)(frontmatter, 'triggers');
    const triggers = metadataTriggers.length > 0 ? metadataTriggers : legacyTriggers;
    const metadataTools = metadataBlock ? (0, frontmatter_utils_1.parseYamlList)(metadataBlock, 'tools', 2) : [];
    const legacyTools = (0, frontmatter_utils_1.parseYamlList)(frontmatter, 'tools');
    const tools = metadataTools.length > 0 ? metadataTools : legacyTools;
    const metadataRelated = metadataBlock ? (0, frontmatter_utils_1.parseYamlList)(metadataBlock, 'related', 2) : [];
    const legacyRelated = (0, frontmatter_utils_1.parseYamlList)(frontmatter, 'related');
    const related = metadataRelated.length > 0 ? metadataRelated : legacyRelated;
    return {
        id: skillId,
        name,
        description,
        triggers,
        tools,
        related,
    };
}
function parseAgentMetadata(agentId, content) {
    const fm = (0, frontmatter_utils_1.parseFrontmatterBlock)(content);
    if (!fm.ok)
        return null;
    const frontmatter = fm.frontmatter;
    const name = (0, frontmatter_utils_1.extractYamlScalar)(frontmatter, 'name');
    const description = (0, frontmatter_utils_1.extractYamlScalar)(frontmatter, 'description');
    if (!name || !description)
        return null;
    const triggers = (0, frontmatter_utils_1.parseYamlList)(frontmatter, 'triggers');
    const permissionsBlock = (0, frontmatter_utils_1.extractYamlSection)(frontmatter, 'permissions');
    const permissions = permissionsBlock ? (0, frontmatter_utils_1.parseYamlList)(permissionsBlock, 'tools', 2) : [];
    const relatedSkills = permissionsBlock ? (0, frontmatter_utils_1.parseYamlList)(permissionsBlock, 'skills', 2) : [];
    const dependenciesBlock = (0, frontmatter_utils_1.extractYamlSection)(frontmatter, 'dependencies');
    const relatedRules = dependenciesBlock
        ? (0, frontmatter_utils_1.listYamlKeys)(dependenciesBlock, 2).flatMap(key => (0, frontmatter_utils_1.parseYamlList)(dependenciesBlock, key, 2))
        : [];
    const workflowSummary = (0, frontmatter_utils_1.extractYamlBlockScalar)(frontmatter, 'workflow_summary');
    const implicitTriggers = [];
    const bodyYamlMatch = content.match(/```yaml\s*\n([\s\S]*?)```/);
    if (bodyYamlMatch) {
        const bodyYaml = bodyYamlMatch[1];
        const implicitSection = bodyYaml.match(/implicit:\s*\n((?:\s+-[\s\S]*?)(?=\n\S|\n```|$))/);
        if (implicitSection) {
            const patternRegex = /- pattern:\s*["'](.+?)["']\s*\n\s+confidence:\s*([\d.]+)/g;
            let patternMatch;
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
