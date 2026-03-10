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

// scripts/src/skill-validator.ts
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
function extractYamlScalar(frontmatter, key, indent = 0) {
  const normalized = normalizeNewlines(frontmatter);
  const pattern = new RegExp(`^${escapeRegex(indentPrefix(indent))}${escapeRegex(key)}:\\s*(.+)$`, "m");
  const match = normalized.match(pattern);
  if (!match) return void 0;
  return stripWrappingQuotes(match[1]);
}
function listYamlKeys(yaml, indent = 0) {
  const normalized = normalizeNewlines(yaml);
  const prefix = indentPrefix(indent);
  const keys = [];
  for (const line of normalized.split("\n")) {
    const match = line.match(new RegExp(`^${escapeRegex(prefix)}([A-Za-z0-9_-]+):(?:\\s+.*)?$`));
    if (match) keys.push(match[1]);
  }
  return keys;
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

// scripts/src/skill-validator.ts
function toPosixPath(p) {
  return p.replace(/\\/g, "/");
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
    if (a === "--strict") {
      parsed.flags.strict = true;
      continue;
    }
    if ((a === "--dir" || a === "--root") && args[i + 1]) {
      parsed.flags.dir = args[++i];
      continue;
    }
    parsed.flags[a.replace(/^--?/, "")] = true;
  }
  if (!parsed.command) parsed.command = "check";
  return parsed;
}
function showHelp() {
  console.log(`
Skill Validator - Skills \u57FA\u7840\u6821\u9A8C

\u7528\u6CD5:
  node .codebuddy/scripts/skill-validator.js [command] [options]

\u547D\u4EE4:
  check                        \u6821\u9A8C skills\uFF08\u9ED8\u8BA4\uFF09

\u9009\u9879:
  --dir, --root <path>         skills \u76EE\u5F55\uFF08\u9ED8\u8BA4: ./custom-skills \u6216 install.json \u8BB0\u5F55\u7684 active skills root \u81EA\u52A8\u63A2\u6D4B\uFF09
  --json                       \u8F93\u51FA JSON
  --strict                     \u5B58\u5728 error \u65F6 exit=1\uFF08\u9ED8\u8BA4\u4E5F\u662F\u5982\u6B64\uFF1B\u4FDD\u7559\u8BE5\u5F00\u5173\u4FBF\u4E8E\u5BF9\u9F50\u5176\u5B83\u811A\u672C\uFF09
  --help, -h                   \u663E\u793A\u5E2E\u52A9

\u8BF4\u660E:
  - \u9ED8\u8BA4\u9012\u5F52\u6821\u9A8C skill \u76EE\u5F55\u4E0B\u5168\u90E8 Markdown \u6587\u4EF6\u7684\u76F8\u5BF9\u94FE\u63A5
  - \u6307\u5411 skill \u6839\u76EE\u5F55\u5916\u90E8\u7684\u76F8\u5BF9\u8DEF\u5F84\uFF0C\u9700\u7528 metadata.link_whitelist \u663E\u5F0F\u653E\u884C
`.trim());
}
function readText(filePath) {
  try {
    return { ok: true, data: fs.readFileSync(filePath, "utf-8") };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
function detectInstalledSkillsDir(cwd) {
  const installStatePath = path.join(cwd, ".codebuddy", "install.json");
  if (!fs.existsSync(installStatePath)) {
    return null;
  }
  try {
    const installState = JSON.parse(fs.readFileSync(installStatePath, "utf-8"));
    const skillsRootDir = installState.outputs?.skillsRootDir || ((installState.stats?.skills || 0) > 0 ? ".codebuddy/skills" : null);
    if (!skillsRootDir) {
      return null;
    }
    const absolutePath = path.resolve(cwd, skillsRootDir);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
      return absolutePath;
    }
  } catch {
  }
  return null;
}
function detectDefaultSkillsDir(cwd) {
  const installedSkillsDir = detectInstalledSkillsDir(cwd);
  const candidates = [
    path.join(cwd, "custom-skills"),
    installedSkillsDir,
    path.join(cwd, ".codebuddy", "skills")
  ].filter((value) => Boolean(value));
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
    } catch {
    }
  }
  return null;
}
function listSkillDirs(skillsDir) {
  try {
    return fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).filter((name) => !name.startsWith("."));
  } catch {
    return [];
  }
}
function isSubPath(parentDir, childPath) {
  const rel = path.relative(parentDir, childPath);
  return rel === "" || !rel.startsWith("..") && !path.isAbsolute(rel);
}
function listMarkdownFiles(rootDir) {
  const files = [];
  const queue = [rootDir];
  const ignoredDirNames = /* @__PURE__ */ new Set([".git", "node_modules", "__pycache__"]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (ignoredDirNames.has(entry.name)) continue;
        queue.push(path.join(current, entry.name));
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        files.push(path.join(current, entry.name));
      }
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}
function stripMarkdownCode(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, " ")).replace(/~~~[\s\S]*?~~~/g, (block) => block.replace(/[^\n]/g, " ")).replace(/`[^`\n]*`/g, (code) => code.replace(/[^\n]/g, " "));
}
function countLineAtOffset(text, offset) {
  let line = 1;
  for (let i = 0; i < offset; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}
function parseMarkdownLinks(markdown) {
  const links = [];
  const sanitized = stripMarkdownCode(markdown);
  const re = /!?\[([^\]\n]*?)\]\(([^)\n]+)\)/g;
  let m;
  while (m = re.exec(sanitized)) {
    if (m[0].startsWith("!")) continue;
    const destination = splitMarkdownLinkDestination(m[2]);
    if (!destination.target) continue;
    links.push({
      text: m[1].trim(),
      target: destination.target,
      title: destination.title,
      line: countLineAtOffset(sanitized, m.index)
    });
  }
  return links;
}
function splitMarkdownLinkDestination(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return { target: "", title: null };
  if (trimmed.startsWith("<")) {
    const closing = trimmed.indexOf(">");
    if (closing > 0) {
      const target = trimmed.slice(1, closing).trim();
      const title = trimmed.slice(closing + 1).trim();
      return { target, title: title || null };
    }
  }
  const match = trimmed.match(/^(\S+)(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?$/);
  if (!match) {
    return { target: trimmed, title: null };
  }
  return {
    target: match[1].trim(),
    title: (match[2] ?? match[3] ?? match[4] ?? "").trim() || null
  };
}
function normalizeLocalMarkdownTarget(target) {
  let normalized = target.trim();
  const hashIndex = normalized.indexOf("#");
  if (hashIndex >= 0) normalized = normalized.slice(0, hashIndex);
  const queryIndex = normalized.indexOf("?");
  if (queryIndex >= 0) normalized = normalized.slice(0, queryIndex);
  return normalized.trim();
}
function normalizeWhitelistEntry(value) {
  return toPosixPath(value.trim()).replace(/^\.\//, "");
}
function parseLinkWhitelist(frontmatter) {
  const metadataBlock = extractYamlSection(frontmatter, "metadata");
  if (!metadataBlock) return [];
  return parseYamlList(metadataBlock, "link_whitelist", 2).map(normalizeWhitelistEntry).filter(Boolean);
}
function isWhitelistedRelativePath(relativeTarget, whitelist) {
  const normalizedTarget = normalizeWhitelistEntry(relativeTarget);
  return whitelist.some((rule) => {
    const normalizedRule = normalizeWhitelistEntry(rule);
    if (!normalizedRule) return false;
    if (normalizedRule.endsWith("/")) {
      const prefix = normalizedRule.slice(0, -1);
      return normalizedTarget === prefix || normalizedTarget.startsWith(normalizedRule);
    }
    return normalizedTarget === normalizedRule;
  });
}
function formatLinkLabel(link) {
  if (link.text) return `"${link.text}"`;
  if (link.title) return `"${link.title}"`;
  return link.target;
}
function validateMarkdownFile(skillId, skillDir, filePath, whitelist) {
  const issues = [];
  const relativeFile = toPosixPath(path.relative(process.cwd(), filePath));
  const read = readText(filePath);
  if (!read.ok) {
    issues.push({ level: "error", skillId, file: relativeFile, message: `\u8BFB\u53D6\u5931\u8D25: ${read.error}` });
    return { issues, checkedLinkCount: 0 };
  }
  const raw = read.data;
  const backtickFenceCount = raw.match(/^```/gm)?.length ?? 0;
  if (backtickFenceCount % 2 !== 0) {
    issues.push({ level: "error", skillId, file: relativeFile, message: "\u5B58\u5728\u672A\u95ED\u5408\u7684\u4EE3\u7801\u5757\uFF08``` \u6570\u91CF\u4E3A\u5947\u6570\uFF09" });
  }
  const tildeFenceCount = raw.match(/^~~~/gm)?.length ?? 0;
  if (tildeFenceCount % 2 !== 0) {
    issues.push({ level: "error", skillId, file: relativeFile, message: "\u5B58\u5728\u672A\u95ED\u5408\u7684\u4EE3\u7801\u5757\uFF08~~~ \u6570\u91CF\u4E3A\u5947\u6570\uFF09" });
  }
  const links = parseMarkdownLinks(raw);
  for (const link of links) {
    const localTarget = normalizeLocalMarkdownTarget(link.target);
    if (!localTarget || isSkippableLink(localTarget)) continue;
    if (localTarget.startsWith("/")) continue;
    if (path.isAbsolute(localTarget)) continue;
    const resolved = path.resolve(path.dirname(filePath), localTarget);
    if (!fs.existsSync(resolved)) {
      issues.push({
        level: "error",
        skillId,
        file: relativeFile,
        message: `\u7B2C ${link.line} \u884C\u94FE\u63A5 ${formatLinkLabel(link)} \u76EE\u6807\u4E0D\u5B58\u5728: ${localTarget}`
      });
      continue;
    }
    if (!isSubPath(skillDir, resolved)) {
      const escapedRelativePath = normalizeWhitelistEntry(toPosixPath(path.relative(skillDir, resolved)));
      if (!isWhitelistedRelativePath(escapedRelativePath, whitelist)) {
        issues.push({
          level: "error",
          skillId,
          file: relativeFile,
          message: `\u7B2C ${link.line} \u884C\u94FE\u63A5 ${formatLinkLabel(link)} \u6307\u5411 skill \u76EE\u5F55\u5916\u90E8: ${escapedRelativePath}\uFF08\u53EF\u7528 metadata.link_whitelist \u663E\u5F0F\u653E\u884C\uFF09`
        });
      }
    }
  }
  return { issues, checkedLinkCount: links.length };
}
function isSkippableLink(url) {
  if (url.startsWith("#")) return true;
  if (url.startsWith("http://") || url.startsWith("https://")) return true;
  if (url.startsWith("mailto:")) return true;
  if (/^[a-zA-Z]+:\/\//.test(url)) return true;
  return false;
}
function validateSkillDir(skillId, skillDir) {
  const issues = [];
  const skillFile = path.join(skillDir, "SKILL.md");
  const relSkillFile = toPosixPath(path.relative(process.cwd(), skillFile));
  if (!fs.existsSync(skillFile)) {
    issues.push({ level: "error", skillId, file: toPosixPath(path.relative(process.cwd(), skillDir)), message: "\u7F3A\u5C11 SKILL.md" });
    return { issues, checkedFileCount: 0, checkedLinkCount: 0 };
  }
  const read = readText(skillFile);
  if (!read.ok) {
    issues.push({ level: "error", skillId, file: relSkillFile, message: `\u8BFB\u53D6\u5931\u8D25: ${read.error}` });
    return { issues, checkedFileCount: 1, checkedLinkCount: 0 };
  }
  const raw = read.data;
  const fm = parseFrontmatterBlock(raw);
  if (!fm.ok) {
    issues.push({ level: "error", skillId, file: relSkillFile, message: fm.error });
    return { issues, checkedFileCount: 1, checkedLinkCount: 0 };
  }
  const frontmatter = fm.frontmatter;
  const name = (extractYamlScalar(frontmatter, "name") ?? "").trim();
  const description = (extractYamlScalar(frontmatter, "description") ?? "").trim();
  if (!name) issues.push({ level: "error", skillId, file: relSkillFile, message: "frontmatter \u7F3A\u5C11 name" });
  if (!description) issues.push({ level: "error", skillId, file: relSkillFile, message: "frontmatter \u7F3A\u5C11 description" });
  if (name && name !== skillId) {
    issues.push({ level: "warning", skillId, file: relSkillFile, message: `skillId \u4E0E frontmatter.name \u4E0D\u4E00\u81F4\uFF08dir=${skillId}, name=${name}\uFF09` });
  }
  const topLevelKeys = listYamlKeys(frontmatter);
  const allowedKeys = /* @__PURE__ */ new Set(["name", "description", "metadata", "triggers", "tools", "related"]);
  for (const k of topLevelKeys) {
    if (!allowedKeys.has(k)) {
      issues.push({ level: "warning", skillId, file: relSkillFile, message: `frontmatter \u5305\u542B\u975E\u63A8\u8350\u5B57\u6BB5: ${k}\uFF08\u5EFA\u8BAE\u4EC5\u4FDD\u7559 name/description/metadata\uFF09` });
    }
  }
  for (const legacyKey of ["triggers", "tools", "related"]) {
    if (topLevelKeys.includes(legacyKey)) {
      issues.push({
        level: "warning",
        skillId,
        file: relSkillFile,
        message: `top-level ${legacyKey} \u5DF2\u5E9F\u5F03\uFF0C\u5EFA\u8BAE\u8FC1\u79FB\u5230 metadata.${legacyKey}`
      });
    }
  }
  const metadataBlock = extractYamlSection(frontmatter, "metadata");
  if (metadataBlock) {
    const metadataKeys = listYamlKeys(metadataBlock, 2);
    const allowedMetadataKeys = /* @__PURE__ */ new Set([
      "triggers",
      "tools",
      "related",
      "languages",
      "frameworks",
      "roles",
      "scenarios",
      "workspace_scope",
      "link_whitelist"
    ]);
    for (const key of metadataKeys) {
      if (!allowedMetadataKeys.has(key)) {
        issues.push({
          level: "warning",
          skillId,
          file: relSkillFile,
          message: `metadata \u5305\u542B\u672A\u77E5\u5B57\u6BB5: ${key}\uFF08\u63A8\u8350\u4EC5\u4F7F\u7528 triggers/tools/related\uFF09`
        });
      }
    }
    for (const key of ["triggers", "tools", "related"]) {
      if (topLevelKeys.includes(key) && parseYamlList(metadataBlock, key, 2).length > 0) {
        issues.push({
          level: "warning",
          skillId,
          file: relSkillFile,
          message: `\u540C\u65F6\u5B58\u5728 legacy ${key} \u4E0E metadata.${key}\uFF0C\u5EFA\u8BAE\u53EA\u4FDD\u7559 metadata.${key}`
        });
      }
    }
  }
  const whitelist = parseLinkWhitelist(frontmatter);
  const markdownFiles = listMarkdownFiles(skillDir);
  let checkedLinkCount = 0;
  for (const markdownFile of markdownFiles) {
    const result = validateMarkdownFile(skillId, skillDir, markdownFile, whitelist);
    checkedLinkCount += result.checkedLinkCount;
    issues.push(...result.issues);
  }
  return { issues, checkedFileCount: markdownFiles.length, checkedLinkCount };
}
function main() {
  const parsed = parseCli(process.argv.slice(2));
  if (parsed.flags.help || parsed.command === "help") {
    showHelp();
    process.exit(0);
  }
  if (parsed.command !== "check") {
    console.error(`\u9519\u8BEF: \u672A\u77E5\u547D\u4EE4: ${parsed.command}`);
    showHelp();
    process.exit(1);
  }
  const json = Boolean(parsed.flags.json);
  const strict = Boolean(parsed.flags.strict);
  const dirFlag = typeof parsed.flags.dir === "string" ? parsed.flags.dir : null;
  const skillsDir = dirFlag ? path.resolve(process.cwd(), dirFlag) : detectDefaultSkillsDir(process.cwd());
  if (!skillsDir) {
    const msg = "\u672A\u627E\u5230 skills \u76EE\u5F55\uFF08\u671F\u671B ./custom-skills \u6216 install.json \u8BB0\u5F55\u7684 active skills root\uFF09\u3002\u8BF7\u4F7F\u7528 --dir \u6307\u5B9A\u3002";
    if (json) {
      console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
    } else {
      console.error(`\u9519\u8BEF: ${msg}`);
    }
    process.exit(1);
  }
  const skillDirs = listSkillDirs(skillsDir);
  const issues = [];
  let checkedFileCount = 0;
  let checkedLinkCount = 0;
  for (const skillId of skillDirs) {
    const abs = path.join(skillsDir, skillId);
    const res = validateSkillDir(skillId, abs);
    checkedFileCount += res.checkedFileCount;
    checkedLinkCount += res.checkedLinkCount;
    issues.push(...res.issues);
  }
  const errorCount = issues.filter((i) => i.level === "error").length;
  const warningCount = issues.filter((i) => i.level === "warning").length;
  const payload = {
    ok: errorCount === 0,
    skillsDir: toPosixPath(path.relative(process.cwd(), skillsDir) || "."),
    checkedSkillCount: skillDirs.length,
    checkedFileCount,
    checkedLinkCount,
    issueCount: issues.length,
    errorCount,
    warningCount,
    issues
  };
  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`[skill-validator] root: ${payload.skillsDir}`);
    console.log(
      `[skill-validator] checked skills: ${payload.checkedSkillCount}, files: ${payload.checkedFileCount}, links: ${payload.checkedLinkCount}, errors: ${payload.errorCount}, warnings: ${payload.warningCount}`
    );
    for (const it of issues) {
      const prefix = it.level === "error" ? "ERROR" : "WARN";
      const s = it.skillId ? `(${it.skillId}) ` : "";
      console.log(`- ${prefix} ${s}${it.file}: ${it.message}`);
    }
  }
  if (strict && errorCount > 0) process.exit(1);
  if (!strict && errorCount > 0) process.exit(1);
}
main();
