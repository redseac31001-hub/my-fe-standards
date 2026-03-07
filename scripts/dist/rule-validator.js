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

// scripts/src/rule-validator.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
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
Rule Validator - \u89C4\u5219 Markdown \u57FA\u7840\u6821\u9A8C

\u7528\u6CD5:
  node .codebuddy/scripts/rule-validator.js [command] [options]

\u547D\u4EE4:
  check                        \u6821\u9A8C\u89C4\u5219\uFF08\u9ED8\u8BA4\uFF09

\u9009\u9879:
  --dir, --root <path>         \u89C4\u5219\u76EE\u5F55\uFF08\u9ED8\u8BA4: ./rules \u6216 ./.codebuddy/rules_cache \u81EA\u52A8\u63A2\u6D4B\uFF09
  --json                       \u8F93\u51FA JSON
  --strict                     \u5B58\u5728 error \u65F6 exit=1\uFF08\u9ED8\u8BA4\u4E5F\u662F\u5982\u6B64\uFF1B\u4FDD\u7559\u8BE5\u5F00\u5173\u4FBF\u4E8E\u5BF9\u9F50\u5176\u5B83\u811A\u672C\uFF09
  --help, -h                   \u663E\u793A\u5E2E\u52A9
`.trim());
}
function readText(filePath) {
  try {
    return { ok: true, data: fs.readFileSync(filePath, "utf-8") };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
function listMarkdownFiles(rootDir) {
  const out = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "_meta") continue;
        if (e.name === "node_modules") continue;
        if (e.name === ".git") continue;
        walk(full);
        continue;
      }
      if (e.isFile() && e.name.toLowerCase().endsWith(".md")) {
        out.push(full);
      }
    }
  }
  walk(rootDir);
  return out;
}
function parseFrontmatter(md) {
  const normalized = md.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---")) return { ok: true, frontmatter: null };
  const m = normalized.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/);
  if (!m) return { ok: false, error: "YAML frontmatter \u672A\u95ED\u5408\uFF08\u7F3A\u5C11\u7ED3\u675F ---\uFF09" };
  return { ok: true, frontmatter: m[1] };
}
function parseSimpleYamlObject(yaml) {
  const obj = {};
  const lines = yaml.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2];
    obj[key] = val;
  }
  return obj;
}
function detectDefaultRulesDir(cwd) {
  const candidates = [
    path.join(cwd, "rules"),
    path.join(cwd, ".codebuddy", "rules_cache"),
    path.join(cwd, ".codebuddy", "rules")
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
    } catch {
    }
  }
  return null;
}
function validateRuleFile(filePath, rootDir) {
  const issues = [];
  const rel = toPosixPath(path.relative(process.cwd(), filePath));
  const read = readText(filePath);
  if (!read.ok) {
    issues.push({ level: "error", file: rel, message: `\u8BFB\u53D6\u5931\u8D25: ${read.error}` });
    return issues;
  }
  const raw = read.data;
  const fm = parseFrontmatter(raw);
  if (!fm.ok) {
    issues.push({ level: "error", file: rel, message: fm.error });
    return issues;
  }
  if (fm.frontmatter) {
    const meta = parseSimpleYamlObject(fm.frontmatter);
    const name = (meta.name ?? "").trim();
    const description = (meta.description ?? "").trim();
    if (!name) issues.push({ level: "error", file: rel, message: "frontmatter \u7F3A\u5C11 name" });
    if (!description) issues.push({ level: "error", file: rel, message: "frontmatter \u7F3A\u5C11 description" });
  }
  const fenceMatches = raw.match(/^```/gm) ?? [];
  if (fenceMatches.length % 2 !== 0) {
    issues.push({ level: "error", file: rel, message: "\u5B58\u5728\u672A\u95ED\u5408\u7684\u4EE3\u7801\u5757\uFF08``` \u6570\u91CF\u4E3A\u5947\u6570\uFF09" });
  }
  const hasLeveled = /<!--\s*@level:/i.test(raw);
  if (hasLeveled) {
    const hasSummary = /<!--\s*@level:summary\s*-->/i.test(raw);
    const hasQuick = /<!--\s*@level:quick\s*-->/i.test(raw);
    const hasFull = /<!--\s*@level:full\s*-->/i.test(raw);
    if (!hasSummary) issues.push({ level: "warning", file: rel, message: "\u7F3A\u5C11 @level:summary \u5206\u6BB5\u6807\u8BB0" });
    if (!hasQuick) issues.push({ level: "warning", file: rel, message: "\u7F3A\u5C11 @level:quick \u5206\u6BB5\u6807\u8BB0" });
    if (!hasFull) issues.push({ level: "warning", file: rel, message: "\u7F3A\u5C11 @level:full \u5206\u6BB5\u6807\u8BB0" });
    return issues;
  }
  const hasContext = /^##+\s+.*(Context|背景与适用范围|背景)/im.test(raw);
  const hasRule = /^##+\s+.*(The Rule|规则详情)/im.test(raw);
  const hasReasoning = /^##+\s+.*(Reasoning|核心原理|原理)/im.test(raw);
  const hasExamples = /^##+\s+.*(Examples|代码示例)/im.test(raw);
  if (!hasContext) issues.push({ level: "warning", file: rel, message: "\u672A\u68C0\u6D4B\u5230 Context/\u80CC\u666F \u6BB5\u843D\u6807\u9898\uFF08\u5EFA\u8BAE\u5305\u542B\uFF09" });
  if (!hasRule) issues.push({ level: "warning", file: rel, message: "\u672A\u68C0\u6D4B\u5230 The Rule/\u89C4\u5219\u8BE6\u60C5 \u6BB5\u843D\u6807\u9898\uFF08\u5EFA\u8BAE\u5305\u542B\uFF09" });
  if (!hasReasoning) issues.push({ level: "warning", file: rel, message: "\u672A\u68C0\u6D4B\u5230 Reasoning/\u539F\u7406 \u6BB5\u843D\u6807\u9898\uFF08\u5EFA\u8BAE\u5305\u542B\uFF09" });
  if (!hasExamples) issues.push({ level: "warning", file: rel, message: "\u672A\u68C0\u6D4B\u5230 Examples/\u4EE3\u7801\u793A\u4F8B \u6BB5\u843D\u6807\u9898\uFF08\u5EFA\u8BAE\u5305\u542B\uFF09" });
  const absRoot = path.resolve(rootDir);
  const absFile = path.resolve(filePath);
  if (!absFile.startsWith(absRoot)) {
    issues.push({ level: "warning", file: rel, message: `\u6587\u4EF6\u4E0D\u5728 rootDir \u8303\u56F4\u5185: root=${toPosixPath(absRoot)}` });
  }
  return issues;
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
  const rootDir = dirFlag ? path.resolve(process.cwd(), dirFlag) : detectDefaultRulesDir(process.cwd());
  if (!rootDir) {
    const msg = "\u672A\u627E\u5230\u89C4\u5219\u76EE\u5F55\uFF08\u671F\u671B ./rules \u6216 ./.codebuddy/rules_cache\uFF09\u3002\u8BF7\u4F7F\u7528 --dir \u6307\u5B9A\u3002";
    if (json) {
      console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
    } else {
      console.error(`\u9519\u8BEF: ${msg}`);
    }
    process.exit(1);
  }
  const files = listMarkdownFiles(rootDir);
  const issues = [];
  for (const f of files) {
    issues.push(...validateRuleFile(f, rootDir));
  }
  const errorCount = issues.filter((i) => i.level === "error").length;
  const warningCount = issues.filter((i) => i.level === "warning").length;
  const payload = {
    ok: errorCount === 0,
    rootDir: toPosixPath(path.relative(process.cwd(), rootDir) || "."),
    checkedFileCount: files.length,
    issueCount: issues.length,
    errorCount,
    warningCount,
    issues
  };
  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`[rule-validator] root: ${payload.rootDir}`);
    console.log(`[rule-validator] checked: ${payload.checkedFileCount}, errors: ${payload.errorCount}, warnings: ${payload.warningCount}`);
    for (const it of issues) {
      const prefix = it.level === "error" ? "ERROR" : "WARN";
      console.log(`- ${prefix} ${it.file}: ${it.message}`);
    }
  }
  if (strict && errorCount > 0) process.exit(1);
  if (!strict && errorCount > 0) process.exit(1);
}
main();
