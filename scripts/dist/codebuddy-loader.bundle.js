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
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));

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
function fetchUrl(ctx, logger, url, retries = 3) {
  return new Promise((resolve2, reject) => {
    const client = url.startsWith("https") ? https : http;
    logger.verbose(`Fetching: ${url} (Retries left: ${retries})`);
    const request = client.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        logger.verbose(`Redirecting to: ${res.headers.location}`);
        fetchUrl(ctx, logger, res.headers.location, retries).then(resolve2).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        if (res.statusCode && res.statusCode >= 500 && retries > 0) {
          res.resume();
          logger.warn(`HTTP ${res.statusCode}. Retrying...`);
          setTimeout(() => {
            fetchUrl(ctx, logger, url, retries - 1).then(resolve2).catch(reject);
          }, 1e3);
          return;
        }
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}: Failed to fetch ${url}`));
        return;
      }
      let data = "";
      res.on("data", (chunk) => {
        data += chunk.toString();
      });
      res.on("end", () => {
        logger.verbose(`Fetched ${data.length} bytes from ${url}`);
        resolve2(data);
      });
    });
    request.on("error", (e) => {
      if (retries > 0) {
        logger.warn(`Network Error (${e.code}). Retrying...`);
        setTimeout(() => {
          fetchUrl(ctx, logger, url, retries - 1).then(resolve2).catch(reject);
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
          fetchUrl(ctx, logger, url, retries - 1).then(resolve2).catch(reject);
        }, 1e3);
        return;
      }
      reject(new Error(`Request Timeout: ${url}`));
    });
  });
}

// scripts/src/lib/distributor.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
async function distributeItems(ctx, logger, targetDir, projectRoot, options) {
  const distributed = [];
  const localDir = path.join(targetDir, options.targetSubDir);
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  if (options.preCreateDirs) {
    for (const sub of options.preCreateDirs) {
      const subPath = path.join(localDir, sub);
      if (!fs.existsSync(subPath)) fs.mkdirSync(subPath, { recursive: true });
    }
  }
  for (const item of options.items) {
    const destPath = path.join(localDir, item.destFile);
    if (ctx.isRemote) {
      const url = `${ctx.remoteBaseUrl}/${item.sourcePath}`;
      try {
        const content = await fetchUrl(ctx, logger, url);
        fs.writeFileSync(destPath, content, "utf-8");
        distributed.push(item.destFile);
        logger.verbose(`\u5DF2\u4E0B\u8F7D ${options.label}: ${item.destFile}`);
      } catch (e) {
        logger.warn(`${options.label} \u4E0B\u8F7D\u5931\u8D25: ${item.destFile} - ${e.message}`);
      }
    } else {
      const srcPath = path.join(projectRoot, item.sourcePath);
      if (!fs.existsSync(srcPath)) {
        logger.warn(`${options.label} \u6587\u4EF6\u4E0D\u5B58\u5728: ${srcPath}`);
        continue;
      }
      try {
        fs.copyFileSync(srcPath, destPath);
        distributed.push(item.destFile);
        logger.verbose(`\u5DF2\u590D\u5236 ${options.label}: ${item.destFile}`);
      } catch (e) {
        logger.warn(`${options.label} \u590D\u5236\u5931\u8D25: ${item.destFile} - ${e.message}`);
      }
    }
  }
  if (distributed.length > 0 && options.readme) {
    const readmePath = path.join(localDir, "README.md");
    fs.writeFileSync(readmePath, options.readme, "utf-8");
  }
  return distributed;
}
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((child) => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// scripts/src/lib/metadata-parser.ts
function parseSkillMetadata(skillId, content) {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!frontmatterMatch) return null;
  const frontmatter = frontmatterMatch[1];
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  let descMatch = frontmatter.match(/^description:\s*["'](.+)["']$/m);
  if (!descMatch) descMatch = frontmatter.match(/^description:\s*(.+)$/m);
  if (!nameMatch || !descMatch) return null;
  const triggers = [];
  const triggersMatch = frontmatter.match(/^triggers:\s*\n((?:\s+-\s*.+\n?)+)/m);
  if (triggersMatch) {
    const triggerLines = triggersMatch[1].split("\n");
    for (const line of triggerLines) {
      const match = line.match(/^\s+-\s*["']?(.+?)["']?\s*$/);
      if (match) triggers.push(match[1]);
    }
  }
  return {
    id: skillId,
    name: nameMatch[1].trim(),
    description: descMatch[1].trim(),
    triggers
  };
}
function parseAgentMetadata(agentId, content) {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!frontmatterMatch) return null;
  const frontmatter = frontmatterMatch[1];
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  let descMatch = frontmatter.match(/^description:\s*["'](.+)["']$/m);
  if (!descMatch) descMatch = frontmatter.match(/^description:\s*(.+)$/m);
  if (!nameMatch || !descMatch) return null;
  const triggers = [];
  const triggersMatch = frontmatter.match(/^triggers:\s*\n((?:\s+-\s*.+\n?)+)/m);
  if (triggersMatch) {
    const triggerLines = triggersMatch[1].split("\n");
    for (const line of triggerLines) {
      const match = line.match(/^\s+-\s*["']?(.+?)["']?\s*$/);
      if (match) triggers.push(match[1]);
    }
  }
  const permissions = [];
  const permMatch = frontmatter.match(/permissions:\s*\n\s+tools:\s*\n((?:\s+-\s*.+\n?)+)/m);
  if (permMatch) {
    const permLines = permMatch[1].split("\n");
    for (const line of permLines) {
      const match = line.match(/^\s+-\s*(.+?)\s*$/);
      if (match) permissions.push(match[1]);
    }
  }
  let workflowSummary;
  const workflowMatch = frontmatter.match(/workflow_summary:\s*\|\s*\n((?:\s+.+\n?)+)/m);
  if (workflowMatch) {
    workflowSummary = workflowMatch[1].split("\n").map((line) => line.replace(/^\s{2}/, "")).join("\n").trim();
  }
  const implicitTriggers = [];
  const bodyYamlMatch = content.match(/```yaml\s*\n([\s\S]*?)```/);
  if (bodyYamlMatch) {
    const bodyYaml = bodyYamlMatch[1];
    const implicitSection = bodyYaml.match(/implicit:\s*\n((?:\s+-[\s\S]*?)(?=\n\S|\n```|$))/);
    if (implicitSection) {
      const patternRegex = /- pattern:\s*["'](.+?)["']\s*\n\s+confidence:\s*([\d.]+)/g;
      let pMatch;
      while (pMatch = patternRegex.exec(implicitSection[1])) {
        implicitTriggers.push({ pattern: pMatch[1], confidence: parseFloat(pMatch[2]) });
      }
    }
  }
  return {
    id: agentId,
    name: nameMatch[1].trim(),
    description: descMatch[1].trim(),
    triggers,
    implicitTriggers: implicitTriggers.length > 0 ? implicitTriggers : void 0,
    permissions,
    workflowSummary
  };
}

// scripts/src/lib/prompt-builder.ts
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
function generateCommandsPrompt(commands) {
  if (commands.length === 0) return "";
  let table = "| \u547D\u4EE4 | \u8BF4\u660E | \u89E6\u53D1\u65B9\u5F0F |\n|------|------|----------|\n";
  for (const cmd of commands) {
    if (cmd === "task.md") {
      table += `| \`/task\` | \u7AEF\u5230\u7AEF\u8BA1\u5212\u4EFB\u52A1\u7F16\u6392 | \`/task \u5B9E\u73B0\u7528\u6237\u767B\u5F55\u529F\u80FD\` \u6216 "\u5E2E\u6211\u5B9E\u73B0xxx" |
`;
    } else {
      const cmdName = cmd.replace(".md", "");
      table += `| \`/${cmdName}\` | - | \`/${cmdName}\` |
`;
    }
  }
  return `
# \u{1F4CB} Slash Commands \u7D22\u5F15

\u672C\u89C4\u5219\u5E93\u5305\u542B\u53EF\u6267\u884C\u7684 Slash Commands\uFF0C\u5DF2\u5B89\u88C5\u81F3 \`.codebuddy/commands/\`\u3002

## \u5DF2\u5B89\u88C5\u547D\u4EE4

${table}

## \u{1F680} /task \u547D\u4EE4\u4F7F\u7528\u6307\u5357

\`/task\` \u662F\u7AEF\u5230\u7AEF\u7684\u8BA1\u5212\u4EFB\u52A1\u7F16\u6392\u547D\u4EE4\uFF0C\u652F\u6301\uFF1A

### \u89E6\u53D1\u65B9\u5F0F

\`\`\`bash
# Slash Command \u65B9\u5F0F
/task \u5B9E\u73B0\u7528\u6237\u767B\u5F55\u529F\u80FD
/task \u91CD\u6784\u8BA2\u5355\u5904\u7406\u6A21\u5757

# \u5173\u952E\u8BCD\u81EA\u52A8\u89E6\u53D1
\u5E2E\u6211\u5B9E\u73B0\u5546\u54C1\u641C\u7D22\u529F\u80FD
\u5F00\u53D1\u7528\u6237\u4E2D\u5FC3\u6A21\u5757
\u91CD\u6784\u8D2D\u7269\u8F66\u903B\u8F91
\`\`\`

### \u5DE5\u4F5C\u6D41\u7A0B

\`\`\`
\u610F\u56FE\u8BC6\u522B \u2192 \u4E0A\u4E0B\u6587\u6536\u96C6 \u2192 \u9700\u6C42\u5206\u89E3 \u2192 \u7528\u6237\u786E\u8BA4 \u2192 \u81EA\u52A8\u6267\u884C \u2192 \u53D8\u66F4\u8FFD\u8E2A \u2192 \u9A8C\u6536\u95ED\u73AF
\`\`\`

### \u6838\u5FC3\u7279\u6027

- **\u5E76\u884C\u6267\u884C**: \u65E0\u4F9D\u8D56\u4EFB\u52A1\u81EA\u52A8\u5E76\u884C\uFF0C\u63D0\u5347\u6548\u7387
- **\u53D8\u66F4\u8FFD\u8E2A**: \u5B9E\u65F6\u8BB0\u5F55\u504F\u79BB\u539F\u8BA1\u5212\u7684\u6539\u52A8\u53CA\u539F\u56E0
- **\u963B\u585E\u5904\u7406**: \u9047\u5230\u963B\u585E\u6682\u505C\uFF0C\u7B49\u5F85\u7528\u6237\u4ECB\u5165
- **\u9A8C\u6536\u95ED\u73AF**: \u751F\u6210\u9A8C\u6536\u62A5\u544A\uFF0C\u8BF7\u6C42\u6700\u7EC8\u786E\u8BA4
- **\u4EFB\u52A1\u6301\u4E45\u5316**: TaskBook \u53EF\u6062\u590D\uFF0C\u652F\u6301\u4E2D\u65AD\u7EE7\u7EED

### TaskBook \u5B58\u50A8

\`\`\`
.codebuddy/taskbooks/
\u251C\u2500\u2500 active/      # \u8FDB\u884C\u4E2D\u7684\u4EFB\u52A1\u4E66
\u2514\u2500\u2500 history/     # \u5DF2\u5B8C\u6210\u7684\u4EFB\u52A1\u4E66
\`\`\`

**\u8BE6\u7EC6\u4F7F\u7528\u8BF4\u660E**: \u8BF7\u8BFB\u53D6 \`.codebuddy/commands/task.md\`
`;
}
function generateScriptsReadme(scripts) {
  const lines = [
    "# CodeBuddy \u5DE5\u5177\u811A\u672C",
    "",
    "> \u81EA\u52A8\u751F\u6210\uFF0C\u8BF7\u52FF\u624B\u52A8\u7F16\u8F91",
    "",
    "## \u5DF2\u5B89\u88C5\u811A\u672C",
    "",
    "| \u811A\u672C | \u8BF4\u660E | \u7528\u6CD5 |",
    "|------|------|------|"
  ];
  for (const script of scripts) {
    if (script === "structure-analyzer.js") {
      lines.push(`| \`${script}\` | \u9879\u76EE\u7ED3\u6784\u5206\u6790\u5668 | \`node .codebuddy/scripts/${script} .\` |`);
    } else if (script === "agent-call-manager.js") {
      lines.push(`| \`${script}\` | Agent Call \u7BA1\u7406\u5668\uFF08list/show/validate\uFF09 | \`node .codebuddy/scripts/${script} list\` |`);
    } else if (script === "task-orchestrator.js") {
      lines.push(`| \`${script}\` | \u4E00\u952E\u95ED\u73AF\u6267\u884C\u5668\uFF08\u521B\u5EFA/\u89C4\u5212/\u6267\u884C/\u9A8C\u6536\uFF09 | \`node .codebuddy/scripts/${script} "\u5B9E\u73B0\u7528\u6237\u767B\u5F55" --type new-feature\` |`);
    } else if (script === "contract-validator.js") {
      lines.push(`| \`${script}\` | \u5951\u7EA6\u6821\u9A8C\u5668\uFF08TaskBook/Workflow\uFF09| \`node .codebuddy/scripts/${script} --workflows --taskbooks\` |`);
    } else {
      lines.push(`| \`${script}\` | - | \`node .codebuddy/scripts/${script}\` |`);
    }
  }
  lines.push("");
  lines.push("## \u4F7F\u7528\u793A\u4F8B");
  lines.push("");
  lines.push("### \u9879\u76EE\u7ED3\u6784\u5206\u6790");
  lines.push("");
  lines.push("```bash");
  lines.push("# \u5206\u6790\u5F53\u524D\u9879\u76EE");
  lines.push("node .codebuddy/scripts/structure-analyzer.js .");
  lines.push("");
  lines.push("# \u8F93\u51FA JSON \u683C\u5F0F");
  lines.push("node .codebuddy/scripts/structure-analyzer.js . --output json");
  lines.push("");
  lines.push("# \u5B8C\u6574\u6A21\u5F0F\uFF08\u542B\u76EE\u5F55\u6811\uFF09");
  lines.push("node .codebuddy/scripts/structure-analyzer.js . --mode full");
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}
function generateScriptsPrompt(scripts) {
  if (scripts.length === 0) return "";
  let table = "| \u811A\u672C | \u8BF4\u660E | \u7528\u6CD5 |\n|------|------|------|\n";
  for (const script of scripts) {
    if (script === "structure-analyzer.js") {
      table += `| \`${script}\` | \u9879\u76EE\u7ED3\u6784\u5206\u6790\u5668 | \`node .codebuddy/scripts/${script} .\` |
`;
    } else if (script === "module-mapper.js") {
      table += `| \`${script}\` | \u6A21\u5757\u56FE\u8C31\u5206\u6790\u5668 | \`node .codebuddy/scripts/${script} .\` |
`;
    } else if (script === "report-manager.js") {
      table += `| \`${script}\` | \u62A5\u544A\u7BA1\u7406\u5668 | \`node .codebuddy/scripts/${script} status\` |
`;
    } else if (script === "agent-call-manager.js") {
      table += `| \`${script}\` | Agent Call \u7BA1\u7406\u5668\uFF08list/show/validate\uFF09 | \`node .codebuddy/scripts/${script} list\` |
`;
    } else if (script === "task-orchestrator.js") {
      table += `| \`${script}\` | \u4E00\u952E\u95ED\u73AF\u6267\u884C\u5668\uFF08\u521B\u5EFA/\u89C4\u5212/\u6267\u884C/\u9A8C\u6536\uFF09 | \`node .codebuddy/scripts/${script} "\u5B9E\u73B0\u7528\u6237\u767B\u5F55" --type new-feature\` |
`;
    } else if (script === "contract-validator.js") {
      table += `| \`${script}\` | \u5951\u7EA6\u6821\u9A8C\u5668\uFF08TaskBook/Workflow\uFF09| \`node .codebuddy/scripts/${script} --workflows --taskbooks\` |
`;
    } else {
      table += `| \`${script}\` | - | \`node .codebuddy/scripts/${script}\` |
`;
    }
  }
  return `
# \u{1F527} \u5DE5\u5177\u811A\u672C\u7D22\u5F15 (Scripts Index)

\u672C\u89C4\u5219\u5E93\u5305\u542B\u53EF\u6267\u884C\u811A\u672C\uFF0C\u5DF2\u5B89\u88C5\u81F3 \`.codebuddy/scripts/\`\u3002

## \u5DF2\u5B89\u88C5\u811A\u672C

${table}

## \u{1F680} \u811A\u672C\u8C03\u7528\u6307\u5357 (CodeBuddy)

\u5F53\u7528\u6237\u8BF7\u6C42\u6267\u884C\u7ED3\u6784\u5206\u6790\u3001\u5065\u5EB7\u5EA6\u68C0\u67E5\u7B49\u4EFB\u52A1\u65F6\uFF0C\u53EF\u4EE5\uFF1A

1. **\u76F4\u63A5\u8C03\u7528\u811A\u672C**\uFF08\u63A8\u8350\uFF09:
   \`\`\`bash
   node .codebuddy/scripts/structure-analyzer.js .
   \`\`\`

2. **\u6216\u4F7F\u7528 MCP \u5DE5\u5177**\uFF08\u5982\u5DF2\u914D\u7F6E\uFF09:
   \`\`\`
   analyze_project_structure({ projectPath: "." })
   \`\`\`

## \u{1F4CA} \u62A5\u544A\u7CFB\u7EDF (Project Memory)

\u5206\u6790\u7ED3\u679C\u81EA\u52A8\u4FDD\u5B58\u5230 \`.codebuddy/reports/\` \u76EE\u5F55\uFF1A

\`\`\`
.codebuddy/reports/
\u251C\u2500\u2500 manifest.json                 # \u62A5\u544A\u7D22\u5F15
\u251C\u2500\u2500 architecture/latest.json      # \u67B6\u6784\u5FEB\u7167
\u251C\u2500\u2500 modules/latest.json           # \u6A21\u5757\u56FE\u8C31
\u2514\u2500\u2500 health/timeline.json          # \u5065\u5EB7\u5EA6\u65F6\u95F4\u7EBF
\`\`\`

### \u62A5\u544A\u7BA1\u7406\u547D\u4EE4

\`\`\`bash
# \u67E5\u770B\u62A5\u544A\u72B6\u6001
node .codebuddy/scripts/report-manager.js status

# \u67E5\u8BE2\u6A21\u5757/\u6587\u4EF6\uFF08\u4E0A\u4E0B\u6E38/\u70ED\u70B9/\u8D8B\u52BF\uFF09
node .codebuddy/scripts/report-manager.js inspect --module "src/features/user"
node .codebuddy/scripts/report-manager.js inspect --file "src/features/user/index.ts"

# \u70ED\u70B9\u6A21\u5757\u5217\u8868
node .codebuddy/scripts/report-manager.js hotspots --top 10

# \u5BFC\u51FA Markdown \u62A5\u544A
node .codebuddy/scripts/report-manager.js export

# \u6E05\u7406\u8FC7\u671F\u62A5\u544A
node .codebuddy/scripts/report-manager.js cleanup
\`\`\`

### \u62A5\u544A\u590D\u7528

\u5F53\u62A5\u544A\u5B58\u5728\u4E14 < 24\u5C0F\u65F6\u65F6\uFF0C\u53EF\u76F4\u63A5\u8BFB\u53D6 JSON \u6587\u4EF6\u800C\u65E0\u9700\u91CD\u65B0\u5206\u6790\uFF1A
- \u67B6\u6784\u5FEB\u7167: \`.codebuddy/reports/architecture/latest.json\`
- \u6A21\u5757\u56FE\u8C31: \`.codebuddy/reports/modules/latest.json\`

## \u811A\u672C\u4E0E Skill/Agent \u7684\u5173\u7CFB

| \u7EC4\u4EF6 | \u804C\u8D23 | \u4F4D\u7F6E |
|------|------|------|
| **\u811A\u672C** | \u5B9E\u9645\u6267\u884C\u903B\u8F91 | \`.codebuddy/scripts/\` |
| **Skill** | \u77E5\u8BC6\u4E0A\u4E0B\u6587 | \`.codebuddy/skills/\` |
| **Agent** | \u5DE5\u4F5C\u6D41\u5B9A\u4E49 | \`.codebuddy/agents/\` |
| **Reports** | \u9879\u76EE\u8BB0\u5FC6 | \`.codebuddy/reports/\` |

**\u8C03\u7528\u94FE**: Skill/Agent \u63D0\u4F9B\u77E5\u8BC6 \u2192 \u811A\u672C\u6267\u884C\u5206\u6790 \u2192 Reports \u6301\u4E45\u5316 \u2192 \u540E\u7EED\u4EFB\u52A1\u590D\u7528
`;
}
function generateAgentsPrompt(agents) {
  if (agents.length === 0) return "";
  let agentDetails = "";
  for (const agent of agents) {
    const triggerText = agent.triggers.join(", ");
    agentDetails += `### ${agent.name} (\`${agent.id}\`)

`;
    agentDetails += `- **\u63CF\u8FF0**: ${agent.description}
`;
    agentDetails += `- **\u89E6\u53D1\u8BCD**: ${triggerText}
`;
    if (agent.workflowSummary) {
      agentDetails += `
${agent.workflowSummary}
`;
    }
    agentDetails += "\n";
  }
  let decisionNodes = "";
  for (const agent of agents) {
    if (agent.triggers.length === 0) continue;
    const triggerList = agent.triggers.join("/");
    decisionNodes += `\u251C\u2500 \u5305\u542B"${triggerList}"\uFF1F
`;
    decisionNodes += `\u2502  \u2514\u2500 YES \u2192 ${agent.id}\uFF08${agent.description}\uFF09
\u2502
`;
  }
  decisionNodes += `\u2514\u2500 \u4EE5\u4E0A\u5747\u4E0D\u5339\u914D\uFF1F
`;
  decisionNodes += `   \u2514\u2500 \u56DE\u9000\u5230\u3010\u7B2C\u4E09\u6B65\uFF1ASkill \u51B3\u7B56\u6811\u3011`;
  const orchestratorKeywords = [];
  for (const agent of agents) {
    for (const t of agent.triggers) {
      if (!t.startsWith("/") && !t.startsWith("plan ") && !t.startsWith("create ")) {
        orchestratorKeywords.push(t);
      }
    }
    if (agent.implicitTriggers) {
      for (const it of agent.implicitTriggers) {
        const cleaned = it.pattern.replace(/\.\*/g, "").replace(/[\\^$|?+()[\]{}]/g, "");
        if (cleaned.length > 0) {
          orchestratorKeywords.push(cleaned);
        }
      }
    }
  }
  const uniqueKeywords = [...new Set(orchestratorKeywords)];
  const keywordHints = uniqueKeywords.length > 0 ? uniqueKeywords.map((k) => `"${k}"`).join("/") : '"\u89C4\u5212/\u8BA1\u5212/\u5E2E\u6211\u5B9E\u73B0/\u5E2E\u6211\u89C4\u5212/\u5F00\u53D1"';
  return `
# \u{1F916} Agent \u4E0E Skill \u7EDF\u4E00\u8C03\u5EA6\u6307\u5357

\u672C\u89C4\u5219\u5E93\u652F\u6301 **Agent \u6267\u884C\u6A21\u5F0F** \u548C **Skill \u77E5\u8BC6\u6A21\u5F0F**\u3002\u6536\u5230\u7528\u6237\u8BF7\u6C42\u540E\uFF0C\u6309\u4EE5\u4E0B\u51B3\u7B56\u6811\u4ECE\u4E0A\u5230\u4E0B\u5224\u65AD\u3002

## \u7B2C\u4E00\u6B65\uFF1A\u5224\u65AD\u4EFB\u52A1\u89C4\u6A21

\`\`\`
\u7528\u6237\u8BF7\u6C42
\u2502
\u251C\u2500 \u662F\u5426\u6D89\u53CA\u591A\u6587\u4EF6\u3001\u591A\u6B65\u9AA4\u3001\u9700\u8981\u89C4\u5212+\u5B9E\u73B0+\u5BA1\u67E5\uFF1F
\u2502  \u2502  \u5224\u65AD\u4F9D\u636E\uFF1A
\u2502  \u2502  - \u63D0\u5230"\u6574\u4E2A\u6A21\u5757/\u7CFB\u7EDF/\u529F\u80FD"\uFF08\u975E\u5355\u4E2A\u6587\u4EF6/\u7EC4\u4EF6\uFF09
\u2502  \u2502  - \u5305\u542B ${keywordHints}
\u2502  \u2502  - \u9700\u8981\u5148\u8BBE\u8BA1\u518D\u7F16\u7801\u518D\u6D4B\u8BD5
\u2502  \u2502
\u2502  \u251C\u2500 YES \u2192 \u8FDB\u5165\u3010\u7B2C\u4E8C\u6B65\uFF1AAgent \u51B3\u7B56\u6811\u3011
\u2502  \u2514\u2500 NO\uFF08\u5355\u6587\u4EF6/\u5355\u7EC4\u4EF6/\u5355\u6B21\u64CD\u4F5C\uFF09\u2192 \u8FDB\u5165\u3010\u7B2C\u4E09\u6B65\uFF1ASkill \u51B3\u7B56\u6811\u3011
\`\`\`

## \u7B2C\u4E8C\u6B65\uFF1AAgent \u51B3\u7B56\u6811\uFF08\u591A\u6B65\u9AA4\u6D41\u7A0B\uFF09

\u547D\u4E2D\u5373\u505C\uFF0C\u4E0D\u518D\u7EE7\u7EED\u5339\u914D\uFF1A

\`\`\`
${decisionNodes}
\`\`\`

**Agent \u8C03\u7528\u6B65\u9AA4**:
1. \u8C03\u7528 \`read_file\` \u8BFB\u53D6 \`.codebuddy/agents/<agent-id>/AGENT.md\`
2. \u4E25\u683C\u6309 AGENT.md \u4E2D\u5B9A\u4E49\u7684\u6B65\u9AA4\u987A\u5E8F\u6267\u884C\uFF0C\u4E0D\u53EF\u8DF3\u8FC7
3. \u5408\u5E76\u7ED3\u679C\u8F93\u51FA\u5B8C\u6574\u62A5\u544A

## \u5DF2\u5B89\u88C5 Agents \u8BE6\u60C5

${agentDetails}

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
function generateSkillsPrompt(skills) {
  if (skills.length === 0) return "";
  let table = "| \u6280\u80FD\u540D\u79F0 | \u6280\u80FD ID | \u89E6\u53D1\u573A\u666F |\n|---------|---------|----------|\n";
  for (const skill of skills) {
    table += `| **${skill.name}** | \`${skill.id}\` | ${skill.description} |
`;
  }
  let decisionNodes = "";
  for (const skill of skills) {
    if (skill.triggers.length === 0) continue;
    const triggerList = skill.triggers.join("/");
    decisionNodes += `\u251C\u2500 \u5305\u542B"${triggerList}"\uFF1F
`;
    decisionNodes += `\u2502  \u2514\u2500 YES \u2192 ${skill.id}\uFF08${skill.name}\uFF09
\u2502
`;
  }
  decisionNodes += `\u2514\u2500 \u4EE5\u4E0A\u5747\u4E0D\u5339\u914D\uFF1F
`;
  decisionNodes += `   \u2514\u2500 \u4E0D\u52A0\u8F7D\u6280\u80FD\uFF0C\u76F4\u63A5\u57FA\u4E8E\u89C4\u5219\u56DE\u7B54`;
  return `
## \u7B2C\u4E09\u6B65\uFF1ASkill \u51B3\u7B56\u6811\uFF08\u5355\u6B21\u64CD\u4F5C\uFF09

\u6280\u80FD\u6587\u4EF6\u5DF2\u4E0B\u8F7D\u81F3 \`.codebuddy/skills/\`\u3002

> **Skill \u662F\u77E5\u8BC6\u6E90\uFF0C\u4E0D\u662F\u6267\u884C\u8005\u3002** \u5982\u679C\u4EFB\u52A1\u9700\u8981\u591A\u6B65\u9AA4\u81EA\u4E3B\u6D41\u7A0B\uFF0C\u8BF7\u56DE\u5230\u7B2C\u4E8C\u6B65\u4F7F\u7528 Agent\u3002

\u547D\u4E2D\u5373\u505C\uFF0C\u4E0D\u518D\u7EE7\u7EED\u5339\u914D\uFF1A

\`\`\`
${decisionNodes}
\`\`\`

**Skill \u8C03\u7528\u6B65\u9AA4**:
1. \u8C03\u7528 \`read_file\` \u8BFB\u53D6 \`.codebuddy/skills/<\u6280\u80FDID>/SKILL.md\`
2. \u6839\u636E SKILL.md \u4E2D\u7684\u8DEF\u7531\u903B\u8F91\uFF0C\u8BFB\u53D6 \`references/\` \u4E0B\u7684\u76F8\u5173\u6587\u6863
3. \u57FA\u4E8E\u5B8C\u6574\u4E0A\u4E0B\u6587\u6267\u884C\u7528\u6237\u4EFB\u52A1

## \u5DF2\u5B89\u88C5\u6280\u80FD\u4E00\u89C8

${table}

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

// scripts/src/codebuddy-loader.ts
var SCRIPT_DIR = __dirname;
var PROJECT_ROOT = path2.resolve(SCRIPT_DIR, "../..");
var RULES_ROOT = path2.join(PROJECT_ROOT, "rules");
var CONFIG_PATH = path2.join(PROJECT_ROOT, "config", "loader-config.json");
var SKILLS_ROOT = path2.join(PROJECT_ROOT, "custom-skills");
var AGENTS_ROOT = path2.join(PROJECT_ROOT, "agents");
var DEFAULT_TIMEOUT = 1e4;
var DEFAULT_THRESHOLD = 0.5;
var DEFAULT_RULE_LEVEL = "full";
function showHelp() {
  console.log(`
\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
\u2551      CodeBuddy \u89C4\u5219\u52A0\u8F7D\u5668 v2.0 - \u4E09\u5C42\u67B6\u6784 + \u6280\u80FD\u7CFB\u7EDF              \u2551
\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D

\u7528\u6CD5\uFF1A
  node codebuddy-loader.js [options]

\u9009\u9879\uFF1A
  --help, -h           \u663E\u793A\u5E2E\u52A9\u4FE1\u606F
  --remote <URL>       \u4ECE\u8FDC\u7A0B URL \u83B7\u53D6\u89C4\u5219
  --task <type>        \u6309\u4EFB\u52A1\u7C7B\u578B\u7B5B\u9009\u89C4\u5219\uFF08\u6E10\u8FDB\u5F0F\u62AB\u9732\uFF09
                       \u7C7B\u578B: refactoring, debugging, testing, new-feature, code-review
  --threshold <n>      \u8BBE\u7F6E\u76F8\u5173\u6027\u9608\u503C (0-1, \u9ED8\u8BA4: 0.5)
  --rule-level <lvl>   \u89C4\u5219\u5185\u5BB9\u88C1\u526A\u7B49\u7EA7\uFF08\u57FA\u4E8E @level:summary/quick/full \u5206\u6BB5\u6807\u8BB0\uFF0C\u9ED8\u8BA4: full\uFF09
  --enable-orchestrator \u542F\u7528 B \u8DEF\u7EBF\u7F16\u6392\u811A\u672C\u5206\u53D1\uFF08task-executor\u3001agent-call \u534F\u8BAE\u7B49\uFF09
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

  # \u4EC5\u52A0\u8F7D\u91CD\u6784\u76F8\u5173\u89C4\u5219
  node codebuddy-loader.js --task refactoring

  # \u4ECE\u8FDC\u7A0B\u52A0\u8F7D
  node codebuddy-loader.js --remote https://example.com/standards

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
    if (!fs2.existsSync(CONFIG_PATH)) {
      logger.error(`\u914D\u7F6E\u6587\u4EF6\u4E0D\u5B58\u5728: ${CONFIG_PATH}`);
      process.exit(1);
    }
    logger.verbose(`\u52A0\u8F7D\u672C\u5730\u914D\u7F6E: ${CONFIG_PATH}`);
    return { config: JSON.parse(fs2.readFileSync(CONFIG_PATH, "utf-8")), manifest: null };
  }
}
function getPackageJson(logger, targetDir) {
  const pkgPath = path2.join(targetDir, "package.json");
  if (!fs2.existsSync(pkgPath)) {
    logger.warn(`\u672A\u627E\u5230 package.json: ${pkgPath}`);
    return {};
  }
  try {
    return JSON.parse(fs2.readFileSync(pkgPath, "utf-8"));
  } catch (e) {
    logger.error(`\u89E3\u6790 package.json \u5931\u8D25: ${e.message}`);
    return {};
  }
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
async function loadRuleFile(ctx, logger, layerId, filePath) {
  if (ctx.isRemote) {
    const fileUrl = `${ctx.remoteBaseUrl}/rules/${layerId}/${filePath}`;
    try {
      return await fetchUrl(ctx, logger, fileUrl);
    } catch (e) {
      logger.warn(`\u8FDC\u7A0B\u89C4\u5219\u52A0\u8F7D\u5931\u8D25: ${filePath}`);
      return "";
    }
  } else {
    const fullPath = path2.join(RULES_ROOT, layerId, filePath);
    if (fs2.existsSync(fullPath)) {
      return fs2.readFileSync(fullPath, "utf-8");
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
      const folderPath = path2.join(RULES_ROOT, layerId, folder);
      if (fs2.existsSync(folderPath)) {
        const stat = fs2.statSync(folderPath);
        if (stat.isDirectory()) {
          const files = fs2.readdirSync(folderPath).filter((f) => f.endsWith(".md"));
          for (const file of files) {
            const content = fs2.readFileSync(path2.join(folderPath, file), "utf-8");
            contents.push({ path: `${folder}/${file}`, content: filterRuleByLevel(content, ctx.ruleLevel) });
          }
        } else if (folderPath.endsWith(".md")) {
          const content = fs2.readFileSync(folderPath, "utf-8");
          contents.push({ path: folder, content: filterRuleByLevel(content, ctx.ruleLevel) });
        }
      }
      const mdPath = path2.join(RULES_ROOT, layerId, folder + ".md");
      if (fs2.existsSync(mdPath)) {
        const content = fs2.readFileSync(mdPath, "utf-8");
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
async function loadEntities(ctx, logger, sourcePath, options) {
  const entities = [];
  const localDir = path2.join(process.cwd(), options.targetSubDir);
  if (!fs2.existsSync(localDir)) {
    fs2.mkdirSync(localDir, { recursive: true });
  }
  if (ctx.isRemote) {
    const files = ctx.remoteManifest.files.filter(
      (f) => f.path.startsWith(options.manifestPrefix) && f.path.endsWith(".md")
    );
    for (const file of files) {
      const fileUrl = `${ctx.remoteBaseUrl}/${file.path}`;
      try {
        const content = await fetchUrl(ctx, logger, fileUrl);
        const relativePath = file.path.replace(options.manifestPrefix, "");
        const localPath = path2.join(localDir, relativePath);
        const localDirPath = path2.dirname(localPath);
        if (!fs2.existsSync(localDirPath)) {
          fs2.mkdirSync(localDirPath, { recursive: true });
        }
        fs2.writeFileSync(localPath, content, "utf-8");
        logger.verbose(`\u5DF2\u4E0B\u8F7D${options.label}\u6587\u4EF6: ${relativePath}`);
        if (file.path.endsWith(options.metadataFileName)) {
          const entityId = relativePath.split("/")[0];
          const metadata = options.parseMetadata(entityId, content);
          if (metadata) entities.push(metadata);
        }
      } catch (e) {
        logger.warn(`${options.label}\u6587\u4EF6\u4E0B\u8F7D\u5931\u8D25: ${file.path} - ${e.message}`);
      }
    }
  } else {
    const sourceDir = path2.join(PROJECT_ROOT, sourcePath);
    if (fs2.existsSync(sourceDir)) {
      copyRecursive(sourceDir, localDir);
      const entityDirs = fs2.readdirSync(localDir).filter((f) => {
        const fullPath = path2.join(localDir, f);
        return fs2.existsSync(fullPath) && fs2.statSync(fullPath).isDirectory();
      });
      for (const entityId of entityDirs) {
        const metadataFile = path2.join(localDir, entityId, options.metadataFileName);
        if (fs2.existsSync(metadataFile)) {
          const content = fs2.readFileSync(metadataFile, "utf-8");
          const metadata = options.parseMetadata(entityId, content);
          if (metadata) entities.push(metadata);
        }
      }
    }
  }
  return entities;
}
async function loadSkills(ctx, logger, skillsPath) {
  return loadEntities(ctx, logger, skillsPath, {
    manifestPrefix: "custom-skills/",
    targetSubDir: ".codebuddy/skills",
    metadataFileName: "SKILL.md",
    parseMetadata: parseSkillMetadata,
    label: "\u6280\u80FD"
  });
}
async function loadAgents(ctx, logger, agentsPath) {
  return loadEntities(ctx, logger, agentsPath, {
    manifestPrefix: "agents/",
    targetSubDir: ".codebuddy/agents",
    metadataFileName: "AGENT.md",
    parseMetadata: parseAgentMetadata,
    label: "Agent"
  });
}
var CORE_SCRIPTS = [
  {
    file: "structure-analyzer.js",
    dependencies: ["types/structure-analyzer.js", "types/reports.js", "report-manager.js"]
  },
  {
    file: "module-mapper.js",
    dependencies: ["types/module-mapper.js", "types/reports.js", "report-manager.js"]
  },
  {
    file: "report-manager.js",
    dependencies: ["types/reports.js"]
  },
  {
    file: "rule-validator.js"
  },
  {
    file: "skill-validator.js"
  }
];
var OPTIONAL_SCRIPTS = [
  {
    file: "agent-registry.js"
  },
  {
    file: "agent-call-manager.js"
  },
  {
    file: "task-orchestrator.js"
  },
  {
    file: "taskbook-manager.js",
    dependencies: ["types/index.js"]
  },
  {
    file: "task-executor.js",
    dependencies: ["types/index.js", "types/agent-runtime.js", "taskbook-manager.js", "context-collector.js", "reference-finder.js", "agent-runtime.js"]
  },
  {
    file: "agent-runtime.js",
    dependencies: ["types/agent-runtime.js", "types/index.js"]
  },
  {
    file: "contract-validator.js"
  },
  {
    file: "reference-finder.js",
    dependencies: ["types/index.js"]
  },
  {
    file: "context-collector.js",
    dependencies: ["types/index.js", "reference-finder.js"]
  }
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
async function distributeScripts(ctx, logger, targetDir) {
  const distributed = [];
  const localScriptsDir = path2.join(targetDir, ".codebuddy/scripts");
  const scriptsToDistribute = ctx.enableOrchestrator ? [...CORE_SCRIPTS, ...OPTIONAL_SCRIPTS] : CORE_SCRIPTS;
  if (!fs2.existsSync(localScriptsDir)) {
    fs2.mkdirSync(localScriptsDir, { recursive: true });
  }
  if (ctx.isRemote) {
    for (const scriptInfo of scriptsToDistribute) {
      const scriptUrl = `${ctx.remoteBaseUrl}/scripts/dist/${scriptInfo.file}`;
      try {
        const content = await fetchUrl(ctx, logger, scriptUrl);
        const destPath = path2.join(localScriptsDir, scriptInfo.file);
        fs2.writeFileSync(destPath, content, "utf-8");
        distributed.push(scriptInfo.file);
        logger.verbose(`\u5DF2\u4E0B\u8F7D\u811A\u672C: ${scriptInfo.file}`);
        if (scriptInfo.dependencies) {
          for (const dep of scriptInfo.dependencies) {
            const depUrl = `${ctx.remoteBaseUrl}/scripts/dist/${dep}`;
            try {
              const depContent = await fetchUrl(ctx, logger, depUrl);
              const depDir = path2.dirname(path2.join(localScriptsDir, dep));
              if (!fs2.existsSync(depDir)) {
                fs2.mkdirSync(depDir, { recursive: true });
              }
              fs2.writeFileSync(path2.join(localScriptsDir, dep), depContent, "utf-8");
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
    const sourceDir = path2.join(PROJECT_ROOT, "scripts/dist");
    for (const scriptInfo of scriptsToDistribute) {
      const srcPath = path2.join(sourceDir, scriptInfo.file);
      if (fs2.existsSync(srcPath)) {
        const destPath = path2.join(localScriptsDir, scriptInfo.file);
        fs2.copyFileSync(srcPath, destPath);
        distributed.push(scriptInfo.file);
        logger.verbose(`\u5DF2\u590D\u5236\u811A\u672C: ${scriptInfo.file}`);
        if (scriptInfo.dependencies) {
          for (const dep of scriptInfo.dependencies) {
            const depSrc = path2.join(sourceDir, dep);
            if (fs2.existsSync(depSrc)) {
              const depDir = path2.dirname(path2.join(localScriptsDir, dep));
              if (!fs2.existsSync(depDir)) {
                fs2.mkdirSync(depDir, { recursive: true });
              }
              fs2.copyFileSync(depSrc, path2.join(localScriptsDir, dep));
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
    const readmePath = path2.join(localScriptsDir, "README.md");
    fs2.writeFileSync(readmePath, generateScriptsReadme(distributed), "utf-8");
  }
  return distributed;
}
async function distributeWorkflows(ctx, logger, targetDir) {
  return distributeItems(ctx, logger, targetDir, PROJECT_ROOT, {
    targetSubDir: ".codebuddy/workflows",
    items: WORKFLOWS_TO_DISTRIBUTE,
    label: "workflow",
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
async function distributeTaskBooks(ctx, logger, targetDir) {
  return distributeItems(ctx, logger, targetDir, PROJECT_ROOT, {
    targetSubDir: ".codebuddy/taskbooks",
    items: TASKBOOK_FILES_TO_DISTRIBUTE,
    label: "taskbook contract",
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
async function distributeAgentCalls(ctx, logger, targetDir) {
  return distributeItems(ctx, logger, targetDir, PROJECT_ROOT, {
    targetSubDir: ".codebuddy/agent-calls",
    items: AGENT_CALL_FILES_TO_DISTRIBUTE,
    label: "agent-call contract",
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
async function distributeCommands(ctx, logger, targetDir) {
  return distributeItems(ctx, logger, targetDir, PROJECT_ROOT, {
    targetSubDir: ".codebuddy/commands",
    items: COMMANDS_TO_DISTRIBUTE,
    label: "\u547D\u4EE4"
  });
}
function updateGitignore(logger, projectDir) {
  const gitignorePath = path2.join(projectDir, ".gitignore");
  const entry = ".codebuddy/";
  try {
    let content = "";
    if (fs2.existsSync(gitignorePath)) {
      content = fs2.readFileSync(gitignorePath, "utf-8");
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
    fs2.writeFileSync(gitignorePath, content, "utf-8");
    logger.verbose("\u5DF2\u66F4\u65B0 .gitignore");
  } catch (error) {
    logger.warn(`\u66F4\u65B0 .gitignore \u5931\u8D25: ${error.message}`);
  }
}
function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
  }
  let isVerbose = false;
  let isRemote = false;
  let remoteBaseUrl = "";
  let taskType = null;
  let relevanceThreshold = DEFAULT_THRESHOLD;
  let ruleLevel = DEFAULT_RULE_LEVEL;
  let requestTimeout = DEFAULT_TIMEOUT;
  let enableOrchestrator = false;
  if (args.includes("--verbose") || args.includes("-v")) {
    isVerbose = true;
  }
  if (args.includes("--enable-orchestrator")) {
    enableOrchestrator = true;
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
    remoteManifest: null,
    requestTimeout,
    taskType,
    relevanceThreshold,
    ruleLevel,
    enableOrchestrator
  };
}
async function main() {
  const parsedCtx = parseArgs();
  const logger = createLogger(parsedCtx);
  const { config, manifest } = await loadConfig(parsedCtx, logger);
  const ctx = manifest ? { ...parsedCtx, remoteManifest: manifest } : parsedCtx;
  logger.log("CodeBuddy \u89C4\u5219\u52A0\u8F7D\u5668 v2.0 (\u4E09\u5C42\u67B6\u6784 + \u6280\u80FD\u7CFB\u7EDF)");
  logger.log(ctx.isRemote ? `\u6A21\u5F0F: \u8FDC\u7A0B (${ctx.remoteBaseUrl})` : "\u6A21\u5F0F: \u672C\u5730");
  if (ctx.enableOrchestrator) logger.log("\u7F16\u6392\u6A21\u5F0F: \u5B8C\u6574\uFF08\u542B B \u8DEF\u7EBF\u811A\u672C\u548C\u5951\u7EA6\uFF09");
  if (ctx.ruleLevel !== "full") logger.log(`\u89C4\u5219\u88C1\u526A: ${ctx.ruleLevel}\uFF08\u4EC5\u5F71\u54CD Layer1 Eager \u5185\u5BB9\uFF1Brules_cache \u4ECD\u4FDD\u7559 full\uFF09`);
  if (ctx.taskType) {
    logger.log(`\u4EFB\u52A1\u7B5B\u9009: ${ctx.taskType} (\u9608\u503C: ${ctx.relevanceThreshold})`);
  }
  const targetDir = process.cwd();
  logger.log(`\u76EE\u6807\u9879\u76EE: ${targetDir}`);
  const { layers, skills: skillsConfig, output, frontmatter } = config;
  const pkg = getPackageJson(logger, targetDir);
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  const vueProfile = checkVueProfile(dependencies);
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

> Generated by CodeBuddy Rule Loader v2.0
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
  for (const [depName, ruleFolders] of Object.entries(businessDeps)) {
    if (dependencies[depName]) {
      logger.log(`  \u68C0\u6D4B\u5230 ${depName}\uFF0C\u6DFB\u52A0\u89C4\u5219\u7D22\u5F15`);
      for (const folder of ruleFolders) {
        layer2Index.push({
          dep: depName,
          rule: folder,
          path: `.codebuddy/rules_cache/layer2_business/${folder}.md`
        });
        const cacheDir = path2.join(targetDir, ".codebuddy/rules_cache/layer2_business");
        if (!fs2.existsSync(cacheDir)) {
          fs2.mkdirSync(cacheDir, { recursive: true });
        }
        const content = await loadRuleFile(ctx, logger, layers.business?.id || "layer2_business", folder + ".md");
        if (content) {
          fs2.writeFileSync(path2.join(cacheDir, folder + ".md"), content, "utf-8");
        }
      }
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
    const cacheDir = path2.join(targetDir, ".codebuddy/rules_cache/layer3_action");
    if (!fs2.existsSync(cacheDir)) {
      fs2.mkdirSync(cacheDir, { recursive: true });
    }
    const content = await loadRuleFile(ctx, logger, layers.action?.id || "layer3_action", item + ".md");
    if (content) {
      fs2.writeFileSync(path2.join(cacheDir, item + ".md"), content, "utf-8");
    }
  }
  if (layer2Index.length > 0 || layer3Index.length > 0) {
    finalContent += `## \u{1F4DA} \u89C4\u5219\u53C2\u8003\u7D22\u5F15 (\u6309\u9700\u52A0\u8F7D)

`;
    finalContent += `> \u4EE5\u4E0B\u89C4\u5219\u5305\u542B\u5177\u4F53\u7684\u6280\u672F\u6808\u5B9E\u73B0\u7EC6\u8282\uFF0C\u8BF7\u6309\u9700\u8BFB\u53D6

`;
    finalContent += `| \u89C4\u5219\u540D\u79F0 | \u672C\u5730\u8DEF\u5F84 | \u8BF4\u660E |
|---------|---------|------|
`;
    for (const item of layer2Index) {
      finalContent += `| ${item.rule} | \`${item.path}\` | ${item.dep} \u89C4\u8303 |
`;
    }
    for (const item of layer3Index) {
      finalContent += `| ${item.rule} | \`${item.path}\` | \u4EFB\u52A1\u68C0\u67E5\u6E05\u5355 |
`;
    }
    finalContent += "\n";
  }
  finalContent += generateRuleActivationPrompt(config);
  if (skillsConfig?.enabled) {
    logger.log("\u52A0\u8F7D\u6280\u80FD\u7CFB\u7EDF...");
    const skills = await loadSkills(ctx, logger, skillsConfig.path || "custom-skills");
    logger.log(`\u5DF2\u52A0\u8F7D ${skills.length} \u4E2A\u6280\u80FD`);
    finalContent += generateSkillsPrompt(skills);
  }
  logger.log("\u52A0\u8F7D Agent \u7CFB\u7EDF...");
  const agents = await loadAgents(ctx, logger, "agents");
  if (agents.length > 0) {
    logger.log(`\u5DF2\u52A0\u8F7D ${agents.length} \u4E2A Agents`);
    finalContent += generateAgentsPrompt(agents);
  }
  logger.log("\u5206\u53D1\u5DE5\u5177\u811A\u672C...");
  const distributedScripts = await distributeScripts(ctx, logger, targetDir);
  if (distributedScripts.length > 0) {
    logger.log(`\u5DF2\u5206\u53D1 ${distributedScripts.length} \u4E2A\u811A\u672C`);
    finalContent += generateScriptsPrompt(distributedScripts);
  }
  let distributedWorkflows = [];
  if (ctx.enableOrchestrator) {
    logger.log("\u5206\u53D1 Workflows...");
    distributedWorkflows = await distributeWorkflows(ctx, logger, targetDir);
    if (distributedWorkflows.length > 0) {
      logger.log(`\u5DF2\u5206\u53D1 ${distributedWorkflows.length} \u4E2A\u5DE5\u4F5C\u6D41`);
      finalContent += generateWorkflowsPrompt(distributedWorkflows);
    }
  } else {
    logger.verbose("\u8DF3\u8FC7 Workflows \u5206\u53D1\uFF08\u9ED8\u8BA4\u6A21\u5F0F\uFF0C\u4F7F\u7528 --enable-orchestrator \u542F\u7528\uFF09");
  }
  let distributedTaskBooks = [];
  if (ctx.enableOrchestrator) {
    logger.log("\u5206\u53D1 TaskBook \u5951\u7EA6...");
    distributedTaskBooks = await distributeTaskBooks(ctx, logger, targetDir);
    if (distributedTaskBooks.length > 0) {
      logger.log(`\u5DF2\u5206\u53D1 ${distributedTaskBooks.length} \u4E2A TaskBook \u5951\u7EA6\u6587\u4EF6`);
      finalContent += generateTaskBooksPrompt(distributedTaskBooks);
    }
  } else {
    logger.verbose("\u8DF3\u8FC7 TaskBook \u5951\u7EA6\u5206\u53D1\uFF08\u9ED8\u8BA4\u6A21\u5F0F\uFF0C\u4F7F\u7528 --enable-orchestrator \u542F\u7528\uFF09");
  }
  let distributedAgentCalls = [];
  if (ctx.enableOrchestrator) {
    logger.log("\u5206\u53D1 Agent Call \u5951\u7EA6...");
    distributedAgentCalls = await distributeAgentCalls(ctx, logger, targetDir);
    if (distributedAgentCalls.length > 0) {
      logger.log(`\u5DF2\u5206\u53D1 ${distributedAgentCalls.length} \u4E2A Agent Call \u5951\u7EA6\u6587\u4EF6`);
      finalContent += generateAgentCallsPrompt(distributedAgentCalls);
    }
  } else {
    logger.verbose("\u8DF3\u8FC7 Agent Call \u5951\u7EA6\u5206\u53D1\uFF08\u9ED8\u8BA4\u6A21\u5F0F\uFF0C\u4F7F\u7528 --enable-orchestrator \u542F\u7528\uFF09");
  }
  logger.log("\u5206\u53D1 Slash Commands...");
  const distributedCommands = await distributeCommands(ctx, logger, targetDir);
  if (distributedCommands.length > 0) {
    logger.log(`\u5DF2\u5206\u53D1 ${distributedCommands.length} \u4E2A\u547D\u4EE4`);
    finalContent += generateCommandsPrompt(distributedCommands);
  }
  const outputDir = path2.join(targetDir, output?.dirName || ".codebuddy/rules");
  if (!fs2.existsSync(outputDir)) {
    fs2.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path2.join(outputDir, output?.fileName || "project-rules.md");
  fs2.writeFileSync(outputPath, finalContent, "utf-8");
  updateGitignore(logger, targetDir);
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
  logger.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
}
main().catch((err) => {
  logError(`Fatal Error: ${err.message}`);
  process.exit(1);
});
