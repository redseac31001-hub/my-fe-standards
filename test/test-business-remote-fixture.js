#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawnSync, spawn } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(__dirname, 'business-fixtures.json');
const SLEEP_INT32 = new Int32Array(new SharedArrayBuffer(4));

function sleepSync(ms) {
  Atomics.wait(SLEEP_INT32, 0, 0, ms);
}

function parseArgs(argv) {
  const parsed = {
    fixture: null,
    target: null,
    remote: null,
    loaderUrl: null,
    keepTemp: true,
    workflowSmoke: true,
    listFixtures: false,
    help: false,
    extraLoaderArgs: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--fixture' && argv[i + 1]) {
      parsed.fixture = argv[++i];
      continue;
    }
    if (arg === '--target' && argv[i + 1]) {
      parsed.target = argv[++i];
      continue;
    }
    if (arg === '--remote' && argv[i + 1]) {
      parsed.remote = argv[++i];
      continue;
    }
    if (arg === '--loader-url' && argv[i + 1]) {
      parsed.loaderUrl = argv[++i];
      continue;
    }
    if (arg === '--no-keep-temp') {
      parsed.keepTemp = false;
      continue;
    }
    if (arg === '--no-workflow-smoke') {
      parsed.workflowSmoke = false;
      continue;
    }
    if (arg === '--list-fixtures') {
      parsed.listFixtures = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    parsed.extraLoaderArgs.push(arg);
  }

  return parsed;
}

function showHelp(config) {
  console.log(`
Business Remote Fixture Smoke

Usage:
  node test/test-business-remote-fixture.js [options] [extra loader args]

Options:
  --fixture <name>          Fixture id from test/business-fixtures.json
  --target <path>           Runtime path (default: ${config.runtimeRoot}/<fixture>)
  --remote <url>            Remote base URL. Omit to serve the current repo locally.
  --loader-url <url>        Loader bundle URL. Defaults to <remote>/scripts/dist/codebuddy-loader.bundle.js
  --no-workflow-smoke       Skip task-orchestrator blocked/resume smoke
  --no-keep-temp            Remove temp runtime directory after success
  --list-fixtures           Show available fixtures
  --help, -h                Show help

Examples:
  node test/test-business-remote-fixture.js
  node test/test-business-remote-fixture.js --remote https://raw.githubusercontent.com/<org>/<repo>/<branch>
  node test/test-business-remote-fixture.js --fixture vue3-remote-smoke --target temp/business-fixtures/shadow-app
`.trim());
}

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function listFixtures(config) {
  console.log('Available fixtures:');
  for (const [id, fixture] of Object.entries(config.fixtures || {})) {
    console.log(`- ${id}: ${fixture.description}`);
  }
}

function ensureBuildOutputs() {
  const required = [
    path.join(REPO_ROOT, 'scripts', 'dist', 'codebuddy-loader.bundle.js'),
    path.join(REPO_ROOT, 'scripts', 'dist', 'contract-validator.js'),
    path.join(REPO_ROOT, 'manifest.json'),
  ];

  for (const filePath of required) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`missing build output: ${filePath}. Run "npm run build" first.`);
    }
  }
}

function toPosixPath(p) {
  return String(p).replace(/\\/g, '/');
}

function joinUrl(baseUrl, pathname) {
  return `${String(baseUrl).replace(/\/+$/, '')}/${String(pathname).replace(/^\/+/, '')}`;
}

function stageFixture(sourceDir, targetDir) {
  try {
    fs.rmSync(targetDir, { recursive: true, force: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const hint = error && typeof error === 'object' && error.code === 'EPERM'
      ? `\nHint: if you want to preserve an existing temp runtime or the current environment blocks deletes, rerun with --target temp/business-fixtures/<new-name>.`
      : '';
    throw new Error(`failed to clean fixture runtime directory: ${targetDir}\n${message}${hint}`);
  }
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });

  fs.cpSync(sourceDir, targetDir, {
    recursive: true,
    filter: src => {
      const baseName = path.basename(src);
      if (baseName === '.codebuddy' || baseName === 'node_modules') return false;
      return true;
    },
  });
}

function startStaticFileServer(rootDir) {
  const host = '127.0.0.1';
  const script = `
const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = process.env.STATIC_ROOT;
const host = process.env.STATIC_HOST || '127.0.0.1';
const port = Number(process.env.STATIC_PORT || '0');

const server = http.createServer((req, res) => {
  const rawPath = String((req && req.url) || '/').split('?')[0];
  if (rawPath === '/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const normalized = path.posix.normalize(decodeURIComponent(rawPath)).replace(/^\\/+/, '');
  if (!normalized || normalized.startsWith('..') || normalized.includes('/../')) {
    res.writeHead(400);
    res.end('bad path');
    return;
  }

  const absolutePath = path.join(rootDir, normalized);
  const resolvedRoot = path.resolve(rootDir);
  const resolvedPath = path.resolve(absolutePath);
  if (!resolvedPath.startsWith(resolvedRoot)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }

  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }

  res.writeHead(200, { 'content-type': 'application/octet-stream' });
  fs.createReadStream(resolvedPath).pipe(res);
});

server.listen(port, host, () => {
  console.log(JSON.stringify({ ok: true, port }, null, 2));
});
`;

  for (let attempt = 0; attempt < 12; attempt++) {
    const port = 36000 + Math.floor(Math.random() * 18000);
    const proc = spawn(process.execPath, ['-e', script], {
      stdio: 'ignore',
      env: {
        ...process.env,
        STATIC_ROOT: rootDir,
        STATIC_HOST: host,
        STATIC_PORT: String(port),
      },
    });

    sleepSync(120);
    if (proc.exitCode !== null) continue;

    const baseUrl = `http://${host}:${port}`;
    let ok = false;
    for (let i = 0; i < 30; i++) {
      const health = spawnSync(process.execPath, ['-e', `
const http = require('http');
http.get(process.argv[1], (res) => {
  process.exit((res.statusCode || 0) === 200 ? 0 : 1);
}).on('error', () => process.exit(2));
      `, `${baseUrl}/health`], {
        stdio: 'ignore',
      });
      if (health.status === 0) {
        ok = true;
        break;
      }
      sleepSync(120);
    }
    if (ok) {
      return { proc, baseUrl };
    }

    try {
      proc.kill();
    } catch {}
  }

  throw new Error('failed to start local static server');
}

function fetchText(url, timeoutMs = 15000, failOnHttpError = true) {
  const client = String(url).startsWith('https://') ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.get(url, res => {
      let data = '';
      res.setEncoding('utf-8');
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        const statusCode = res.statusCode || 0;
        if (failOnHttpError && (statusCode < 200 || statusCode >= 300)) {
          reject(new Error(`GET ${url} failed: HTTP ${statusCode}`));
          return;
        }
        resolve({ ok: statusCode >= 200 && statusCode < 300, statusCode, text: data });
      });
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`GET ${url} timeout after ${timeoutMs}ms`));
    });
  });
}

async function downloadFile(url, destinationPath) {
  const response = await fetchText(url, 20000, true);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.writeFileSync(destinationPath, response.text, 'utf-8');
}

function runNode(commandArgs, cwd, expectedExitCode = 0) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd,
    stdio: 'pipe',
    encoding: 'utf-8',
  });

  if (result.error) {
    const detail = result.error instanceof Error ? result.error.stack || result.error.message : String(result.error);
    throw new Error(`command failed to start: node ${commandArgs.join(' ')}\n${detail}`);
  }

  if (result.status !== expectedExitCode) {
    const output = (result.stderr || result.stdout || '').trim();
    const signal = result.signal ? ` signal=${result.signal}` : '';
    throw new Error(`command failed (exit=${result.status}${signal}): node ${commandArgs.join(' ')}\n${output}`);
  }

  return result;
}

function assertFilesExist(rootDir, relativePaths) {
  for (const relativePath of relativePaths) {
    const absPath = path.join(rootDir, relativePath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`expected file missing after remote load: ${absPath}`);
    }
  }
}

function readInstallState(projectDir) {
  const installStatePath = path.join(projectDir, '.codebuddy', 'install.json');
  return JSON.parse(fs.readFileSync(installStatePath, 'utf-8'));
}

function assertSkillFilesExist(projectDir, installState, relativePaths) {
  const skillsRootDir = installState && installState.outputs && installState.outputs.skillsRootDir;
  if (!skillsRootDir) {
    throw new Error('install.json missing outputs.skillsRootDir');
  }

  for (const relativePath of relativePaths) {
    const absPath = path.join(projectDir, skillsRootDir, relativePath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`expected skill file missing after remote load: ${absPath}`);
    }
  }
}

function assertAgentsPresent(registryPayload, expectedAgents) {
  const installedAgents = new Set((registryPayload.agents || []).map(agent => agent.id));
  for (const agentId of expectedAgents) {
    if (!installedAgents.has(agentId)) {
      throw new Error(`expected agent missing after remote load: ${agentId}`);
    }
  }
}

function writeRunMetadata(targetDir, payload) {
  const metadataPath = path.join(targetDir, '.fixture-run.json');
  fs.writeFileSync(metadataPath, JSON.stringify(payload, null, 2), 'utf-8');
}

function runWorkflowSmoke(projectDir) {
  const first = runNode([
    '.codebuddy/scripts/task-orchestrator.js',
    'Fixture remote smoke requirement',
    '--type',
    'new-feature',
    '--tasks-only',
    '--json',
  ], projectDir, 2);

  const blocked = JSON.parse(first.stdout);
  if (!blocked || blocked.status !== 'blocked' || !blocked.taskBookId) {
    throw new Error(`unexpected orchestrator blocked payload: ${first.stdout}`);
  }

  const details = blocked.details || {};
  const requestId = details.requestId;
  const resultPath = details.resultPath;
  if (!requestId || !resultPath) {
    throw new Error(`blocked orchestrator payload missing requestId/resultPath: ${first.stdout}`);
  }

  const resultAbsPath = path.isAbsolute(resultPath) ? resultPath : path.join(projectDir, resultPath);
  const plannerResult = {
    requestId,
    kind: 'planner',
    status: 'success',
    output: {
      tasks: [
        { planId: 'T1', title: 'Fixture analyze step', type: 'analysis', priority: 'critical' },
      ],
    },
    completedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(resultAbsPath), { recursive: true });
  fs.writeFileSync(resultAbsPath, JSON.stringify(plannerResult, null, 2), 'utf-8');

  const second = runNode([
    '.codebuddy/scripts/task-orchestrator.js',
    '--taskbook',
    blocked.taskBookId,
    '--tasks-only',
    '--json',
  ], projectDir, 0);

  const completed = JSON.parse(second.stdout);
  if (!completed || completed.status !== 'completed' || completed.taskBookId !== blocked.taskBookId) {
    throw new Error(`unexpected orchestrator completed payload: ${second.stdout}`);
  }

  return {
    taskBookId: blocked.taskBookId,
    requestId,
    resultPath: toPosixPath(path.relative(projectDir, resultAbsPath)),
  };
}

async function main() {
  const config = loadConfig();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    showHelp(config);
    return;
  }

  if (args.listFixtures) {
    listFixtures(config);
    return;
  }

  ensureBuildOutputs();

  const fixtureId = args.fixture || config.defaultFixture;
  const fixture = (config.fixtures || {})[fixtureId];
  if (!fixture) {
    throw new Error(`unknown fixture: ${fixtureId}`);
  }

  const sourceDir = path.resolve(REPO_ROOT, fixture.sourceDir);
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`fixture source not found: ${sourceDir}`);
  }

  const runtimeRoot = path.resolve(REPO_ROOT, config.runtimeRoot || 'temp/business-fixtures');
  const targetDir = args.target
    ? path.resolve(REPO_ROOT, args.target)
    : path.join(runtimeRoot, fixtureId);

  stageFixture(sourceDir, targetDir);

  const cleanup = [];
  try {
    let remoteBase = args.remote;
    if (!remoteBase) {
      const localServer = startStaticFileServer(REPO_ROOT);
      cleanup.push(() => {
        try { localServer.proc.kill(); } catch {}
      });
      remoteBase = localServer.baseUrl;
    }

    const loaderUrl = args.loaderUrl || joinUrl(remoteBase, 'scripts/dist/codebuddy-loader.bundle.js');
    const downloadedLoaderPath = path.join(runtimeRoot, '_downloads', `${fixtureId}.loader.bundle.js`);
    await downloadFile(loaderUrl, downloadedLoaderPath);

    const loaderArgs = ['--remote', remoteBase, ...(fixture.loaderArgs || []), ...args.extraLoaderArgs];
    runNode([downloadedLoaderPath, ...loaderArgs], targetDir, 0);

    assertFilesExist(targetDir, fixture.expectedFiles || []);
    const installState = readInstallState(targetDir);
    assertSkillFilesExist(targetDir, installState, fixture.expectedSkillFiles || []);

    runNode(['.codebuddy/scripts/contract-validator.js', '--workflows', '--taskbooks'], targetDir, 0);
    const registryResult = runNode(['.codebuddy/scripts/agent-registry.js', 'list', '--json'], targetDir, 0);
    const registryPayload = JSON.parse(registryResult.stdout);
    if (!registryPayload || !Array.isArray(registryPayload.agents) || registryPayload.agents.length === 0) {
      throw new Error(`unexpected agent registry payload: ${registryResult.stdout}`);
    }
    assertAgentsPresent(registryPayload, fixture.expectedAgents || []);

    let workflowSummary = null;
    if (args.workflowSmoke) {
      workflowSummary = runWorkflowSmoke(targetDir);
    }

    const summary = {
      fixtureId,
      fixtureDescription: fixture.description,
      sourceDir: toPosixPath(path.relative(REPO_ROOT, sourceDir)),
      targetDir: toPosixPath(path.relative(REPO_ROOT, targetDir)),
      remoteBase,
      loaderUrl,
      loaderArgs,
      generatedAt: new Date().toISOString(),
      workflowSmoke: workflowSummary,
    };

    writeRunMetadata(targetDir, summary);

    console.log('[business-remote-smoke] fixture staged and verified');
    console.log(JSON.stringify(summary, null, 2));

    if (!args.keepTemp) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  } finally {
    while (cleanup.length > 0) {
      const dispose = cleanup.pop();
      if (dispose) dispose();
    }
  }
}

main().catch(error => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
