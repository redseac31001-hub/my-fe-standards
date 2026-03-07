"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// scripts/src/context-collector.ts
var context_collector_exports = {};
__export(context_collector_exports, {
  collectContext: () => collectContext,
  formatContextAsMarkdown: () => formatContextAsMarkdown
});
module.exports = __toCommonJS(context_collector_exports);
var fs2 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var import_child_process = require("child_process");

// scripts/src/reference-finder.ts
var fs = __toESM(require("fs"));
var path2 = __toESM(require("path"));

// scripts/src/lib/cli-entry.ts
var path = __toESM(require("path"));
function isDirectCliEntry(expectedFileNames) {
  const argvPath = process.argv[1];
  if (!argvPath) return false;
  const actual = path.basename(argvPath).toLowerCase();
  const expected = Array.isArray(expectedFileNames) ? expectedFileNames : [expectedFileNames];
  return expected.some((name) => actual === name.toLowerCase());
}

// scripts/src/reference-finder.ts
var SOURCE_EXTENSIONS = /* @__PURE__ */ new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".vue",
  ".svelte"
]);
var IGNORE_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".codebuddy",
  ".next",
  ".nuxt",
  ".output"
]);
var MAX_FILE_SIZE = 512 * 1024;
var MAX_FILES_SCAN = 5e3;
function collectSourceFiles(dir, collected, depth = 0) {
  if (depth > 15 || collected.length >= MAX_FILES_SCAN) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (collected.length >= MAX_FILES_SCAN) break;
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      collectSourceFiles(path2.join(dir, entry.name), collected, depth + 1);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path2.extname(entry.name).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    const fullPath = path2.join(dir, entry.name);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.size > MAX_FILE_SIZE) continue;
    } catch {
      continue;
    }
    collected.push(fullPath);
  }
}
function buildImportPatterns(targetPath, projectRoot) {
  const rel = path2.relative(projectRoot, targetPath).replace(/\\/g, "/");
  const withoutExt = rel.replace(/\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte)$/, "");
  const withoutIndex = withoutExt.replace(/\/index$/, "");
  const patterns = /* @__PURE__ */ new Set();
  patterns.add(withoutExt);
  patterns.add(withoutIndex);
  if (withoutExt.startsWith("src/")) {
    patterns.add(withoutExt.slice(4));
    patterns.add(withoutIndex.slice(4));
  }
  const baseName = path2.basename(withoutExt);
  patterns.add(baseName);
  return Array.from(patterns).filter((p) => p.length > 0);
}
function buildSymbolPattern(symbol) {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "g");
}
function searchFileForReferences(filePath, importPatterns, symbolPattern, targetAbsPath) {
  if (targetAbsPath && path2.resolve(filePath) === path2.resolve(targetAbsPath)) {
    return [];
  }
  let content;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }
  const results = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of importPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match) {
        const kind = /\brequire\s*\(/.test(line) ? "require" : /\bfrom\s+['"]/.test(line) ? "from" : /\bimport\s/.test(line) ? "import" : "usage";
        results.push({
          filePath,
          line: i + 1,
          column: match.index + 1,
          matchText: line.trim(),
          kind
        });
        break;
      }
    }
    if (symbolPattern) {
      symbolPattern.lastIndex = 0;
      const match = symbolPattern.exec(line);
      if (match) {
        const alreadyMatched = results.some((r) => r.filePath === filePath && r.line === i + 1);
        if (!alreadyMatched) {
          results.push({
            filePath,
            line: i + 1,
            column: match.index + 1,
            matchText: line.trim(),
            kind: "usage"
          });
        }
      }
    }
  }
  return results;
}
function findReferences(target, projectRoot, options) {
  const start = Date.now();
  const maxResults = options?.maxResults ?? 100;
  const sourceFiles = [];
  collectSourceFiles(projectRoot, sourceFiles);
  const targetAbsPath = fs.existsSync(path2.resolve(projectRoot, target)) ? path2.resolve(projectRoot, target) : null;
  const importPatterns = [];
  if (targetAbsPath) {
    const patterns = buildImportPatterns(targetAbsPath, projectRoot);
    for (const p of patterns) {
      const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      importPatterns.push(new RegExp(`['"\`](?:@/|~/|\\.{0,2}/)?(?:[^'"\`]*?/)?${escaped}(?:\\.[a-z]+)?['"\`]`, "g"));
    }
  }
  const symbolPattern = options?.symbol ? buildSymbolPattern(options.symbol) : null;
  if (!targetAbsPath && !symbolPattern) {
    const fallbackSymbol = buildSymbolPattern(target);
    const allRefs2 = [];
    for (const file of sourceFiles) {
      if (allRefs2.length >= maxResults) break;
      const refs = searchFileForReferences(file, [], fallbackSymbol, null);
      allRefs2.push(...refs);
    }
    return {
      target,
      references: allRefs2.slice(0, maxResults),
      searchedFiles: sourceFiles.length,
      durationMs: Date.now() - start
    };
  }
  const allRefs = [];
  for (const file of sourceFiles) {
    if (allRefs.length >= maxResults) break;
    const refs = searchFileForReferences(file, importPatterns, symbolPattern, targetAbsPath);
    allRefs.push(...refs);
  }
  return {
    target,
    references: allRefs.slice(0, maxResults),
    searchedFiles: sourceFiles.length,
    durationMs: Date.now() - start
  };
}
function findRelatedTests(targetPath, projectRoot) {
  const results = [];
  const rel = path2.relative(projectRoot, targetPath).replace(/\\/g, "/");
  const parsed = path2.parse(rel);
  const baseName = parsed.name;
  const exactPatterns = [
    `${baseName}.spec.ts`,
    `${baseName}.spec.tsx`,
    `${baseName}.test.ts`,
    `${baseName}.test.tsx`,
    `${baseName}.spec.js`,
    `${baseName}.spec.jsx`,
    `${baseName}.test.js`,
    `${baseName}.test.jsx`
  ];
  const testDirs = [
    path2.dirname(path2.join(projectRoot, rel)),
    // 同目录
    path2.join(projectRoot, "__tests__"),
    // 根 __tests__
    path2.join(projectRoot, "test"),
    // 根 test
    path2.join(projectRoot, "tests"),
    // 根 tests
    path2.join(projectRoot, "src", "__tests__"),
    // src/__tests__
    path2.join(path2.dirname(path2.join(projectRoot, rel)), "__tests__")
    // 同级 __tests__
  ];
  const seen = /* @__PURE__ */ new Set();
  for (const dir of testDirs) {
    if (!fs.existsSync(dir)) continue;
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path2.join(dir, entry);
      const normalized = path2.resolve(fullPath);
      if (seen.has(normalized)) continue;
      if (exactPatterns.includes(entry)) {
        seen.add(normalized);
        results.push({
          testPath: path2.relative(projectRoot, fullPath).replace(/\\/g, "/"),
          sourcePath: rel,
          confidence: "exact"
        });
        continue;
      }
      if ((entry.includes(".spec.") || entry.includes(".test.")) && entry.includes(baseName)) {
        seen.add(normalized);
        results.push({
          testPath: path2.relative(projectRoot, fullPath).replace(/\\/g, "/"),
          sourcePath: rel,
          confidence: "pattern"
        });
      }
    }
  }
  if (results.length === 0) {
    const sourceDir = path2.dirname(path2.join(projectRoot, rel));
    if (fs.existsSync(sourceDir)) {
      try {
        const entries = fs.readdirSync(sourceDir);
        for (const entry of entries) {
          if (entry.includes(".spec.") || entry.includes(".test.")) {
            const fullPath = path2.join(sourceDir, entry);
            const normalized = path2.resolve(fullPath);
            if (seen.has(normalized)) continue;
            seen.add(normalized);
            results.push({
              testPath: path2.relative(projectRoot, fullPath).replace(/\\/g, "/"),
              sourcePath: rel,
              confidence: "directory"
            });
          }
        }
      } catch {
      }
    }
  }
  return results;
}
function showHelp() {
  console.log(`
Reference Finder - \u8F7B\u91CF\u7EA7\u5F15\u7528\u8FFD\u8E2A\u5668

\u7528\u6CD5:
  node .codebuddy/scripts/reference-finder.js <target> [options]

\u53C2\u6570:
  target                \u76EE\u6807\u6587\u4EF6\u8DEF\u5F84\u6216\u7B26\u53F7\u540D

\u9009\u9879:
  --symbol <name>       \u989D\u5916\u641C\u7D22\u6307\u5B9A\u7B26\u53F7\u7684\u5F15\u7528
  --max <n>             \u6700\u5927\u7ED3\u679C\u6570\uFF08\u9ED8\u8BA4: 100\uFF09
  --tests               \u540C\u65F6\u67E5\u627E\u5173\u8054\u6D4B\u8BD5\u6587\u4EF6
  --json                \u4EE5 JSON \u683C\u5F0F\u8F93\u51FA
  -h, --help            \u663E\u793A\u5E2E\u52A9
`);
}
function main() {
  const args = process.argv.slice(2);
  let target = "";
  let symbol;
  let maxResults = 100;
  let findTests = false;
  let jsonOutput = false;
  let help = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
      help = true;
      continue;
    }
    if (arg === "--symbol" && args[i + 1]) {
      symbol = args[++i];
      continue;
    }
    if (arg === "--max" && args[i + 1]) {
      maxResults = parseInt(args[++i], 10) || 100;
      continue;
    }
    if (arg === "--tests") {
      findTests = true;
      continue;
    }
    if (arg === "--json") {
      jsonOutput = true;
      continue;
    }
    if (!arg.startsWith("-") && !target) {
      target = arg;
    }
  }
  if (help || !target) {
    showHelp();
    process.exit(target ? 0 : 1);
  }
  const projectRoot = process.cwd();
  const result = findReferences(target, projectRoot, { symbol, maxResults });
  if (jsonOutput) {
    const output = { ...result };
    if (findTests) {
      const absTarget = fs.existsSync(path2.resolve(projectRoot, target)) ? path2.resolve(projectRoot, target) : null;
      if (absTarget) {
        output.relatedTests = findRelatedTests(absTarget, projectRoot);
      }
    }
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`
\u5F15\u7528\u8FFD\u8E2A: ${result.target}`);
    console.log(`\u626B\u63CF\u6587\u4EF6: ${result.searchedFiles}\uFF0C\u8017\u65F6: ${result.durationMs}ms`);
    console.log(`\u627E\u5230 ${result.references.length} \u5904\u5F15\u7528:
`);
    for (const ref of result.references) {
      const relPath = path2.relative(projectRoot, ref.filePath).replace(/\\/g, "/");
      console.log(`  ${relPath}:${ref.line} [${ref.kind}]`);
      console.log(`    ${ref.matchText}`);
    }
    if (findTests) {
      const absTarget = fs.existsSync(path2.resolve(projectRoot, target)) ? path2.resolve(projectRoot, target) : null;
      if (absTarget) {
        const tests = findRelatedTests(absTarget, projectRoot);
        if (tests.length > 0) {
          console.log(`
\u5173\u8054\u6D4B\u8BD5\u6587\u4EF6 (${tests.length}):
`);
          for (const t of tests) {
            console.log(`  ${t.testPath} [${t.confidence}]`);
          }
        }
      }
    }
  }
}
if (isDirectCliEntry("reference-finder.js")) {
  main();
}

// scripts/src/context-collector.ts
var MAX_FILE_CONTENT_LINES = 300;
var MAX_FILE_CONTENT_CHARS = 2e4;
var MAX_GIT_COMMITS = 10;
var MAX_REFERENCES_PER_FILE = 30;
var COLLECT_TIMEOUT_MS = 15e3;
function extractTargetFiles(task) {
  const files = [];
  if (task.scope?.files) {
    for (const f of task.scope.files) {
      if (typeof f === "string" && f.trim().length > 0) {
        files.push(f.trim());
      }
    }
  }
  const pathPattern = /(?:^|\s)((?:src|lib|components|pages|utils|hooks|services|api|store|modules)\/[\w./-]+\.\w+)/g;
  const textSources = [task.title, ...task.acceptanceCriteria ?? []];
  for (const text of textSources) {
    if (!text) continue;
    let match;
    pathPattern.lastIndex = 0;
    while ((match = pathPattern.exec(text)) !== null) {
      const candidate = match[1];
      if (!files.includes(candidate)) {
        files.push(candidate);
      }
    }
  }
  return files;
}
function readFileContent(filePath, projectRoot, maxLines) {
  const absPath = path3.isAbsolute(filePath) ? filePath : path3.resolve(projectRoot, filePath);
  if (!fs2.existsSync(absPath)) return null;
  let content;
  try {
    content = fs2.readFileSync(absPath, "utf-8");
  } catch {
    return null;
  }
  const allLines = content.split(/\r?\n/);
  const totalLines = allLines.length;
  if (allLines.length > maxLines) {
    content = allLines.slice(0, maxLines).join("\n") + `

... (\u622A\u65AD\uFF0C\u5171 ${totalLines} \u884C\uFF0C\u4EC5\u663E\u793A\u524D ${maxLines} \u884C)`;
  }
  if (content.length > MAX_FILE_CONTENT_CHARS) {
    content = content.slice(0, MAX_FILE_CONTENT_CHARS) + `

... (\u622A\u65AD\uFF0C\u8D85\u8FC7 ${MAX_FILE_CONTENT_CHARS} \u5B57\u7B26\u9650\u5236)`;
  }
  const relPath = path3.relative(projectRoot, absPath).replace(/\\/g, "/");
  return { path: relPath, content, lines: totalLines };
}
function getGitHistory(targetFiles, projectRoot, maxCommits) {
  if (targetFiles.length === 0) return [];
  const gitCheck = (0, import_child_process.spawnSync)("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: projectRoot,
    encoding: "utf-8",
    stdio: "pipe",
    timeout: 5e3
  });
  if (gitCheck.status !== 0) return [];
  const entries = [];
  const seenHashes = /* @__PURE__ */ new Set();
  for (const file of targetFiles) {
    const result = (0, import_child_process.spawnSync)("git", [
      "log",
      `--max-count=${maxCommits}`,
      "--format=%H|%an|%aI|%s",
      "--name-only",
      "--",
      file
    ], {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 5e3
    });
    if (result.status !== 0 || !result.stdout) continue;
    const lines = result.stdout.trim().split(/\r?\n/);
    let current = null;
    for (const line of lines) {
      if (!line.trim()) {
        if (current && !seenHashes.has(current.hash)) {
          seenHashes.add(current.hash);
          entries.push(current);
        }
        current = null;
        continue;
      }
      if (line.includes("|")) {
        const parts = line.split("|");
        if (parts.length >= 4) {
          if (current && !seenHashes.has(current.hash)) {
            seenHashes.add(current.hash);
            entries.push(current);
          }
          current = {
            hash: parts[0].slice(0, 8),
            author: parts[1],
            date: parts[2],
            message: parts.slice(3).join("|"),
            files: []
          };
        }
      } else if (current) {
        current.files.push(line.trim());
      }
    }
    if (current && !seenHashes.has(current.hash)) {
      seenHashes.add(current.hash);
      entries.push(current);
    }
  }
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries.slice(0, maxCommits);
}
function collectContext(task, projectRoot, options) {
  const start = Date.now();
  const maxFileLines = options?.maxFileLines ?? MAX_FILE_CONTENT_LINES;
  const maxGitCommits = options?.maxGitCommits ?? MAX_GIT_COMMITS;
  const maxRefsPerFile = options?.maxRefsPerFile ?? MAX_REFERENCES_PER_FILE;
  const includeFileContent = options?.includeFileContent !== false;
  const includeReferences = options?.includeReferences !== false;
  const includeTests = options?.includeTests !== false;
  const includeGitHistory = options?.includeGitHistory !== false;
  const targetFiles = extractTargetFiles(task);
  const fileContents = [];
  if (includeFileContent) {
    for (const file of targetFiles) {
      if (Date.now() - start > COLLECT_TIMEOUT_MS) break;
      const result = readFileContent(file, projectRoot, maxFileLines);
      if (result) fileContents.push(result);
    }
  }
  const references = [];
  if (includeReferences) {
    for (const file of targetFiles) {
      if (Date.now() - start > COLLECT_TIMEOUT_MS) break;
      const result = findReferences(file, projectRoot, { maxResults: maxRefsPerFile });
      if (result.references.length > 0) {
        references.push(result);
      }
    }
  }
  const relatedTests = [];
  if (includeTests) {
    const seen = /* @__PURE__ */ new Set();
    for (const file of targetFiles) {
      if (Date.now() - start > COLLECT_TIMEOUT_MS) break;
      const absPath = path3.isAbsolute(file) ? file : path3.resolve(projectRoot, file);
      if (!fs2.existsSync(absPath)) continue;
      const tests = findRelatedTests(absPath, projectRoot);
      for (const t of tests) {
        if (!seen.has(t.testPath)) {
          seen.add(t.testPath);
          relatedTests.push(t);
        }
      }
    }
  }
  const gitHistory = includeGitHistory ? getGitHistory(targetFiles, projectRoot, maxGitCommits) : [];
  return {
    targetFiles: fileContents,
    references,
    relatedTests,
    gitHistory,
    collectedAt: (/* @__PURE__ */ new Date()).toISOString(),
    durationMs: Date.now() - start
  };
}
function formatContextAsMarkdown(ctx) {
  const sections = [];
  if (ctx.targetFiles.length > 0) {
    sections.push("## Context: \u76EE\u6807\u6587\u4EF6\u5185\u5BB9");
    for (const file of ctx.targetFiles) {
      const ext = path3.extname(file.path).slice(1) || "text";
      sections.push(`### ${file.path} (${file.lines} \u884C)`);
      sections.push("```" + ext);
      sections.push(file.content);
      sections.push("```");
      sections.push("");
    }
  }
  if (ctx.references.length > 0) {
    sections.push("## Context: \u5F15\u7528\u8FFD\u8E2A");
    for (const ref of ctx.references) {
      sections.push(`### ${ref.target} \u7684\u5F15\u7528 (${ref.references.length} \u5904)`);
      for (const r of ref.references) {
        const relPath = r.filePath.replace(/\\/g, "/");
        sections.push(`- \`${relPath}:${r.line}\` [${r.kind}] ${r.matchText}`);
      }
      sections.push("");
    }
  }
  if (ctx.relatedTests.length > 0) {
    sections.push("## Context: \u5173\u8054\u6D4B\u8BD5\u6587\u4EF6");
    for (const t of ctx.relatedTests) {
      sections.push(`- \`${t.testPath}\` [${t.confidence}] \u2190 ${t.sourcePath}`);
    }
    sections.push("");
  }
  if (ctx.gitHistory.length > 0) {
    sections.push("## Context: Git \u6700\u8FD1\u53D8\u66F4");
    for (const entry of ctx.gitHistory) {
      const filesStr = entry.files.length > 0 ? ` (${entry.files.join(", ")})` : "";
      sections.push(`- \`${entry.hash}\` ${entry.date.slice(0, 10)} ${entry.author}: ${entry.message}${filesStr}`);
    }
    sections.push("");
  }
  if (sections.length === 0) {
    return "";
  }
  return sections.join("\n");
}
function showHelp2() {
  console.log(`
Context Collector - \u4E0A\u4E0B\u6587\u81EA\u52A8\u6536\u96C6\u5668

\u7528\u6CD5:
  node .codebuddy/scripts/context-collector.js --files <file1,file2> [options]

\u9009\u9879:
  --files <paths>       \u9017\u53F7\u5206\u9694\u7684\u76EE\u6807\u6587\u4EF6\u5217\u8868
  --symbol <name>       \u989D\u5916\u641C\u7D22\u6307\u5B9A\u7B26\u53F7
  --max-lines <n>       \u6587\u4EF6\u5185\u5BB9\u6700\u5927\u884C\u6570\uFF08\u9ED8\u8BA4: 300\uFF09
  --max-commits <n>     Git \u5386\u53F2\u6700\u5927\u6761\u6570\uFF08\u9ED8\u8BA4: 10\uFF09
  --no-content          \u4E0D\u8BFB\u53D6\u6587\u4EF6\u5185\u5BB9
  --no-refs             \u4E0D\u8FFD\u8E2A\u5F15\u7528
  --no-tests            \u4E0D\u67E5\u627E\u6D4B\u8BD5\u6587\u4EF6
  --no-git              \u4E0D\u83B7\u53D6 Git \u5386\u53F2
  --json                \u4EE5 JSON \u683C\u5F0F\u8F93\u51FA
  --markdown            \u4EE5 Markdown \u683C\u5F0F\u8F93\u51FA\uFF08\u9ED8\u8BA4\uFF09
  -h, --help            \u663E\u793A\u5E2E\u52A9
`);
}
function main2() {
  const args = process.argv.slice(2);
  let files = [];
  let maxLines = MAX_FILE_CONTENT_LINES;
  let maxCommits = MAX_GIT_COMMITS;
  let noContent = false;
  let noRefs = false;
  let noTests = false;
  let noGit = false;
  let jsonOutput = false;
  let help = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
      help = true;
      continue;
    }
    if (arg === "--files" && args[i + 1]) {
      files = args[++i].split(",").map((f) => f.trim()).filter(Boolean);
      continue;
    }
    if (arg === "--max-lines" && args[i + 1]) {
      maxLines = parseInt(args[++i], 10) || MAX_FILE_CONTENT_LINES;
      continue;
    }
    if (arg === "--max-commits" && args[i + 1]) {
      maxCommits = parseInt(args[++i], 10) || MAX_GIT_COMMITS;
      continue;
    }
    if (arg === "--no-content") {
      noContent = true;
      continue;
    }
    if (arg === "--no-refs") {
      noRefs = true;
      continue;
    }
    if (arg === "--no-tests") {
      noTests = true;
      continue;
    }
    if (arg === "--no-git") {
      noGit = true;
      continue;
    }
    if (arg === "--json") {
      jsonOutput = true;
      continue;
    }
  }
  if (help || files.length === 0) {
    showHelp2();
    process.exit(files.length > 0 ? 0 : 1);
  }
  const pseudoTask = {
    id: "cli",
    title: "CLI context collection",
    type: "implement",
    status: "pending",
    priority: "medium",
    dependencies: [],
    acceptanceCriteria: [],
    scope: { files }
  };
  const ctx = collectContext(pseudoTask, process.cwd(), {
    maxFileLines: maxLines,
    maxGitCommits: maxCommits,
    includeFileContent: !noContent,
    includeReferences: !noRefs,
    includeTests: !noTests,
    includeGitHistory: !noGit
  });
  if (jsonOutput) {
    console.log(JSON.stringify(ctx, null, 2));
  } else {
    const md = formatContextAsMarkdown(ctx);
    if (md) {
      console.log(md);
    } else {
      console.log("\u672A\u6536\u96C6\u5230\u4EFB\u4F55\u4E0A\u4E0B\u6587\u4FE1\u606F\u3002");
    }
    console.log(`
\u6536\u96C6\u8017\u65F6: ${ctx.durationMs}ms`);
  }
}
if (isDirectCliEntry("context-collector.js")) {
  main2();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  collectContext,
  formatContextAsMarkdown
});
