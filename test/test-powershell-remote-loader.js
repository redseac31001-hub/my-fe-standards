#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RUN_ROOT = path.join(REPO_ROOT, 'temp', `powershell-remote-loader-smoke-${Date.now()}`);

function ensureBuildOutputs() {
  const required = [
    path.join(REPO_ROOT, 'scripts', 'dist', 'codebuddy-install.js'),
    path.join(REPO_ROOT, 'scripts', 'dist', 'codebuddy-loader.bundle.js'),
    path.join(REPO_ROOT, 'manifest.json'),
    path.join(REPO_ROOT, 'packs', 'content-pack-full.json'),
  ];

  for (const filePath of required) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`missing build output: ${filePath}. Run "npm run build" first.`);
    }
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function fetchHealth(url, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve((res.statusCode || 0) === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startStaticServer(rootDir) {
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
  fs.readFile(resolvedPath, (error, content) => {
    if (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500);
      res.end(error.code || 'read error');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/octet-stream' });
    res.end(content);
  });
});
server.listen(port, host, () => {
  const address = server.address();
  console.log(JSON.stringify({ ok: true, port: address && typeof address !== 'string' ? address.port : null }));
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
    if (proc.exitCode !== null) {
      continue;
    }

    const baseUrl = `http://${host}:${port}`;
    let ok = false;
    for (let i = 0; i < 30; i++) {
      ok = await fetchHealth(`${baseUrl}/health`);
      if (ok) {
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

function createFixtureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(
    path.join(dirPath, 'package.json'),
    '{"name":"powershell-remote-loader-smoke","version":"1.0.0"}',
    'ascii',
  );
}

function runPowerShell(command, cwd) {
  const powershellPath = process.env.SystemRoot
    ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    : 'powershell.exe';

  return spawnSync(
    powershellPath,
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
    },
  );
}

function assertInstalled(projectDir) {
  const required = [
    path.join(projectDir, '.codebuddy', 'install.json'),
    path.join(projectDir, '.codebuddy', 'scripts', 'report-manager.js'),
    path.join(projectDir, '.codebuddy', 'scripts', 'task-orchestrator.js'),
    path.join(projectDir, '.codebuddy', 'rules', 'project-rules.md'),
  ];

  for (const filePath of required) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`expected installed artifact missing: ${filePath}`);
    }
  }
}

function summarizeResult(result) {
  return {
    exitCode: result.status,
    stdout: String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean).slice(0, 20),
    stderr: String(result.stderr || '').trim().split(/\r?\n/).filter(Boolean).slice(0, 20),
  };
}

async function main() {
  if (process.platform !== 'win32') {
    console.log('[powershell-remote-loader-smoke] skipped: Windows PowerShell only');
    process.exit(0);
  }

  ensureBuildOutputs();
  const { proc, baseUrl } = await startStaticServer(REPO_ROOT);
  const installUrl = `${baseUrl}/scripts/dist/codebuddy-install.js`;
  const loaderUrl = `${baseUrl}/scripts/dist/codebuddy-loader.bundle.js`;

  const scenarios = [
    {
      id: 'installer-file',
      command: `Invoke-WebRequest -Uri '${installUrl}' -OutFile codebuddy-install.js; node codebuddy-install.js --remote '${baseUrl}' --profile full --pack-only`,
    },
    {
      id: 'loader-pipe',
      command: `Invoke-RestMethod -Uri '${loaderUrl}' | node - --remote '${baseUrl}' --profile full --pack-only`,
    },
  ];

  const summary = [];
  try {
    for (const scenario of scenarios) {
      const scenarioDir = path.join(RUN_ROOT, scenario.id);
      createFixtureDir(scenarioDir);

      const result = runPowerShell(scenario.command, scenarioDir);
      if (result.error) {
        throw result.error;
      }
      if (result.status !== 0) {
        throw new Error(
          `[${scenario.id}] failed with exit=${String(result.status)}\n${String(result.stderr || result.stdout || '').trim()}`,
        );
      }

      assertInstalled(scenarioDir);
      summary.push({
        scenario: scenario.id,
        projectDir: path.relative(REPO_ROOT, scenarioDir).replace(/\\/g, '/'),
        result: summarizeResult(result),
      });
    }
  } finally {
    if (proc && proc.exitCode === null) {
      try {
        proc.kill();
      } catch {}
    }
  }

  console.log('[powershell-remote-loader-smoke] ok');
  console.log(JSON.stringify({ baseUrl, scenarios: summary }, null, 2));
}

main().catch(error => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
