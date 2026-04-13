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

// scripts/src/repo-state-validator.ts
var repo_state_validator_exports = {};
__export(repo_state_validator_exports, {
  finalizeRepoStateValidation: () => finalizeRepoStateValidation,
  looksLikeRepositoryFactRoot: () => looksLikeRepositoryFactRoot,
  validateRepoStateRoot: () => validateRepoStateRoot
});
module.exports = __toCommonJS(repo_state_validator_exports);
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var REQUIRED_FILES = [
  { file: "README.md", purpose: "repo entrypoint" },
  { file: "PROJECT.md", purpose: "capability truth source" },
  { file: "ROADMAP.md", purpose: "execution status and priority" },
  { file: "docs/README.md", purpose: "documentation index" },
  { file: "docs/guides/HANDOFF.md", purpose: "handoff and next-step source" },
  { file: "docs/guides/team-collaboration-protocol.md", purpose: "team collaboration protocol" },
  { file: "docs/reference/architecture-constraints.md", purpose: "compatibility boundaries" }
];
var REQUIRED_TEXT_CHECKS = [
  {
    file: "README.md",
    expectedText: "(./docs/README.md)",
    message: "README \u5E94\u94FE\u63A5 docs \u7D22\u5F15\uFF0C\u4FBF\u4E8E\u56E2\u961F\u6210\u5458\u4ECE\u4ED3\u5E93\u5165\u53E3\u627E\u5230\u4E8B\u5B9E\u6E90"
  },
  {
    file: "README.md",
    expectedText: "(./docs/guides/team-collaboration-protocol.md)",
    message: "README \u5E94\u94FE\u63A5\u56E2\u961F\u534F\u4F5C\u534F\u8BAE\uFF0C\u4FBF\u4E8E AI \u548C\u56E2\u961F\u6210\u5458\u8BFB\u53D6\u6807\u51C6\u63A5\u624B\u89C4\u5219"
  },
  {
    file: "README.md",
    expectedText: "(./docs/guides/HANDOFF.md)",
    message: "README \u5E94\u94FE\u63A5 handoff \u6587\u6863\uFF0C\u4FBF\u4E8E\u5FEB\u901F\u8BFB\u53D6\u5F53\u524D\u8FDB\u5EA6"
  },
  {
    file: "docs/README.md",
    expectedText: "(./guides/HANDOFF.md)",
    message: "docs/README \u5E94\u94FE\u63A5 Handoff"
  },
  {
    file: "docs/README.md",
    expectedText: "(./guides/team-collaboration-protocol.md)",
    message: "docs/README \u5E94\u94FE\u63A5 Team Collaboration Protocol"
  },
  {
    file: "docs/guides/HANDOFF.md",
    expectedText: "docs/guides/team-collaboration-protocol.md",
    message: "Handoff \u5E94\u63D0\u793A\u63A5\u624B\u8005\u5148\u8BFB Team Collaboration Protocol"
  },
  {
    file: "docs/guides/team-collaboration-protocol.md",
    expectedText: "./HANDOFF.md",
    message: "Team Collaboration Protocol \u5E94\u5F15\u7528 Handoff \u4F5C\u4E3A\u4E8B\u5B9E\u6E90"
  },
  {
    file: "docs/guides/team-collaboration-protocol.md",
    expectedText: "../../ROADMAP.md",
    message: "Team Collaboration Protocol \u5E94\u5F15\u7528 Roadmap \u4F5C\u4E3A\u4E8B\u5B9E\u6E90"
  },
  {
    file: "docs/guides/team-collaboration-protocol.md",
    expectedText: "../../README.md",
    message: "Team Collaboration Protocol \u5E94\u5F15\u7528 README \u4F5C\u4E3A\u4E8B\u5B9E\u6E90"
  }
];
var REQUIRED_PATTERN_CHECKS = [
  {
    file: "ROADMAP.md",
    pattern: /^##\s+Current Snapshot\s*$/m,
    message: "ROADMAP \u5E94\u5305\u542B Current Snapshot \u6BB5\u843D"
  },
  {
    file: "ROADMAP.md",
    pattern: /^\| Item \| Status \| Priority \| Estimate \| Goal \| Next Action \|$/m,
    message: "ROADMAP \u5E94\u5305\u542B Current Snapshot \u8868\u5934"
  },
  {
    file: "docs/guides/HANDOFF.md",
    pattern: /^##\s+1\)\s+当前状态/m,
    message: "HANDOFF \u5E94\u5305\u542B \u201C\u5F53\u524D\u72B6\u6001\u201D \u6BB5\u843D"
  },
  {
    file: "docs/guides/HANDOFF.md",
    pattern: /^##\s+5\)\s+下一步建议/m,
    message: "HANDOFF \u5E94\u5305\u542B \u201C\u4E0B\u4E00\u6B65\u5EFA\u8BAE\u201D \u6BB5\u843D"
  },
  {
    file: "docs/guides/team-collaboration-protocol.md",
    pattern: /^##\s+Canonical Sources\s*$/m,
    message: "Team Collaboration Protocol \u5E94\u5305\u542B Canonical Sources \u6BB5\u843D"
  },
  {
    file: "docs/guides/team-collaboration-protocol.md",
    pattern: /^##\s+Standard AI Session Bootstrap\s*$/m,
    message: "Team Collaboration Protocol \u5E94\u5305\u542B Standard AI Session Bootstrap \u6BB5\u843D"
  }
];
var FRESHNESS_CHECKS = [
  {
    file: "ROADMAP.md",
    thresholdDays: 7,
    extractor: extractLastUpdatedDate,
    missingDateMessage: "ROADMAP \u7F3A\u5C11 > Last updated: \u65E5\u671F\uFF0C\u65E0\u6CD5\u5224\u65AD\u8DEF\u7EBF\u56FE\u662F\u5426\u8FC7\u671F"
  },
  {
    file: "docs/README.md",
    thresholdDays: 14,
    extractor: extractLastUpdatedDate,
    missingDateMessage: "docs/README \u7F3A\u5C11 > Last updated: \u65E5\u671F\uFF0C\u65E0\u6CD5\u5224\u65AD\u6587\u6863\u7D22\u5F15\u662F\u5426\u8FC7\u671F"
  },
  {
    file: "docs/guides/team-collaboration-protocol.md",
    thresholdDays: 14,
    extractor: extractLastUpdatedDate,
    missingDateMessage: "Team Collaboration Protocol \u7F3A\u5C11 > Last updated: \u65E5\u671F\uFF0C\u65E0\u6CD5\u5224\u65AD\u56E2\u961F\u534F\u4F5C\u89C4\u5219\u662F\u5426\u8FC7\u671F"
  },
  {
    file: "docs/guides/HANDOFF.md",
    thresholdDays: 14,
    extractor: extractLatestDateFromText,
    missingDateMessage: "HANDOFF \u672A\u68C0\u6D4B\u5230\u4EFB\u4F55\u65E5\u671F\uFF0C\u65E0\u6CD5\u5224\u65AD\u4EA4\u63A5\u4FE1\u606F\u662F\u5426\u8FC7\u671F"
  }
];
var REPOSITORY_ROOT_SENTINELS = [
  "README.md",
  "ROADMAP.md",
  "PROJECT.md",
  "docs/guides/HANDOFF.md",
  "docs/guides/team-collaboration-protocol.md"
];
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
Repo State Validator - \u4ED3\u5E93\u4E8B\u5B9E\u6E90\u4E00\u81F4\u6027\u6821\u9A8C

\u7528\u6CD5:
  node scripts/dist/repo-state-validator.js [command] [options]

\u547D\u4EE4:
  check                        \u6821\u9A8C\u4ED3\u5E93\u4E8B\u5B9E\u6E90\uFF08\u9ED8\u8BA4\uFF09

\u9009\u9879:
  --dir, --root <path>         \u4ED3\u5E93\u6839\u76EE\u5F55\uFF08\u9ED8\u8BA4: \u5F53\u524D\u76EE\u5F55\uFF09
  --json                       \u8F93\u51FA JSON
  --strict                     \u5B58\u5728 warning/error \u65F6 exit=1\uFF1B\u9ED8\u8BA4\u4EC5 error \u624D exit=1
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
function resolveRepoFile(rootDir, relativePath) {
  return path.join(rootDir, ...relativePath.split("/"));
}
function formatRelativeToCwd(filePath) {
  return toPosixPath(path.relative(process.cwd(), filePath) || path.basename(filePath));
}
function extractLastUpdatedDate(text) {
  const match = text.match(/^>\s*Last updated:\s*(\d{4}-\d{2}-\d{2})\s*$/im);
  return match?.[1] ?? null;
}
function extractLatestDateFromText(text) {
  const matches = Array.from(text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g), (match) => match[0]);
  if (matches.length === 0) return null;
  return matches.sort().at(-1) ?? null;
}
function parseDateOnly(dateText) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const stamp = Date.parse(`${dateText}T00:00:00Z`);
  return Number.isFinite(stamp) ? stamp : null;
}
function calculateAgeDays(dateText, now) {
  const target = parseDateOnly(dateText);
  if (target === null) return null;
  const nowStamp = parseDateOnly(now.toISOString().slice(0, 10));
  if (nowStamp === null) return null;
  return Math.floor((nowStamp - target) / 864e5);
}
function looksLikeRepositoryFactRoot(rootDir) {
  return REPOSITORY_ROOT_SENTINELS.every((relativePath) => fs.existsSync(resolveRepoFile(rootDir, relativePath)));
}
function validateRepoStateRoot(rootDir, options = {}) {
  const issues = [];
  const now = options.now ?? /* @__PURE__ */ new Date();
  const checkedTexts = /* @__PURE__ */ new Map();
  const requiredFiles = REQUIRED_FILES.map((item) => ({
    ...item,
    absolutePath: resolveRepoFile(rootDir, item.file)
  }));
  for (const item of requiredFiles) {
    if (!fs.existsSync(item.absolutePath)) {
      issues.push({
        level: "error",
        file: toPosixPath(item.file),
        message: `\u7F3A\u5C11\u5FC5\u9700\u4E8B\u5B9E\u6E90\u6587\u4EF6: ${item.purpose}`
      });
      continue;
    }
    const read = readText(item.absolutePath);
    if (!read.ok) {
      issues.push({
        level: "error",
        file: formatRelativeToCwd(item.absolutePath),
        message: `\u8BFB\u53D6\u5931\u8D25: ${read.error}`
      });
      continue;
    }
    checkedTexts.set(item.file, read.data);
  }
  for (const check of REQUIRED_TEXT_CHECKS) {
    const text = checkedTexts.get(check.file);
    if (!text) continue;
    if (!text.includes(check.expectedText)) {
      issues.push({
        level: "warning",
        file: toPosixPath(check.file),
        message: check.message
      });
    }
  }
  for (const check of REQUIRED_PATTERN_CHECKS) {
    const text = checkedTexts.get(check.file);
    if (!text) continue;
    if (!check.pattern.test(text)) {
      issues.push({
        level: "warning",
        file: toPosixPath(check.file),
        message: check.message
      });
    }
  }
  for (const check of FRESHNESS_CHECKS) {
    const text = checkedTexts.get(check.file);
    if (!text) continue;
    const dateText = check.extractor(text);
    if (!dateText) {
      issues.push({
        level: "warning",
        file: toPosixPath(check.file),
        message: check.missingDateMessage
      });
      continue;
    }
    const ageDays = calculateAgeDays(dateText, now);
    if (ageDays === null) {
      issues.push({
        level: "warning",
        file: toPosixPath(check.file),
        message: `\u65E0\u6CD5\u89E3\u6790\u65E5\u671F: ${dateText}`
      });
      continue;
    }
    if (ageDays > check.thresholdDays) {
      issues.push({
        level: "warning",
        file: toPosixPath(check.file),
        message: `\u4E8B\u5B9E\u6E90\u53EF\u80FD\u8FC7\u671F: \u6700\u8FD1\u65E5\u671F ${dateText}\uFF0C\u8DDD\u4ECA ${ageDays} \u5929\uFF08\u9608\u503C ${check.thresholdDays} \u5929\uFF09`
      });
    }
  }
  const errorCount = issues.filter((issue) => issue.level === "error").length;
  const warningCount = issues.filter((issue) => issue.level === "warning").length;
  const checkedFileCount = checkedTexts.size;
  const checkedRuleCount = REQUIRED_TEXT_CHECKS.length + REQUIRED_PATTERN_CHECKS.length + FRESHNESS_CHECKS.length;
  return {
    ok: errorCount === 0,
    rootDir: toPosixPath(path.relative(process.cwd(), rootDir) || "."),
    checkedFileCount,
    checkedRuleCount,
    issueCount: issues.length,
    errorCount,
    warningCount,
    issues
  };
}
function finalizeRepoStateValidation(payload, strict) {
  return {
    ...payload,
    strictMode: strict,
    effectiveOk: strict ? payload.errorCount === 0 && payload.warningCount === 0 : payload.ok
  };
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
  const rootDir = dirFlag ? path.resolve(process.cwd(), dirFlag) : process.cwd();
  const payload = finalizeRepoStateValidation(validateRepoStateRoot(rootDir), strict);
  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`[repo-state-validator] root: ${payload.rootDir}`);
    console.log(
      `[repo-state-validator] checked files: ${payload.checkedFileCount}, checks: ${payload.checkedRuleCount}, errors: ${payload.errorCount}, warnings: ${payload.warningCount}`
    );
    for (const issue of payload.issues) {
      const prefix = issue.level === "error" ? "ERROR" : "WARN";
      console.log(`- ${prefix} ${issue.file}: ${issue.message}`);
    }
  }
  if (!payload.effectiveOk) process.exit(1);
}
if (require.main === module) {
  main();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  finalizeRepoStateValidation,
  looksLikeRepositoryFactRoot,
  validateRepoStateRoot
});
