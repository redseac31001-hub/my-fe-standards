"use strict";
/**
 * Agent Registry (dependency-free)
 *
 * Scan Agent definitions under:
 * - .codebuddy/agents/<agentId>/AGENT.md (preferred in business projects)
 * - agents/<agentId>/AGENT.md (fallback for this repo/dev)
 *
 * Output a consumable JSON registry for discovery and validation.
 */
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_AGENT_DIR_CANDIDATES = [
    path.join(process.cwd(), '.codebuddy', 'agents'),
    path.join(process.cwd(), 'agents'),
];
function toPosixPath(p) {
    return p.replace(/\\/g, '/');
}
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function parseCli(args) {
    const parsed = { command: null, positionals: [], flags: {} };
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (!a.startsWith('-') && !parsed.command) {
            parsed.command = a;
            continue;
        }
        if (!a.startsWith('-')) {
            parsed.positionals.push(a);
            continue;
        }
        if (a === '--json') {
            parsed.flags.json = true;
            continue;
        }
        if (a === '--help' || a === '-h') {
            parsed.flags.help = true;
            continue;
        }
        if ((a === '--dir' || a === '--root') && args[i + 1]) {
            parsed.flags.dir = args[++i];
            continue;
        }
        if (a === '--strict') {
            parsed.flags.strict = true;
            continue;
        }
        parsed.flags[a.replace(/^--?/, '')] = true;
    }
    if (!parsed.command)
        parsed.command = 'list';
    return parsed;
}
function showHelp() {
    console.log(`
Agent Registry - Agent 定义扫描与注册表输出

用法:
  node .codebuddy/scripts/agent-registry.js <command> [args] [options]

命令:
  list                         列出所有 Agent（默认）
  show <agentId>               查看单个 Agent

选项:
  --dir, --root <path>         扫描目录（默认优先 .codebuddy/agents，其次 agents）
  --json                       输出 JSON
  --strict                     list 时若存在解析错误则 exit=1
  --help, -h                   显示帮助
`.trim());
}
function parseFrontmatter(md) {
    const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    return m ? m[1] : null;
}
function parseFirstYamlCodeBlock(md) {
    const m = md.match(/```ya?ml\s*([\s\S]*?)\s*```/);
    return m ? m[1] : null;
}
function parseYamlListBlock(block) {
    const out = [];
    const lines = block.split(/\r?\n/);
    for (const line of lines) {
        const m = line.match(/^\s*-\s*["']?(.+?)["']?\s*$/);
        if (m && m[1])
            out.push(m[1]);
    }
    return out;
}
function parseAgentEntry(agentId, agentMdPathAbs) {
    const raw = fs.readFileSync(agentMdPathAbs, 'utf-8');
    const fm = parseFrontmatter(raw);
    const rel = toPosixPath(path.relative(process.cwd(), agentMdPathAbs));
    if (!fm) {
        // Backward compatible: some agents use a dedicated YAML code block instead of frontmatter.
        const yaml = parseFirstYamlCodeBlock(raw);
        if (!yaml) {
            return { ok: false, issue: { level: 'error', agentId, file: rel, message: 'missing metadata (frontmatter or ```yaml``` block)' } };
        }
        const nameMatch = yaml.match(/^name:\s*(.+)$/m);
        const versionMatch = yaml.match(/^version:\s*(.+)$/m);
        let descMatch = yaml.match(/^description:\s*["'](.+)["']$/m);
        if (!descMatch)
            descMatch = yaml.match(/^description:\s*(.+)$/m);
        if (!nameMatch || !descMatch) {
            return { ok: false, issue: { level: 'error', agentId, file: rel, message: 'yaml metadata missing required fields: name/description' } };
        }
        const triggers = [];
        const explicitMatch = yaml.match(/triggers:\s*\n[\s\S]*?\bexplicit:\s*\n([\s\S]*?)(?:\n\s*implicit:|\s*$)/m);
        if (explicitMatch)
            triggers.push(...parseYamlListBlock(explicitMatch[1]));
        const tools = [];
        const permissionsMatch = yaml.match(/permissions:\s*\n([\s\S]*?)(?:\n[a-zA-Z_][^:\n]*:|\s*$)/m);
        if (permissionsMatch)
            tools.push(...parseYamlListBlock(permissionsMatch[1]));
        const versionRaw = versionMatch ? versionMatch[1].trim() : '';
        const version = versionRaw && versionRaw !== 'null' ? versionRaw : undefined;
        const entry = {
            id: agentId,
            name: nameMatch[1].trim(),
            version,
            description: descMatch[1].trim(),
            triggers,
            permissions: { tools, skills: [] },
            dependencies: { layer3_action: [] },
            sourcePath: rel,
        };
        return { ok: true, entry };
    }
    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    const versionMatch = fm.match(/^version:\s*(.+)$/m);
    let descMatch = fm.match(/^description:\s*["'](.+)["']$/m);
    if (!descMatch)
        descMatch = fm.match(/^description:\s*(.+)$/m);
    if (!nameMatch || !descMatch) {
        return { ok: false, issue: { level: 'error', agentId, file: rel, message: 'frontmatter missing required fields: name/description' } };
    }
    const triggers = [];
    const triggersMatch = fm.match(/^triggers:\s*\n((?:\s+-\s*.+\n?)+)/m);
    if (triggersMatch)
        triggers.push(...parseYamlListBlock(triggersMatch[1]));
    const tools = [];
    const toolsMatch = fm.match(/permissions:\s*\n[\s\S]*?\s+tools:\s*\n((?:\s+-\s*.+\n?)+)/m);
    if (toolsMatch)
        tools.push(...parseYamlListBlock(toolsMatch[1]));
    const skills = [];
    const skillsMatch = fm.match(/permissions:\s*\n[\s\S]*?\s+skills:\s*\n((?:\s+-\s*.+\n?)+)/m);
    if (skillsMatch)
        skills.push(...parseYamlListBlock(skillsMatch[1]));
    const layer3Action = [];
    const layer3Match = fm.match(/dependencies:\s*\n[\s\S]*?\s+layer3_action:\s*\n((?:\s+-\s*.+\n?)+)/m);
    if (layer3Match)
        layer3Action.push(...parseYamlListBlock(layer3Match[1]));
    const versionRaw = versionMatch ? versionMatch[1].trim() : '';
    const version = versionRaw && versionRaw !== 'null' ? versionRaw : undefined;
    const entry = {
        id: agentId,
        name: nameMatch[1].trim(),
        version,
        description: descMatch[1].trim(),
        triggers,
        permissions: { tools, skills },
        dependencies: { layer3_action: layer3Action },
        sourcePath: rel,
    };
    return { ok: true, entry };
}
function resolveAgentsRootDir(dirFlag) {
    if (isNonEmptyString(dirFlag)) {
        const abs = path.isAbsolute(dirFlag) ? dirFlag : path.join(process.cwd(), dirFlag);
        if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
            return { ok: false, issue: { level: 'error', message: `agents dir not found: ${abs}` } };
        }
        return { ok: true, rootDir: abs };
    }
    for (const cand of DEFAULT_AGENT_DIR_CANDIDATES) {
        if (fs.existsSync(cand) && fs.statSync(cand).isDirectory()) {
            return { ok: true, rootDir: cand };
        }
    }
    return { ok: false, issue: { level: 'error', message: 'agents dir not found: expected .codebuddy/agents or agents (run codebuddy-loader first)' } };
}
function scanAgents(rootDirAbs) {
    const issues = [];
    const agents = [];
    const dirents = fs.readdirSync(rootDirAbs, { withFileTypes: true });
    for (const d of dirents) {
        if (!d.isDirectory())
            continue;
        const agentId = d.name;
        const agentMdPathAbs = path.join(rootDirAbs, agentId, 'AGENT.md');
        if (!fs.existsSync(agentMdPathAbs))
            continue;
        try {
            const parsed = parseAgentEntry(agentId, agentMdPathAbs);
            if (parsed.ok)
                agents.push(parsed.entry);
            else
                issues.push(parsed.issue);
        }
        catch (e) {
            issues.push({
                level: 'error',
                agentId,
                file: toPosixPath(path.relative(process.cwd(), agentMdPathAbs)),
                message: e instanceof Error ? e.message : String(e),
            });
        }
    }
    agents.sort((a, b) => a.id.localeCompare(b.id));
    return { agents, issues };
}
function printJson(payload) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
function main() {
    var _a, _b;
    const args = process.argv.slice(2);
    const parsed = parseCli(args);
    const json = Boolean(parsed.flags.json);
    if (parsed.flags.help) {
        showHelp();
        process.exit(0);
    }
    const resolved = resolveAgentsRootDir((_a = parsed.flags.dir) !== null && _a !== void 0 ? _a : parsed.flags.root);
    if (!resolved.ok) {
        if (json)
            printJson({ ok: false, error: resolved.issue.message });
        else
            console.error(resolved.issue.message);
        process.exit(1);
    }
    const rootDirAbs = resolved.rootDir;
    const { agents, issues } = scanAgents(rootDirAbs);
    const command = (_b = parsed.command) !== null && _b !== void 0 ? _b : 'list';
    switch (command) {
        case 'list': {
            const payload = {
                ok: issues.every(i => i.level !== 'error'),
                rootDir: toPosixPath(path.relative(process.cwd(), rootDirAbs)),
                agentCount: agents.length,
                agents,
                issues,
            };
            if (json) {
                printJson(payload);
            }
            else {
                console.log(`[AgentRegistry] root: ${payload.rootDir}`);
                for (const a of agents) {
                    const v = a.version ? `@${a.version}` : '';
                    console.log(`- ${a.id}${v}: ${a.description}`);
                }
                if (issues.length > 0) {
                    console.log('');
                    console.log('[AgentRegistry] issues:');
                    for (const i of issues) {
                        const where = i.file ? ` (${i.file})` : '';
                        console.log(`- ${i.level}${i.agentId ? ` ${i.agentId}` : ''}: ${i.message}${where}`);
                    }
                }
            }
            if (parsed.flags.strict && issues.some(i => i.level === 'error')) {
                process.exit(1);
            }
            process.exit(0);
        }
        case 'show': {
            const agentId = parsed.positionals[0];
            if (!agentId) {
                if (json)
                    printJson({ ok: false, error: 'missing agentId' });
                else
                    console.error('错误: show 需要 <agentId>');
                process.exit(1);
            }
            const found = agents.find(a => a.id === agentId);
            if (!found) {
                if (json)
                    printJson({ ok: false, error: 'not_found', agentId });
                else
                    console.error(`错误: Agent not found: ${agentId}`);
                process.exit(1);
            }
            if (json)
                printJson({ ok: true, agent: found });
            else
                console.log(JSON.stringify(found, null, 2));
            process.exit(0);
        }
        default: {
            if (json)
                printJson({ ok: false, error: `unknown command: ${command}` });
            else
                console.error(`未知命令: ${command}`);
            showHelp();
            process.exit(1);
        }
    }
}
if (require.main === module) {
    main();
}
