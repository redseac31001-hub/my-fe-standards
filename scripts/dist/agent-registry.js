"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// scripts/src/agent-registry.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));

// scripts/src/lib/frontmatter-utils.ts
function normalizeNewlines(text) {
  return text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}
function stripWrappingQuotes(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if (first === '"' && last === '"' || first === "'" && last === "'") {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}
function countLeadingSpaces(line) {
  const match = line.match(/^ */);
  return match ? match[0].length : 0;
}
function indentPrefix(indent) {
  return " ".repeat(Math.max(0, indent));
}
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function parseFrontmatterBlock(md) {
  const normalized = normalizeNewlines(md);
  if (!normalized.startsWith("---")) {
    return { ok: false, error: "missing YAML frontmatter (must start with ---)" };
  }
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { ok: false, error: "YAML frontmatter is not closed (missing ending ---)" };
  }
  return { ok: true, frontmatter: match[1], endIndex: match[0].length };
}
function extractYamlScalar(frontmatter, key) {
  const normalized = normalizeNewlines(frontmatter);
  const pattern = new RegExp(`^${escapeRegex(key)}:\\s*(.+)$`, "m");
  const match = normalized.match(pattern);
  if (!match) return void 0;
  return stripWrappingQuotes(match[1]);
}
function extractYamlSection(frontmatter, key, indent = 0) {
  const normalized = normalizeNewlines(frontmatter);
  const lines = normalized.split("\n");
  const prefix = indentPrefix(indent);
  const startPattern = new RegExp(`^${escapeRegex(prefix)}${escapeRegex(key)}:\\s*$`);
  for (let i = 0; i < lines.length; i++) {
    if (!startPattern.test(lines[i])) continue;
    const collected = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim()) {
        collected.push(line);
        continue;
      }
      if (countLeadingSpaces(line) <= indent) break;
      collected.push(line);
    }
    return collected.join("\n");
  }
  return null;
}
function parseYamlList(frontmatter, key, indent = 0) {
  const normalized = normalizeNewlines(frontmatter);
  const lines = normalized.split("\n");
  const prefix = indentPrefix(indent);
  const itemPrefix = indentPrefix(indent + 2);
  const startPattern = new RegExp(`^${escapeRegex(prefix)}${escapeRegex(key)}:\\s*$`);
  const itemPattern = new RegExp(`^${escapeRegex(itemPrefix)}-\\s*(.+?)\\s*$`);
  const values = [];
  for (let i = 0; i < lines.length; i++) {
    if (!startPattern.test(lines[i])) continue;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim()) continue;
      const currentIndent = countLeadingSpaces(line);
      if (currentIndent <= indent) break;
      const itemMatch = line.match(itemPattern);
      if (itemMatch) values.push(stripWrappingQuotes(itemMatch[1]));
    }
    break;
  }
  return values;
}

// scripts/src/agent-registry.ts
var DEFAULT_AGENT_DIR_CANDIDATES = [
  path.join(process.cwd(), ".codebuddy", "agents"),
  path.join(process.cwd(), "agents")
];
function toPosixPath(p) {
  return p.replace(/\\/g, "/");
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function parseCli(args) {
  const parsed = { command: null, positionals: [], flags: {} };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("-") && !parsed.command) {
      parsed.command = a;
      continue;
    }
    if (!a.startsWith("-")) {
      parsed.positionals.push(a);
      continue;
    }
    if (a === "--json") {
      parsed.flags.json = true;
      continue;
    }
    if (a === "--help" || a === "-h") {
      parsed.flags.help = true;
      continue;
    }
    if ((a === "--dir" || a === "--root") && args[i + 1]) {
      parsed.flags.dir = args[++i];
      continue;
    }
    if (a === "--strict") {
      parsed.flags.strict = true;
      continue;
    }
    parsed.flags[a.replace(/^--?/, "")] = true;
  }
  if (!parsed.command) parsed.command = "list";
  return parsed;
}
function showHelp() {
  console.log(`
Agent Registry - Agent \u5B9A\u4E49\u626B\u63CF\u4E0E\u6CE8\u518C\u8868\u8F93\u51FA

\u7528\u6CD5:
  node .codebuddy/scripts/agent-registry.js <command> [args] [options]

\u547D\u4EE4:
  list                         \u5217\u51FA\u6240\u6709 Agent\uFF08\u9ED8\u8BA4\uFF09
  show <agentId>               \u67E5\u770B\u5355\u4E2A Agent

\u9009\u9879:
  --dir, --root <path>         \u626B\u63CF\u76EE\u5F55\uFF08\u9ED8\u8BA4\u4F18\u5148 .codebuddy/agents\uFF0C\u5176\u6B21 agents\uFF09
  --json                       \u8F93\u51FA JSON
  --strict                     list \u65F6\u82E5\u5B58\u5728\u89E3\u6790\u9519\u8BEF\u5219 exit=1
  --help, -h                   \u663E\u793A\u5E2E\u52A9
`.trim());
}
function parseFirstYamlCodeBlock(md) {
  const m = md.match(/```ya?ml\s*([\s\S]*?)\s*```/);
  return m ? m[1] : null;
}
function parseOptionalVersion(yaml) {
  const versionRaw = extractYamlScalar(yaml, "version");
  if (!versionRaw || versionRaw === "null") return void 0;
  return versionRaw;
}
function buildAgentEntryFromYaml(agentId, yaml, rel) {
  const name = extractYamlScalar(yaml, "name");
  const description = extractYamlScalar(yaml, "description");
  if (!name || !description) return null;
  const triggersBlock = extractYamlSection(yaml, "triggers");
  const explicitTriggers = triggersBlock ? parseYamlList(triggersBlock, "explicit", 2) : [];
  const plainTriggers = parseYamlList(yaml, "triggers");
  const triggers = explicitTriggers.length > 0 ? explicitTriggers : plainTriggers;
  const permissionsBlock = extractYamlSection(yaml, "permissions");
  const tools = permissionsBlock ? parseYamlList(permissionsBlock, "tools", 2) : [];
  const skills = permissionsBlock ? parseYamlList(permissionsBlock, "skills", 2) : [];
  const dependenciesBlock = extractYamlSection(yaml, "dependencies");
  const layer3Action = dependenciesBlock ? parseYamlList(dependenciesBlock, "layer3_action", 2) : [];
  return {
    id: agentId,
    name,
    version: parseOptionalVersion(yaml),
    description,
    triggers,
    permissions: { tools, skills },
    dependencies: { layer3_action: layer3Action },
    sourcePath: rel
  };
}
function parseAgentEntry(agentId, agentMdPathAbs) {
  const raw = fs.readFileSync(agentMdPathAbs, "utf-8");
  const rel = toPosixPath(path.relative(process.cwd(), agentMdPathAbs));
  const fm = parseFrontmatterBlock(raw);
  if (fm.ok) {
    const entry2 = buildAgentEntryFromYaml(agentId, fm.frontmatter, rel);
    if (!entry2) {
      return { ok: false, issue: { level: "error", agentId, file: rel, message: "frontmatter missing required fields: name/description" } };
    }
    return { ok: true, entry: entry2 };
  }
  if (raw.replace(/^\uFEFF/, "").startsWith("---")) {
    return { ok: false, issue: { level: "error", agentId, file: rel, message: fm.error } };
  }
  const yaml = parseFirstYamlCodeBlock(raw);
  if (!yaml) {
    return { ok: false, issue: { level: "error", agentId, file: rel, message: "missing metadata (frontmatter or ```yaml``` block)" } };
  }
  const entry = buildAgentEntryFromYaml(agentId, yaml, rel);
  if (!entry) {
    return { ok: false, issue: { level: "error", agentId, file: rel, message: "yaml metadata missing required fields: name/description" } };
  }
  return { ok: true, entry };
}
function resolveAgentsRootDir(dirFlag) {
  if (isNonEmptyString(dirFlag)) {
    const abs = path.isAbsolute(dirFlag) ? dirFlag : path.join(process.cwd(), dirFlag);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
      return { ok: false, issue: { level: "error", message: `agents dir not found: ${abs}` } };
    }
    return { ok: true, rootDir: abs };
  }
  for (const cand of DEFAULT_AGENT_DIR_CANDIDATES) {
    if (fs.existsSync(cand) && fs.statSync(cand).isDirectory()) {
      return { ok: true, rootDir: cand };
    }
  }
  return { ok: false, issue: { level: "error", message: "agents dir not found: expected .codebuddy/agents or agents (run codebuddy-loader first)" } };
}
function scanAgents(rootDirAbs) {
  const issues = [];
  const agents = [];
  const dirents = fs.readdirSync(rootDirAbs, { withFileTypes: true });
  for (const d of dirents) {
    if (!d.isDirectory()) continue;
    const agentId = d.name;
    const agentMdPathAbs = path.join(rootDirAbs, agentId, "AGENT.md");
    if (!fs.existsSync(agentMdPathAbs)) continue;
    try {
      const parsed = parseAgentEntry(agentId, agentMdPathAbs);
      if (parsed.ok) agents.push(parsed.entry);
      else issues.push(parsed.issue);
    } catch (e) {
      issues.push({
        level: "error",
        agentId,
        file: toPosixPath(path.relative(process.cwd(), agentMdPathAbs)),
        message: e instanceof Error ? e.message : String(e)
      });
    }
  }
  agents.sort((a, b) => a.id.localeCompare(b.id));
  return { agents, issues };
}
function printJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}
`);
}
function main() {
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
  const command = parsed.command ?? "list";
  switch (command) {
    case "list": {
      const payload = {
        ok: issues.every((i) => i.level !== "error"),
        rootDir: toPosixPath(path.relative(process.cwd(), rootDirAbs)),
        agentCount: agents.length,
        agents,
        issues
      };
      if (json) {
        printJson(payload);
      } else {
        console.log(`[AgentRegistry] root: ${payload.rootDir}`);
        for (const a of agents) {
          const v = a.version ? `@${a.version}` : "";
          console.log(`- ${a.id}${v}: ${a.description}`);
        }
        if (issues.length > 0) {
          console.log("");
          console.log("[AgentRegistry] issues:");
          for (const i of issues) {
            const where = i.file ? ` (${i.file})` : "";
            console.log(`- ${i.level}${i.agentId ? ` ${i.agentId}` : ""}: ${i.message}${where}`);
          }
        }
      }
      if (parsed.flags.strict && issues.some((i) => i.level === "error")) {
        process.exit(1);
      }
      process.exit(0);
    }
    case "show": {
      const agentId = parsed.positionals[0];
      if (!agentId) {
        if (json) printJson({ ok: false, error: "missing agentId" });
        else console.error("\u9519\u8BEF: show \u9700\u8981 <agentId>");
        process.exit(1);
      }
      const found = agents.find((a) => a.id === agentId);
      if (!found) {
        if (json) printJson({ ok: false, error: "not_found", agentId });
        else console.error(`\u9519\u8BEF: Agent not found: ${agentId}`);
        process.exit(1);
      }
      if (json) printJson({ ok: true, agent: found });
      else console.log(JSON.stringify(found, null, 2));
      process.exit(0);
    }
    default: {
      if (json) printJson({ ok: false, error: `unknown command: ${command}` });
      else console.error(`\u672A\u77E5\u547D\u4EE4: ${command}`);
      showHelp();
      process.exit(1);
    }
  }
}
if (require.main === module) {
  main();
}
