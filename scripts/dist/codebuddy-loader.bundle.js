#!/usr/bin/env node
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

// scripts/src/codebuddy-loader.ts
var fs5 = __toESM(require("fs"));
var path5 = __toESM(require("path"));
var import_crypto3 = require("crypto");

// scripts/src/lib/logger.ts
function createLogger(ctx) {
  return {
    log: (msg) => console.log(`[CodeBuddy] ${msg}`),
    verbose: (msg) => {
      if (ctx.isVerbose) console.log(`[CodeBuddy:DEBUG] ${msg}`);
    },
    error: (msg) => console.error(`[CodeBuddy:ERROR] ${msg}`),
    warn: (msg) => console.warn(`[CodeBuddy:WARN] ${msg}`)
  };
}
function logError(message) {
  console.error(`[CodeBuddy:ERROR] ${message}`);
}

// scripts/src/lib/fetcher.ts
var https = __toESM(require("https"));
var http = __toESM(require("http"));
function buildRequestHeaders(ctx, url) {
  if (!ctx.remoteBearerToken || !ctx.remoteBaseUrl) {
    return {};
  }
  try {
    const remoteOrigin = new URL(ctx.remoteBaseUrl).origin;
    const requestOrigin = new URL(url).origin;
    if (remoteOrigin !== requestOrigin) {
      return {};
    }
  } catch {
    return {};
  }
  return {
    Authorization: `Bearer ${ctx.remoteBearerToken}`
  };
}
function fetchUrlBuffer(ctx, logger, url, retries = 3) {
  return new Promise((resolve2, reject) => {
    const client = url.startsWith("https") ? https : http;
    const headers = buildRequestHeaders(ctx, url);
    logger.verbose(`Fetching: ${url} (Retries left: ${retries})`);
    const request = client.get(url, { headers }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        res.resume();
        logger.verbose(`Redirecting to: ${redirectUrl}`);
        fetchUrlBuffer(ctx, logger, redirectUrl, retries).then(resolve2).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        if (res.statusCode && res.statusCode >= 500 && retries > 0) {
          res.resume();
          logger.warn(`HTTP ${res.statusCode}. Retrying...`);
          setTimeout(() => {
            fetchUrlBuffer(ctx, logger, url, retries - 1).then(resolve2).catch(reject);
          }, 1e3);
          return;
        }
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}: Failed to fetch ${url}`));
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      res.on("end", () => {
        const data = Buffer.concat(chunks);
        logger.verbose(`Fetched ${data.length} bytes from ${url}`);
        resolve2(data);
      });
    });
    request.on("error", (e) => {
      if (retries > 0) {
        logger.warn(`Network Error (${e.code}). Retrying...`);
        setTimeout(() => {
          fetchUrlBuffer(ctx, logger, url, retries - 1).then(resolve2).catch(reject);
        }, 1e3);
        return;
      }
      reject(new Error(`Network Error: ${e.message} (URL: ${url})`));
    });
    request.setTimeout(ctx.requestTimeout, () => {
      request.destroy();
      if (retries > 0) {
        logger.warn(`Request Timeout. Retrying...`);
        setTimeout(() => {
          fetchUrlBuffer(ctx, logger, url, retries - 1).then(resolve2).catch(reject);
        }, 1e3);
        return;
      }
      reject(new Error(`Request Timeout: ${url}`));
    });
  });
}
async function fetchUrl(ctx, logger, url, retries = 3) {
  const buffer = await fetchUrlBuffer(ctx, logger, url, retries);
  return buffer.toString("utf-8");
}

// scripts/src/lib/distributor.ts
var fs3 = __toESM(require("fs"));
var path3 = __toESM(require("path"));

// scripts/src/lib/install-sync.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_crypto = require("crypto");
function createManagedFileTracker(targetDir) {
  return {
    targetDir,
    files: /* @__PURE__ */ new Map(),
    summary: {
      written: 0,
      unchanged: 0,
      removed: 0
    }
  };
}
function readInstallState(targetDir, logger) {
  const installStatePath = path.join(targetDir, ".codebuddy", "install.json");
  if (!fs.existsSync(installStatePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(installStatePath, "utf-8"));
  } catch (error) {
    logger?.warn(`\u8BFB\u53D6 install.json \u5931\u8D25: ${error.message}`);
    return null;
  }
}
function toProjectRelativePath(targetDir, absolutePath) {
  return path.relative(targetDir, absolutePath).replace(/\\/g, "/");
}
function listFilesRecursive(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const results = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }
  return results.sort();
}
function copyManagedFile(tracker, sourcePath, destinationPath) {
  const content = fs.readFileSync(sourcePath);
  return writeManagedFile(tracker, destinationPath, content);
}
function writeManagedFile(tracker, destinationPath, content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf-8");
  const relativePath = toProjectRelativePath(tracker.targetDir, destinationPath);
  const record = {
    path: relativePath,
    sha256: (0, import_crypto.createHash)("sha256").update(buffer).digest("hex"),
    size: buffer.length
  };
  let shouldWrite = true;
  if (fs.existsSync(destinationPath)) {
    const existing = fs.readFileSync(destinationPath);
    const existingHash = (0, import_crypto.createHash)("sha256").update(existing).digest("hex");
    shouldWrite = existingHash !== record.sha256;
  }
  if (shouldWrite) {
    const destinationDir = path.dirname(destinationPath);
    if (!fs.existsSync(destinationDir)) {
      fs.mkdirSync(destinationDir, { recursive: true });
    }
    fs.writeFileSync(destinationPath, buffer);
    tracker.summary.written += 1;
  } else {
    tracker.summary.unchanged += 1;
  }
  tracker.files.set(relativePath, record);
  return shouldWrite;
}
function getManagedFiles(tracker) {
  return Array.from(tracker.files.values()).sort((left, right) => left.path.localeCompare(right.path));
}
function cleanupStaleManagedFiles(tracker, previousInstallState, options, logger) {
  if (!previousInstallState?.managedFiles?.length) {
    return [];
  }
  const currentPaths = new Set(tracker.files.keys());
  const preservePrefixes = (options?.preservePrefixes || []).map((prefix) => prefix.replace(/\\/g, "/"));
  const removed = [];
  for (const managedFile of previousInstallState.managedFiles) {
    if (currentPaths.has(managedFile.path)) {
      continue;
    }
    if (preservePrefixes.some((prefix) => managedFile.path.startsWith(prefix))) {
      continue;
    }
    if (!managedFile.path.startsWith(".codebuddy/")) {
      logger?.warn(`\u8DF3\u8FC7\u6E05\u7406\u975E .codebuddy \u7BA1\u7406\u6587\u4EF6: ${managedFile.path}`);
      continue;
    }
    const absolutePath = path.join(tracker.targetDir, managedFile.path);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    try {
      if (!removeManagedPath(tracker.targetDir, absolutePath)) {
        continue;
      }
      tracker.summary.removed += 1;
      removed.push(managedFile.path);
    } catch (error) {
      logger?.warn(`\u6E05\u7406\u9648\u65E7\u6587\u4EF6\u5931\u8D25: ${managedFile.path} - ${error.message}`);
    }
  }
  return removed.sort();
}
function removeManagedPath(targetDir, absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    return false;
  }
  ensureWritableRecursive(absolutePath);
  fs.rmSync(absolutePath, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 50
  });
  if (fs.existsSync(absolutePath)) {
    return false;
  }
  pruneEmptyParents(targetDir, path.dirname(absolutePath));
  return true;
}
function ensureWritableRecursive(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }
  const stat = fs.lstatSync(targetPath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath)) {
      ensureWritableRecursive(path.join(targetPath, entry));
    }
    try {
      fs.chmodSync(targetPath, 511);
    } catch {
    }
    return;
  }
  try {
    fs.chmodSync(targetPath, 438);
  } catch {
  }
}
function pruneEmptyParents(targetDir, startDir) {
  const stopDir = path.join(targetDir, ".codebuddy");
  let current = startDir;
  while (current.startsWith(stopDir) && current !== stopDir) {
    if (!fs.existsSync(current)) {
      current = path.dirname(current);
      continue;
    }
    const entries = fs.readdirSync(current);
    if (entries.length > 0) {
      break;
    }
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

// scripts/src/lib/remote-content-pack.ts
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var import_crypto2 = require("crypto");
var CONTENT_PACK_SCHEMA_VERSION = "1.0.0";
function normalizeRelativePath(relativePath) {
  const normalized = path2.posix.normalize(String(relativePath || "").replace(/\\/g, "/"));
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.includes("/../") || path2.posix.isAbsolute(normalized)) {
    throw new Error(`invalid relative path: ${relativePath}`);
  }
  return normalized;
}
function ensureDirectoryForFile(filePath) {
  const dir = path2.dirname(filePath);
  if (!fs2.existsSync(dir)) {
    fs2.mkdirSync(dir, { recursive: true });
  }
}
function computeSha256(content) {
  return (0, import_crypto2.createHash)("sha256").update(content).digest("hex");
}
function decodeEntryContent(entry) {
  if (entry.encoding === "base64") {
    return Buffer.from(entry.content, "base64");
  }
  return Buffer.from(entry.content, "utf-8");
}
function validateContentPack(pack, packMeta) {
  if (!pack || typeof pack !== "object") {
    throw new Error("content pack must be an object");
  }
  if (pack.schemaVersion !== CONTENT_PACK_SCHEMA_VERSION) {
    throw new Error(`unsupported content pack schema: ${String(pack.schemaVersion)}`);
  }
  if (pack.profile !== packMeta.profile) {
    throw new Error(`content pack profile mismatch: expected ${packMeta.profile}, got ${pack.profile}`);
  }
  if (!Array.isArray(pack.entries)) {
    throw new Error("content pack entries must be an array");
  }
  if (pack.entryCount !== pack.entries.length) {
    throw new Error(`content pack entryCount mismatch: expected ${pack.entryCount}, got ${pack.entries.length}`);
  }
  for (const entry of pack.entries) {
    if (!entry || typeof entry !== "object") {
      throw new Error("content pack entry must be an object");
    }
    if (entry.encoding && entry.encoding !== "utf8" && entry.encoding !== "base64") {
      throw new Error(`unsupported content pack entry encoding: ${String(entry.encoding)}`);
    }
  }
}
function buildContentRoot(targetDir, manifestVersion, packMeta) {
  return path2.join(
    targetDir,
    ".codebuddy",
    "cache",
    "content-packs",
    manifestVersion,
    `${packMeta.profile}-${packMeta.sha256.slice(0, 12)}`,
    "contents"
  );
}
async function ensureRemoteContentPack(ctx, logger, targetDir) {
  const packMeta = ctx.remoteManifest?.packs?.[ctx.profile] || null;
  const manifestVersion = ctx.remoteManifest?.version || "0.0.0";
  if (!ctx.isRemote) {
    return { contentRoot: null, pack: null, usedCache: false };
  }
  if (!packMeta) {
    if (ctx.strictRemotePack) {
      throw new Error(`pack-only mode requires manifest.packs.${ctx.profile}`);
    }
    return { contentRoot: null, pack: null, usedCache: false };
  }
  const contentRoot = buildContentRoot(targetDir, manifestVersion, packMeta);
  const markerPath = path2.join(path2.dirname(contentRoot), "pack-meta.json");
  if (fs2.existsSync(contentRoot) && fs2.existsSync(markerPath)) {
    logger.log(`\u8FDC\u7A0B\u5185\u5BB9\u5305: \u4F7F\u7528\u672C\u5730\u7F13\u5B58 ${packMeta.profile} (${packMeta.sha256.slice(0, 12)})`);
    return { contentRoot, pack: packMeta, usedCache: true };
  }
  try {
    const packUrl = `${ctx.remoteBaseUrl}/${packMeta.file}`;
    logger.log(`\u8FDC\u7A0B\u5185\u5BB9\u5305: \u4E0B\u8F7D ${packMeta.profile} -> ${packUrl}`);
    const packSource = await fetchUrl(ctx, logger, packUrl);
    const actualSha = computeSha256(packSource);
    if (actualSha !== packMeta.sha256) {
      throw new Error(`content pack sha256 mismatch: expected ${packMeta.sha256}, got ${actualSha}`);
    }
    const pack = JSON.parse(packSource);
    validateContentPack(pack, packMeta);
    const packRoot = path2.dirname(contentRoot);
    fs2.rmSync(packRoot, { recursive: true, force: true });
    fs2.mkdirSync(contentRoot, { recursive: true });
    for (const entry of pack.entries) {
      const normalized = normalizeRelativePath(entry.path);
      const destPath = path2.join(contentRoot, normalized);
      ensureDirectoryForFile(destPath);
      const entryBuffer = decodeEntryContent(entry);
      fs2.writeFileSync(destPath, entryBuffer);
      const entrySha = computeSha256(entryBuffer);
      if (entry.sha256 !== entrySha) {
        throw new Error(`content pack entry sha256 mismatch: ${normalized}`);
      }
    }
    fs2.writeFileSync(markerPath, JSON.stringify({
      schemaVersion: CONTENT_PACK_SCHEMA_VERSION,
      profile: packMeta.profile,
      file: packMeta.file,
      format: packMeta.format,
      sha256: packMeta.sha256,
      entryCount: packMeta.entryCount,
      generatedAt: packMeta.generatedAt
    }, null, 2), "utf-8");
    logger.log(`\u8FDC\u7A0B\u5185\u5BB9\u5305: \u5DF2\u7F13\u5B58 ${packMeta.profile} (${pack.entryCount} files)`);
    return { contentRoot, pack: packMeta, usedCache: false };
  } catch (error) {
    if (ctx.strictRemotePack) {
      throw new Error(`pack-only mode requires a valid ${ctx.profile} content pack: ${error.message}`);
    }
    logger.warn(`\u8FDC\u7A0B\u5185\u5BB9\u5305\u4E0D\u53EF\u7528\uFF0C\u56DE\u9000\u9010\u6587\u4EF6\u62C9\u53D6: ${error.message}`);
    return { contentRoot: null, pack: null, usedCache: false };
  }
}
async function readRemoteTextAsset(ctx, logger, relativePath) {
  const buffer = await readRemoteAsset(ctx, logger, relativePath);
  return buffer.toString("utf-8");
}
async function readRemoteAsset(ctx, logger, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  if (ctx.remoteContentRoot) {
    const cachedPath = path2.join(ctx.remoteContentRoot, normalized);
    if (fs2.existsSync(cachedPath)) {
      return fs2.readFileSync(cachedPath);
    }
    if (ctx.strictRemotePack) {
      throw new Error(`pack-only mode blocked raw fallback for ${normalized}`);
    }
    logger.verbose(`\u8FDC\u7A0B\u5185\u5BB9\u5305\u672A\u547D\u4E2D: ${normalized}\uFF0C\u56DE\u9000\u9010\u6587\u4EF6\u62C9\u53D6`);
  }
  if (ctx.strictRemotePack) {
    throw new Error(`pack-only mode requires cached asset: ${normalized}`);
  }
  const url = `${ctx.remoteBaseUrl}/${normalized}`;
  return fetchUrlBuffer(ctx, logger, url);
}

// scripts/src/lib/distributor.ts
async function distributeItems(ctx, logger, targetDir, projectRoot, options) {
  const distributed = [];
  const localDir = path3.join(targetDir, options.targetSubDir);
  if (!fs3.existsSync(localDir)) {
    fs3.mkdirSync(localDir, { recursive: true });
  }
  if (options.preCreateDirs) {
    for (const sub of options.preCreateDirs) {
      const subPath = path3.join(localDir, sub);
      if (!fs3.existsSync(subPath)) fs3.mkdirSync(subPath, { recursive: true });
    }
  }
  for (const item of options.items) {
    const destPath = path3.join(localDir, item.destFile);
    if (ctx.isRemote) {
      try {
        const content = await readRemoteAsset(ctx, logger, item.sourcePath);
        if (options.tracker) {
          writeManagedFile(options.tracker, destPath, content);
        } else {
          fs3.writeFileSync(destPath, content);
        }
        distributed.push(item.destFile);
        logger.verbose(`\u5DF2\u4E0B\u8F7D ${options.label}: ${item.destFile}`);
      } catch (e) {
        logger.warn(`${options.label} \u4E0B\u8F7D\u5931\u8D25: ${item.destFile} - ${e.message}`);
      }
    } else {
      const srcPath = path3.join(projectRoot, item.sourcePath);
      if (!fs3.existsSync(srcPath)) {
        logger.warn(`${options.label} \u6587\u4EF6\u4E0D\u5B58\u5728: ${srcPath}`);
        continue;
      }
      try {
        if (options.tracker) {
          copyManagedFile(options.tracker, srcPath, destPath);
        } else {
          fs3.copyFileSync(srcPath, destPath);
        }
        distributed.push(item.destFile);
        logger.verbose(`\u5DF2\u590D\u5236 ${options.label}: ${item.destFile}`);
      } catch (e) {
        logger.warn(`${options.label} \u590D\u5236\u5931\u8D25: ${item.destFile} - ${e.message}`);
      }
    }
  }
  if (distributed.length > 0 && options.readme) {
    const readmePath = path3.join(localDir, "README.md");
    if (options.tracker) {
      writeManagedFile(options.tracker, readmePath, options.readme);
    } else {
      fs3.writeFileSync(readmePath, options.readme, "utf-8");
    }
  }
  return distributed;
}

// scripts/src/lib/distribution-profiles.ts
var CORE_SCRIPTS = [
  { file: "rule-validator.js" },
  { file: "skill-validator.js" }
];
var ANALYSIS_SCRIPTS = [
  { file: "structure-analyzer.js" },
  { file: "module-mapper.js" },
  { file: "report-manager.js" }
];
var ORCHESTRATOR_SCRIPTS = [
  { file: "agent-call-manager.js" },
  { file: "task-orchestrator.js" },
  { file: "taskbook-manager.js" },
  { file: "task-executor.js" },
  { file: "contract-validator.js" },
  { file: "reference-finder.js" },
  { file: "context-collector.js" }
];
var FULL_SCRIPTS = [
  { file: "agent-registry.js" }
];
var COMMANDS_TO_DISTRIBUTE = [
  { sourcePath: ".claude/commands/task.md", destFile: "task.md" },
  { sourcePath: ".claude/commands/agent-call.md", destFile: "agent-call.md" }
];
var WORKFLOWS_TO_DISTRIBUTE = [
  { sourcePath: "workflows/schema/workflow.schema.json", destFile: "workflow.schema.json" },
  { sourcePath: "workflows/templates/default.workflow.json", destFile: "default.workflow.json" }
];
var TASKBOOK_FILES_TO_DISTRIBUTE = [
  { sourcePath: "taskbooks/schema/taskbook.schema.json", destFile: "taskbook.schema.json" }
];
var AGENT_CALL_FILES_TO_DISTRIBUTE = [
  { sourcePath: "agent-calls/schema/agent-call.schema.json", destFile: "agent-call.schema.json" }
];
function isOrchestratorProfile(profile) {
  return profile === "orchestrator" || profile === "full";
}
function getScriptsForProfile(profile) {
  const scripts = [...CORE_SCRIPTS];
  if (profile !== "core") {
    scripts.push(...ANALYSIS_SCRIPTS);
  }
  if (isOrchestratorProfile(profile)) {
    scripts.push(...ORCHESTRATOR_SCRIPTS);
  }
  if (profile === "full") {
    scripts.push(...FULL_SCRIPTS);
  }
  return scripts;
}

// scripts/src/lib/install-health.ts
var fs4 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
var import_child_process = require("child_process");

// scripts/src/lib/install-roots.ts
function normalizeRelativeRoot(relativeRoot) {
  if (typeof relativeRoot !== "string") return null;
  const normalized = relativeRoot.trim().replace(/\\/g, "/");
  return normalized ? normalized : null;
}
function resolveInstalledSkillsRootDir(installState) {
  if (!installState) return null;
  return normalizeRelativeRoot(installState.outputs.skillsRootDir) || (installState.stats.skills > 0 ? ".codebuddy/skills" : null);
}
function resolveInstalledSkillsSnapshotRetention(installState) {
  if (!installState) return null;
  if (typeof installState.outputs.skillsSnapshotRetention === "number") {
    return installState.outputs.skillsSnapshotRetention;
  }
  return resolveInstalledSkillsRootDir(installState) ? 3 : null;
}
function resolveInstalledAgentsRootDir(installState) {
  if (!installState) return null;
  return normalizeRelativeRoot(installState.outputs.agentsRootDir) || (installState.stats.agents > 0 ? ".codebuddy/agents" : null);
}
function resolveInstalledAgentsSnapshotRetention(installState) {
  if (!installState) return null;
  if (typeof installState.outputs.agentsSnapshotRetention === "number") {
    return installState.outputs.agentsSnapshotRetention;
  }
  return resolveInstalledAgentsRootDir(installState) ? 3 : null;
}

// scripts/src/lib/install-health.ts
var SUPPORTED_INSTALL_STATE_SCHEMAS = /* @__PURE__ */ new Set(["1.0.0", "1.1.0", "1.2.0"]);
var PROFILE_RESIDUAL_ARTIFACTS = {
  core: [
    ".codebuddy/scripts/structure-analyzer.js",
    ".codebuddy/scripts/module-mapper.js",
    ".codebuddy/scripts/report-manager.js",
    ".codebuddy/scripts/reference-finder.js",
    ".codebuddy/scripts/context-collector.js",
    ".codebuddy/scripts/contract-validator.js",
    ".codebuddy/scripts/agent-call-manager.js",
    ".codebuddy/scripts/task-orchestrator.js",
    ".codebuddy/scripts/taskbook-manager.js",
    ".codebuddy/scripts/task-executor.js",
    ".codebuddy/scripts/agent-registry.js",
    ".codebuddy/agent-calls/agent-call.schema.json",
    ".codebuddy/agent-calls/README.md",
    ".codebuddy/taskbooks/taskbook.schema.json",
    ".codebuddy/taskbooks/README.md",
    ".codebuddy/workflows/default.workflow.json",
    ".codebuddy/workflows/workflow.schema.json",
    ".codebuddy/workflows/README.md"
  ],
  analysis: [
    ".codebuddy/scripts/contract-validator.js",
    ".codebuddy/scripts/agent-call-manager.js",
    ".codebuddy/scripts/task-orchestrator.js",
    ".codebuddy/scripts/taskbook-manager.js",
    ".codebuddy/scripts/task-executor.js",
    ".codebuddy/scripts/agent-registry.js",
    ".codebuddy/agent-calls/agent-call.schema.json",
    ".codebuddy/agent-calls/README.md",
    ".codebuddy/taskbooks/taskbook.schema.json",
    ".codebuddy/taskbooks/README.md",
    ".codebuddy/workflows/default.workflow.json",
    ".codebuddy/workflows/workflow.schema.json",
    ".codebuddy/workflows/README.md"
  ],
  orchestrator: [
    ".codebuddy/scripts/agent-registry.js"
  ],
  full: []
};
var LEGACY_ORCHESTRATOR_ARTIFACTS = [
  ".codebuddy/agent-calls/agent-call.schema.json",
  ".codebuddy/agent-calls/README.md",
  ".codebuddy/taskbooks/taskbook.schema.json",
  ".codebuddy/taskbooks/README.md",
  ".codebuddy/workflows/default.workflow.json",
  ".codebuddy/workflows/workflow.schema.json",
  ".codebuddy/workflows/README.md"
];
var PYTHON_COMMAND_CANDIDATES = process.platform === "win32" ? [
  { command: "python", args: [], label: "python" },
  { command: "py", args: ["-3"], label: "py -3" },
  { command: "python3", args: [], label: "python3" }
] : [
  { command: "python3", args: [], label: "python3" },
  { command: "python", args: [], label: "python" }
];
function canRunCommand(command, args) {
  const result = (0, import_child_process.spawnSync)(command, [...args, "--version"], {
    encoding: "utf-8",
    stdio: "ignore",
    timeout: 5e3
  });
  return !result.error && result.status === 0;
}
function detectPythonRuntime() {
  let fallback = null;
  for (const candidate of PYTHON_COMMAND_CANDIDATES) {
    if (!canRunCommand(candidate.command, candidate.args)) {
      continue;
    }
    const importResult = (0, import_child_process.spawnSync)(candidate.command, [...candidate.args, "-c", "import docx"], {
      encoding: "utf-8",
      stdio: "ignore",
      timeout: 5e3
    });
    const status = {
      available: true,
      label: candidate.label,
      pythonDocx: !importResult.error && importResult.status === 0
    };
    if (status.pythonDocx) {
      return status;
    }
    if (!fallback) {
      fallback = status;
    }
  }
  return fallback || {
    available: false,
    label: null,
    pythonDocx: false
  };
}
function needsSystemOverviewPythonRuntime(inspection) {
  const managedFiles = inspection.installState?.managedFiles || [];
  return managedFiles.some((file) => /system-overview-design\/scripts\/(extract_template|render_overview_doc)\.py$/.test(file.path.replace(/\\/g, "/")));
}
function buildPipInstallCommand(pythonLabel) {
  return pythonLabel ? `${pythonLabel} -m pip install python-docx` : "python -m pip install python-docx";
}
function resolveManagedRoots(installState) {
  const roots = [
    ".codebuddy/agent-calls",
    ".codebuddy/commands",
    ".codebuddy/rules",
    ".codebuddy/rules_cache",
    ".codebuddy/scripts",
    ".codebuddy/taskbooks",
    ".codebuddy/workflows"
  ];
  const agentsRootDir = resolveInstalledAgentsRootDir(installState);
  if (agentsRootDir) {
    roots.push(agentsRootDir);
  }
  const skillsRootDir = resolveInstalledSkillsRootDir(installState);
  if (skillsRootDir) {
    roots.push(skillsRootDir);
  }
  return roots;
}
function inspectInstallState(targetDir, installState, installStateExists) {
  const installStatePath = path4.join(targetDir, ".codebuddy", "install.json");
  const rulesFilePath = installState?.outputs.rulesFile ? path4.join(targetDir, installState.outputs.rulesFile) : null;
  const workspaceIndexPath = installState?.outputs.workspaceIndexFile ? path4.join(targetDir, installState.outputs.workspaceIndexFile) : null;
  const agentsRootDir = resolveInstalledAgentsRootDir(installState);
  const agentsRootPath = agentsRootDir ? path4.join(targetDir, agentsRootDir) : null;
  const skillsRootDir = resolveInstalledSkillsRootDir(installState);
  const skillsRootPath = skillsRootDir ? path4.join(targetDir, skillsRootDir) : null;
  const managedFiles = installState?.managedFiles || [];
  const managedFileSet = new Set(managedFiles.map((file) => file.path));
  const missingManagedFiles = managedFiles.filter((file) => !fs4.existsSync(path4.join(targetDir, file.path))).map((file) => file.path).sort();
  const unexpectedStaticFiles = managedFileSet.size > 0 ? resolveManagedRoots(installState).flatMap((relativeRoot) => {
    const absoluteRoot = path4.join(targetDir, relativeRoot);
    return listFilesRecursive(absoluteRoot).map((filePath) => toProjectRelativePath(targetDir, filePath)).filter((filePath) => !managedFileSet.has(filePath));
  }).sort() : [];
  const expectedResiduals = installState ? PROFILE_RESIDUAL_ARTIFACTS[installState.profile] : [];
  const unexpectedProfileFiles = expectedResiduals.filter((relativePath) => {
    if (managedFileSet.has(relativePath)) return false;
    return fs4.existsSync(path4.join(targetDir, relativePath));
  });
  return {
    targetDir,
    installStatePath,
    installStateExists,
    installState,
    rulesFilePath,
    rulesFileExists: rulesFilePath ? fs4.existsSync(rulesFilePath) : false,
    workspaceIndexPath,
    workspaceIndexExists: workspaceIndexPath ? fs4.existsSync(workspaceIndexPath) : false,
    agentsRootPath,
    agentsRootExists: agentsRootPath ? fs4.existsSync(agentsRootPath) : false,
    skillsRootPath,
    skillsRootExists: skillsRootPath ? fs4.existsSync(skillsRootPath) : false,
    trackedManagedFileCount: managedFiles.length,
    presentManagedFileCount: managedFiles.length - missingManagedFiles.length,
    missingManagedFiles,
    unexpectedStaticFiles,
    unexpectedProfileFiles
  };
}
function buildDoctorChecks(inspection) {
  const checks = [];
  const { installState } = inspection;
  if (!inspection.installStateExists) {
    checks.push({
      id: "install-state-missing",
      status: "fail",
      message: "\u672A\u627E\u5230 .codebuddy/install.json\uFF0C\u8BF7\u5148\u6267\u884C loader \u5B89\u88C5\u3002"
    });
    return checks;
  }
  if (!installState) {
    checks.push({
      id: "install-state-invalid",
      status: "fail",
      message: "install.json \u5B58\u5728\uFF0C\u4F46\u65E0\u6CD5\u89E3\u6790\u3002"
    });
    return checks;
  }
  checks.push({
    id: "install-state-schema",
    status: SUPPORTED_INSTALL_STATE_SCHEMAS.has(installState.schemaVersion) ? "pass" : "warn",
    message: SUPPORTED_INSTALL_STATE_SCHEMAS.has(installState.schemaVersion) ? `install.json schemaVersion=${installState.schemaVersion}` : `install.json schemaVersion=${installState.schemaVersion} \u4E0D\u5728\u5F53\u524D\u53D7\u652F\u6301\u5217\u8868\u4E2D`
  });
  checks.push({
    id: "rules-file",
    status: inspection.rulesFileExists ? "pass" : "fail",
    message: inspection.rulesFileExists ? `\u89C4\u5219\u6587\u4EF6\u5B58\u5728: ${installState.outputs.rulesFile}` : `\u89C4\u5219\u6587\u4EF6\u7F3A\u5931: ${installState.outputs.rulesFile}`
  });
  if (installState.outputs.workspaceIndexFile) {
    checks.push({
      id: "workspace-index",
      status: inspection.workspaceIndexExists ? "pass" : "fail",
      message: inspection.workspaceIndexExists ? `workspace \u7D22\u5F15\u5B58\u5728: ${installState.outputs.workspaceIndexFile}` : `workspace \u7D22\u5F15\u7F3A\u5931: ${installState.outputs.workspaceIndexFile}`
    });
  }
  const agentsRootDir = resolveInstalledAgentsRootDir(installState);
  if (agentsRootDir) {
    checks.push({
      id: "agents-root",
      status: inspection.agentsRootExists ? "pass" : "fail",
      message: inspection.agentsRootExists ? `agents \u6839\u5B58\u5728: ${agentsRootDir}` : `agents \u6839\u7F3A\u5931: ${agentsRootDir}`
    });
  }
  const skillsRootDir = resolveInstalledSkillsRootDir(installState);
  if (skillsRootDir) {
    checks.push({
      id: "skills-root",
      status: inspection.skillsRootExists ? "pass" : "fail",
      message: inspection.skillsRootExists ? `skills \u6839\u5B58\u5728: ${skillsRootDir}` : `skills \u6839\u7F3A\u5931: ${skillsRootDir}`
    });
  }
  if (needsSystemOverviewPythonRuntime(inspection)) {
    const pythonRuntime = detectPythonRuntime();
    checks.push({
      id: "system-overview-python",
      status: pythonRuntime.available ? "pass" : "warn",
      message: pythonRuntime.available ? `system-overview-design Python runtime ready: ${pythonRuntime.label}` : "system-overview-design requires Python 3, but no python command was detected on PATH",
      details: pythonRuntime.available ? void 0 : [
        "Install Python 3 and ensure `python`, `python3`, or `py -3` is available in PATH."
      ]
    });
    checks.push({
      id: "system-overview-python-docx",
      status: !pythonRuntime.available || pythonRuntime.pythonDocx ? "pass" : "warn",
      message: !pythonRuntime.available ? "Skip python-docx check because Python runtime is unavailable" : pythonRuntime.pythonDocx ? `python-docx import ok via ${pythonRuntime.label}` : `python-docx is missing for ${pythonRuntime.label}`,
      details: !pythonRuntime.available || pythonRuntime.pythonDocx ? void 0 : [`Install dependency: \`${buildPipInstallCommand(pythonRuntime.label)}\``]
    });
  }
  checks.push({
    id: "managed-files-tracked",
    status: inspection.trackedManagedFileCount > 0 ? "pass" : "fail",
    message: `tracked managed files: ${inspection.trackedManagedFileCount}`
  });
  checks.push({
    id: "managed-files-missing",
    status: inspection.missingManagedFiles.length === 0 ? "pass" : "fail",
    message: inspection.missingManagedFiles.length === 0 ? "\u6240\u6709 managed files \u5747\u5B58\u5728" : `\u7F3A\u5931 ${inspection.missingManagedFiles.length} \u4E2A managed files`,
    details: inspection.missingManagedFiles.slice(0, 10)
  });
  checks.push({
    id: "unexpected-static-files",
    status: inspection.unexpectedStaticFiles.length === 0 ? "pass" : "warn",
    message: inspection.unexpectedStaticFiles.length === 0 ? "\u672A\u53D1\u73B0\u672A\u8DDF\u8E2A\u7684\u9759\u6001\u5206\u53D1\u6587\u4EF6" : `\u53D1\u73B0 ${inspection.unexpectedStaticFiles.length} \u4E2A\u672A\u8DDF\u8E2A\u7684\u9759\u6001\u5206\u53D1\u6587\u4EF6`,
    details: inspection.unexpectedStaticFiles.slice(0, 10)
  });
  if (installState.profile !== "full") {
    const legacyArtifactCount = LEGACY_ORCHESTRATOR_ARTIFACTS.filter((relativePath) => {
      if (inspection.installState?.profile === "orchestrator" || inspection.installState?.profile === "full") {
        return false;
      }
      return inspection.unexpectedProfileFiles.includes(relativePath);
    }).length;
    checks.push({
      id: "profile-residual-cleanup",
      status: inspection.unexpectedProfileFiles.length === 0 ? "pass" : "warn",
      message: inspection.unexpectedProfileFiles.length === 0 ? `${installState.profile} profile \u672A\u53D1\u73B0\u8D8A\u754C\u6B8B\u7559\u6587\u4EF6` : `${installState.profile} profile \u4ECD\u5B58\u5728 ${inspection.unexpectedProfileFiles.length} \u4E2A\u8D8A\u754C\u6B8B\u7559\u6587\u4EF6` + (legacyArtifactCount > 0 ? `\uFF08\u5176\u4E2D ${legacyArtifactCount} \u4E2A\u4E3A\u7F16\u6392\u5951\u7EA6\u6B8B\u7559\uFF09` : ""),
      details: inspection.unexpectedProfileFiles.slice(0, 10)
    });
  }
  return checks;
}
function summarizeDoctorChecks(checks) {
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;
  for (const check of checks) {
    if (check.status === "pass") passCount += 1;
    if (check.status === "warn") warnCount += 1;
    if (check.status === "fail") failCount += 1;
  }
  return {
    status: failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass",
    passCount,
    warnCount,
    failCount
  };
}
function formatStatusReport(inspection) {
  if (!inspection.installState) {
    return [
      "CodeBuddy Status",
      `Target: ${inspection.targetDir}`,
      `Install File: ${inspection.installStatePath}`,
      "Status: missing",
      "Hint: \u5148\u6267\u884C loader \u5B89\u88C5\uFF0C\u4F8B\u5982 `npm run codebuddy` \u6216 `node scripts/dist/codebuddy-loader.js`\u3002"
    ].join("\n");
  }
  const installState = inspection.installState;
  return [
    "CodeBuddy Status",
    `Target: ${inspection.targetDir}`,
    `Install File: ${inspection.installStatePath}`,
    "Status: installed",
    `Version: ${installState.version}`,
    `Installed At: ${installState.installedAt}`,
    `Mode: ${installState.mode}`,
    `Profile: ${installState.profile}`,
    `Orchestrator: ${installState.enableOrchestrator}`,
    `Pack Mode: ${installState.options.strictRemotePack ? "strict" : "fallback-allowed"}`,
    `Content Pack: ${installState.source.contentPackFile || "n/a"}${installState.source.contentPackSha256 ? ` (${installState.source.contentPackSha256.slice(0, 12)})` : ""}`,
    `Content Hash: ${installState.contentHash}`,
    `Rules File: ${installState.outputs.rulesFile} (${inspection.rulesFileExists ? "present" : "missing"})`,
    `Workspace Index: ${installState.outputs.workspaceIndexFile || "n/a"}${installState.outputs.workspaceIndexFile ? ` (${inspection.workspaceIndexExists ? "present" : "missing"})` : ""}`,
    `Agents Root: ${resolveInstalledAgentsRootDir(installState) || "n/a"}${resolveInstalledAgentsRootDir(installState) ? ` (${inspection.agentsRootExists ? "present" : "missing"})` : ""}`,
    `Agents Snapshot Retention: ${resolveInstalledAgentsSnapshotRetention(installState) ?? "n/a"}`,
    `Skills Root: ${resolveInstalledSkillsRootDir(installState) || "n/a"}${resolveInstalledSkillsRootDir(installState) ? ` (${inspection.skillsRootExists ? "present" : "missing"})` : ""}`,
    `Skills Snapshot Retention: ${resolveInstalledSkillsSnapshotRetention(installState) ?? "n/a"}`,
    `Managed Files: tracked=${inspection.trackedManagedFileCount}, present=${inspection.presentManagedFileCount}, missing=${inspection.missingManagedFiles.length}`,
    `Stats: skills=${installState.stats.skills}, agents=${installState.stats.agents}, scripts=${installState.stats.scripts}, workflows=${installState.stats.workflows}, taskbooks=${installState.stats.taskbooks}, agentCalls=${installState.stats.agentCalls}, commands=${installState.stats.commands}`
  ].join("\n");
}
function formatDoctorReport(inspection, checks, summary) {
  const lines = [
    "CodeBuddy Doctor",
    `Target: ${inspection.targetDir}`,
    `Overall: ${summary.status.toUpperCase()} (pass=${summary.passCount}, warn=${summary.warnCount}, fail=${summary.failCount})`,
    ""
  ];
  for (const check of checks) {
    const marker = check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "FAIL";
    lines.push(`[${marker}] ${check.id}: ${check.message}`);
    if (check.details && check.details.length > 0) {
      for (const detail of check.details) {
        lines.push(`  - ${detail}`);
      }
    }
  }
  return lines.join("\n");
}

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
function extractYamlBlockScalar(frontmatter, key, indent = 0) {
  const normalized = normalizeNewlines(frontmatter);
  const lines = normalized.split("\n");
  const prefix = indentPrefix(indent);
  const startPattern = new RegExp(`^${escapeRegex(prefix)}${escapeRegex(key)}:\\s*[>|][+-]?\\s*$`);
  for (let i = 0; i < lines.length; i++) {
    if (!startPattern.test(lines[i])) continue;
    const collected = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim()) {
        collected.push("");
        continue;
      }
      if (countLeadingSpaces(line) <= indent) break;
      collected.push(line);
    }
    const nonEmptyLines = collected.filter((line) => line.trim());
    if (nonEmptyLines.length === 0) return "";
    const contentIndent = Math.min(...nonEmptyLines.map(countLeadingSpaces));
    return collected.map((line) => line.trim() ? line.slice(contentIndent) : "").join("\n").trim();
  }
  return void 0;
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

// scripts/src/lib/metadata-parser.ts
var SKILL_ROLE_SET = /* @__PURE__ */ new Set([
  "frontend",
  "backend",
  "fullstack",
  "qa",
  "architect",
  "product",
  "devops"
]);
var PROJECT_LANG_SET = /* @__PURE__ */ new Set([
  "typescript",
  "javascript",
  "java",
  "python",
  "go",
  "rust",
  "dotnet",
  "unknown"
]);
var SKILL_WORKSPACE_SCOPE_SET = /* @__PURE__ */ new Set([
  "workspace-union",
  "project-targeted",
  "both"
]);
function normalizeSkillRole(value) {
  const normalized = value.trim().toLowerCase();
  return SKILL_ROLE_SET.has(normalized) ? normalized : null;
}
function normalizeProjectLang(value) {
  const normalized = value.trim().toLowerCase();
  return PROJECT_LANG_SET.has(normalized) ? normalized : null;
}
function normalizeWorkspaceScope(value) {
  const normalized = value.trim().toLowerCase();
  return SKILL_WORKSPACE_SCOPE_SET.has(normalized) ? normalized : null;
}
function normalizeStringList(values) {
  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : void 0;
}
function parseSkillMetadata(skillId, content) {
  const fm = parseFrontmatterBlock(content);
  if (!fm.ok) return null;
  const frontmatter = fm.frontmatter;
  const name = extractYamlScalar(frontmatter, "name");
  const description = extractYamlScalar(frontmatter, "description");
  if (!name || !description) return null;
  const metadataBlock = extractYamlSection(frontmatter, "metadata");
  const metadataTriggers = metadataBlock ? parseYamlList(metadataBlock, "triggers", 2) : [];
  const legacyTriggers = parseYamlList(frontmatter, "triggers");
  const triggers = metadataTriggers.length > 0 ? metadataTriggers : legacyTriggers;
  const metadataTools = metadataBlock ? parseYamlList(metadataBlock, "tools", 2) : [];
  const legacyTools = parseYamlList(frontmatter, "tools");
  const tools = metadataTools.length > 0 ? metadataTools : legacyTools;
  const metadataRelated = metadataBlock ? parseYamlList(metadataBlock, "related", 2) : [];
  const legacyRelated = parseYamlList(frontmatter, "related");
  const related = metadataRelated.length > 0 ? metadataRelated : legacyRelated;
  const metadataLanguages = metadataBlock ? parseYamlList(metadataBlock, "languages", 2) : [];
  const languages = metadataLanguages.map(normalizeProjectLang).filter((value) => value !== null);
  const metadataFrameworks = metadataBlock ? parseYamlList(metadataBlock, "frameworks", 2) : [];
  const frameworks = normalizeStringList(metadataFrameworks);
  const metadataRoles = metadataBlock ? parseYamlList(metadataBlock, "roles", 2) : [];
  const roles = metadataRoles.map(normalizeSkillRole).filter((value) => value !== null);
  const metadataScenarios = metadataBlock ? parseYamlList(metadataBlock, "scenarios", 2) : [];
  const scenarios = normalizeStringList(metadataScenarios);
  const workspaceScopeRaw = metadataBlock ? extractYamlScalar(metadataBlock, "workspace_scope", 2) : void 0;
  const workspaceScope = workspaceScopeRaw ? normalizeWorkspaceScope(workspaceScopeRaw) ?? void 0 : void 0;
  return {
    id: skillId,
    name,
    description,
    triggers,
    tools,
    related,
    languages: languages.length > 0 ? languages : void 0,
    frameworks,
    roles: roles.length > 0 ? roles : void 0,
    scenarios,
    workspaceScope
  };
}
function parseAgentMetadata(agentId, content) {
  const fm = parseFrontmatterBlock(content);
  if (!fm.ok) return null;
  const frontmatter = fm.frontmatter;
  const name = extractYamlScalar(frontmatter, "name");
  const description = extractYamlScalar(frontmatter, "description");
  if (!name || !description) return null;
  const triggers = parseYamlList(frontmatter, "triggers");
  const permissionsBlock = extractYamlSection(frontmatter, "permissions");
  const permissions = permissionsBlock ? parseYamlList(permissionsBlock, "tools", 2) : [];
  const relatedSkills = permissionsBlock ? parseYamlList(permissionsBlock, "skills", 2) : [];
  const dependenciesBlock = extractYamlSection(frontmatter, "dependencies");
  const relatedRules = dependenciesBlock ? listYamlKeys(dependenciesBlock, 2).flatMap((key) => parseYamlList(dependenciesBlock, key, 2)) : [];
  const workflowSummary = extractYamlBlockScalar(frontmatter, "workflow_summary");
  const implicitTriggers = [];
  const bodyYamlMatch = content.match(/```yaml\s*\n([\s\S]*?)```/);
  if (bodyYamlMatch) {
    const bodyYaml = bodyYamlMatch[1];
    const implicitSection = bodyYaml.match(/implicit:\s*\n((?:\s+-[\s\S]*?)(?=\n\S|\n```|$))/);
    if (implicitSection) {
      const patternRegex = /- pattern:\s*["'](.+?)["']\s*\n\s+confidence:\s*([\d.]+)/g;
      let patternMatch;
      while (patternMatch = patternRegex.exec(implicitSection[1])) {
        implicitTriggers.push({ pattern: patternMatch[1], confidence: parseFloat(patternMatch[2]) });
      }
    }
  }
  return {
    id: agentId,
    name,
    description,
    triggers,
    implicitTriggers: implicitTriggers.length > 0 ? implicitTriggers : void 0,
    permissions,
    workflowSummary,
    relatedSkills: relatedSkills.length > 0 ? relatedSkills : void 0,
    relatedRules: relatedRules.length > 0 ? relatedRules : void 0
  };
}

// scripts/src/lib/prompt-builder.ts
function summarizeHintItems(values, maxItems = 2) {
  if (!values || values.length === 0) return null;
  const uniqueValues = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (uniqueValues.length === 0) return null;
  if (uniqueValues.length <= maxItems) return uniqueValues.join(", ");
  return `${uniqueValues.slice(0, maxItems).join(", ")} +${uniqueValues.length - maxItems}`;
}
function buildSkillHint(skill) {
  const parts = [];
  const tools = summarizeHintItems(skill.tools);
  const related = summarizeHintItems(skill.related);
  const languages = summarizeHintItems(skill.languages);
  const frameworks = summarizeHintItems(skill.frameworks);
  const roles = summarizeHintItems(skill.roles);
  if (tools) parts.push(`tools: ${tools}`);
  if (related) parts.push(`related: ${related}`);
  if (languages) parts.push(`langs: ${languages}`);
  if (frameworks) parts.push(`stacks: ${frameworks}`);
  if (roles) parts.push(`roles: ${roles}`);
  if (skill.workspaceScope && skill.workspaceScope !== "both") parts.push(`scope: ${skill.workspaceScope}`);
  return parts.length > 0 ? parts.join("; ") : "-";
}
function generateWorkflowsPrompt(workflows) {
  if (workflows.length === 0) return "";
  const workflowFiles = workflows.filter((f) => f.endsWith(".workflow.json")).sort((a, b) => a.localeCompare(b));
  const schemaFiles = workflows.filter((f) => f.endsWith(".schema.json")).sort((a, b) => a.localeCompare(b));
  let table = "| \u6587\u4EF6 | \u8DEF\u5F84 | \u8BF4\u660E |\n|------|------|------|\n";
  for (const wf of workflowFiles) {
    table += `| \`${wf}\` | \`.codebuddy/workflows/${wf}\` | Workflow Spec |
`;
  }
  for (const s of schemaFiles) {
    table += `| \`${s}\` | \`.codebuddy/workflows/${s}\` | JSON Schema |
`;
  }
  return `
# \u{1F9ED} Workflows\uFF08\u5DE5\u4F5C\u6D41\u89C4\u8303\uFF09

\u672C\u9879\u76EE\u5305\u542B **Workflow Spec**\uFF08\u5DE5\u4F5C\u6D41\u89C4\u8303\uFF09\uFF0C\u7528\u4E8E\u63CF\u8FF0"\u6B65\u9AA4\u4F9D\u8D56\uFF08DAG\uFF09+ \u4EA7\u7269\uFF08artifacts\uFF09+ \u8D28\u91CF\u95F8\u95E8\uFF08gates\uFF09+ \u7B56\u7565\uFF08policies\uFF09"\u3002

> \u65E9\u671F\uFF1A\u53EF\u4F5C\u4E3A Agent \u7684\u6267\u884C\u7EA6\u675F\u4E0E\u5F15\u5BFC\uFF1B\u540E\u671F\uFF1A\u53EF\u7531\u6267\u884C\u5F15\u64CE\u6309\u89C4\u8303\u7F16\u6392\u5E76\u5F3A\u5236 gates\u3002

## \u5DF2\u5B89\u88C5\u6587\u4EF6

${table}

## \u4F7F\u7528\u7EA6\u5B9A\uFF08\u5F3A\u5EFA\u8BAE\uFF09

1. \u5728\u521B\u5EFA/\u6267\u884C TaskBook \u524D\uFF0C\u5148\u8BFB\u53D6 \`.codebuddy/workflows/default.workflow.json\`\u3002
2. \u6BCF\u4E2A step \u90FD\u9700\u8981\u4EA7\u51FA\u53EF\u9A8C\u8BC1\u7684 artifact\uFF08\u4F8B\u5982\u62A5\u544A\u3001\u6D4B\u8BD5\u7ED3\u679C\u3001\u53D8\u66F4\u8BF4\u660E\uFF09\uFF0C\u5E76\u5199\u56DE TaskBook \u7684 \`actualWork\` / \u62A5\u544A\u76EE\u5F55\u3002
3. gates \u5931\u8D25\u5FC5\u987B\u8FDB\u5165 \`blocked\` \u5E76\u8BB0\u5F55\u539F\u56E0\uFF0C\u76F4\u5230\u4EBA\u5DE5\u786E\u8BA4\u7EE7\u7EED/\u8DF3\u8FC7\u3002
`;
}
function generateTaskBooksPrompt(files) {
  if (files.length === 0) return "";
  let table = "| \u6587\u4EF6 | \u8DEF\u5F84 | \u8BF4\u660E |\n|------|------|------|\n";
  for (const f of files.sort((a, b) => a.localeCompare(b))) {
    table += `| \`${f}\` | \`.codebuddy/taskbooks/${f}\` | TaskBook Contract |
`;
  }
  return `
# \u{1F4D2} TaskBook\uFF08\u4EFB\u52A1\u4E66\u5951\u7EA6\uFF09

TaskBook \u662F\u4EFB\u52A1\u534F\u4F5C\u7684 **\u552F\u4E00\u4E8B\u5B9E\u6E90\uFF08SSOT\uFF09**\uFF1A\u89C4\u5212\u3001\u6267\u884C\u3001\u4EA7\u51FA\u3001\u9A8C\u6536\u90FD\u5E94\u4EE5 \`.codebuddy/taskbooks/active/*.json\` \u4E3A\u51C6\u3002

## \u5DF2\u5B89\u88C5\u6587\u4EF6

${table}

## \u4F7F\u7528\u7EA6\u5B9A\uFF08\u5F3A\u5EFA\u8BAE\uFF09

1. \u6240\u6709\u4EFB\u52A1\u72B6\u6001\u53D8\u66F4\u5FC5\u987B\u5199\u56DE TaskBook\uFF08\u907F\u514D"\u53E3\u5934\u5B8C\u6210"\uFF09\u3002
2. \u6BCF\u4E2A\u4EFB\u52A1\u7684\u53EF\u9A8C\u8BC1\u4EA7\u51FA\uFF08\u62A5\u544A/\u6D4B\u8BD5\u7ED3\u679C/\u53D8\u66F4\u8BF4\u660E\uFF09\u5E94\u8BB0\u5F55\u5230 \`actualWork\` \u6216\u62A5\u544A\u76EE\u5F55\uFF0C\u5E76\u5728 TaskBook \u4E2D\u5F15\u7528\u3002
3. gates \u5931\u8D25\u5FC5\u987B\u8FDB\u5165 \`blocked\` \u5E76\u8BB0\u5F55\u539F\u56E0\uFF0C\u76F4\u5230\u4EBA\u5DE5\u786E\u8BA4\u7EE7\u7EED/\u8DF3\u8FC7\u3002
`;
}
function generateAgentCallsPrompt(files) {
  if (files.length === 0) return "";
  const schemaFiles = files.filter((f) => f.endsWith(".schema.json")).sort((a, b) => a.localeCompare(b));
  let table = "| \u6587\u4EF6 | \u8DEF\u5F84 | \u8BF4\u660E |\n|------|------|------|\n";
  for (const f of schemaFiles) {
    table += `| \`${f}\` | \`.codebuddy/agent-calls/${f}\` | JSON Schema |
`;
  }
  return `
# \u{1F9E9} Agent Calls\uFF08\u6587\u4EF6\u534F\u8BAE\uFF09
\u672C\u89C4\u5219\u5E93\u652F\u6301 **Agent Call \u6587\u4EF6\u534F\u8BAE**\uFF1A\`.codebuddy/agent-calls/<requestId>.prompt.md\` \u21C4 \`.result.json\`\u3002
> \u7528\u4E8E\u628A\u300C\u5916\u90E8\u6A21\u578B/\u5DE5\u5177\u6267\u884C\u300D\u4E0E\u300C\u672C\u5730 CLI \u72B6\u6001\u673A\u300D\u89E3\u8026\uFF0C\u5B9E\u73B0\u53EF\u5BA1\u8BA1\u3001\u53EF\u6062\u590D\u7684\u95ED\u73AF\u3002
## \u5DF2\u5B89\u88C5\u6587\u4EF6
${table}
`;
}
function getCommandPromptEntry(cmd) {
  const commandName = cmd.replace(/\.md$/, "");
  const path6 = `.codebuddy/commands/${cmd}`;
  if (cmd === "task.md") {
    return {
      command: "/task",
      path: path6,
      description: "\u7AEF\u5230\u7AEF\u8BA1\u5212\u4EFB\u52A1\u7F16\u6392",
      example: "/task \u5B9E\u73B0\u7528\u6237\u767B\u5F55\u529F\u80FD"
    };
  }
  if (cmd === "agent-call.md") {
    return {
      command: "/agent-call",
      path: path6,
      description: "\u6267\u884C Agent Call \u5E76\u5199\u56DE result.json",
      example: "/agent-call req-20260204-xxxxxx"
    };
  }
  return {
    command: `/${commandName}`,
    path: path6,
    description: "-",
    example: `/${commandName}`
  };
}
function getScriptPromptEntry(script) {
  const path6 = `.codebuddy/scripts/${script}`;
  if (script === "structure-analyzer.js") {
    return {
      file: script,
      path: path6,
      description: "\u9879\u76EE\u7ED3\u6784\u5206\u6790\u5668",
      usage: `node ${path6} .`
    };
  }
  if (script === "module-mapper.js") {
    return {
      file: script,
      path: path6,
      description: "\u6A21\u5757\u56FE\u8C31\u5206\u6790\u5668",
      usage: `node ${path6} .`
    };
  }
  if (script === "report-manager.js") {
    return {
      file: script,
      path: path6,
      description: "\u62A5\u544A\u7BA1\u7406\u5668",
      usage: `node ${path6} status`
    };
  }
  if (script === "agent-call-manager.js") {
    return {
      file: script,
      path: path6,
      description: "Agent Call \u7BA1\u7406\u5668\uFF08list/show/validate\uFF09",
      usage: `node ${path6} list`
    };
  }
  if (script === "task-orchestrator.js") {
    return {
      file: script,
      path: path6,
      description: "\u4E00\u952E\u95ED\u73AF\u6267\u884C\u5668\uFF08\u521B\u5EFA/\u89C4\u5212/\u6267\u884C/\u9A8C\u6536\uFF09",
      usage: `node ${path6} "\u5B9E\u73B0\u7528\u6237\u767B\u5F55" --type new-feature`
    };
  }
  if (script === "contract-validator.js") {
    return {
      file: script,
      path: path6,
      description: "\u5951\u7EA6\u6821\u9A8C\u5668\uFF08TaskBook/Workflow\uFF09",
      usage: `node ${path6} --workflows --taskbooks`
    };
  }
  return {
    file: script,
    path: path6,
    description: "-",
    usage: `node ${path6}`
  };
}
function buildCommandsTable(commands) {
  const entries = commands.map(getCommandPromptEntry).sort((a, b) => a.command.localeCompare(b.command));
  let table = "| \u547D\u4EE4 | \u8DEF\u5F84 | \u8BF4\u660E | \u793A\u4F8B |\n|------|------|------|------|\n";
  for (const entry of entries) {
    table += `| \`${entry.command}\` | \`${entry.path}\` | ${entry.description} | \`${entry.example}\` |
`;
  }
  return table;
}
function buildScriptsTable(scripts) {
  const entries = scripts.map(getScriptPromptEntry).sort((a, b) => a.file.localeCompare(b.file));
  let table = "| \u811A\u672C | \u8DEF\u5F84 | \u8BF4\u660E | \u7528\u6CD5 |\n|------|------|------|------|\n";
  for (const entry of entries) {
    table += `| \`${entry.file}\` | \`${entry.path}\` | ${entry.description} | \`${entry.usage}\` |
`;
  }
  return table;
}
function formatCodeList(values) {
  return values.map((value) => `\`${value}\``).join("\u3001");
}
function buildCommandsSummaryTable(commands) {
  const entries = commands.map(getCommandPromptEntry).sort((a, b) => a.command.localeCompare(b.command));
  let table = "| \u573A\u666F | \u9996\u9009\u5165\u53E3 | \u8BF4\u660E |\n|------|----------|------|\n";
  for (const entry of entries) {
    table += `| ${entry.description} | \`${entry.example}\` | \u8BE6\u60C5\u89C1 \`${entry.path}\` |
`;
  }
  return table;
}
function buildScriptPromptGroups(scripts) {
  const scriptSet = new Set(scripts);
  const consumed = /* @__PURE__ */ new Set();
  const groups = [];
  const addGroup = (title, summary, entry, files) => {
    const present = files.filter((file) => scriptSet.has(file));
    if (present.length === 0) return;
    for (const file of present) {
      consumed.add(file);
    }
    groups.push({
      title,
      summary,
      entry,
      files: present
    });
  };
  addGroup(
    "\u7ED3\u6784\u5206\u6790",
    "\u5148\u751F\u6210\u7ED3\u6784\u548C\u6A21\u5757\u8FB9\u754C\uFF0C\u518D\u51B3\u5B9A\u662F\u5426\u7EE7\u7EED\u6DF1\u6316",
    "node .codebuddy/scripts/structure-analyzer.js .",
    ["structure-analyzer.js", "module-mapper.js"]
  );
  addGroup(
    "\u62A5\u544A\u67E5\u8BE2",
    "\u4F18\u5148\u590D\u7528\u5DF2\u6709\u62A5\u544A\uFF0C\u907F\u514D\u91CD\u590D\u626B\u63CF",
    "node .codebuddy/scripts/report-manager.js status",
    ["report-manager.js"]
  );
  addGroup(
    "\u89C4\u5219\u4E0E\u5951\u7EA6\u6821\u9A8C",
    "\u89C4\u5219\u3001\u6280\u80FD\u3001TaskBook/Workflow \u53D8\u66F4\u524D\u5148\u6821\u9A8C",
    "node .codebuddy/scripts/contract-validator.js --workflows --taskbooks",
    ["rule-validator.js", "skill-validator.js", "contract-validator.js", "agent-registry.js"]
  );
  addGroup(
    "\u7F16\u6392\u6267\u884C",
    "\u9700\u8981\u5B8C\u6574\u4EFB\u52A1\u95ED\u73AF\u65F6\u8D70\u7F16\u6392\u5165\u53E3",
    'node .codebuddy/scripts/task-orchestrator.js "\u5B9E\u73B0\u7528\u6237\u767B\u5F55" --type new-feature',
    ["task-orchestrator.js", "taskbook-manager.js", "task-executor.js"]
  );
  addGroup(
    "Agent Call \u4E0E\u4E0A\u4E0B\u6587",
    "\u5904\u7406\u5916\u90E8\u6267\u884C\u3001\u4E0A\u4E0B\u6587\u91C7\u96C6\u548C\u7ED3\u679C\u5199\u56DE",
    "node .codebuddy/scripts/agent-call-manager.js list",
    ["agent-call-manager.js", "reference-finder.js", "context-collector.js"]
  );
  const remaining = [...scripts].filter((file) => !consumed.has(file)).sort((a, b) => a.localeCompare(b));
  if (remaining.length > 0) {
    groups.push({
      title: "\u5176\u4ED6\u5165\u53E3",
      summary: "\u4EC5\u5728\u4E0A\u8FF0\u5165\u53E3\u4E0D\u5339\u914D\u65F6\u518D\u6309\u9700\u8BFB\u53D6",
      entry: `node .codebuddy/scripts/${remaining[0]}`,
      files: remaining
    });
  }
  return groups;
}
function buildScriptsSummaryTable(scripts) {
  const groups = buildScriptPromptGroups(scripts);
  let table = "| \u573A\u666F | \u9996\u9009\u5165\u53E3 | \u8986\u76D6\u811A\u672C |\n|------|----------|----------|\n";
  for (const group of groups) {
    table += `| ${group.title} | \`${group.entry}\` | ${formatCodeList(group.files)} |
`;
  }
  return table;
}
function generateCommandsPrompt(commands) {
  if (commands.length === 0) return "";
  const entries = commands.map(getCommandPromptEntry).sort((a, b) => a.command.localeCompare(b.command));
  const installedCommands = formatCodeList(entries.map((entry) => entry.command));
  const installedFiles = formatCodeList(entries.map((entry) => entry.path));
  return `
# \u{1F4CB} Slash Commands \u7D22\u5F15

\u672C\u89C4\u5219\u5E93\u53EA\u4FDD\u7559\u5C11\u91CF\u9AD8\u9891\u547D\u4EE4\u4F5C\u4E3A\u77ED\u5165\u53E3\uFF1B\u8BE6\u7EC6\u53C2\u6570\u548C\u5B8C\u6574\u8BF4\u660E\u5DF2\u5916\u8FC1\u5230 \`.codebuddy/commands/README.md\`\u3002

## \u5FEB\u901F\u5165\u53E3

${buildCommandsSummaryTable(commands)}

\u5DF2\u5B89\u88C5\u547D\u4EE4\uFF1A${installedCommands}

\u547D\u4EE4\u6587\u4EF6\uFF1A${installedFiles}

\u5148\u8BFB README\uFF0C\u518D\u6309\u9700\u6253\u5F00\u5BF9\u5E94\u547D\u4EE4\u6587\u4EF6\uFF0C\u4E0D\u8981\u4E00\u6B21\u6027\u626B\u8BFB\u5168\u90E8 command \u8BF4\u660E\u3002
`;
}
function generateCommandsReadme(commands) {
  const table = buildCommandsTable(commands);
  return [
    "# CodeBuddy Slash Commands",
    "",
    "> \u81EA\u52A8\u751F\u6210\uFF0C\u8BF7\u52FF\u624B\u52A8\u7F16\u8F91",
    "",
    "## \u5DF2\u5B89\u88C5\u547D\u4EE4",
    "",
    table.trimEnd(),
    "",
    "## \u5FEB\u901F\u5165\u53E3",
    "",
    "- \u4E1A\u52A1\u9700\u6C42\u3001\u91CD\u6784\u3001\u7F3A\u9677\u4FEE\u590D\uFF1A\u4F18\u5148\u4F7F\u7528 `/task`\uFF0C\u8BE6\u7EC6\u8BF4\u660E\u89C1 `task.md`\u3002",
    "- \u9700\u8981\u6267\u884C `.codebuddy/agent-calls/*.prompt.md`\uFF1A\u4F7F\u7528 `/agent-call`\uFF0C\u8BE6\u7EC6\u8BF4\u660E\u89C1 `agent-call.md`\u3002",
    "",
    "## \u63A8\u8350\u9605\u8BFB\u987A\u5E8F",
    "",
    "1. \u5148\u770B\u672C README \u786E\u8BA4\u5165\u53E3\u3002",
    "2. \u518D\u6309\u9700\u8BFB\u53D6\u5BF9\u5E94\u547D\u4EE4\u6587\u4EF6\uFF0C\u907F\u514D\u4E00\u6B21\u6027\u626B\u8BFB\u5168\u90E8\u8BF4\u660E\u3002"
  ].join("\n");
}
function generateScriptsReadme(scripts) {
  const table = buildScriptsTable(scripts);
  return [
    "# CodeBuddy \u5DE5\u5177\u811A\u672C",
    "",
    "> \u81EA\u52A8\u751F\u6210\uFF0C\u8BF7\u52FF\u624B\u52A8\u7F16\u8F91",
    "",
    "## \u5DF2\u5B89\u88C5\u811A\u672C",
    "",
    table.trimEnd(),
    "",
    "## \u5E38\u7528\u573A\u666F",
    "",
    "### \u7ED3\u6784\u5206\u6790",
    "",
    "```bash",
    "node .codebuddy/scripts/structure-analyzer.js .",
    "node .codebuddy/scripts/structure-analyzer.js . --output json",
    "```",
    "",
    "### \u67E5\u770B\u5206\u6790\u62A5\u544A",
    "",
    "```bash",
    "node .codebuddy/scripts/report-manager.js status",
    'node .codebuddy/scripts/report-manager.js inspect --module "src/features/user"',
    "```",
    "",
    "### \u7F16\u6392 / \u5951\u7EA6\u6821\u9A8C",
    "",
    "```bash",
    "node .codebuddy/scripts/contract-validator.js --workflows --taskbooks",
    'node .codebuddy/scripts/task-orchestrator.js "\u5B9E\u73B0\u7528\u6237\u767B\u5F55" --type new-feature',
    "```",
    "",
    "\u62A5\u544A\u9ED8\u8BA4\u5199\u5165 `.codebuddy/reports/`\uFF0C\u4F18\u5148\u590D\u7528\u5DF2\u6709\u5206\u6790\u7ED3\u679C\uFF0C\u518D\u51B3\u5B9A\u662F\u5426\u91CD\u8DD1\u811A\u672C\u3002"
  ].join("\n");
}
function generateScriptsPrompt(scripts) {
  if (scripts.length === 0) return "";
  const sortedScripts = [...scripts].sort((a, b) => a.localeCompare(b));
  return `
# \u{1F527} \u5DE5\u5177\u811A\u672C\u7D22\u5F15 (Scripts Index)

\u672C\u89C4\u5219\u5E93\u7684\u811A\u672C\u7EC6\u8282\u5DF2\u5916\u8FC1\u5230 \`.codebuddy/scripts/README.md\`\uFF1B\u8FD9\u91CC\u4EC5\u4FDD\u7559\u9AD8\u9891\u5165\u53E3\u548C\u80FD\u529B\u5206\u7EC4\u3002

## \u5FEB\u901F\u5165\u53E3

${buildScriptsSummaryTable(sortedScripts)}

\u5DF2\u5B89\u88C5\u811A\u672C\uFF1A${formatCodeList(sortedScripts)}

\u5206\u6790\u7C7B\u811A\u672C\u9ED8\u8BA4\u628A\u7ED3\u679C\u5199\u5165 \`.codebuddy/reports/\`\u3002\u4F18\u5148\u5148\u770B README\uFF0C\u518D\u6309\u9700\u8BFB\u53D6\u5177\u4F53\u811A\u672C\u5E2E\u52A9\u3002
`;
}
function generateQuickActionGuide() {
  return `
## \u26A1 \u5FEB\u901F\u884C\u52A8\u6307\u5F15

| \u573A\u666F | \u4F18\u5148\u52A8\u4F5C | \u5165\u53E3 |
|------|----------|------|
| \u65B0\u529F\u80FD / \u91CD\u6784 / \u7F3A\u9677\u4FEE\u590D | \u8D70\u4EFB\u52A1\u95ED\u73AF\uFF0C\u4E0D\u8981\u624B\u5DE5\u8DF3\u6B65\u9AA4 | \`/task <\u9700\u6C42>\` |
| \u9700\u8981\u7406\u89E3\u9879\u76EE\u7ED3\u6784 | \u5148\u505A\u7ED3\u6784\u5206\u6790\uFF0C\u518D\u8BFB\u76F8\u5173\u89C4\u5219/\u4EE3\u7801 | \`node .codebuddy/scripts/structure-analyzer.js .\` |
| \u9700\u8981\u67E5\u770B\u5DF2\u6709\u5206\u6790\u7ED3\u679C | \u5148\u67E5\u62A5\u544A\u72B6\u6001\uFF0C\u907F\u514D\u91CD\u590D\u626B\u63CF | \`node .codebuddy/scripts/report-manager.js status\` |
| \u9700\u8981\u6267\u884C\u5916\u90E8 Agent Call | \u8BFB\u53D6 prompt\uFF0C\u5199\u56DE result.json | \`/agent-call <requestId>\` |
| \u9700\u8981\u6821\u9A8C TaskBook / Workflow \u5951\u7EA6 | \u5148\u8DD1\u5951\u7EA6\u6821\u9A8C | \`node .codebuddy/scripts/contract-validator.js --workflows --taskbooks\` |
| \u9700\u8981\u7EC6\u8282\u89C4\u8303 | \u6309\u9700\u8BFB\u53D6\u7F13\u5B58\u89C4\u5219\uFF0C\u4E0D\u8981\u5168\u6587\u626B\u8BFB\u5168\u90E8\u89C4\u5219 | \`.codebuddy/rules_cache/\` |

\u4F18\u5148\u8BFB\u77ED\u5165\u53E3\uFF1A\`.codebuddy/scripts/README.md\`\u3001\`.codebuddy/commands/README.md\`\u3001\`.codebuddy/rules_cache/\`\u3002
`;
}
function truncateText(value, max = 48) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}...`;
}
function summarizeRouteTriggers(triggers, maxItems = 3) {
  const values = [...new Set((triggers || []).map((trigger) => trigger.trim()).filter(Boolean))];
  if (values.length === 0) return "-";
  const formatted = values.slice(0, maxItems).map((trigger) => `\`${trigger}\``).join(", ");
  return values.length > maxItems ? `${formatted} +${values.length - maxItems}` : formatted;
}
function formatRouteIds(ids) {
  return ids.map((id) => `\`${id}\``).join(", ");
}
function buildAgentHint(agent) {
  const parts = [];
  if (agent.relatedSkills && agent.relatedSkills.length > 0) {
    parts.push(`skills ${agent.relatedSkills.length}`);
  }
  if (agent.relatedRules && agent.relatedRules.length > 0) {
    parts.push(`rules ${agent.relatedRules.length}`);
  }
  if (agent.permissions.length > 0) {
    parts.push(`tools ${Math.min(agent.permissions.length, 3)}+`);
  }
  return parts.length > 0 ? parts.join(" / ") : "-";
}
function classifyAgentRouteCategory(agent) {
  const text = `${agent.id} ${agent.name} ${agent.description}`.toLowerCase();
  if (/(orchestrator|planner|tdd|编排|规划|交付)/.test(text)) {
    return "orchestration";
  }
  if (/(build|bug|fix|debug|investigator|profiler|修复|排查|诊断|构建|性能)/.test(text)) {
    return "diagnosis";
  }
  if (/(review|security|structure|analyzer|审查|架构|安全)/.test(text)) {
    return "review";
  }
  return "other";
}
function groupAgentsByScenario(agents) {
  const groups = [
    {
      key: "orchestration",
      title: "\u8BA1\u5212\u4E0E\u6267\u884C",
      signal: "\u591A\u6587\u4EF6\u3001\u591A\u6B65\u9AA4\u3001\u9700\u8981\u89C4\u5212/\u5B9E\u73B0/\u9A8C\u6536\u95ED\u73AF",
      items: []
    },
    {
      key: "diagnosis",
      title: "\u8BCA\u65AD\u4E0E\u4FEE\u590D",
      signal: "\u6784\u5EFA\u5931\u8D25\u3001\u8FD0\u884C\u65F6\u62A5\u9519\u3001\u6839\u56E0\u6392\u67E5\u3001\u6027\u80FD\u5F02\u5E38",
      items: []
    },
    {
      key: "review",
      title: "\u5206\u6790\u4E0E\u5BA1\u67E5",
      signal: "\u7ED3\u6784\u5206\u6790\u3001\u4EE3\u7801\u5BA1\u67E5\u3001\u5B89\u5168\u68C0\u67E5\u3001\u4E13\u9879\u8BC4\u4F30",
      items: []
    },
    {
      key: "other",
      title: "\u5176\u4ED6",
      signal: "\u672A\u843D\u5165\u4EE5\u4E0A\u573A\u666F\u7684\u4E13\u7528 Agent",
      items: []
    }
  ];
  for (const agent of [...agents].sort((a, b) => a.id.localeCompare(b.id))) {
    const group = groups.find((item) => item.key === classifyAgentRouteCategory(agent));
    group?.items.push(agent);
  }
  return groups.filter((group) => group.items.length > 0);
}
function classifySkillRouteCategory(skill) {
  const text = `${skill.id} ${skill.name} ${skill.description}`.toLowerCase();
  if (/(structure|module|architecture)/.test(text)) {
    return "architecture";
  }
  if (/(component|state|refactor|重构|store)/.test(text)) {
    return "implementation";
  }
  if (/(review|testing|a11y|i18n|wcag|无障碍)/.test(text)) {
    return "quality";
  }
  if (/(performance|build|render|bundle)/.test(text)) {
    return "performance";
  }
  if (/(prd|ralph|skill-creator|requirements|spec)/.test(text)) {
    return "workflow";
  }
  return "other";
}
function groupSkillsByScenario(skills) {
  const groups = [
    {
      key: "architecture",
      title: "\u67B6\u6784\u4E0E\u5206\u6790",
      signal: "\u9879\u76EE\u7ED3\u6784\u3001\u76EE\u5F55\u6CBB\u7406\u3001\u6A21\u5757\u5173\u7CFB\u3001\u67B6\u6784\u5065\u5EB7\u5EA6",
      items: []
    },
    {
      key: "implementation",
      title: "\u5B9E\u73B0\u4E0E\u91CD\u6784",
      signal: "\u7EC4\u4EF6\u62C6\u5206\u3001\u72B6\u6001\u7BA1\u7406\u3001\u5177\u4F53\u4EE3\u7801\u6539\u9020",
      items: []
    },
    {
      key: "quality",
      title: "\u8D28\u91CF\u4E0E\u4F53\u9A8C",
      signal: "\u4EE3\u7801\u5BA1\u67E5\u3001\u6D4B\u8BD5\u3001\u56FD\u9645\u5316\u3001\u53EF\u8BBF\u95EE\u6027",
      items: []
    },
    {
      key: "performance",
      title: "\u6027\u80FD\u4E0E\u6784\u5EFA",
      signal: "\u6E32\u67D3\u6027\u80FD\u3001\u5305\u4F53\u79EF\u3001\u6784\u5EFA\u901F\u5EA6\u3001\u914D\u7F6E\u4F18\u5316",
      items: []
    },
    {
      key: "workflow",
      title: "\u4EA7\u54C1\u4E0E\u6D41\u7A0B",
      signal: "PRD\u3001\u683C\u5F0F\u8F6C\u6362\u3001\u6280\u80FD\u5B9A\u4E49\u4E0E\u7EF4\u62A4",
      items: []
    },
    {
      key: "other",
      title: "\u5176\u4ED6",
      signal: "\u672A\u843D\u5165\u4EE5\u4E0A\u573A\u666F\u7684\u4E13\u7528 Skill",
      items: []
    }
  ];
  for (const skill of [...skills].sort((a, b) => a.id.localeCompare(b.id))) {
    const group = groups.find((item) => item.key === classifySkillRouteCategory(skill));
    group?.items.push(skill);
  }
  return groups.filter((group) => group.items.length > 0);
}
function generateAgentsPrompt(agents, agentsRootDir = ".codebuddy/agents") {
  if (agents.length === 0) return "";
  const groups = groupAgentsByScenario(agents);
  let routeTable = "| \u573A\u666F | \u5224\u65AD\u4FE1\u53F7 | \u4F18\u5148 Agent |\n|------|----------|------------|\n";
  for (const group of groups) {
    routeTable += `| ${group.title} | ${group.signal} | ${formatRouteIds(group.items.map((agent) => agent.id))} |
`;
  }
  let groupSections = "";
  for (const group of groups) {
    let table = "| Agent | \u4F55\u65F6\u4F7F\u7528 | \u5165\u53E3\u63D0\u793A | \u8865\u5145 |\n|-------|----------|----------|------|\n";
    for (const agent of group.items) {
      table += `| \`${agent.id}\` | ${truncateText(agent.description)} | ${summarizeRouteTriggers(agent.triggers, 2)} | ${buildAgentHint(agent)} |
`;
    }
    groupSections += `### ${group.title}

${table}
`;
  }
  return `
# \u{1F916} Agent \u4E0E Skill \u7EDF\u4E00\u8C03\u5EA6\u6307\u5357

\u672C\u89C4\u5219\u5E93\u652F\u6301 **Agent \u6267\u884C\u6A21\u5F0F** \u548C **Skill \u77E5\u8BC6\u6A21\u5F0F**\u3002\u4F18\u5148\u6309\u4EFB\u52A1\u89C4\u6A21\u5224\u65AD\uFF0C\u518D\u6309\u573A\u666F\u5206\u7C7B\u8DEF\u7531\u3002

## \u7B2C\u4E00\u6B65\uFF1A\u5224\u65AD\u4EFB\u52A1\u89C4\u6A21

| \u4EFB\u52A1\u89C4\u6A21 | \u5904\u7406\u65B9\u5F0F |
|----------|----------|
| \u591A\u6587\u4EF6\u3001\u591A\u6B65\u9AA4\u3001\u9700\u8981\u89C4\u5212/\u6267\u884C/\u9A8C\u6536 | \u8FDB\u5165\u3010\u7B2C\u4E8C\u6B65\uFF1AAgent \u5206\u7C7B\u8DEF\u7531\u3011 |
| \u5355\u6587\u4EF6\u3001\u5355\u7EC4\u4EF6\u3001\u5355\u6B21\u5177\u4F53\u64CD\u4F5C | \u8FDB\u5165\u3010\u7B2C\u4E09\u6B65\uFF1ASkill \u5206\u7C7B\u8DEF\u7531\u3011 |
| \u7EAF\u6982\u5FF5\u95EE\u7B54\u6216\u7B80\u5355\u8BED\u6CD5\u8BF4\u660E | \u4E0D\u52A0\u8F7D Agent/Skill\uFF0C\u76F4\u63A5\u57FA\u4E8E\u89C4\u5219\u56DE\u7B54 |

## \u7B2C\u4E8C\u6B65\uFF1AAgent \u5206\u7C7B\u8DEF\u7531\uFF08\u591A\u6B65\u9AA4\u6D41\u7A0B\uFF09

${routeTable}

Agent \u6587\u4EF6\u5DF2\u4E0B\u8F7D\u81F3 \`${agentsRootDir}/\`\u3002

> **\u4EE5\u5F53\u524D\u89C4\u5219\u6587\u4EF6\u4E2D\u7684 Agent \u8868\u548C \`.codebuddy/install.json\` \u4E3A\u51C6\u3002** \u82E5\u76EE\u5F55\u4E2D\u540C\u65F6\u5B58\u5728\u5386\u53F2 snapshot\uFF0C\u8BF7\u53EA\u8BFB\u53D6\u8FD9\u91CC\u5217\u51FA\u7684 active root\u3002

\u547D\u4E2D\u67D0\u4E2A\u573A\u666F\u540E\uFF0C\u518D\u6309\u9700\u8BFB\u53D6\u5BF9\u5E94 \`${agentsRootDir}/<agent-id>/AGENT.md\`\uFF0C\u4E0D\u8981\u5148\u628A\u6240\u6709 Agent \u5168\u6587\u626B\u4E00\u904D\u3002

## \u5DF2\u5B89\u88C5 Agents\uFF08\u6309\u573A\u666F\u5206\u7EC4\uFF09

${groupSections}

## Agent \u4E0E Skill \u7684\u533A\u522B

| \u7EF4\u5EA6 | Agent\uFF08\u6267\u884C\u8005\uFF09 | Skill\uFF08\u77E5\u8BC6\u6E90\uFF09 |
|------|----------------|----------------|
| **\u5B9A\u4F4D** | \u72EC\u7ACB\u51B3\u7B56\u6267\u884C\u8005\uFF0C\u9A71\u52A8\u5B8C\u6574\u6D41\u7A0B | \u77E5\u8BC6\u5305/\u53C2\u8003\u6587\u6863\uFF0C\u63D0\u4F9B\u4E0A\u4E0B\u6587 |
| **\u89E6\u53D1\u65B9\u5F0F** | \u591A\u6B65\u9AA4\u6D41\u7A0B\uFF08\u89C4\u5212\u2192\u5B9E\u73B0\u2192\u5BA1\u67E5\u2192\u4FEE\u590D\uFF09 | \u5355\u6B21\u5177\u4F53\u64CD\u4F5C\uFF08\u5BA1\u67E5\u4E00\u6BB5\u4EE3\u7801\u3001\u91CD\u6784\u4E00\u4E2A\u7EC4\u4EF6\uFF09 |
| **\u6267\u884C\u6A21\u5F0F** | \u6309 AGENT.md \u5DE5\u4F5C\u6D41\u81EA\u4E3B\u6267\u884C | \u8BFB\u53D6 SKILL.md \u540E\u7531 AI \u6267\u884C |
| **\u5178\u578B\u573A\u666F** | "\u5E2E\u6211\u89C4\u5212\u5E76\u5B9E\u73B0\u767B\u5F55\u529F\u80FD" | "\u5E2E\u6211\u91CD\u6784\u8FD9\u4E2A\u7EC4\u4EF6" |
| **\u8F93\u51FA** | \u5B8C\u6574\u4EA4\u4ED8\u7269\uFF08\u4EE3\u7801+\u6D4B\u8BD5+\u62A5\u544A\uFF09 | \u77E5\u8BC6\u5F15\u5BFC\u4E0B\u7684\u5355\u6B21\u64CD\u4F5C |
`;
}
function generateSkillsPrompt(skills, skillsRootDir = ".codebuddy/skills") {
  if (skills.length === 0) return "";
  const groups = groupSkillsByScenario(skills);
  let routeTable = "| \u573A\u666F | \u5224\u65AD\u4FE1\u53F7 | \u4F18\u5148 Skill |\n|------|----------|------------|\n";
  for (const group of groups) {
    routeTable += `| ${group.title} | ${group.signal} | ${formatRouteIds(group.items.map((skill) => skill.id))} |
`;
  }
  let groupSections = "";
  for (const group of groups) {
    let table = "| Skill | \u4F55\u65F6\u4F7F\u7528 | \u5165\u53E3\u63D0\u793A | Hints |\n|-------|----------|----------|-------|\n";
    for (const skill of group.items) {
      table += `| \`${skill.id}\` | ${truncateText(skill.description)} | ${summarizeRouteTriggers(skill.triggers, 2)} | ${buildSkillHint(skill)} |
`;
    }
    groupSections += `### ${group.title}

${table}
`;
  }
  return `
## \u7B2C\u4E09\u6B65\uFF1ASkill \u5206\u7C7B\u8DEF\u7531\uFF08\u5355\u6B21\u64CD\u4F5C\uFF09

\u6280\u80FD\u6587\u4EF6\u5DF2\u4E0B\u8F7D\u81F3 \`${skillsRootDir}/\`\u3002

> **\u4EE5\u5F53\u524D\u89C4\u5219\u6587\u4EF6\u4E2D\u7684\u6280\u80FD\u8868\u548C \`.codebuddy/install.json\` \u4E3A\u51C6\u3002** \u82E5\u76EE\u5F55\u4E2D\u540C\u65F6\u5B58\u5728\u5386\u53F2 snapshot\uFF0C\u8BF7\u53EA\u8BFB\u53D6\u8FD9\u91CC\u5217\u51FA\u7684 active root\u3002

> **Skill \u662F\u77E5\u8BC6\u6E90\uFF0C\u4E0D\u662F\u6267\u884C\u8005\u3002** \u5982\u679C\u4EFB\u52A1\u9700\u8981\u591A\u6B65\u9AA4\u81EA\u4E3B\u6D41\u7A0B\uFF0C\u8BF7\u56DE\u5230\u7B2C\u4E8C\u6B65\u4F7F\u7528 Agent\u3002

${routeTable}

\u547D\u4E2D\u67D0\u4E2A\u573A\u666F\u540E\uFF0C\u518D\u6309\u9700\u8BFB\u53D6 \`${skillsRootDir}/<\u6280\u80FDID>/SKILL.md\` \u4E0E\u76F8\u5173 \`references/\`\uFF0C\u907F\u514D\u4E00\u6B21\u6027\u52A0\u8F7D\u5168\u90E8\u6280\u80FD\u3002

## \u5DF2\u5B89\u88C5\u6280\u80FD\uFF08\u6309\u573A\u666F\u5206\u7EC4\uFF09

${groupSections}

## \u26A0\uFE0F \u4F55\u65F6\u4E0D\u9700\u8981\u52A0\u8F7D\u6280\u80FD

- \u6982\u5FF5\u6027\u95EE\u9898\uFF08"computed \u548C watch \u6709\u4EC0\u4E48\u533A\u522B?"\uFF09
- \u7B80\u5355\u8BED\u6CD5\u95EE\u9898\uFF08"Vue 3 \u600E\u4E48\u5B9A\u4E49 Props?"\uFF09
- \u901A\u7528\u6700\u4F73\u5B9E\u8DF5\u54A8\u8BE2

**\u4EC5\u5F53\u7528\u6237\u8BF7\u6C42\u6267\u884C\u5177\u4F53\u64CD\u4F5C\u65F6**\u624D\u89E6\u53D1\u6280\u80FD\u52A0\u8F7D\u3002
`;
}
function generateRuleActivationPrompt(_config) {
  let table = "| \u4EFB\u52A1\u7C7B\u578B | \u5173\u952E\u8BCD | \u91CD\u70B9\u89C4\u5219 |\n|---------|--------|--------|\n";
  table += "| \u91CD\u6784 | refactor, optimize, cleanup | Layer1 \u67B6\u6784\u89C4\u8303 + Layer3 \u91CD\u6784\u68C0\u67E5\u6E05\u5355 |\n";
  table += "| **\u8C03\u8BD5/Bug\u4FEE\u590D** | debug, fix, bugfix, \u62A5\u9519, \u6392\u67E5 | Layer3 \u8C03\u8BD5\u6E05\u5355 + **\u4E0A\u4E0B\u6587\u7BA1\u7406** + TypeScript \u7C7B\u578B\u89C4\u8303 |\n";
  table += "| \u65B0\u529F\u80FD | feature, implement, add | Layer1 \u5168\u90E8 + Layer2 UI \u5E93\u89C4\u8303 |\n";
  table += "| \u6D4B\u8BD5 | test, unit-test, e2e | Layer3 \u6D4B\u8BD5\u7B56\u7565 |\n";
  table += "| \u4EE3\u7801\u5BA1\u67E5 | review, pr | Layer3 \u81EA\u68C0\u6E05\u5355 |\n";
  table += "| **\u5927\u89C4\u6A21\u6539\u52A8** | refactor entire, \u91CD\u6784\u6A21\u5757, \u7CFB\u7EDF\u91CD\u6784 | Layer3 \u4E0A\u4E0B\u6587\u7BA1\u7406 + \u91CD\u6784\u68C0\u67E5\u6E05\u5355 |\n";
  return `
# \u{1F3AF} \u89C4\u5219\u6FC0\u6D3B\u6307\u5357

\u6839\u636E\u7528\u6237\u8BF7\u6C42\u7C7B\u578B\uFF0C\u53C2\u8003\u4EE5\u4E0B\u89C4\u5219\uFF1A

${table}

**\u91CD\u8981**: \u5F53\u9700\u8981\u67E5\u770B\u89C4\u5219\u8BE6\u60C5\u65F6\uFF0C\u4F7F\u7528 \`read_file\` \u5DE5\u5177\u8BFB\u53D6 \`.codebuddy/rules_cache/\` \u4E0B\u7684\u5BF9\u5E94\u6587\u4EF6\u3002
`;
}
function generateWorkspacePrompt(workspaceInfo) {
  if (workspaceInfo.totalProjectCount <= 1) return "";
  const { projects } = workspaceInfo;
  const scopeNote = workspaceInfo.scope === "project-targeted" && workspaceInfo.selectedProject ? `\u5F53\u524D\u4EE5 \`project-targeted\` \u6A21\u5F0F\u9501\u5B9A \`${workspaceInfo.selectedProject}\`\uFF08workspace \u603B\u8BA1 ${workspaceInfo.totalProjectCount} \u4E2A\u9879\u76EE\uFF09\u3002` : `\u5F53\u524D\u4EE5 \`workspace-union\` \u6A21\u5F0F\u805A\u5408 ${workspaceInfo.totalProjectCount} \u4E2A\u9879\u76EE\u3002`;
  let indexTable = "| \u9879\u76EE\u540D\u79F0 | \u8DEF\u5F84\u524D\u7F00 | \u8BED\u8A00 | \u6846\u67B6 | UI \u5E93 | Vue \u7248\u672C | \u89C4\u5219\u7F13\u5B58\u8DEF\u5F84 |\n";
  indexTable += "|---------|---------|------|------|-------|---------|-------------|\n";
  for (const p of projects) {
    const vueVer = p.vueProfile ? `v${p.vueProfile.version}` : "-";
    const uiLibs = p.uiLibLabels.length > 0 ? p.uiLibLabels.join(", ") : "-";
    const cachePath = p.relativePath === "." ? "`.codebuddy/rules_cache/layer2_business/`" : `\`.codebuddy/rules_cache/projects/${p.relativePath}/layer2_business/\``;
    indexTable += `| ${p.name} | \`${p.relativePath}/\` | ${p.lang} | ${p.frameworkLabel || "-"} | ${uiLibs} | ${vueVer} | ${cachePath} |
`;
  }
  const sortedProjects = [...projects].filter((p) => p.relativePath !== ".").sort((a, b) => b.relativePath.length - a.relativePath.length);
  let routingRules = "";
  for (const p of sortedProjects) {
    const label = [p.lang, p.frameworkLabel, ...p.uiLibLabels].filter(Boolean).join(" + ") || "\u901A\u7528";
    routingRules += `\u251C\u2500 \u8DEF\u5F84\u4EE5 \`${p.relativePath}/\` \u5F00\u5934\uFF1F \u2192 \u5E94\u7528 **${p.name}** \u7684\u89C4\u5219\uFF08${label}\uFF09
`;
  }
  const rootProject = projects.find((p) => p.relativePath === ".");
  if (rootProject) {
    const rootLabel = [rootProject.frameworkLabel, ...rootProject.uiLibLabels].filter(Boolean).join(" + ") || "\u901A\u7528";
    routingRules += `\u2514\u2500 \u5176\u4ED6\u8DEF\u5F84 \u2192 \u5E94\u7528 **${rootProject.name}** \u6839\u9879\u76EE\u89C4\u5219\uFF08${rootLabel}\uFF09
`;
  } else {
    routingRules += `\u2514\u2500 \u5176\u4ED6\u8DEF\u5F84 \u2192 \u4F7F\u7528\u901A\u7528\u89C4\u5219\uFF08\u65E0\u6839\u9879\u76EE package.json\uFF09
`;
  }
  const exampleProject = sortedProjects[0];
  let routingExample = "";
  if (exampleProject) {
    routingExample = `
### \u8DEF\u7531\u793A\u4F8B

\u5F53\u7528\u6237\u7F16\u8F91 \`${exampleProject.relativePath}/src/App.vue\` \u65F6\uFF1A

1. \u83B7\u53D6\u6587\u4EF6\u76F8\u5BF9\u8DEF\u5F84\uFF1A\`${exampleProject.relativePath}/src/App.vue\`
2. \u5339\u914D\u8DEF\u5F84\u524D\u7F00\uFF1A\`${exampleProject.relativePath}/\` \u2192 **${exampleProject.name}**
3. \u52A0\u8F7D\u5BF9\u5E94 Layer2 \u89C4\u5219\u7F13\u5B58\uFF1A\`.codebuddy/rules_cache/projects/${exampleProject.relativePath}/layer2_business/\`
4. \u5E94\u7528\u6280\u672F\u6808\u7EA6\u5B9A\uFF1A${exampleProject.frameworkLabel || "\u901A\u7528"}${exampleProject.uiLibLabels.length > 0 ? " + " + exampleProject.uiLibLabels.join(" + ") : ""}
`;
  }
  const hasVue2 = projects.some((p) => p.vueProfile?.version === 2);
  const hasVue3 = projects.some((p) => p.vueProfile?.version === 3);
  let mixWarning = "";
  if (hasVue2 && hasVue3) {
    mixWarning = `
### \u26A0\uFE0F \u8DE8\u9879\u76EE\u6280\u672F\u6808\u9694\u79BB\u8B66\u544A

\u672C Workspace \u540C\u65F6\u5305\u542B Vue 2 \u548C Vue 3 \u9879\u76EE\uFF0C**\u4E25\u7981\u6DF7\u7528**\uFF1A

- **Vue 2 \u9879\u76EE**\u7981\u6B62\u4F7F\u7528\uFF1A\`<script setup>\`\u3001\`defineProps()\`\u3001\`defineEmits()\`
- **Vue 3 \u9879\u76EE**\u7981\u6B62\u4F7F\u7528\uFF1AOptions API\uFF08\`data()\`\u3001\`methods\`\u3001\`computed\`\uFF09\u3001\`this.$refs\`
- \u7F16\u8F91\u6587\u4EF6\u524D**\u5FC5\u987B**\u5148\u786E\u8BA4\u6240\u5C5E\u9879\u76EE\uFF0C\u518D\u5E94\u7528\u5BF9\u5E94\u7248\u672C\u7684\u89C4\u8303
`;
  }
  let projectList = "";
  for (const p of projects) {
    const techStack = [p.frameworkLabel, ...p.uiLibLabels].filter(Boolean).join(" + ") || "-";
    const shortName = p.relativePath === "." ? "\u6839\u9879\u76EE" : p.relativePath.split("/").pop();
    const aliases = [p.name, shortName, p.relativePath].filter((v, i, a) => a.indexOf(v) === i);
    projectList += `| **${p.name}** | \`${p.relativePath}\` | ${p.lang} | ${techStack} | ${aliases.map((a) => `\`${a}\``).join(", ")} |
`;
  }
  return `
# \u{1F3E2} Workspace \u591A\u9879\u76EE\u8DEF\u7531

\u672C\u76EE\u5F55\u4E3A **Workspace \u6A21\u5F0F**\uFF0C\u5305\u542B ${projects.length} \u4E2A\u5B50\u9879\u76EE\u3002\u7F16\u8F91\u6587\u4EF6\u65F6\u5FC5\u987B\u5148\u5224\u65AD\u6240\u5C5E\u9879\u76EE\uFF0C\u518D\u5E94\u7528\u5BF9\u5E94\u89C4\u5219\u3002

> ${scopeNote}

## \u{1F3AF} \u5FEB\u6377\u9879\u76EE\u5B9A\u4F4D

\u5728\u5BF9\u8BDD\u6D88\u606F\u4E2D\u4F7F\u7528 \`@project <\u540D\u79F0>\` \u53EF\u5FEB\u901F\u9501\u5B9A\u5F53\u524D\u64CD\u4F5C\u7684\u76EE\u6807\u9879\u76EE\uFF0C\u540E\u7EED\u64CD\u4F5C\u5C06\u81EA\u52A8\u5E94\u7528\u8BE5\u9879\u76EE\u7684\u6280\u672F\u6808\u89C4\u5219\u3002

### \u7528\u6CD5

\`\`\`
@project <\u9879\u76EE\u540D\u79F0|\u8DEF\u5F84\u524D\u7F00|\u522B\u540D>
<\u4F60\u7684\u9700\u6C42\u63CF\u8FF0>
\`\`\`

### \u793A\u4F8B

\`\`\`
@project ${sortedProjects[0]?.name || projects[0].name}
\u5E2E\u6211\u6DFB\u52A0\u4E00\u4E2A\u65B0\u7684\u5217\u8868\u9875

@project ${projects.length > 1 ? projects[1].name : projects[0].name}
\u68C0\u67E5\u767B\u5F55\u903B\u8F91\u6709\u6CA1\u6709\u95EE\u9898
\`\`\`

### \u53EF\u7528\u9879\u76EE\u5217\u8868

| \u9879\u76EE\u540D\u79F0 | \u8DEF\u5F84 | \u8BED\u8A00 | \u6846\u67B6 | \u53EF\u7528\u522B\u540D |
|---------|------|------|------|---------|
${projectList}

### \u5339\u914D\u89C4\u5219

1. **\u7CBE\u786E\u5339\u914D**\uFF1A\u4F18\u5148\u5339\u914D\u9879\u76EE\u540D\u79F0\u6216\u8DEF\u5F84\u524D\u7F00
2. **\u6A21\u7CCA\u5339\u914D**\uFF1A\u8F93\u5165\u7684\u540D\u79F0\u662F\u9879\u76EE\u540D/\u8DEF\u5F84\u7684\u5B50\u4E32\u65F6\u81EA\u52A8\u5339\u914D\uFF08\u5982 \`@project mobile\` \u53EF\u5339\u914D \`app-mobile\`\uFF09
3. **\u6B67\u4E49\u5904\u7406**\uFF1A\u5982\u679C\u5339\u914D\u5230\u591A\u4E2A\u9879\u76EE\uFF0C\u8BF7\u4F7F\u7528\u66F4\u5177\u4F53\u7684\u540D\u79F0\u6216\u5B8C\u6574\u8DEF\u5F84

### \u884C\u4E3A\u7EA6\u5B9A

- \u6307\u5B9A \`@project\` \u540E\uFF0C**\u672C\u8F6E\u5BF9\u8BDD**\u4E2D\u6240\u6709\u6587\u4EF6\u64CD\u4F5C\u9ED8\u8BA4\u9650\u5B9A\u5728\u8BE5\u9879\u76EE\u76EE\u5F55\u4E0B
- \u5F15\u7528\u6587\u4EF6\u8DEF\u5F84\u65F6\u81EA\u52A8\u8865\u5168\u9879\u76EE\u8DEF\u5F84\u524D\u7F00
- \u5E94\u7528\u8BE5\u9879\u76EE\u5BF9\u5E94\u7684 Layer2 \u89C4\u5219\u7F13\u5B58
- \u672A\u6307\u5B9A \`@project\` \u65F6\uFF0C\u6309\u6587\u4EF6\u8DEF\u5F84\u81EA\u52A8\u8DEF\u7531\uFF08\u89C1\u4E0B\u65B9\u8DEF\u7531\u89C4\u5219\uFF09

## \u9879\u76EE\u7D22\u5F15

${indexTable}

## \u8DEF\u5F84\u8DEF\u7531\u89C4\u5219

\u83B7\u53D6\u5F53\u524D\u64CD\u4F5C\u6587\u4EF6\u76F8\u5BF9\u4E8E Workspace \u6839\u76EE\u5F55\u7684\u8DEF\u5F84\uFF0C\u6309\u4EE5\u4E0B\u89C4\u5219\u4ECE\u4E0A\u5230\u4E0B\u5339\u914D\uFF08\u6700\u5177\u4F53\u7684\u8DEF\u5F84\u4F18\u5148\uFF09\uFF1A

\`\`\`
${routingRules}\`\`\`

### \u8DEF\u7531\u5224\u5B9A\u6B65\u9AA4

1. \u83B7\u53D6\u5F53\u524D\u6587\u4EF6\u76F8\u5BF9\u4E8E Workspace \u6839\u76EE\u5F55\u7684\u8DEF\u5F84
2. \u6309\u8DEF\u5F84\u524D\u7F00\u4ECE\u4E0A\u5230\u4E0B\u5339\u914D\uFF08\u6700\u957F\u5339\u914D\u4F18\u5148\uFF09
3. \u52A0\u8F7D\u5339\u914D\u9879\u76EE\u7684 Layer2 \u89C4\u5219\u7F13\u5B58
4. \u5E94\u7528\u5BF9\u5E94\u6280\u672F\u6808\u7684\u7F16\u7801\u7EA6\u5B9A
${routingExample}${mixWarning}
**\u91CD\u8981**: \u6BCF\u4E2A\u5B50\u9879\u76EE\u7684 Layer2 \u89C4\u5219\u7F13\u5B58\u72EC\u7ACB\u5B58\u653E\u5728 \`.codebuddy/rules_cache/projects/{\u9879\u76EE\u8DEF\u5F84}/layer2_business/\` \u4E0B\u3002
`;
}

// scripts/src/codebuddy-loader.ts
var SCRIPT_DIR = __dirname;
var PROJECT_ROOT = path5.resolve(SCRIPT_DIR, "../..");
var PACKAGE_JSON_PATH = path5.join(PROJECT_ROOT, "package.json");
var RULES_ROOT = path5.join(PROJECT_ROOT, "rules");
var CONFIG_PATH = path5.join(PROJECT_ROOT, "config", "loader-config.json");
var SKILLS_ROOT = path5.join(PROJECT_ROOT, "custom-skills");
var AGENTS_ROOT = path5.join(PROJECT_ROOT, "agents");
var DEFAULT_TIMEOUT = 1e4;
var DEFAULT_THRESHOLD = 0.5;
var DEFAULT_RULE_LEVEL = "full";
var DEFAULT_PROFILE = "analysis";
var INSTALL_STATE_SCHEMA_VERSION = "1.2.0";
var SKILL_SNAPSHOT_RETAIN_COUNT = 3;
var AGENT_SNAPSHOT_RETAIN_COUNT = 3;
var COMMANDS = /* @__PURE__ */ new Set(["install", "status", "doctor"]);
var INSTALL_PROFILES = ["core", "analysis", "orchestrator", "full"];
var WORKSPACE_SCOPES = ["workspace-union", "project-targeted"];
var SKILL_ROLES = ["frontend", "backend", "fullstack", "qa", "architect", "product", "devops"];
var LOADER_DISPLAY_VERSION = "v3.3.0";
function showHelp() {
  console.log(`
\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
\u2551     CodeBuddy \u89C4\u5219\u52A0\u8F7D\u5668 ${LOADER_DISPLAY_VERSION} - \u4E09\u5C42\u67B6\u6784 + \u6280\u80FD\u7CFB\u7EDF        \u2551
\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D

\u7528\u6CD5\uFF1A
  node codebuddy-loader.js [command] [options]

\u547D\u4EE4\uFF1A
  install              \u5B89\u88C5/\u540C\u6B65 CodeBuddy \u89C4\u5219\u548C\u8FD0\u884C\u65F6\uFF08\u9ED8\u8BA4\uFF09
  status               \u663E\u793A\u5F53\u524D\u9879\u76EE\u7684 CodeBuddy \u5B89\u88C5\u72B6\u6001
  doctor               \u8BCA\u65AD\u5F53\u524D\u9879\u76EE\u7684 CodeBuddy \u5B89\u88C5\u95EE\u9898

\u9009\u9879\uFF1A
  --help, -h           \u663E\u793A\u5E2E\u52A9\u4FE1\u606F
  --json               status / doctor \u8F93\u51FA JSON
  --remote <URL>       \u4ECE\u8FDC\u7A0B URL \u83B7\u53D6\u89C4\u5219
  --remote-bearer-token <token>
                       \u8FDC\u7A0B\u8BF7\u6C42\u9644\u5E26 Bearer Token\uFF08\u4E5F\u652F\u6301\u73AF\u5883\u53D8\u91CF CODEBUDDY_REMOTE_BEARER_TOKEN\uFF09
  --pack-only          \u8FDC\u7A0B\u6A21\u5F0F\u53EA\u5141\u8BB8\u4F7F\u7528 manifest.packs \u5185\u5BB9\u5305\uFF0C\u4E0D\u56DE\u9000\u9010\u6587\u4EF6\u62C9\u53D6
  --strict-pack-only   --pack-only \u7684\u517C\u5BB9\u522B\u540D
  --task <type>        \u6309\u4EFB\u52A1\u7C7B\u578B\u7B5B\u9009\u89C4\u5219\uFF08\u6E10\u8FDB\u5F0F\u62AB\u9732\uFF09
                       \u7C7B\u578B: refactoring, debugging, testing, new-feature, code-review
  --threshold <n>      \u8BBE\u7F6E\u76F8\u5173\u6027\u9608\u503C (0-1, \u9ED8\u8BA4: 0.5)
  --rule-level <lvl>   \u89C4\u5219\u5185\u5BB9\u88C1\u526A\u7B49\u7EA7\uFF08\u57FA\u4E8E @level:summary/quick/full \u5206\u6BB5\u6807\u8BB0\uFF0C\u9ED8\u8BA4: full\uFF09
  --profile <name>     \u5206\u53D1\u6863\u4F4D: core | analysis | orchestrator | full\uFF08\u9ED8\u8BA4: analysis\uFF09
  --enable-orchestrator \u517C\u5BB9\u65E7\u53C2\u6570\uFF0C\u7B49\u4EF7\u4E8E\u65E7\u7248\u5B8C\u6574\u5206\u53D1\uFF08\u5373 --profile full\uFF09
  --no-workspace       \u7981\u7528 workspace \u591A\u9879\u76EE\u81EA\u52A8\u53D1\u73B0
  --workspace-scope <scope>
                       Workspace \u5206\u53D1\u8303\u56F4: workspace-union | project-targeted\uFF08\u9ED8\u8BA4: workspace-union\uFF09
  --project <selector> project-targeted \u6A21\u5F0F\u4E0B\u9501\u5B9A\u76EE\u6807\u9879\u76EE\uFF08\u540D\u79F0/\u8DEF\u5F84/\u76EE\u5F55\u522B\u540D\uFF09
  --role <role>        \u6309\u5C97\u4F4D\u8FC7\u6EE4\u6280\u80FD: frontend | backend | fullstack | qa | architect | product | devops
  --verbose, -v        \u542F\u7528\u8BE6\u7EC6\u65E5\u5FD7
  --timeout <ms>       \u8BBE\u7F6E\u7F51\u7EDC\u8BF7\u6C42\u8D85\u65F6\uFF08\u9ED8\u8BA4: 10000ms\uFF09

\u4EFB\u52A1\u7C7B\u578B\uFF1A
  refactoring          \u4EE3\u7801\u91CD\u6784\u3001\u4F18\u5316\u3001\u6280\u672F\u503A\u52A1\u6E05\u7406
  debugging            Bug \u4FEE\u590D\u3001\u95EE\u9898\u6392\u67E5\u3001\u9519\u8BEF\u5904\u7406
  testing              \u7F16\u5199\u6D4B\u8BD5\u3001\u6D4B\u8BD5\u7B56\u7565\u3001\u8986\u76D6\u7387
  new-feature          \u5F00\u53D1\u65B0\u529F\u80FD\u3001\u6DFB\u52A0\u65B0\u7279\u6027
  code-review          \u4EE3\u7801\u5BA1\u67E5\u3001PR \u5BA1\u6838

\u793A\u4F8B\uFF1A
  # \u52A0\u8F7D\u6240\u6709\u89C4\u5219\uFF08\u9ED8\u8BA4\uFF09
  node codebuddy-loader.js

  # \u67E5\u770B\u5F53\u524D\u9879\u76EE\u5B89\u88C5\u72B6\u6001
  node codebuddy-loader.js status

  # \u8BCA\u65AD\u5B89\u88C5\u95EE\u9898\uFF08JSON \u8F93\u51FA\uFF09
  node codebuddy-loader.js doctor --json

  # \u4EC5\u52A0\u8F7D\u91CD\u6784\u76F8\u5173\u89C4\u5219
  node codebuddy-loader.js --task refactoring

  # \u53EA\u5B89\u88C5\u6700\u5C0F\u8FD0\u884C\u65F6
  node codebuddy-loader.js --profile core

  # \u5B89\u88C5\u5B8C\u6574\u8FD0\u884C\u65F6
  node codebuddy-loader.js --profile full

  # Workspace \u5171\u4EAB\u5B89\u88C5
  node codebuddy-loader.js --workspace-scope workspace-union

  # Workspace \u9501\u5B9A\u67D0\u4E2A\u5B50\u9879\u76EE
  node codebuddy-loader.js --workspace-scope project-targeted --project packages/api

  # \u4EC5\u5B89\u88C5\u540E\u7AEF\u5C97\u4F4D\u76F8\u5173\u6280\u80FD
  node codebuddy-loader.js --role backend

  # \u4ECE\u8FDC\u7A0B\u52A0\u8F7D
  node codebuddy-loader.js --remote https://example.com/standards

  # \u4ECE\u53D7\u4FDD\u62A4\u8FDC\u7A0B\u6E90\u52A0\u8F7D\u5E76\u5F3A\u5236\u4F7F\u7528\u5185\u5BB9\u5305
  node codebuddy-loader.js --remote https://example.com/standards --pack-only --remote-bearer-token YOUR_TOKEN

\u8F93\u51FA\uFF1A
  \u5728\u5F53\u524D\u5DE5\u4F5C\u76EE\u5F55\u751F\u6210 .codebuddy/rules/project-rules.md
`);
  process.exit(0);
}
async function loadConfig(ctx, logger) {
  if (ctx.isRemote) {
    try {
      const manifestUrl = `${ctx.remoteBaseUrl}/manifest.json`;
      logger.log(`\u6B63\u5728\u4ECE\u8FDC\u7A0B\u52A0\u8F7D\u914D\u7F6E: ${manifestUrl}`);
      const data = await fetchUrl(ctx, logger, manifestUrl);
      const manifest = JSON.parse(data);
      logger.verbose(`Manifest \u52A0\u8F7D\u6210\u529F. Version: ${manifest.version}`);
      return { config: manifest.config, manifest };
    } catch (e) {
      logger.error(`\u8FDC\u7A0B manifest \u52A0\u8F7D\u5931\u8D25: ${e.message}`);
      process.exit(1);
    }
  } else {
    if (!fs5.existsSync(CONFIG_PATH)) {
      logger.error(`\u914D\u7F6E\u6587\u4EF6\u4E0D\u5B58\u5728: ${CONFIG_PATH}`);
      process.exit(1);
    }
    logger.verbose(`\u52A0\u8F7D\u672C\u5730\u914D\u7F6E: ${CONFIG_PATH}`);
    return { config: JSON.parse(fs5.readFileSync(CONFIG_PATH, "utf-8")), manifest: null };
  }
}
function getPackageJson(logger, targetDir) {
  const pkgPath = path5.join(targetDir, "package.json");
  if (!fs5.existsSync(pkgPath)) {
    logger.warn(`\u672A\u627E\u5230 package.json: ${pkgPath}`);
    return {};
  }
  try {
    return JSON.parse(fs5.readFileSync(pkgPath, "utf-8"));
  } catch (e) {
    logger.error(`\u89E3\u6790 package.json \u5931\u8D25: ${e.message}`);
    return {};
  }
}
function getLoaderVersion(ctx, logger) {
  if (ctx.remoteManifest?.version) {
    return ctx.remoteManifest.version;
  }
  if (!fs5.existsSync(PACKAGE_JSON_PATH)) {
    logger.warn(`\u672A\u627E\u5230 loader package.json: ${PACKAGE_JSON_PATH}`);
    return "0.0.0";
  }
  try {
    const pkg = JSON.parse(fs5.readFileSync(PACKAGE_JSON_PATH, "utf-8"));
    return pkg.version || "0.0.0";
  } catch (error) {
    logger.warn(`\u8BFB\u53D6 loader package.json \u5931\u8D25: ${error.message}`);
    return "0.0.0";
  }
}
function createInstallSnapshotId() {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const entropy = (0, import_crypto3.createHash)("sha256").update(`${process.pid}-${Math.random()}-${Date.now()}`).digest("hex").slice(0, 8);
  return `${timestamp}-${entropy}`;
}
function buildSnapshotSortKey(name, absolutePath) {
  if (/^\d{8}T\d{6}Z-[a-f0-9]+$/i.test(name)) {
    return `0-${name}`;
  }
  try {
    const stat = fs5.statSync(absolutePath);
    return `1-${String(Math.trunc(stat.mtimeMs)).padStart(16, "0")}-${name}`;
  } catch {
    return `2-${name}`;
  }
}
function listSnapshotEntries(targetDir, snapshotRootDir) {
  const snapshotsRoot = path5.join(targetDir, snapshotRootDir);
  if (!fs5.existsSync(snapshotsRoot)) {
    return [];
  }
  return fs5.readdirSync(snapshotsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => {
    const absolutePath = path5.join(snapshotsRoot, entry.name);
    return {
      name: entry.name,
      absolutePath,
      relativePath: toProjectRelativePath(targetDir, absolutePath),
      sortKey: buildSnapshotSortKey(entry.name, absolutePath)
    };
  }).sort((left, right) => right.sortKey.localeCompare(left.sortKey));
}
function gcSnapshotEntries(targetDir, snapshotRootDir, activeRootDir, retainCount, logger) {
  if (!activeRootDir) {
    return [];
  }
  const normalizedRetainCount = Math.max(1, retainCount);
  const entries = listSnapshotEntries(targetDir, snapshotRootDir);
  if (entries.length <= normalizedRetainCount) {
    return [];
  }
  const keep = /* @__PURE__ */ new Set();
  const activeEntry = entries.find((entry) => entry.relativePath === activeRootDir);
  if (activeEntry) {
    keep.add(activeEntry.relativePath);
  } else {
    keep.add(activeRootDir);
  }
  for (const entry of entries) {
    if (keep.has(entry.relativePath)) {
      continue;
    }
    keep.add(entry.relativePath);
    if (keep.size >= normalizedRetainCount) {
      break;
    }
  }
  const removed = [];
  for (const entry of entries) {
    if (keep.has(entry.relativePath)) {
      continue;
    }
    try {
      if (removeManagedPath(targetDir, entry.absolutePath)) {
        removed.push(entry.relativePath);
      }
    } catch (error) {
      logger.warn(`\u6E05\u7406\u65E7\u6280\u80FD\u5FEB\u7167\u5931\u8D25: ${entry.relativePath} - ${error.message}`);
    }
  }
  return removed.sort();
}
function buildInstallState(params) {
  const {
    ctx,
    logger,
    targetDir,
    outputPath,
    workspaceIndexPath,
    skillsRootDir,
    skillsSnapshotRetention,
    agentsRootDir,
    agentsSnapshotRetention,
    layer1RulesCount,
    layer2IndexCount,
    layer3IndexCount,
    skillsCount,
    agentsCount,
    distributedScripts,
    distributedWorkflows,
    distributedTaskBooks,
    distributedAgentCalls,
    distributedCommands,
    managedFiles,
    workspaceInfo
  } = params;
  const version = getLoaderVersion(ctx, logger);
  const installedAt = (/* @__PURE__ */ new Date()).toISOString();
  const profile = ctx.profile;
  const mode = ctx.isRemote ? "remote" : "local";
  const rulesFile = toProjectRelativePath(targetDir, outputPath);
  const workspaceIndexFile = workspaceIndexPath ? toProjectRelativePath(targetDir, workspaceIndexPath) : null;
  const normalizedManagedFiles = managedFiles.map((file) => ({ path: file.path, sha256: file.sha256, size: file.size })).sort((left, right) => left.path.localeCompare(right.path));
  const stableManagedFiles = normalizedManagedFiles.filter((file) => file.path !== rulesFile && file.path !== workspaceIndexFile);
  const hashPayload = {
    version,
    mode,
    profile,
    enableOrchestrator: ctx.enableOrchestrator,
    source: {
      remoteBaseUrl: ctx.isRemote ? ctx.remoteBaseUrl : null,
      manifestVersion: ctx.remoteManifest?.version || null,
      contentPackFile: ctx.remoteContentPack?.file || null,
      contentPackFormat: ctx.remoteContentPack?.format || null,
      contentPackSha256: ctx.remoteContentPack?.sha256 || null
    },
    options: {
      taskType: ctx.taskType,
      ruleLevel: ctx.ruleLevel,
      strictRemotePack: ctx.strictRemotePack,
      relevanceThreshold: ctx.relevanceThreshold,
      workspaceDiscovery: !ctx.disableWorkspace,
      workspaceScope: ctx.workspaceScope,
      targetProject: ctx.targetProject,
      targetRole: ctx.targetRole
    },
    outputs: {
      rulesFile,
      workspaceIndexFile,
      skillsRootDir,
      skillsSnapshotRetention,
      agentsRootDir,
      agentsSnapshotRetention
    },
    managedFiles: stableManagedFiles,
    stats: {
      layer1Rules: layer1RulesCount,
      layer2Indexes: layer2IndexCount,
      layer3Indexes: layer3IndexCount,
      skills: skillsCount,
      agents: agentsCount,
      scripts: distributedScripts.slice().sort(),
      workflows: distributedWorkflows.slice().sort(),
      taskbooks: distributedTaskBooks.slice().sort(),
      agentCalls: distributedAgentCalls.slice().sort(),
      commands: distributedCommands.slice().sort(),
      workspaceProjects: workspaceInfo.projects.map((project) => project.relativePath).sort()
    }
  };
  const contentHash = (0, import_crypto3.createHash)("sha256").update(JSON.stringify(hashPayload)).digest("hex");
  return {
    schemaVersion: INSTALL_STATE_SCHEMA_VERSION,
    version,
    installedAt,
    mode,
    profile,
    enableOrchestrator: ctx.enableOrchestrator,
    contentHash,
    source: {
      remoteBaseUrl: ctx.isRemote ? ctx.remoteBaseUrl : null,
      manifestVersion: ctx.remoteManifest?.version || null,
      contentPackFile: ctx.remoteContentPack?.file || null,
      contentPackFormat: ctx.remoteContentPack?.format || null,
      contentPackSha256: ctx.remoteContentPack?.sha256 || null
    },
    options: {
      taskType: ctx.taskType,
      ruleLevel: ctx.ruleLevel,
      strictRemotePack: ctx.strictRemotePack,
      relevanceThreshold: ctx.relevanceThreshold,
      workspaceDiscovery: !ctx.disableWorkspace,
      workspaceScope: ctx.workspaceScope,
      targetProject: ctx.targetProject,
      targetRole: ctx.targetRole
    },
    outputs: {
      rulesFile,
      workspaceIndexFile,
      skillsRootDir,
      skillsSnapshotRetention,
      agentsRootDir,
      agentsSnapshotRetention
    },
    managedFiles: normalizedManagedFiles,
    stats: {
      layer1Rules: layer1RulesCount,
      layer2Indexes: layer2IndexCount,
      layer3Indexes: layer3IndexCount,
      skills: skillsCount,
      agents: agentsCount,
      scripts: distributedScripts.length,
      workflows: distributedWorkflows.length,
      taskbooks: distributedTaskBooks.length,
      agentCalls: distributedAgentCalls.length,
      commands: distributedCommands.length,
      workspaceProjects: workspaceInfo.projects.length
    }
  };
}
function writeInstallState(targetDir, installState) {
  const installStatePath = path5.join(targetDir, ".codebuddy", "install.json");
  const installStateDir = path5.dirname(installStatePath);
  if (!fs5.existsSync(installStateDir)) {
    fs5.mkdirSync(installStateDir, { recursive: true });
  }
  fs5.writeFileSync(installStatePath, JSON.stringify(installState, null, 2), "utf-8");
  return installStatePath;
}
function checkVueProfile(dependencies) {
  const vueVersion = dependencies["vue"];
  if (!vueVersion) return null;
  if (vueVersion.startsWith("3") || vueVersion.startsWith("^3") || vueVersion.startsWith("~3")) {
    return { version: 3, type: "standard" };
  }
  if (vueVersion.startsWith("2") || vueVersion.startsWith("^2") || vueVersion.startsWith("~2")) {
    if (dependencies["@vue/composition-api"]) {
      return { version: 2, type: "composition" };
    }
    return { version: 2, type: "options" };
  }
  return null;
}
var WORKSPACE_EXCLUDE_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  "dist",
  "build",
  ".codebuddy",
  ".git",
  "coverage",
  ".next",
  ".nuxt",
  ".output",
  ".cache"
]);
var MAX_SUB_PROJECTS = 20;
var PROJECT_MARKERS = [
  {
    files: ["package.json"],
    lang: "javascript",
    refinements: [
      { files: ["tsconfig.json"], lang: "typescript" }
    ]
  },
  { files: ["pom.xml"], lang: "java" },
  { files: ["build.gradle", "build.gradle.kts"], lang: "java" },
  { files: ["go.mod"], lang: "go" },
  { files: ["pyproject.toml", "setup.py"], lang: "python" },
  { files: ["Cargo.toml"], lang: "rust" }
  // .NET: *.csproj 通过单独逻辑检测（通配符）
];
var KNOWN_UI_LIBS = {
  "ant-design-vue": "Ant Design Vue",
  "vant": "Vant",
  "element-plus": "Element Plus",
  "element-ui": "Element UI",
  "naive-ui": "Naive UI",
  "vuetify": "Vuetify",
  "@arco-design/web-vue": "Arco Design Vue",
  "antd": "Ant Design",
  "@mui/material": "MUI"
};
function detectUILibs(deps) {
  const result = [];
  for (const [pkg, label] of Object.entries(KNOWN_UI_LIBS)) {
    if (deps[pkg]) {
      result.push(label);
    }
  }
  return result;
}
function normalizeStackTag(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function finalizeStackTags(values) {
  return [...new Set([...values].map(normalizeStackTag).filter(Boolean))].sort();
}
function readProjectFileIfExists(filePath) {
  try {
    return fs5.existsSync(filePath) ? fs5.readFileSync(filePath, "utf-8") : "";
  } catch {
    return "";
  }
}
function detectNodePackageManagers(projectDir) {
  const markers = [
    { file: "pnpm-lock.yaml", tag: "pnpm" },
    { file: "yarn.lock", tag: "yarn" },
    { file: "package-lock.json", tag: "npm" },
    { file: "bun.lockb", tag: "bun" },
    { file: "bun.lock", tag: "bun" }
  ];
  return markers.filter((marker) => fs5.existsSync(path5.join(projectDir, marker.file))).map((marker) => marker.tag);
}
var NODE_BACKEND_STRONG_ENTRY_FILES = [
  "src/server.ts",
  "src/server.js",
  "src/server.mjs",
  "src/server.cjs",
  "server.ts",
  "server.js",
  "server.mjs",
  "server.cjs"
];
var NODE_BACKEND_WEAK_ENTRY_FILES = [
  "src/main.ts",
  "src/main.js",
  "src/app.ts",
  "src/app.js",
  "main.ts",
  "main.js",
  "app.ts",
  "app.js",
  "index.ts",
  "index.js"
];
var NODE_BACKEND_LAYOUT_DIRS = [
  "src/routes",
  "src/controllers",
  "src/middleware",
  "src/handlers",
  "src/api",
  "routes",
  "controllers",
  "middleware",
  "handlers",
  "api"
];
function detectGenericNodeBackendProject(projectDir, packageJson) {
  const scripts = packageJson.scripts || {};
  const scriptValues = Object.values(scripts).filter((value) => typeof value === "string");
  const hasBackendScript = scriptValues.some(
    (command) => /(node|nodemon|tsx|ts-node|ts-node-dev|bun|pm2)/i.test(command) && /(server|api|listen|http)/i.test(command)
  );
  for (const relativePath of NODE_BACKEND_STRONG_ENTRY_FILES) {
    if (fs5.existsSync(path5.join(projectDir, relativePath))) {
      return true;
    }
  }
  for (const relativePath of NODE_BACKEND_WEAK_ENTRY_FILES) {
    const absolutePath = path5.join(projectDir, relativePath);
    if (!fs5.existsSync(absolutePath)) {
      continue;
    }
    const content = readProjectFileIfExists(absolutePath);
    if (/(createServer|listen\s*\(|process\.env\.PORT|IncomingMessage|ServerResponse)/.test(content)) {
      return true;
    }
  }
  const layoutClues = NODE_BACKEND_LAYOUT_DIRS.filter(
    (relativePath) => fs5.existsSync(path5.join(projectDir, relativePath))
  ).length;
  if (layoutClues >= 2) {
    return true;
  }
  return hasBackendScript && layoutClues >= 1;
}
function detectJavaProjectMetadata(projectDir) {
  const pomContent = readProjectFileIfExists(path5.join(projectDir, "pom.xml"));
  const gradleContent = readProjectFileIfExists(path5.join(projectDir, "build.gradle")) || readProjectFileIfExists(path5.join(projectDir, "build.gradle.kts"));
  const combinedContent = `${pomContent}
${gradleContent}`.toLowerCase();
  const stackTags = /* @__PURE__ */ new Set(["java"]);
  if (pomContent) stackTags.add("maven");
  if (gradleContent) stackTags.add("gradle");
  let frameworkLabel = "";
  let projectKind = "library";
  if (/org\.springframework\.boot|spring-boot/.test(combinedContent)) {
    frameworkLabel = "Spring Boot";
    projectKind = "backend";
    stackTags.add("springboot");
    stackTags.add("spring");
  } else if (/io\.quarkus|quarkus/.test(combinedContent)) {
    frameworkLabel = "Quarkus";
    projectKind = "backend";
    stackTags.add("quarkus");
  } else if (/io\.micronaut|micronaut/.test(combinedContent)) {
    frameworkLabel = "Micronaut";
    projectKind = "backend";
    stackTags.add("micronaut");
  } else if (/jakarta\.ws\.rs|javax\.ws\.rs/.test(combinedContent)) {
    frameworkLabel = "Jakarta REST";
    projectKind = "backend";
    stackTags.add("jakartarest");
  }
  if (/spring-data-jpa|starter-data-jpa|hibernate-core|jakarta\.persistence|javax\.persistence/.test(combinedContent)) {
    stackTags.add("jpa");
  }
  if (/mybatis/.test(combinedContent)) {
    stackTags.add("mybatis");
  }
  return {
    frameworkLabel,
    uiLibLabels: [],
    projectKind,
    stackTags: finalizeStackTags(stackTags)
  };
}
function detectRustProjectMetadata(projectDir) {
  const cargoContent = readProjectFileIfExists(path5.join(projectDir, "Cargo.toml"));
  const normalizedContent = cargoContent.toLowerCase();
  const stackTags = /* @__PURE__ */ new Set(["rust", "cargo"]);
  let frameworkLabel = "";
  let projectKind = "library";
  if (/\baxum\b/.test(normalizedContent)) {
    frameworkLabel = "Axum";
    projectKind = "backend";
    stackTags.add("axum");
  } else if (/actix-web/.test(normalizedContent)) {
    frameworkLabel = "Actix Web";
    projectKind = "backend";
    stackTags.add("actixweb");
  } else if (/\brocket\b/.test(normalizedContent)) {
    frameworkLabel = "Rocket";
    projectKind = "backend";
    stackTags.add("rocket");
  } else if (/\btonic\b/.test(normalizedContent)) {
    frameworkLabel = "Tonic";
    projectKind = "backend";
    stackTags.add("tonic");
  }
  if (/\btokio\b/.test(normalizedContent)) stackTags.add("tokio");
  if (/\bserde\b/.test(normalizedContent)) stackTags.add("serde");
  if (/^\s*\[workspace\]/m.test(cargoContent)) stackTags.add("cargoworkspace");
  return {
    frameworkLabel,
    uiLibLabels: [],
    projectKind,
    stackTags: finalizeStackTags(stackTags)
  };
}
function detectDotnetProjectMetadata(projectDir) {
  const projectFiles = fs5.readdirSync(projectDir).filter((entry) => entry.endsWith(".csproj") || entry.endsWith(".fsproj"));
  const combinedContent = projectFiles.map((file) => readProjectFileIfExists(path5.join(projectDir, file))).join("\n").toLowerCase();
  const stackTags = /* @__PURE__ */ new Set(["dotnet"]);
  let frameworkLabel = "";
  let projectKind = "library";
  if (/microsoft\.aspnetcore|aspnetcore/.test(combinedContent)) {
    frameworkLabel = "ASP.NET Core";
    projectKind = "backend";
    stackTags.add("aspnetcore");
  } else if (/microsoft\.aspnetcore\.components|blazor/.test(combinedContent)) {
    frameworkLabel = "Blazor";
    projectKind = "frontend";
    stackTags.add("blazor");
  }
  return {
    frameworkLabel,
    uiLibLabels: [],
    projectKind,
    stackTags: finalizeStackTags(stackTags)
  };
}
function detectGenericProjectMetadata(lang) {
  return {
    frameworkLabel: "",
    uiLibLabels: [],
    projectKind: "unknown",
    stackTags: finalizeStackTags([lang])
  };
}
function detectNodeProjectMetadata(projectDir, packageJson, lang) {
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  const vueProfile = checkVueProfile(dependencies);
  const uiLibLabels = detectUILibs(dependencies);
  const stackTags = /* @__PURE__ */ new Set([lang, "nodejs", ...detectNodePackageManagers(projectDir)]);
  const detectedKinds = /* @__PURE__ */ new Set();
  let frameworkLabel = "";
  const markFramework = (label, kind, ...tags) => {
    if (!frameworkLabel) frameworkLabel = label;
    detectedKinds.add(kind);
    for (const tag of tags) stackTags.add(tag);
  };
  if (packageJson.type === "module") stackTags.add("esm");
  if (packageJson.workspaces) stackTags.add("monorepo");
  if (dependencies["vite"]) stackTags.add("vite");
  if (dependencies["webpack"]) stackTags.add("webpack");
  if (dependencies["next"]) markFramework("Next.js", "fullstack", "nextjs");
  if (dependencies["nuxt"] || dependencies["nuxt3"]) markFramework(frameworkLabel || "Nuxt", "fullstack", "nuxt");
  if (dependencies["@remix-run/node"] || dependencies["@remix-run/react"]) {
    markFramework(frameworkLabel || "Remix", "fullstack", "remix");
  }
  if (dependencies["@nestjs/core"]) markFramework(frameworkLabel || "NestJS", "backend", "nestjs");
  if (dependencies["express"]) markFramework(frameworkLabel || "Express", "backend", "express");
  if (dependencies["fastify"]) markFramework(frameworkLabel || "Fastify", "backend", "fastify");
  if (dependencies["koa"]) markFramework(frameworkLabel || "Koa", "backend", "koa");
  if (dependencies["hono"]) markFramework(frameworkLabel || "Hono", "backend", "hono");
  if (dependencies["vue"]) {
    const vueTags = vueProfile?.version === 3 ? ["vue", "vue3"] : vueProfile?.version === 2 ? ["vue", "vue2"] : ["vue"];
    markFramework(frameworkLabel || (vueProfile?.version === 3 ? "Vue 3" : vueProfile?.version === 2 ? "Vue 2" : "Vue"), "frontend", ...vueTags);
  }
  if (dependencies["react"]) markFramework(frameworkLabel || "React", "frontend", "react");
  if (dependencies["@angular/core"]) markFramework(frameworkLabel || "Angular", "frontend", "angular");
  if (dependencies["svelte"]) markFramework(frameworkLabel || "Svelte", "frontend", "svelte");
  if (!detectedKinds.has("backend") && !detectedKinds.has("frontend") && detectGenericNodeBackendProject(projectDir, packageJson)) {
    markFramework(frameworkLabel || "Node Service", "backend", "nodeservice");
  }
  for (const uiLibLabel of uiLibLabels) {
    stackTags.add(uiLibLabel);
  }
  let projectKind = "library";
  if (detectedKinds.has("fullstack") || detectedKinds.has("frontend") && detectedKinds.has("backend")) {
    projectKind = "fullstack";
  } else if (detectedKinds.has("backend")) {
    projectKind = "backend";
  } else if (detectedKinds.has("frontend")) {
    projectKind = "frontend";
  }
  return {
    dependencies,
    vueProfile,
    frameworkLabel,
    uiLibLabels,
    projectKind,
    stackTags: finalizeStackTags(stackTags)
  };
}
function detectProjectMetadata(projectDir, lang, packageJson) {
  if (packageJson) {
    return detectNodeProjectMetadata(projectDir, packageJson, lang);
  }
  const metadata = (() => {
    switch (lang) {
      case "java":
        return detectJavaProjectMetadata(projectDir);
      case "rust":
        return detectRustProjectMetadata(projectDir);
      case "dotnet":
        return detectDotnetProjectMetadata(projectDir);
      default:
        return detectGenericProjectMetadata(lang);
    }
  })();
  return {
    dependencies: {},
    vueProfile: null,
    ...metadata
  };
}
function discoverWorkspace(logger, targetDir) {
  const projects = [];
  const visited = /* @__PURE__ */ new Set();
  function scan(dir, depth) {
    if (depth > 2) return;
    if (projects.length >= MAX_SUB_PROJECTS) return;
    let realDir;
    try {
      realDir = fs5.realpathSync(dir);
    } catch {
      return;
    }
    if (visited.has(realDir)) return;
    visited.add(realDir);
    const relativePath = path5.relative(targetDir, dir).replace(/\\/g, "/") || ".";
    let detected = false;
    for (const marker of PROJECT_MARKERS) {
      const markerFile = marker.files.find((f) => fs5.existsSync(path5.join(dir, f)));
      if (!markerFile) continue;
      let lang = marker.lang;
      if (marker.refinements) {
        for (const ref of marker.refinements) {
          if (ref.files.some((f) => fs5.existsSync(path5.join(dir, f)))) {
            lang = ref.lang;
            break;
          }
        }
      }
      if (markerFile === "package.json") {
        try {
          const pkgContent = JSON.parse(fs5.readFileSync(path5.join(dir, "package.json"), "utf-8"));
          const metadata = detectProjectMetadata(dir, lang, pkgContent);
          projects.push({
            name: pkgContent.name || path5.basename(dir),
            relativePath,
            absolutePath: dir,
            lang,
            packageJson: pkgContent,
            vueProfile: metadata.vueProfile,
            dependencies: metadata.dependencies,
            matchedLayer2Rules: [],
            frameworkLabel: metadata.frameworkLabel,
            uiLibLabels: metadata.uiLibLabels,
            projectKind: metadata.projectKind,
            stackTags: metadata.stackTags
          });
        } catch {
          logger.warn(`\u89E3\u6790 package.json \u5931\u8D25: ${path5.join(dir, "package.json")}`);
        }
      } else {
        const metadata = detectProjectMetadata(dir, lang);
        projects.push({
          name: path5.basename(dir),
          relativePath,
          absolutePath: dir,
          lang,
          vueProfile: metadata.vueProfile,
          dependencies: metadata.dependencies,
          matchedLayer2Rules: [],
          frameworkLabel: metadata.frameworkLabel,
          uiLibLabels: metadata.uiLibLabels,
          projectKind: metadata.projectKind,
          stackTags: metadata.stackTags
        });
      }
      detected = true;
      break;
    }
    if (!detected) {
      try {
        const entries = fs5.readdirSync(dir);
        const hasCsproj = entries.some((e) => e.endsWith(".csproj") || e.endsWith(".sln"));
        if (hasCsproj) {
          const metadata = detectProjectMetadata(dir, "dotnet");
          projects.push({
            name: path5.basename(dir),
            relativePath,
            absolutePath: dir,
            lang: "dotnet",
            vueProfile: metadata.vueProfile,
            dependencies: metadata.dependencies,
            matchedLayer2Rules: [],
            frameworkLabel: metadata.frameworkLabel,
            uiLibLabels: metadata.uiLibLabels,
            projectKind: metadata.projectKind,
            stackTags: metadata.stackTags
          });
          detected = true;
        }
      } catch {
      }
    }
    if (depth < 2) {
      let entries;
      try {
        entries = fs5.readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.startsWith(".") || WORKSPACE_EXCLUDE_DIRS.has(entry)) continue;
        const childPath = path5.join(dir, entry);
        try {
          const stat = fs5.statSync(childPath);
          if (stat.isDirectory()) {
            scan(childPath, depth + 1);
          }
        } catch {
        }
      }
    }
  }
  scan(targetDir, 0);
  if (projects.length >= MAX_SUB_PROJECTS) {
    logger.warn(`\u5B50\u9879\u76EE\u6570\u91CF\u5DF2\u8FBE\u4E0A\u9650 ${MAX_SUB_PROJECTS}\uFF0C\u540E\u7EED\u5B50\u9879\u76EE\u88AB\u622A\u65AD`);
  }
  const isWorkspace = projects.length > 1;
  if (isWorkspace) {
    logger.log(`\u53D1\u73B0 Workspace \u6A21\u5F0F\uFF1A${projects.length} \u4E2A\u5B50\u9879\u76EE`);
    for (const p of projects) {
      const label = [p.lang, p.frameworkLabel, ...p.uiLibLabels].filter(Boolean).join(" + ");
      logger.verbose(`  - ${p.relativePath} (${label || "\u65E0\u6846\u67B6\u68C0\u6D4B"})`);
    }
  }
  return {
    isWorkspace,
    rootDir: targetDir,
    projects,
    discoveredAt: (/* @__PURE__ */ new Date()).toISOString(),
    scope: "workspace-union",
    selectedProject: null,
    totalProjectCount: projects.length
  };
}
function normalizeSelector(value) {
  return value.trim().toLowerCase().replace(/\\/g, "/");
}
function normalizeStackLabel(value) {
  return normalizeStackTag(value);
}
function detectProjectLangFromDir(projectDir) {
  for (const marker of PROJECT_MARKERS) {
    const markerFile = marker.files.find((file) => fs5.existsSync(path5.join(projectDir, file)));
    if (!markerFile) continue;
    let lang = marker.lang;
    if (marker.refinements) {
      for (const refinement of marker.refinements) {
        if (refinement.files.some((file) => fs5.existsSync(path5.join(projectDir, file)))) {
          lang = refinement.lang;
          break;
        }
      }
    }
    return lang;
  }
  try {
    const entries = fs5.readdirSync(projectDir);
    if (entries.some((entry) => entry.endsWith(".csproj") || entry.endsWith(".fsproj"))) {
      return "dotnet";
    }
  } catch {
    return "unknown";
  }
  return "unknown";
}
function getProjectAliases(project) {
  const aliases = /* @__PURE__ */ new Set();
  aliases.add(project.relativePath);
  aliases.add(project.name);
  aliases.add(project.relativePath.split("/").pop() || project.relativePath);
  if (project.relativePath === ".") {
    aliases.add("root");
    aliases.add(".");
  }
  return [...aliases].map(normalizeSelector).filter(Boolean);
}
function resolveTargetProject(workspaceInfo, selector) {
  const normalizedSelector = normalizeSelector(selector);
  if (!normalizedSelector) return null;
  const exact = workspaceInfo.projects.find((project) => getProjectAliases(project).includes(normalizedSelector));
  if (exact) return exact;
  const prefixMatches = workspaceInfo.projects.filter(
    (project) => normalizeSelector(project.relativePath).startsWith(normalizedSelector)
  );
  if (prefixMatches.length === 1) return prefixMatches[0];
  const fuzzyMatches = workspaceInfo.projects.filter(
    (project) => getProjectAliases(project).some((alias) => alias.includes(normalizedSelector))
  );
  if (fuzzyMatches.length === 1) return fuzzyMatches[0];
  return null;
}
function createScopedWorkspaceInfo(logger, workspaceInfo, workspaceScope, targetProjectSelector) {
  if (!workspaceInfo.isWorkspace || workspaceInfo.projects.length <= 1) {
    return {
      ...workspaceInfo,
      scope: workspaceScope,
      selectedProject: workspaceInfo.projects[0]?.relativePath || null,
      totalProjectCount: workspaceInfo.projects.length
    };
  }
  if (workspaceScope !== "project-targeted") {
    return {
      ...workspaceInfo,
      scope: "workspace-union",
      selectedProject: null,
      totalProjectCount: workspaceInfo.projects.length
    };
  }
  if (!targetProjectSelector) {
    logError("project-targeted \u6A21\u5F0F\u9700\u8981\u914D\u5408 --project <selector>");
    process.exit(1);
  }
  const selectedProject = resolveTargetProject(workspaceInfo, targetProjectSelector);
  if (!selectedProject) {
    logError(`\u672A\u627E\u5230\u5339\u914D\u7684\u5B50\u9879\u76EE: ${targetProjectSelector}`);
    process.exit(1);
  }
  logger.log(`Workspace \u5B9A\u5411\u6A21\u5F0F: ${selectedProject.name} (${selectedProject.relativePath})`);
  return {
    ...workspaceInfo,
    isWorkspace: true,
    projects: [selectedProject],
    scope: "project-targeted",
    selectedProject: selectedProject.relativePath,
    totalProjectCount: workspaceInfo.projects.length
  };
}
function collectSkillContextProjects(workspaceInfo) {
  return workspaceInfo.projects;
}
function collectProjectFrameworkTags(project) {
  const tags = new Set(project.stackTags || []);
  if (project.frameworkLabel) tags.add(normalizeStackLabel(project.frameworkLabel));
  if (project.vueProfile) tags.add(`vue${project.vueProfile.version}`);
  for (const uiLib of project.uiLibLabels) {
    tags.add(normalizeStackLabel(uiLib));
  }
  return tags;
}
function matchesSkillLanguages(skill, projects) {
  if (!skill.languages || skill.languages.length === 0) return true;
  const languages = new Set(projects.map((project) => project.lang));
  return skill.languages.some((language) => languages.has(language));
}
function matchesSkillFrameworks(skill, projects) {
  if (!skill.frameworks || skill.frameworks.length === 0) return true;
  const frameworkTags = /* @__PURE__ */ new Set();
  for (const project of projects) {
    for (const tag of collectProjectFrameworkTags(project)) {
      frameworkTags.add(tag);
    }
  }
  return skill.frameworks.some((framework) => frameworkTags.has(normalizeStackLabel(framework)));
}
function matchesSkillStack(skill, projects) {
  const hasLanguages = Boolean(skill.languages && skill.languages.length > 0);
  const hasFrameworks = Boolean(skill.frameworks && skill.frameworks.length > 0);
  if (!hasLanguages && !hasFrameworks) return true;
  if (hasLanguages && hasFrameworks) {
    return matchesSkillLanguages(skill, projects) || matchesSkillFrameworks(skill, projects);
  }
  if (hasLanguages) return matchesSkillLanguages(skill, projects);
  return matchesSkillFrameworks(skill, projects);
}
function matchesSkillWorkspaceScope(skill, workspaceInfo) {
  if (!skill.workspaceScope || skill.workspaceScope === "both") return true;
  if (workspaceInfo.totalProjectCount <= 1) return true;
  return skill.workspaceScope === workspaceInfo.scope;
}
function matchesSkillRole(skill, targetRole) {
  if (!targetRole || !skill.roles || skill.roles.length === 0) return true;
  if (targetRole === "fullstack") {
    return skill.roles.includes("fullstack") || skill.roles.includes("frontend") || skill.roles.includes("backend");
  }
  return skill.roles.includes(targetRole);
}
function matchesBusinessRuleSelector(project, selector) {
  const normalizedSelector = selector.trim();
  if (!normalizedSelector) return false;
  const separatorIndex = normalizedSelector.indexOf(":");
  const selectorType = separatorIndex >= 0 ? normalizeStackTag(normalizedSelector.slice(0, separatorIndex)) : "";
  const selectorValue = separatorIndex >= 0 ? normalizedSelector.slice(separatorIndex + 1).trim() : normalizedSelector;
  if (!selectorValue) return false;
  const hasDependency = (packageName) => Boolean(project.dependencies[packageName]);
  const normalizedValue = normalizeStackTag(selectorValue);
  switch (selectorType) {
    case "":
      return hasDependency(selectorValue);
    case "dependency":
    case "dep":
    case "package":
    case "pkg":
      return hasDependency(selectorValue);
    case "stack":
    case "framework":
    case "uilib":
      return project.stackTags.some((tag) => normalizeStackTag(tag) === normalizedValue);
    case "lang":
    case "language":
      return normalizeStackTag(project.lang) === normalizedValue;
    case "kind":
    case "projectkind":
      return normalizeStackTag(project.projectKind) === normalizedValue;
    default:
      return false;
  }
}
function collectMatchedBusinessRules(project, businessSelectors) {
  const matches = [];
  const seenRules = /* @__PURE__ */ new Set();
  for (const [selector, ruleFolders] of Object.entries(businessSelectors)) {
    if (!matchesBusinessRuleSelector(project, selector)) continue;
    for (const rule of ruleFolders) {
      if (seenRules.has(rule)) continue;
      seenRules.add(rule);
      matches.push({ selector, rule });
    }
  }
  return matches;
}
function shouldIncludeSkill(skill, ctx, workspaceInfo) {
  const projects = collectSkillContextProjects(workspaceInfo);
  return matchesSkillWorkspaceScope(skill, workspaceInfo) && matchesSkillStack(skill, projects) && matchesSkillRole(skill, ctx.targetRole);
}
async function loadRuleFile(ctx, logger, layerId, filePath) {
  if (ctx.isRemote) {
    try {
      return await readRemoteTextAsset(ctx, logger, `rules/${layerId}/${filePath}`);
    } catch (e) {
      logger.warn(`\u8FDC\u7A0B\u89C4\u5219\u52A0\u8F7D\u5931\u8D25: ${filePath}`);
      return "";
    }
  } else {
    const fullPath = path5.join(RULES_ROOT, layerId, filePath);
    if (fs5.existsSync(fullPath)) {
      return fs5.readFileSync(fullPath, "utf-8");
    }
    return "";
  }
}
async function loadLayerRules(ctx, logger, layerId, folders) {
  const contents = [];
  for (const folder of folders) {
    if (ctx.isRemote) {
      const matchingFiles = ctx.remoteManifest.files.filter(
        (f) => f.path.startsWith(`rules/${layerId}/${folder}`) && f.path.endsWith(".md")
      );
      for (const file of matchingFiles) {
        const relativePath = file.path.replace(`rules/${layerId}/`, "");
        const content = await loadRuleFile(ctx, logger, layerId, relativePath);
        if (content) {
          contents.push({ path: relativePath, content: filterRuleByLevel(content, ctx.ruleLevel) });
        }
      }
    } else {
      const folderPath = path5.join(RULES_ROOT, layerId, folder);
      if (fs5.existsSync(folderPath)) {
        const stat = fs5.statSync(folderPath);
        if (stat.isDirectory()) {
          const files = fs5.readdirSync(folderPath).filter((f) => f.endsWith(".md"));
          for (const file of files) {
            const content = fs5.readFileSync(path5.join(folderPath, file), "utf-8");
            contents.push({ path: `${folder}/${file}`, content: filterRuleByLevel(content, ctx.ruleLevel) });
          }
        } else if (folderPath.endsWith(".md")) {
          const content = fs5.readFileSync(folderPath, "utf-8");
          contents.push({ path: folder, content: filterRuleByLevel(content, ctx.ruleLevel) });
        }
      }
      const mdPath = path5.join(RULES_ROOT, layerId, folder + ".md");
      if (fs5.existsSync(mdPath)) {
        const content = fs5.readFileSync(mdPath, "utf-8");
        contents.push({ path: folder + ".md", content: filterRuleByLevel(content, ctx.ruleLevel) });
      }
    }
  }
  return contents;
}
function filterRuleByLevel(content, level) {
  if (level === "full") return content;
  const hasAny = /<!--\s*@level:/i.test(content);
  if (!hasAny) return content;
  const rank = { summary: 0, quick: 1, full: 2 };
  const target = rank[level];
  const re = /<!--\s*@level:(summary|quick|full)\s*-->/gi;
  const matches = [];
  let m;
  while (m = re.exec(content)) {
    matches.push({ level: m[1], index: m.index, len: m[0].length });
  }
  if (matches.length === 0) return content;
  matches.sort((a, b) => a.index - b.index);
  const prefix = content.slice(0, matches[0].index);
  const picked = [prefix];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const segLevel = matches[i].level;
    if (rank[segLevel] <= target) {
      picked.push(content.slice(start, end));
    }
  }
  return picked.join("").trimEnd() + "\n";
}
async function loadEntities(ctx, logger, sourcePath, options, tracker, targetDir) {
  const entities = [];
  const localDir = path5.join(targetDir, options.targetSubDir);
  if (!fs5.existsSync(localDir)) {
    fs5.mkdirSync(localDir, { recursive: true });
  }
  if (ctx.isRemote) {
    const files = ctx.remoteManifest.files.filter(
      (f) => f.path.startsWith(options.manifestPrefix)
    );
    const rootFiles = files.filter((file) => !file.path.replace(options.manifestPrefix, "").includes("/"));
    const entityGroups = /* @__PURE__ */ new Map();
    for (const file of files) {
      const relativePath = file.path.replace(options.manifestPrefix, "");
      const parts = relativePath.split("/");
      if (parts.length <= 1) continue;
      const entityId = parts[0];
      const group = entityGroups.get(entityId) || [];
      group.push(file);
      entityGroups.set(entityId, group);
    }
    for (const file of rootFiles) {
      try {
        const content = await readRemoteAsset(ctx, logger, file.path);
        const relativePath = file.path.replace(options.manifestPrefix, "");
        writeManagedFile(tracker, path5.join(localDir, relativePath), content);
        logger.verbose(`\u5DF2\u4E0B\u8F7D${options.label}\u6839\u6587\u4EF6: ${relativePath}`);
      } catch (e) {
        logger.warn(`${options.label}\u6839\u6587\u4EF6\u4E0B\u8F7D\u5931\u8D25: ${file.path} - ${e.message}`);
      }
    }
    for (const [entityId, groupFiles] of entityGroups) {
      const metadataFile = groupFiles.find((file) => file.path.endsWith(`/${options.metadataFileName}`));
      if (!metadataFile) continue;
      try {
        const metadataContent = await readRemoteTextAsset(ctx, logger, metadataFile.path);
        const metadata = options.parseMetadata(entityId, metadataContent);
        if (!metadata) continue;
        if (options.includeEntity && !options.includeEntity(metadata, entityId)) {
          logger.verbose(`\u5DF2\u8DF3\u8FC7${options.label}: ${entityId}`);
          continue;
        }
        entities.push(metadata);
        for (const file of groupFiles) {
          try {
            const content = file.path === metadataFile.path ? metadataContent : await readRemoteAsset(ctx, logger, file.path);
            const relativePath = file.path.replace(options.manifestPrefix, "");
            const localPath = path5.join(localDir, relativePath);
            writeManagedFile(tracker, localPath, content);
            logger.verbose(`\u5DF2\u4E0B\u8F7D${options.label}\u6587\u4EF6: ${relativePath}`);
          } catch (e) {
            logger.warn(`${options.label}\u6587\u4EF6\u4E0B\u8F7D\u5931\u8D25: ${file.path} - ${e.message}`);
          }
        }
      } catch (e) {
        logger.warn(`${options.label}\u5143\u6570\u636E\u4E0B\u8F7D\u5931\u8D25: ${metadataFile.path} - ${e.message}`);
      }
    }
  } else {
    const sourceDir = path5.join(PROJECT_ROOT, sourcePath);
    if (fs5.existsSync(sourceDir)) {
      const entries = fs5.readdirSync(sourceDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const sourceFile = path5.join(sourceDir, entry.name);
        const destinationPath = path5.join(localDir, entry.name);
        copyManagedFile(tracker, sourceFile, destinationPath);
      }
      const entityDirs = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name);
      for (const entityId of entityDirs) {
        const entitySourceDir = path5.join(sourceDir, entityId);
        const metadataFile = path5.join(entitySourceDir, options.metadataFileName);
        if (!fs5.existsSync(metadataFile)) continue;
        const content = fs5.readFileSync(metadataFile, "utf-8");
        const metadata = options.parseMetadata(entityId, content);
        if (!metadata) continue;
        if (options.includeEntity && !options.includeEntity(metadata, entityId)) {
          logger.verbose(`\u5DF2\u8DF3\u8FC7${options.label}: ${entityId}`);
          continue;
        }
        entities.push(metadata);
        const sourceFiles = listFilesRecursive(entitySourceDir);
        for (const sourceFile of sourceFiles) {
          const relativePath = path5.relative(sourceDir, sourceFile);
          const destinationPath = path5.join(localDir, relativePath);
          copyManagedFile(tracker, sourceFile, destinationPath);
        }
      }
    }
  }
  return entities;
}
async function loadSkills(ctx, logger, skillsPath, tracker, targetDir, workspaceInfo, targetSubDir) {
  return loadEntities(ctx, logger, skillsPath, {
    manifestPrefix: "custom-skills/",
    targetSubDir,
    metadataFileName: "SKILL.md",
    parseMetadata: parseSkillMetadata,
    label: "\u6280\u80FD",
    includeEntity: (metadata) => shouldIncludeSkill(metadata, ctx, workspaceInfo)
  }, tracker, targetDir);
}
async function loadAgents(ctx, logger, agentsPath, tracker, targetDir, targetSubDir) {
  return loadEntities(ctx, logger, agentsPath, {
    manifestPrefix: "agents/",
    targetSubDir,
    metadataFileName: "AGENT.md",
    parseMetadata: parseAgentMetadata,
    label: "Agent"
  }, tracker, targetDir);
}
async function distributeScripts(ctx, logger, targetDir, tracker) {
  const distributed = [];
  const localScriptsDir = path5.join(targetDir, ".codebuddy/scripts");
  const scriptsToDistribute = getScriptsForProfile(ctx.profile);
  if (!fs5.existsSync(localScriptsDir)) {
    fs5.mkdirSync(localScriptsDir, { recursive: true });
  }
  if (ctx.isRemote) {
    for (const scriptInfo of scriptsToDistribute) {
      try {
        const content = await readRemoteTextAsset(ctx, logger, `scripts/dist/${scriptInfo.file}`);
        const destPath = path5.join(localScriptsDir, scriptInfo.file);
        writeManagedFile(tracker, destPath, content);
        distributed.push(scriptInfo.file);
        logger.verbose(`\u5DF2\u4E0B\u8F7D\u811A\u672C: ${scriptInfo.file}`);
        if (scriptInfo.dependencies) {
          for (const dep of scriptInfo.dependencies) {
            try {
              const depContent = await readRemoteTextAsset(ctx, logger, `scripts/dist/${dep}`);
              writeManagedFile(tracker, path5.join(localScriptsDir, dep), depContent);
              logger.verbose(`\u5DF2\u4E0B\u8F7D\u4F9D\u8D56: ${dep}`);
            } catch (e) {
              logger.warn(`\u4F9D\u8D56\u4E0B\u8F7D\u5931\u8D25: ${dep} - ${e.message}`);
            }
          }
        }
      } catch (e) {
        logger.warn(`\u811A\u672C\u4E0B\u8F7D\u5931\u8D25: ${scriptInfo.file} - ${e.message}`);
      }
    }
  } else {
    const sourceDir = path5.join(PROJECT_ROOT, "scripts/dist");
    for (const scriptInfo of scriptsToDistribute) {
      const srcPath = path5.join(sourceDir, scriptInfo.file);
      if (fs5.existsSync(srcPath)) {
        const destPath = path5.join(localScriptsDir, scriptInfo.file);
        copyManagedFile(tracker, srcPath, destPath);
        distributed.push(scriptInfo.file);
        logger.verbose(`\u5DF2\u590D\u5236\u811A\u672C: ${scriptInfo.file}`);
        if (scriptInfo.dependencies) {
          for (const dep of scriptInfo.dependencies) {
            const depSrc = path5.join(sourceDir, dep);
            if (fs5.existsSync(depSrc)) {
              copyManagedFile(tracker, depSrc, path5.join(localScriptsDir, dep));
              logger.verbose(`\u5DF2\u590D\u5236\u4F9D\u8D56: ${dep}`);
            }
          }
        }
      } else {
        logger.warn(`\u811A\u672C\u4E0D\u5B58\u5728: ${srcPath}`);
      }
    }
  }
  if (distributed.length > 0) {
    const scriptsPackageJsonPath = path5.join(localScriptsDir, "package.json");
    writeManagedFile(
      tracker,
      scriptsPackageJsonPath,
      `${JSON.stringify({ type: "commonjs" }, null, 2)}
`
    );
    const readmePath = path5.join(localScriptsDir, "README.md");
    writeManagedFile(tracker, readmePath, generateScriptsReadme(distributed));
  }
  return distributed;
}
async function distributeWorkflows(ctx, logger, targetDir, tracker) {
  return distributeItems(ctx, logger, targetDir, PROJECT_ROOT, {
    targetSubDir: ".codebuddy/workflows",
    items: WORKFLOWS_TO_DISTRIBUTE,
    label: "workflow",
    tracker,
    readme: [
      "# Workflows",
      "",
      "\u672C\u76EE\u5F55\u5305\u542B\u5DE5\u4F5C\u6D41\u89C4\u8303\uFF08Workflow Spec\uFF09\u3002",
      "",
      "- `default.workflow.json`\uFF1A\u9ED8\u8BA4\u5355\u4EFB\u52A1\u95ED\u73AF\u5DE5\u4F5C\u6D41\uFF08\u5206\u6790\u2192\u8BA1\u5212\u2192\u5B9E\u73B0\u2192\u6D4B\u8BD5\u2192\u5BA1\u67E5\u2192\u9A8C\u6536\uFF09\u3002",
      "- `workflow.schema.json`\uFF1AWorkflow Spec \u7684 JSON Schema\uFF0C\u7528\u4E8E\u6821\u9A8C/CI/MCP/\u591A\u5DE5\u5177\u9002\u914D\u3002",
      "",
      "\u8BF4\u660E\uFF1A\u65E9\u671F\u53EF\u5C06\u5176\u4F5C\u4E3A Agent \u7684\u6267\u884C\u7EA6\u675F\u4E0E\u4EA7\u7269\u6E05\u5355\uFF1B\u540E\u671F\u53EF\u7531 Task Executor \u6309\u6B65\u9AA4\u7F16\u6392\u5E76\u5F3A\u5236\u6267\u884C gates\u3002",
      ""
    ].join("\n")
  });
}
async function distributeTaskBooks(ctx, logger, targetDir, tracker) {
  return distributeItems(ctx, logger, targetDir, PROJECT_ROOT, {
    targetSubDir: ".codebuddy/taskbooks",
    items: TASKBOOK_FILES_TO_DISTRIBUTE,
    label: "taskbook contract",
    tracker,
    preCreateDirs: ["active", "history"],
    readme: [
      "# TaskBooks",
      "",
      "\u672C\u76EE\u5F55\u662F **TaskBook\uFF08\u4EFB\u52A1\u4E66\uFF09** \u7684\u5B58\u50A8\u4E0E\u5951\u7EA6\uFF08SSOT\uFF09\u3002",
      "",
      "- `active/`\uFF1A\u8FDB\u884C\u4E2D\u7684 TaskBook\uFF08*.json\uFF09",
      "- `history/`\uFF1A\u5DF2\u5F52\u6863\u7684 TaskBook\uFF08*.json\uFF09",
      "- `taskbook.schema.json`\uFF1ATaskBook JSON Schema\uFF08\u5951\u7EA6\uFF09",
      "",
      '\u5EFA\u8BAE\uFF1A\u4EFB\u4F55 Agent/\u5DE5\u5177\u5199\u5165 TaskBook \u524D\u5148\u6309 schema \u6821\u9A8C\u7ED3\u6784\uFF0C\u907F\u514D"\u884C\u4E3A\u4E0D\u4E00\u81F4"\u3002',
      ""
    ].join("\n")
  });
}
async function distributeAgentCalls(ctx, logger, targetDir, tracker) {
  return distributeItems(ctx, logger, targetDir, PROJECT_ROOT, {
    targetSubDir: ".codebuddy/agent-calls",
    items: AGENT_CALL_FILES_TO_DISTRIBUTE,
    label: "agent-call contract",
    tracker,
    readme: [
      "# Agent Calls",
      "",
      "\u672C\u76EE\u5F55\u7528\u4E8E **Agent Call \u6587\u4EF6\u534F\u8BAE**\uFF1Aprompt.md \u21C4 result.json\uFF08\u53EF\u5BA1\u8BA1\u3001\u53EF\u6062\u590D\uFF09\u3002",
      "",
      "- `agent-call.schema.json`\uFF1Aresult.json \u7684 JSON Schema\uFF08\u5951\u7EA6\uFF09",
      "",
      "\u5F3A\u6821\u9A8C/\u8BCA\u65AD\uFF1A",
      "- `node .codebuddy/scripts/contract-validator.js --agent-calls`",
      "- `node .codebuddy/scripts/agent-call-manager.js validate <requestId>`",
      "",
      "\u53EF\u9009\uFF1A\u8FDC\u7A0B\u5199\u56DE result.json\uFF08\u8DE8\u8FDB\u7A0B/\u8DE8\u673A\u5668\uFF09\uFF1A",
      "- `node .codebuddy/scripts/agent-call-manager.js serve --host 127.0.0.1 --port 4317 --token <t>`",
      ""
    ].join("\n")
  });
}
async function distributeCommands(ctx, logger, targetDir, tracker) {
  return distributeItems(ctx, logger, targetDir, PROJECT_ROOT, {
    targetSubDir: ".codebuddy/commands",
    items: COMMANDS_TO_DISTRIBUTE,
    label: "\u547D\u4EE4",
    tracker,
    readme: generateCommandsReadme(COMMANDS_TO_DISTRIBUTE.map((item) => item.destFile))
  });
}
function updateGitignore(logger, projectDir) {
  const gitignorePath = path5.join(projectDir, ".gitignore");
  const entry = ".codebuddy/";
  try {
    let content = "";
    if (fs5.existsSync(gitignorePath)) {
      content = fs5.readFileSync(gitignorePath, "utf-8");
      if (content.includes(entry)) {
        return;
      }
    }
    if (content && !content.endsWith("\n")) {
      content += "\n";
    }
    content += `
# CodeBuddy \u751F\u6210\u6587\u4EF6
${entry}
`;
    fs5.writeFileSync(gitignorePath, content, "utf-8");
    logger.verbose("\u5DF2\u66F4\u65B0 .gitignore");
  } catch (error) {
    logger.warn(`\u66F4\u65B0 .gitignore \u5931\u8D25: ${error.message}`);
  }
}
function parseContextArgs(args) {
  let isVerbose = false;
  let isRemote = false;
  let remoteBaseUrl = "";
  let remoteBearerToken = null;
  let taskType = null;
  let relevanceThreshold = DEFAULT_THRESHOLD;
  let ruleLevel = DEFAULT_RULE_LEVEL;
  let requestTimeout = DEFAULT_TIMEOUT;
  let profile = DEFAULT_PROFILE;
  let disableWorkspace = false;
  let strictRemotePack = false;
  let workspaceScope = "workspace-union";
  let targetProject = null;
  let targetRole = null;
  let profileExplicit = false;
  let remoteBearerTokenExplicit = false;
  if (args.includes("--verbose") || args.includes("-v")) {
    isVerbose = true;
  }
  if (args.includes("--no-workspace")) {
    disableWorkspace = true;
  }
  if (args.includes("--pack-only") || args.includes("--strict-pack-only")) {
    strictRemotePack = true;
  }
  const workspaceScopeIndex = args.indexOf("--workspace-scope");
  if (workspaceScopeIndex !== -1) {
    const value = (args[workspaceScopeIndex + 1] || "").trim().toLowerCase();
    if (!value || value.startsWith("-")) {
      logError("--workspace-scope \u9700\u8981 scope \u53C2\u6570");
      process.exit(1);
    }
    if (!WORKSPACE_SCOPES.includes(value)) {
      logError(`--workspace-scope \u4EC5\u652F\u6301 ${WORKSPACE_SCOPES.join("|")}\uFF0C\u5F53\u524D: ${value}`);
      process.exit(1);
    }
    workspaceScope = value;
  }
  const projectIndex = args.indexOf("--project");
  if (projectIndex !== -1) {
    const value = (args[projectIndex + 1] || "").trim();
    if (!value || value.startsWith("-")) {
      logError("--project \u9700\u8981\u9879\u76EE\u9009\u62E9\u5668\u53C2\u6570");
      process.exit(1);
    }
    targetProject = value;
    workspaceScope = "project-targeted";
  }
  const roleIndex = args.indexOf("--role");
  if (roleIndex !== -1) {
    const value = (args[roleIndex + 1] || "").trim().toLowerCase();
    if (!value || value.startsWith("-")) {
      logError("--role \u9700\u8981\u5C97\u4F4D\u53C2\u6570");
      process.exit(1);
    }
    if (!SKILL_ROLES.includes(value)) {
      logError(`--role \u4EC5\u652F\u6301 ${SKILL_ROLES.join("|")}\uFF0C\u5F53\u524D: ${value}`);
      process.exit(1);
    }
    targetRole = value;
  }
  const profileIndex = args.indexOf("--profile");
  if (profileIndex !== -1) {
    const value = (args[profileIndex + 1] || "").trim().toLowerCase();
    if (!value || value.startsWith("-")) {
      logError("--profile \u9700\u8981 profile \u540D\u79F0\u53C2\u6570");
      process.exit(1);
    }
    if (!INSTALL_PROFILES.includes(value)) {
      logError(`--profile \u4EC5\u652F\u6301 ${INSTALL_PROFILES.join("|")}\uFF0C\u5F53\u524D: ${value}`);
      process.exit(1);
    }
    profile = value;
    profileExplicit = true;
  }
  const legacyEnableOrchestrator = args.includes("--enable-orchestrator");
  if (legacyEnableOrchestrator) {
    if (profileExplicit && !isOrchestratorProfile(profile)) {
      logError("--enable-orchestrator \u53EA\u80FD\u4E0E --profile orchestrator|full \u4E00\u8D77\u4F7F\u7528");
      process.exit(1);
    }
    if (!profileExplicit) {
      profile = "full";
    }
  }
  const remoteIndex = args.indexOf("--remote");
  if (remoteIndex !== -1) {
    const url = args[remoteIndex + 1];
    if (!url || url.startsWith("-")) {
      logError("--remote \u9700\u8981 URL \u53C2\u6570");
      process.exit(1);
    }
    try {
      new URL(url);
    } catch {
      logError("--remote \u9700\u8981\u6709\u6548\u7684 URL \u683C\u5F0F\uFF08\u5982 https://example.com\uFF09");
      process.exit(1);
    }
    isRemote = true;
    remoteBaseUrl = url.replace(/\/$/, "");
  }
  const remoteBearerTokenIndex = args.indexOf("--remote-bearer-token");
  if (remoteBearerTokenIndex !== -1) {
    const token = args[remoteBearerTokenIndex + 1];
    if (!token || token.startsWith("-")) {
      logError("--remote-bearer-token requires a token value");
      process.exit(1);
    }
    remoteBearerToken = token;
    remoteBearerTokenExplicit = true;
  } else if (process.env.CODEBUDDY_REMOTE_BEARER_TOKEN) {
    remoteBearerToken = process.env.CODEBUDDY_REMOTE_BEARER_TOKEN.trim() || null;
  }
  if (strictRemotePack && !isRemote) {
    logError("--pack-only can only be used with --remote");
    process.exit(1);
  }
  if (remoteBearerTokenExplicit && !isRemote) {
    logError("--remote-bearer-token can only be used with --remote");
    process.exit(1);
  }
  const taskIndex = args.indexOf("--task");
  if (taskIndex !== -1) {
    const taskInput = args[taskIndex + 1];
    if (!taskInput || taskInput.startsWith("-")) {
      logError("--task \u9700\u8981\u4EFB\u52A1\u7C7B\u578B\u53C2\u6570");
      process.exit(1);
    }
    taskType = taskInput.toLowerCase().trim();
  }
  const thresholdIndex = args.indexOf("--threshold");
  if (thresholdIndex !== -1) {
    const value = parseFloat(args[thresholdIndex + 1]);
    if (!isNaN(value) && value >= 0 && value <= 1) {
      relevanceThreshold = value;
    }
  }
  const ruleLevelIndex = args.indexOf("--rule-level");
  if (ruleLevelIndex !== -1) {
    const value = (args[ruleLevelIndex + 1] || "").trim().toLowerCase();
    if (value === "summary" || value === "quick" || value === "full") {
      ruleLevel = value;
    } else if (value) {
      logError(`--rule-level \u4EC5\u652F\u6301 summary|quick|full\uFF0C\u5F53\u524D: ${value}`);
      process.exit(1);
    }
  }
  const timeoutIndex = args.indexOf("--timeout");
  if (timeoutIndex !== -1) {
    const value = parseInt(args[timeoutIndex + 1], 10);
    if (!isNaN(value) && value > 0) {
      requestTimeout = value;
    }
  }
  return {
    isRemote,
    isVerbose,
    remoteBaseUrl,
    remoteBearerToken,
    remoteManifest: null,
    remoteContentRoot: null,
    remoteContentPack: null,
    strictRemotePack,
    requestTimeout,
    taskType,
    relevanceThreshold,
    ruleLevel,
    profile,
    enableOrchestrator: isOrchestratorProfile(profile),
    disableWorkspace,
    workspaceScope,
    targetProject,
    targetRole
  };
}
function parseCliArgs() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    showHelp();
  }
  let command = "install";
  let args = rawArgs;
  if (rawArgs[0] && !rawArgs[0].startsWith("-")) {
    const candidate = rawArgs[0].toLowerCase();
    if (COMMANDS.has(candidate)) {
      command = candidate;
      args = rawArgs.slice(1);
    } else {
      logError(`\u672A\u77E5\u547D\u4EE4: ${rawArgs[0]}`);
      process.exit(1);
    }
  }
  const json = args.includes("--json");
  const filteredArgs = args.filter((arg) => arg !== "--json");
  return {
    command,
    ctx: parseContextArgs(filteredArgs),
    json
  };
}
function runStatusCommand(targetDir, logger, json) {
  const installStatePath = path5.join(targetDir, ".codebuddy", "install.json");
  const installStateExists = fs5.existsSync(installStatePath);
  const installState = readInstallState(targetDir, logger);
  const inspection = inspectInstallState(targetDir, installState, installStateExists);
  if (json) {
    console.log(JSON.stringify({
      ok: inspection.installState !== null,
      inspection
    }, null, 2));
  } else {
    console.log(formatStatusReport(inspection));
  }
  return inspection.installState !== null ? 0 : 1;
}
function runDoctorCommand(targetDir, logger, json) {
  const installStatePath = path5.join(targetDir, ".codebuddy", "install.json");
  const installStateExists = fs5.existsSync(installStatePath);
  const installState = readInstallState(targetDir, logger);
  const inspection = inspectInstallState(targetDir, installState, installStateExists);
  const checks = buildDoctorChecks(inspection);
  const summary = summarizeDoctorChecks(checks);
  if (json) {
    console.log(JSON.stringify({
      ok: summary.status !== "fail",
      summary,
      inspection,
      checks
    }, null, 2));
  } else {
    console.log(formatDoctorReport(inspection, checks, summary));
  }
  return summary.status === "fail" ? 1 : 0;
}
async function main() {
  const parsedCli = parseCliArgs();
  const parsedCtx = parsedCli.ctx;
  const logger = createLogger(parsedCtx);
  const targetDir = process.cwd();
  if (parsedCli.command === "status") {
    process.exit(runStatusCommand(targetDir, logger, parsedCli.json));
  }
  if (parsedCli.command === "doctor") {
    process.exit(runDoctorCommand(targetDir, logger, parsedCli.json));
  }
  const { config, manifest } = await loadConfig(parsedCtx, logger);
  let ctx = manifest ? { ...parsedCtx, remoteManifest: manifest } : parsedCtx;
  if (ctx.isRemote && ctx.remoteManifest) {
    const packResolution = await ensureRemoteContentPack(ctx, logger, targetDir);
    ctx = {
      ...ctx,
      remoteContentRoot: packResolution.contentRoot,
      remoteContentPack: packResolution.pack
    };
  }
  logger.log(`CodeBuddy \u89C4\u5219\u52A0\u8F7D\u5668 ${LOADER_DISPLAY_VERSION} (\u4E09\u5C42\u67B6\u6784 + \u6280\u80FD\u7CFB\u7EDF)`);
  logger.log(ctx.isRemote ? `\u6A21\u5F0F: \u8FDC\u7A0B (${ctx.remoteBaseUrl})` : "\u6A21\u5F0F: \u672C\u5730");
  logger.log(`\u5B89\u88C5\u6863\u4F4D: ${ctx.profile}`);
  logger.log(`Workspace \u8303\u56F4: ${ctx.workspaceScope}`);
  if (ctx.targetProject) logger.log(`\u76EE\u6807\u9879\u76EE: ${ctx.targetProject}`);
  if (ctx.enableOrchestrator) logger.log("\u7F16\u6392\u6A21\u5F0F: \u5DF2\u542F\u7528\uFF08\u542B TaskBook / Agent Call / Workflow \u5951\u7EA6\uFF09");
  if (ctx.ruleLevel !== "full") {
    logger.log(`\u89C4\u5219\u88C1\u526A: ${ctx.ruleLevel}\uFF08Layer1 \u4E3B\u5165\u53E3\u4F7F\u7528 ${ctx.ruleLevel}\uFF1B\u5B8C\u6574\u539F\u6587\u5199\u5165 .codebuddy/rules_cache/layer1_reference/\uFF09`);
  }
  if (ctx.taskType) {
    logger.log(`\u4EFB\u52A1\u7B5B\u9009: ${ctx.taskType} (\u9608\u503C: ${ctx.relevanceThreshold})`);
  }
  const previousInstallState = readInstallState(targetDir, logger);
  const managedFileTracker = createManagedFileTracker(targetDir);
  logger.log(`\u76EE\u6807\u9879\u76EE: ${targetDir}`);
  const discoveredWorkspaceInfo = ctx.disableWorkspace ? {
    isWorkspace: false,
    rootDir: targetDir,
    projects: [],
    discoveredAt: (/* @__PURE__ */ new Date()).toISOString(),
    scope: ctx.workspaceScope,
    selectedProject: null,
    totalProjectCount: 0
  } : discoverWorkspace(logger, targetDir);
  const workspaceInfo = ctx.disableWorkspace ? discoveredWorkspaceInfo : createScopedWorkspaceInfo(logger, discoveredWorkspaceInfo, ctx.workspaceScope, ctx.targetProject);
  if (ctx.disableWorkspace) {
    logger.verbose("Workspace \u53D1\u73B0\u5DF2\u7981\u7528\uFF08--no-workspace\uFF09");
  } else if (workspaceInfo.isWorkspace) {
    logger.log(`Workspace \u6A21\u5F0F: ${workspaceInfo.totalProjectCount} \u4E2A\u5B50\u9879\u76EE\uFF08\u5F53\u524D\u8303\u56F4: ${workspaceInfo.scope}\uFF09`);
  } else {
    logger.verbose("\u5355\u9879\u76EE\u6A21\u5F0F\uFF08\u672A\u53D1\u73B0\u591A\u4E2A\u5B50\u9879\u76EE\uFF09");
  }
  if (ctx.targetRole) {
    logger.log(`\u5C97\u4F4D\u8FC7\u6EE4: ${ctx.targetRole}`);
  }
  const { layers, skills: skillsConfig, output, frontmatter } = config;
  let pkg;
  let dependencies;
  let vueProfile;
  let primaryProject = null;
  if ((workspaceInfo.isWorkspace || workspaceInfo.projects.length > 0) && workspaceInfo.projects.length > 0) {
    primaryProject = workspaceInfo.projects.find((p) => p.vueProfile !== null) || workspaceInfo.projects[0];
    pkg = primaryProject.packageJson ?? {};
    dependencies = primaryProject.dependencies;
    vueProfile = primaryProject.vueProfile;
    logger.verbose(`\u4E3B\u9879\u76EE\uFF08Layer1 \u57FA\u51C6\uFF09: ${primaryProject.name} (${primaryProject.relativePath})`);
  } else {
    pkg = getPackageJson(logger, targetDir);
    dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    vueProfile = checkVueProfile(dependencies);
  }
  if (vueProfile) {
    logger.log(`\u68C0\u6D4B\u5230 Vue ${vueProfile.version} (${vueProfile.type})`);
  }
  const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  let finalContent = `---
description: ${frontmatter?.description || "\u524D\u7AEF\u67B6\u6784\u89C4\u8303 - CodeBuddy GLM-4.7 \u4E13\u7528\u7248"}
alwaysApply: ${frontmatter?.alwaysApply !== void 0 ? frontmatter.alwaysApply : true}
enabled: ${frontmatter?.enabled !== void 0 ? frontmatter.enabled : true}
updatedAt: ${updatedAt}
---

# \u524D\u7AEF\u67B6\u6784\u89C4\u8303 (CodeBuddy \u7248)

> Generated by CodeBuddy Rule Loader ${LOADER_DISPLAY_VERSION}
> Generated at: ${updatedAt}
> Vue Version: ${vueProfile ? `${vueProfile.version} (${vueProfile.type})` : "Not detected"}

---

`;
  logger.log("\u5904\u7406 Layer 1: \u57FA\u7840\u89C4\u8303 (Eager Load)...");
  const layer1Folders = [...layers.base?.staticDeps || []];
  if (vueProfile) {
    if (vueProfile.version === 3) {
      layer1Folders.push("vue3");
    } else if (vueProfile.version === 2) {
      if (vueProfile.type === "composition") {
        layer1Folders.push("vue2/vue2-composition.md");
      } else {
        layer1Folders.push("vue2/vue2-general.md");
      }
    }
  }
  const layer1Rules = await loadLayerRules(ctx, logger, layers.base?.id || "layer1_base", layer1Folders);
  const layer1ReferenceIndex = [];
  if (ctx.ruleLevel !== "full") {
    const layer1FullRules = await loadLayerRules(
      { ...ctx, ruleLevel: "full" },
      logger,
      layers.base?.id || "layer1_base",
      layer1Folders
    );
    for (const rule of layer1FullRules) {
      const referencePath = `.codebuddy/rules_cache/layer1_reference/${rule.path}`.replace(/\\/g, "/");
      writeManagedFile(managedFileTracker, path5.join(targetDir, referencePath), rule.content);
      layer1ReferenceIndex.push({
        rule: rule.path.replace(/\.md$/, ""),
        path: referencePath
      });
    }
    if (layer1ReferenceIndex.length > 0) {
      logger.log(`\u5DF2\u751F\u6210 ${layer1ReferenceIndex.length} \u4E2A Layer 1 \u5B8C\u6574\u53C2\u8003\u7F13\u5B58`);
    }
  }
  finalContent += `## ${layers.base?.title || "Layer 1: \u57FA\u7840\u89C4\u8303"}

`;
  finalContent += `> \u8FD9\u4E9B\u662F\u672C\u9879\u76EE\u5FC5\u987B\u9075\u5B88\u7684\u6838\u5FC3\u89C4\u8303

`;
  for (const rule of layer1Rules) {
    finalContent += `<!-- Source: ${rule.path} -->
${rule.content}

---

`;
  }
  logger.log("\u5904\u7406 Layer 2: \u4E1A\u52A1\u89C4\u8303 (Lazy Load)...");
  const layer2Index = [];
  const businessDeps = layers.business?.dependencies || {};
  const standaloneLang = primaryProject ? primaryProject.lang : detectProjectLangFromDir(targetDir);
  const standalonePackageJson = !primaryProject && fs5.existsSync(path5.join(targetDir, "package.json")) ? pkg : void 0;
  const standaloneMetadata = primaryProject ? null : detectProjectMetadata(targetDir, standaloneLang, standalonePackageJson);
  const layer2TargetProject = primaryProject ?? {
    lang: standaloneLang,
    projectKind: standaloneMetadata?.projectKind || "unknown",
    stackTags: standaloneMetadata?.stackTags || [],
    dependencies: standaloneMetadata?.dependencies || dependencies
  };
  for (const match of collectMatchedBusinessRules(layer2TargetProject, businessDeps)) {
    logger.log(`  \u547D\u4E2D ${match.selector}\uFF0C\u6DFB\u52A0\u89C4\u5219\u7D22\u5F15`);
    layer2Index.push({
      dep: match.selector,
      rule: match.rule,
      path: `.codebuddy/rules_cache/layer2_business/${match.rule}.md`
    });
    const cacheDir = path5.join(targetDir, ".codebuddy/rules_cache/layer2_business");
    if (!fs5.existsSync(cacheDir)) {
      fs5.mkdirSync(cacheDir, { recursive: true });
    }
    const content = await loadRuleFile(ctx, logger, layers.business?.id || "layer2_business", `${match.rule}.md`);
    if (content) {
      writeManagedFile(managedFileTracker, path5.join(cacheDir, `${match.rule}.md`), content);
    }
  }
  if (workspaceInfo.totalProjectCount > 1) {
    logger.log("\u5904\u7406 Workspace \u5B50\u9879\u76EE Layer2 \u89C4\u5219...");
    for (const project of workspaceInfo.projects) {
      if (project.relativePath === ".") continue;
      for (const match of collectMatchedBusinessRules(project, businessDeps)) {
        logger.verbose(`  ${project.name}: \u547D\u4E2D ${match.selector}\uFF0C\u6DFB\u52A0\u89C4\u5219\u7D22\u5F15`);
        project.matchedLayer2Rules.push({
          dep: match.selector,
          rule: match.rule,
          path: `.codebuddy/rules_cache/projects/${project.relativePath}/layer2_business/${match.rule}.md`
        });
        const projectCacheDir = path5.join(
          targetDir,
          `.codebuddy/rules_cache/projects/${project.relativePath}/layer2_business`
        );
        if (!fs5.existsSync(projectCacheDir)) {
          fs5.mkdirSync(projectCacheDir, { recursive: true });
        }
        const content = await loadRuleFile(ctx, logger, layers.business?.id || "layer2_business", `${match.rule}.md`);
        if (content) {
          writeManagedFile(managedFileTracker, path5.join(projectCacheDir, `${match.rule}.md`), content);
        }
      }
    }
    const rootProject = workspaceInfo.projects.find((p) => p.relativePath === ".");
    if (rootProject) {
      rootProject.matchedLayer2Rules = [...layer2Index];
    }
  }
  logger.log("\u5904\u7406 Layer 3: \u4EFB\u52A1\u68C0\u67E5\u6E05\u5355 (Lazy Load)...");
  const layer3Index = [];
  const actionDefaults = layers.action?.defaults || [];
  for (const item of actionDefaults) {
    layer3Index.push({
      rule: item,
      path: `.codebuddy/rules_cache/layer3_action/${item}.md`
    });
    const cacheDir = path5.join(targetDir, ".codebuddy/rules_cache/layer3_action");
    if (!fs5.existsSync(cacheDir)) {
      fs5.mkdirSync(cacheDir, { recursive: true });
    }
    const content = await loadRuleFile(ctx, logger, layers.action?.id || "layer3_action", item + ".md");
    if (content) {
      writeManagedFile(managedFileTracker, path5.join(cacheDir, item + ".md"), content);
    }
  }
  if (layer1ReferenceIndex.length > 0 || layer2Index.length > 0 || layer3Index.length > 0) {
    finalContent += `## \u{1F4DA} \u89C4\u5219\u53C2\u8003\u7D22\u5F15 (\u6309\u9700\u52A0\u8F7D)

`;
    if (layer1ReferenceIndex.length > 0) {
      finalContent += `> \u5F53\u524D\u4E3B\u5165\u53E3\u4EC5\u5185\u5D4C Layer 1 \u7684 ${ctx.ruleLevel} \u5185\u5BB9\uFF1B\u5B8C\u6574\u539F\u6587\u4E0E Layer 2/3 \u7EC6\u8282\u89C4\u5219\u8BF7\u6309\u9700\u8BFB\u53D6

`;
    } else {
      finalContent += `> \u4EE5\u4E0B\u89C4\u5219\u5305\u542B\u5177\u4F53\u7684\u6280\u672F\u6808\u5B9E\u73B0\u7EC6\u8282\uFF0C\u8BF7\u6309\u9700\u8BFB\u53D6

`;
    }
    finalContent += `| \u89C4\u5219\u540D\u79F0 | \u672C\u5730\u8DEF\u5F84 | \u8BF4\u660E |
|---------|---------|------|
`;
    for (const item of layer1ReferenceIndex) {
      finalContent += `| ${item.rule} | \`${item.path}\` | Layer 1 \u5B8C\u6574\u53C2\u8003 |
`;
    }
    for (const item of layer2Index) {
      finalContent += `| ${item.rule} | \`${item.path}\` | Layer 2 \u5339\u914D\uFF1A${item.dep} |
`;
    }
    for (const item of layer3Index) {
      finalContent += `| ${item.rule} | \`${item.path}\` | \u4EFB\u52A1\u68C0\u67E5\u6E05\u5355 |
`;
    }
    finalContent += "\n";
  }
  let workspaceIndexPath = null;
  if (workspaceInfo.totalProjectCount > 1) {
    const workspaceIndex = {
      version: "1.1.0",
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      rootDir: targetDir,
      projectCount: workspaceInfo.projects.length,
      totalProjectCount: workspaceInfo.totalProjectCount,
      scope: workspaceInfo.scope,
      selectedProject: workspaceInfo.selectedProject,
      projects: workspaceInfo.projects.map((p) => ({
        name: p.name,
        relativePath: p.relativePath,
        lang: p.lang,
        frameworkLabel: p.frameworkLabel,
        uiLibLabels: p.uiLibLabels,
        projectKind: p.projectKind,
        stackTags: p.stackTags,
        vueVersion: p.vueProfile?.version ?? null,
        layer2CachePath: p.relativePath === "." ? ".codebuddy/rules_cache/layer2_business/" : `.codebuddy/rules_cache/projects/${p.relativePath}/layer2_business/`,
        matchedRules: p.matchedLayer2Rules.map((r) => r.rule)
      }))
    };
    workspaceIndexPath = path5.join(targetDir, ".codebuddy/workspace-index.json");
    const workspaceIndexDir = path5.dirname(workspaceIndexPath);
    if (!fs5.existsSync(workspaceIndexDir)) {
      fs5.mkdirSync(workspaceIndexDir, { recursive: true });
    }
    writeManagedFile(managedFileTracker, workspaceIndexPath, JSON.stringify(workspaceIndex, null, 2));
    logger.log(`\u5DF2\u751F\u6210 workspace-index.json (${workspaceInfo.projects.length} \u4E2A\u9879\u76EE)`);
    finalContent += generateWorkspacePrompt(workspaceInfo);
  }
  finalContent += generateRuleActivationPrompt(config);
  finalContent += generateQuickActionGuide();
  let skills = [];
  let skillsRootDir = null;
  const skillsSnapshotRetention = skillsConfig?.enabled ? SKILL_SNAPSHOT_RETAIN_COUNT : null;
  if (skillsConfig?.enabled) {
    logger.log("\u52A0\u8F7D\u6280\u80FD\u7CFB\u7EDF...");
    skillsRootDir = `.codebuddy/skill-snapshots/${createInstallSnapshotId()}`;
    logger.verbose(`Skills active root: ${skillsRootDir}`);
    skills = await loadSkills(
      ctx,
      logger,
      skillsConfig.path || "custom-skills",
      managedFileTracker,
      targetDir,
      workspaceInfo,
      skillsRootDir
    );
    logger.log(`\u5DF2\u52A0\u8F7D ${skills.length} \u4E2A\u6280\u80FD`);
    finalContent += generateSkillsPrompt(skills, skillsRootDir);
  }
  logger.log("\u52A0\u8F7D Agent \u7CFB\u7EDF...");
  let agentsRootDir = `.codebuddy/agent-snapshots/${createInstallSnapshotId()}`;
  const agentsSnapshotRetention = AGENT_SNAPSHOT_RETAIN_COUNT;
  logger.verbose(`Agents active root: ${agentsRootDir}`);
  const agents = await loadAgents(ctx, logger, "agents", managedFileTracker, targetDir, agentsRootDir);
  if (agents.length > 0) {
    logger.log(`\u5DF2\u52A0\u8F7D ${agents.length} \u4E2A Agents`);
    finalContent += generateAgentsPrompt(agents, agentsRootDir);
  }
  logger.log("\u5206\u53D1\u5DE5\u5177\u811A\u672C...");
  const distributedScripts = await distributeScripts(ctx, logger, targetDir, managedFileTracker);
  if (distributedScripts.length > 0) {
    logger.log(`\u5DF2\u5206\u53D1 ${distributedScripts.length} \u4E2A\u811A\u672C`);
    finalContent += generateScriptsPrompt(distributedScripts);
  }
  let distributedWorkflows = [];
  if (ctx.enableOrchestrator) {
    logger.log("\u5206\u53D1 Workflows...");
    distributedWorkflows = await distributeWorkflows(ctx, logger, targetDir, managedFileTracker);
    if (distributedWorkflows.length > 0) {
      logger.log(`\u5DF2\u5206\u53D1 ${distributedWorkflows.length} \u4E2A\u5DE5\u4F5C\u6D41`);
      finalContent += generateWorkflowsPrompt(distributedWorkflows);
    }
  } else {
    logger.verbose("\u8DF3\u8FC7 Workflows \u5206\u53D1\uFF08\u5F53\u524D profile \u4E0D\u5305\u542B\u7F16\u6392\u5951\u7EA6\uFF09");
  }
  let distributedTaskBooks = [];
  if (ctx.enableOrchestrator) {
    logger.log("\u5206\u53D1 TaskBook \u5951\u7EA6...");
    distributedTaskBooks = await distributeTaskBooks(ctx, logger, targetDir, managedFileTracker);
    if (distributedTaskBooks.length > 0) {
      logger.log(`\u5DF2\u5206\u53D1 ${distributedTaskBooks.length} \u4E2A TaskBook \u5951\u7EA6\u6587\u4EF6`);
      finalContent += generateTaskBooksPrompt(distributedTaskBooks);
    }
  } else {
    logger.verbose("\u8DF3\u8FC7 TaskBook \u5951\u7EA6\u5206\u53D1\uFF08\u5F53\u524D profile \u4E0D\u5305\u542B\u7F16\u6392\u5951\u7EA6\uFF09");
  }
  let distributedAgentCalls = [];
  if (ctx.enableOrchestrator) {
    logger.log("\u5206\u53D1 Agent Call \u5951\u7EA6...");
    distributedAgentCalls = await distributeAgentCalls(ctx, logger, targetDir, managedFileTracker);
    if (distributedAgentCalls.length > 0) {
      logger.log(`\u5DF2\u5206\u53D1 ${distributedAgentCalls.length} \u4E2A Agent Call \u5951\u7EA6\u6587\u4EF6`);
      finalContent += generateAgentCallsPrompt(distributedAgentCalls);
    }
  } else {
    logger.verbose("\u8DF3\u8FC7 Agent Call \u5951\u7EA6\u5206\u53D1\uFF08\u5F53\u524D profile \u4E0D\u5305\u542B\u7F16\u6392\u5951\u7EA6\uFF09");
  }
  logger.log("\u5206\u53D1 Slash Commands...");
  const distributedCommands = await distributeCommands(ctx, logger, targetDir, managedFileTracker);
  if (distributedCommands.length > 0) {
    logger.log(`\u5DF2\u5206\u53D1 ${distributedCommands.length} \u4E2A\u547D\u4EE4`);
    finalContent += generateCommandsPrompt(distributedCommands);
  }
  const outputDir = path5.join(targetDir, output?.dirName || ".codebuddy/rules");
  if (!fs5.existsSync(outputDir)) {
    fs5.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path5.join(outputDir, output?.fileName || "project-rules.md");
  writeManagedFile(managedFileTracker, outputPath, finalContent);
  updateGitignore(logger, targetDir);
  const removedManagedFiles = cleanupStaleManagedFiles(
    managedFileTracker,
    previousInstallState,
    {
      preservePrefixes: [
        ".codebuddy/agent-snapshots/",
        ".codebuddy/agents/",
        ".codebuddy/skill-snapshots/",
        ".codebuddy/skills/"
      ]
    },
    logger
  );
  const installState = buildInstallState({
    ctx,
    logger,
    targetDir,
    outputPath,
    workspaceIndexPath,
    skillsRootDir,
    skillsSnapshotRetention,
    agentsRootDir,
    agentsSnapshotRetention,
    layer1RulesCount: layer1Rules.length,
    layer2IndexCount: layer2Index.length,
    layer3IndexCount: layer3Index.length,
    skillsCount: skills.length,
    agentsCount: agents.length,
    distributedScripts,
    distributedWorkflows,
    distributedTaskBooks,
    distributedAgentCalls,
    distributedCommands,
    managedFiles: getManagedFiles(managedFileTracker),
    workspaceInfo
  });
  const installStatePath = writeInstallState(targetDir, installState);
  const removedAgentSnapshots = gcSnapshotEntries(
    targetDir,
    ".codebuddy/agent-snapshots",
    agentsRootDir,
    agentsSnapshotRetention || AGENT_SNAPSHOT_RETAIN_COUNT,
    logger
  );
  const removedSkillSnapshots = gcSnapshotEntries(
    targetDir,
    ".codebuddy/skill-snapshots",
    skillsRootDir,
    skillsSnapshotRetention || SKILL_SNAPSHOT_RETAIN_COUNT,
    logger
  );
  logger.log(`\u5DF2\u751F\u6210 install.json: ${installStatePath}`);
  logger.log(`\u540C\u6B65\u7ED3\u679C: \u5199\u5165 ${managedFileTracker.summary.written}\uFF0C\u590D\u7528 ${managedFileTracker.summary.unchanged}\uFF0C\u6E05\u7406 ${removedManagedFiles.length}`);
  if (removedAgentSnapshots.length > 0) {
    logger.log(`Agent \u5FEB\u7167\u56DE\u6536: ${removedAgentSnapshots.length} \u4E2A\uFF08\u4FDD\u7559\u6700\u8FD1 ${agentsSnapshotRetention || AGENT_SNAPSHOT_RETAIN_COUNT} \u4E2A\uFF09`);
  }
  if (removedSkillSnapshots.length > 0) {
    logger.log(`\u6280\u80FD\u5FEB\u7167\u56DE\u6536: ${removedSkillSnapshots.length} \u4E2A\uFF08\u4FDD\u7559\u6700\u8FD1 ${skillsSnapshotRetention || SKILL_SNAPSHOT_RETAIN_COUNT} \u4E2A\uFF09`);
  }
  logger.log("");
  logger.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  logger.log(`\u2705 \u6210\u529F! \u89C4\u5219\u6587\u4EF6\u5DF2\u5199\u5165: ${outputPath}`);
  logger.log(`   \u6587\u4EF6\u5927\u5C0F: ${(finalContent.length / 1024).toFixed(2)} KB`);
  logger.log(`   Layer 1 \u89C4\u5219: ${layer1Rules.length} \u4E2A`);
  logger.log(`   Layer 2 \u7D22\u5F15: ${layer2Index.length} \u4E2A`);
  logger.log(`   Layer 3 \u7D22\u5F15: ${layer3Index.length} \u4E2A`);
  logger.log(`   \u5DE5\u5177\u811A\u672C: ${distributedScripts.length} \u4E2A`);
  logger.log(`   Workflows: ${distributedWorkflows.length} \u4E2A`);
  logger.log(`   TaskBook \u5951\u7EA6: ${distributedTaskBooks.length} \u4E2A`);
  logger.log(`   Agent Call \u5951\u7EA6: ${distributedAgentCalls.length} \u4E2A`);
  logger.log(`   Slash Commands: ${distributedCommands.length} \u4E2A`);
  if (workspaceInfo.totalProjectCount > 1) {
    logger.log(`   Workspace \u5B50\u9879\u76EE: ${workspaceInfo.projects.length} \u4E2A`);
    for (const p of workspaceInfo.projects) {
      const rules = p.matchedLayer2Rules.map((r) => r.rule).join(", ") || "\u65E0";
      logger.log(`     - ${p.name} (${p.relativePath}): ${p.frameworkLabel || "\u65E0\u6846\u67B6"} | \u89C4\u5219: ${rules}`);
    }
  }
  logger.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
}
main().catch((err) => {
  logError(`Fatal Error: ${err.message}`);
  process.exit(1);
});
