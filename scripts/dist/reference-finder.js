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

// scripts/src/reference-finder.ts
var reference_finder_exports = {};
__export(reference_finder_exports, {
  findReferences: () => findReferences,
  findRelatedTests: () => findRelatedTests
});
module.exports = __toCommonJS(reference_finder_exports);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  findReferences,
  findRelatedTests
});
