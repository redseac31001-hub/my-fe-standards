"use strict";
/**
 * 元数据解析模块
 *
 * 从 SKILL.md / AGENT.md 的 YAML frontmatter 提取结构化元数据
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSkillMetadata = parseSkillMetadata;
exports.parseAgentMetadata = parseAgentMetadata;
function parseSkillMetadata(skillId, content) {
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!frontmatterMatch)
        return null;
    const frontmatter = frontmatterMatch[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    let descMatch = frontmatter.match(/^description:\s*["'](.+)["']$/m);
    if (!descMatch)
        descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (!nameMatch || !descMatch)
        return null;
    // 解析 triggers（与 Agent 的 triggers 解析一致）
    const triggers = [];
    const triggersMatch = frontmatter.match(/^triggers:\s*\n((?:\s+-\s*.+\n?)+)/m);
    if (triggersMatch) {
        const triggerLines = triggersMatch[1].split('\n');
        for (const line of triggerLines) {
            const match = line.match(/^\s+-\s*["']?(.+?)["']?\s*$/);
            if (match)
                triggers.push(match[1]);
        }
    }
    return {
        id: skillId,
        name: nameMatch[1].trim(),
        description: descMatch[1].trim(),
        triggers,
    };
}
function parseAgentMetadata(agentId, content) {
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!frontmatterMatch)
        return null;
    const frontmatter = frontmatterMatch[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    let descMatch = frontmatter.match(/^description:\s*["'](.+)["']$/m);
    if (!descMatch)
        descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (!nameMatch || !descMatch)
        return null;
    // 解析 triggers
    const triggers = [];
    const triggersMatch = frontmatter.match(/^triggers:\s*\n((?:\s+-\s*.+\n?)+)/m);
    if (triggersMatch) {
        const triggerLines = triggersMatch[1].split('\n');
        for (const line of triggerLines) {
            const match = line.match(/^\s+-\s*["']?(.+?)["']?\s*$/);
            if (match)
                triggers.push(match[1]);
        }
    }
    // 解析 permissions
    const permissions = [];
    const permMatch = frontmatter.match(/permissions:\s*\n\s+tools:\s*\n((?:\s+-\s*.+\n?)+)/m);
    if (permMatch) {
        const permLines = permMatch[1].split('\n');
        for (const line of permLines) {
            const match = line.match(/^\s+-\s*(.+?)\s*$/);
            if (match)
                permissions.push(match[1]);
        }
    }
    // 解析 workflow_summary
    let workflowSummary;
    const workflowMatch = frontmatter.match(/workflow_summary:\s*\|\s*\n((?:\s+.+\n?)+)/m);
    if (workflowMatch) {
        workflowSummary = workflowMatch[1]
            .split('\n')
            .map(line => line.replace(/^\s{2}/, ''))
            .join('\n')
            .trim();
    }
    // 解析 body 中的 implicit triggers（YAML 代码块）
    const implicitTriggers = [];
    const bodyYamlMatch = content.match(/```yaml\s*\n([\s\S]*?)```/);
    if (bodyYamlMatch) {
        const bodyYaml = bodyYamlMatch[1];
        const implicitSection = bodyYaml.match(/implicit:\s*\n((?:\s+-[\s\S]*?)(?=\n\S|\n```|$))/);
        if (implicitSection) {
            const patternRegex = /- pattern:\s*["'](.+?)["']\s*\n\s+confidence:\s*([\d.]+)/g;
            let pMatch;
            while ((pMatch = patternRegex.exec(implicitSection[1]))) {
                implicitTriggers.push({ pattern: pMatch[1], confidence: parseFloat(pMatch[2]) });
            }
        }
    }
    return {
        id: agentId,
        name: nameMatch[1].trim(),
        description: descMatch[1].trim(),
        triggers,
        implicitTriggers: implicitTriggers.length > 0 ? implicitTriggers : undefined,
        permissions,
        workflowSummary,
    };
}
