/**
 * Agent Registry (dependency-free)
 *
 * Scan Agent definitions under:
 * - .codebuddy/agents/<agentId>/AGENT.md (preferred in business projects)
 * - agents/<agentId>/AGENT.md (fallback for this repo/dev)
 *
 * Output a consumable JSON registry for discovery and validation.
 */

import * as fs from 'fs';
import * as path from 'path';

type ParsedCli = {
  command: string | null;
  positionals: string[];
  flags: Record<string, string | boolean>;
};

type RegistryIssue = {
  level: 'error' | 'warning';
  agentId?: string;
  file?: string;
  message: string;
};

type AgentRegistryEntry = {
  id: string;
  name: string;
  version?: string;
  description: string;
  triggers: string[];
  permissions: {
    tools: string[];
    skills: string[];
  };
  dependencies: {
    layer3_action: string[];
  };
  sourcePath: string; // project-relative, posix
};

const DEFAULT_AGENT_DIR_CANDIDATES = [
  path.join(process.cwd(), '.codebuddy', 'agents'),
  path.join(process.cwd(), 'agents'),
];

function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/');
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseCli(args: string[]): ParsedCli {
  const parsed: ParsedCli = { command: null, positionals: [], flags: {} };

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

  if (!parsed.command) parsed.command = 'list';
  return parsed;
}

function showHelp(): void {
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

function parseFrontmatter(md: string): string | null {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  return m ? m[1] : null;
}

function parseFirstYamlCodeBlock(md: string): string | null {
  const m = md.match(/```ya?ml\s*([\s\S]*?)\s*```/);
  return m ? m[1] : null;
}

function parseYamlListBlock(block: string): string[] {
  const out: string[] = [];
  const lines = block.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*-\s*["']?(.+?)["']?\s*$/);
    if (m && m[1]) out.push(m[1]);
  }
  return out;
}

function parseAgentEntry(agentId: string, agentMdPathAbs: string): { ok: true; entry: AgentRegistryEntry } | { ok: false; issue: RegistryIssue } {
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
    if (!descMatch) descMatch = yaml.match(/^description:\s*(.+)$/m);

    if (!nameMatch || !descMatch) {
      return { ok: false, issue: { level: 'error', agentId, file: rel, message: 'yaml metadata missing required fields: name/description' } };
    }

    const triggers: string[] = [];
    const explicitMatch = yaml.match(/triggers:\s*\n[\s\S]*?\bexplicit:\s*\n([\s\S]*?)(?:\n\s*implicit:|\s*$)/m);
    if (explicitMatch) triggers.push(...parseYamlListBlock(explicitMatch[1]));

    const tools: string[] = [];
    const permissionsMatch = yaml.match(/permissions:\s*\n([\s\S]*?)(?:\n[a-zA-Z_][^:\n]*:|\s*$)/m);
    if (permissionsMatch) tools.push(...parseYamlListBlock(permissionsMatch[1]));

    const versionRaw = versionMatch ? versionMatch[1].trim() : '';
    const version = versionRaw && versionRaw !== 'null' ? versionRaw : undefined;

    const entry: AgentRegistryEntry = {
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
  if (!descMatch) descMatch = fm.match(/^description:\s*(.+)$/m);

  if (!nameMatch || !descMatch) {
    return { ok: false, issue: { level: 'error', agentId, file: rel, message: 'frontmatter missing required fields: name/description' } };
  }

  const triggers: string[] = [];
  const triggersMatch = fm.match(/^triggers:\s*\n((?:\s+-\s*.+\n?)+)/m);
  if (triggersMatch) triggers.push(...parseYamlListBlock(triggersMatch[1]));

  const tools: string[] = [];
  const toolsMatch = fm.match(/permissions:\s*\n[\s\S]*?\s+tools:\s*\n((?:\s+-\s*.+\n?)+)/m);
  if (toolsMatch) tools.push(...parseYamlListBlock(toolsMatch[1]));

  const skills: string[] = [];
  const skillsMatch = fm.match(/permissions:\s*\n[\s\S]*?\s+skills:\s*\n((?:\s+-\s*.+\n?)+)/m);
  if (skillsMatch) skills.push(...parseYamlListBlock(skillsMatch[1]));

  const layer3Action: string[] = [];
  const layer3Match = fm.match(/dependencies:\s*\n[\s\S]*?\s+layer3_action:\s*\n((?:\s+-\s*.+\n?)+)/m);
  if (layer3Match) layer3Action.push(...parseYamlListBlock(layer3Match[1]));

  const versionRaw = versionMatch ? versionMatch[1].trim() : '';
  const version = versionRaw && versionRaw !== 'null' ? versionRaw : undefined;

  const entry: AgentRegistryEntry = {
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

function resolveAgentsRootDir(dirFlag: unknown): { ok: true; rootDir: string } | { ok: false; issue: RegistryIssue } {
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

function scanAgents(rootDirAbs: string): { agents: AgentRegistryEntry[]; issues: RegistryIssue[] } {
  const issues: RegistryIssue[] = [];
  const agents: AgentRegistryEntry[] = [];

  const dirents = fs.readdirSync(rootDirAbs, { withFileTypes: true });
  for (const d of dirents) {
    if (!d.isDirectory()) continue;
    const agentId = d.name;
    const agentMdPathAbs = path.join(rootDirAbs, agentId, 'AGENT.md');
    if (!fs.existsSync(agentMdPathAbs)) continue;

    try {
      const parsed = parseAgentEntry(agentId, agentMdPathAbs);
      if (parsed.ok) agents.push(parsed.entry);
      else issues.push(parsed.issue);
    } catch (e) {
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

function printJson(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function main(): void {
  const args = process.argv.slice(2);
  const parsed = parseCli(args);
  const json = Boolean(parsed.flags.json);

  if (parsed.flags.help) {
    showHelp();
    process.exit(0);
  }

  const resolved = resolveAgentsRootDir(parsed.flags.dir ?? parsed.flags.root);
  if (!resolved.ok) {
    if (json) printJson({ ok: false, error: resolved.issue.message });
    else console.error(resolved.issue.message);
    process.exit(1);
  }

  const rootDirAbs = resolved.rootDir;
  const { agents, issues } = scanAgents(rootDirAbs);

  const command = parsed.command ?? 'list';
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
      } else {
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
        if (json) printJson({ ok: false, error: 'missing agentId' });
        else console.error('错误: show 需要 <agentId>');
        process.exit(1);
      }

      const found = agents.find(a => a.id === agentId);
      if (!found) {
        if (json) printJson({ ok: false, error: 'not_found', agentId });
        else console.error(`错误: Agent not found: ${agentId}`);
        process.exit(1);
      }

      if (json) printJson({ ok: true, agent: found });
      else console.log(JSON.stringify(found, null, 2));
      process.exit(0);
    }

    default: {
      if (json) printJson({ ok: false, error: `unknown command: ${command}` });
      else console.error(`未知命令: ${command}`);
      showHelp();
      process.exit(1);
    }
  }
}

if (require.main === module) {
  main();
}
