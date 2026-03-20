"use strict";
/**
 * Agent Registry (shared frontmatter parser)
 *
 * Scan Agent definitions under:
 * - install.json 记录的 active agents root（preferred in business projects）
 * - .codebuddy/agents/<agentId>/AGENT.md (legacy fallback)
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
const frontmatter_utils_1 = require("./lib/frontmatter-utils");
const install_roots_1 = require("./lib/install-roots");
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
  --dir, --root <path>         扫描目录（默认优先 install.json 记录的 active agents root，其次 .codebuddy/agents，再次 agents）
  --json                       输出 JSON
  --strict                     list 时若存在解析错误则 exit=1
  --help, -h                   显示帮助
`.trim());
}
function parseFirstYamlCodeBlock(md) {
    const m = md.match(/```ya?ml\s*([\s\S]*?)\s*```/);
    return m ? m[1] : null;
}
function parseOptionalVersion(yaml) {
    const versionRaw = (0, frontmatter_utils_1.extractYamlScalar)(yaml, 'version');
    if (!versionRaw || versionRaw === 'null')
        return undefined;
    return versionRaw;
}
function buildAgentEntryFromYaml(agentId, yaml, rel) {
    const name = (0, frontmatter_utils_1.extractYamlScalar)(yaml, 'name');
    const description = (0, frontmatter_utils_1.extractYamlScalar)(yaml, 'description');
    if (!name || !description)
        return null;
    const triggersBlock = (0, frontmatter_utils_1.extractYamlSection)(yaml, 'triggers');
    const explicitTriggers = triggersBlock ? (0, frontmatter_utils_1.parseYamlList)(triggersBlock, 'explicit', 2) : [];
    const plainTriggers = (0, frontmatter_utils_1.parseYamlList)(yaml, 'triggers');
    const triggers = explicitTriggers.length > 0 ? explicitTriggers : plainTriggers;
    const permissionsBlock = (0, frontmatter_utils_1.extractYamlSection)(yaml, 'permissions');
    const tools = permissionsBlock ? (0, frontmatter_utils_1.parseYamlList)(permissionsBlock, 'tools', 2) : [];
    const skills = permissionsBlock ? (0, frontmatter_utils_1.parseYamlList)(permissionsBlock, 'skills', 2) : [];
    const dependenciesBlock = (0, frontmatter_utils_1.extractYamlSection)(yaml, 'dependencies');
    const layer3Action = dependenciesBlock ? (0, frontmatter_utils_1.parseYamlList)(dependenciesBlock, 'layer3_action', 2) : [];
    return {
        id: agentId,
        name,
        version: parseOptionalVersion(yaml),
        description,
        triggers,
        permissions: { tools, skills },
        dependencies: { layer3_action: layer3Action },
        sourcePath: rel,
    };
}
function parseAgentEntry(agentId, agentMdPathAbs) {
    const raw = fs.readFileSync(agentMdPathAbs, 'utf-8');
    const rel = toPosixPath(path.relative(process.cwd(), agentMdPathAbs));
    const fm = (0, frontmatter_utils_1.parseFrontmatterBlock)(raw);
    if (fm.ok) {
        const entry = buildAgentEntryFromYaml(agentId, fm.frontmatter, rel);
        if (!entry) {
            return { ok: false, issue: { level: 'error', agentId, file: rel, message: 'frontmatter missing required fields: name/description' } };
        }
        return { ok: true, entry };
    }
    if (raw.replace(/^\uFEFF/, '').startsWith('---')) {
        return { ok: false, issue: { level: 'error', agentId, file: rel, message: fm.error } };
    }
    const yaml = parseFirstYamlCodeBlock(raw);
    if (!yaml) {
        return { ok: false, issue: { level: 'error', agentId, file: rel, message: 'missing metadata (frontmatter or ```yaml``` block)' } };
    }
    const entry = buildAgentEntryFromYaml(agentId, yaml, rel);
    if (!entry) {
        return { ok: false, issue: { level: 'error', agentId, file: rel, message: 'yaml metadata missing required fields: name/description' } };
    }
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
    for (const cand of (0, install_roots_1.getProjectAgentRootCandidatePaths)(process.cwd())) {
        if (fs.existsSync(cand) && fs.statSync(cand).isDirectory()) {
            return { ok: true, rootDir: cand };
        }
    }
    return {
        ok: false,
        issue: {
            level: 'error',
            message: 'agents dir not found: expected install.json active agents root, .codebuddy/agents or agents (run codebuddy-loader first)',
        },
    };
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
