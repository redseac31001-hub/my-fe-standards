#!/usr/bin/env node
/**
 * 闂傚倸鍊峰ù鍥х暦閻㈢绐楅柟鎵閸嬶繝鏌曟竟顖楀亾闁稿鎸搁～婵嬫偂鎼粹檧鎷柣搴ゎ潐濞叉牜绱炴繝鍥モ偓浣糕槈閵忊€斥偓鐑芥煠绾板崬澧绘俊鑼厴濮婄粯鎷呴搹鐟扮濡炪値鍘煎ú顓炵暦閺囥垹围闁搞儮鏅濋悞鐐箾鐎电甯堕柣掳鍔戦幃锟犲即閵忥紕鍙嗗┑鐘绘涧濡寮冲▎蹇婃斀妞ゆ梻鍘ч埀顒€婀遍幑銏犫槈濞嗗繒绐炲┑鐐村灦濮樸劑寮抽妶鍛傛棃鎮╅棃娑楃捕濡炪倖鍨甸ˇ鐢告偘椤曗偓瀹曞爼顢楁径瀣珝闂備胶绮敃鈺呭窗閺嶃劎顩烽柨鏇炲€归埛鎴︽煠婵劕鈧洖鐡繝鐢靛仩椤曟粎绮婚幋鐘插疾婵犵數濞€濞佳囶敄閸涱垳鐭嗛柛顐ｇ妇閺€浠嬫煕鐏炲墽鐭ら柣鎺楃畺閹? *
 * 濠电姷鏁告慨鐑藉极閹间礁纾婚柣鎰▕閻掕姤绻涢崱妯绘儎闁轰礁瀚伴弻娑㈩敃閻樻彃濮曢梺绋块閿曘儵濡甸崟顖氬唨闁靛ě浣插亾閹烘鐓冪紓浣股戦埛鎺楁煃瑜滈崜娆戠不瀹ュ纾块梺顒€绉寸粻鐘荤叓閸ャ劎鈽夌痪鎯х秺瀵爼宕煎顓熺彇缂佺偓鍎抽崥瀣Φ閸曨垰绠涢柍杞扮婵爼姊洪幖鐐测偓鏍偡閳哄懎钃熼柨婵嗘閸庣喖鏌ㄥ┑鍡樺櫣妤犵偛顑夊铏规嫚閳ュ磭浠╅梺鍝ュ枑濞兼瑩鎮鹃悜鑺ュ亜缁炬媽椴搁弲鐐烘⒑缂佹ɑ鐓ュ褍娴风划锝夊籍閳ь剟銆冮妷鈺傚€烽柤纰卞墰椤旀帡姊虹拠鈥虫灁闁搞劏妫勯悾宄邦煥閸曨剙顎撻梺缁樺灦閿氭繛鍫㈠仱濮婂宕掑▎鎴М闂佽绁撮埀顒佺窞濞戙垹绠ｉ柣妯哄暱鎼村﹤鈹戦悩缁樻锭妞ゆ垵鎳撶换姘舵煟鎼达紕鐣柛搴ㄤ憾钘濆ù鍏兼綑绾惧潡骞栭幖顓熷▏濞存粍绮撻弻锟犲礃閵婏附鎮欓悶姘皑缁辨帒螖娴ｅ摜浼屽┑顔硷攻濡炶棄鐣烽妸锔剧瘈闁告洦鍋呭▓鍦磽閸屾瑨鍏屽┑顔炬暩閺侇噣鍨惧畷鍥ㄦ濠德板€愰崑鎾绘懚閿濆懌鈧帒顫濋悡搴ｄ画濠碘剝銇滈崝鎴濐潖濞差亜绠伴幖杈剧悼閻ｉ潧鈹戦悙璺虹毢濠电偐鍋撻梺绯曟杹閸嬫挸顪冮妶鍡楃瑐缂佽翰鍊濋幊鎾诲锤濡や胶鍘靛銈嗘瀹曠敻鎯屽▎鎾寸厵妞ゆ柨鎼悘顔剧磼椤旂晫鎳呴柟鐟板婵℃悂濡堕崱妯洪棷闂傚倸鍊峰ù鍥х暦閻㈢绐楅柟鎵閸嬶繝鏌曟竟顖楀亾闁稿鎸搁～婵嬫偂鎼粹檧鎷柣搴ゎ潐濞叉牜绱炴繝鍥モ偓浣糕槈閵忊€斥偓鐑芥煕濞嗗浚妯堟俊顐ゅ枛濮婄粯鎷呯憴鍕哗闂佺楠搁…宄邦潖娴犲绀嬫い鏍电稻閺? */

const childProcess = require('child_process');
const { spawnSync, spawn } = childProcess;
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SLEEP_INT32 = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms) {
  Atomics.wait(SLEEP_INT32, 0, 0, ms);
}

function splitCommandArgs(argString) {
  if (!argString || !argString.trim()) return [];

  const args = [];
  const re = /"([^"]*)"|'([^']*)'|[^\s]+/g;
  let match = null;
  while ((match = re.exec(argString))) {
    args.push(match[1] ?? match[2] ?? match[0]);
  }
  return args;
}

function buildExecError(command, result) {
  const error = new Error(`Command failed: ${command}\n${result.stderr || result.stdout || ''}`.trim());
  error.status = result.status;
  error.stdout = result.stdout;
  error.stderr = result.stderr;
  return error;
}

function execSync(command, options = {}) {
  const trimmed = String(command).trim();
  const nodeMatch = trimmed.match(/^node\s+"([^"]+)"(?:\s+([\s\S]*))?$/);

  if (nodeMatch) {
    const scriptPath = nodeMatch[1];
    const args = splitCommandArgs(nodeMatch[2] || '');
    const result = spawnSync(process.execPath, [scriptPath, ...args], {
      stdio: 'pipe',
      encoding: 'utf-8',
      ...options,
    });

    if (result.status !== 0) {
      throw buildExecError(command, result);
    }

    return result.stdout;
  }

  return childProcess.execSync(command, options);
}

function httpRequestJson({ method, url, headers = {}, body = '', timeoutMs = 5000 }) {
  const script = `
const http = require('http');
const https = require('https');
const { URL } = require('url');

const method = process.env.REQ_METHOD || 'GET';
const url = new URL(process.env.REQ_URL || 'http://127.0.0.1/');
const headers = JSON.parse(process.env.REQ_HEADERS || '{}');
const body = process.env.REQ_BODY || '';

const lib = url.protocol === 'https:' ? https : http;
const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80);
const timeoutMs = Number(process.env.REQ_TIMEOUT_MS || '5000');
let timer = null;

const req = lib.request({
  method,
  hostname: url.hostname,
  port,
  path: url.pathname + url.search,
  headers: {
    ...headers,
    ...(body ? { 'content-length': Buffer.byteLength(body) } : {}),
  },
}, (res) => {
  let data = '';
  res.setEncoding('utf-8');
  res.on('data', (c) => { data += c; });
  res.on('end', () => {
    if (timer) clearTimeout(timer);
    console.log(JSON.stringify({ statusCode: res.statusCode, body: data }, null, 2));
    process.exit(0);
  });
});

req.on('error', (e) => {
  if (timer) clearTimeout(timer);
  console.error(String(e && e.message ? e.message : e));
  process.exit(2);
});

if (body) req.write(body);
req.end();

timer = setTimeout(() => {
  try { req.destroy(); } catch {}
  console.error('timeout');
  process.exit(3);
}, timeoutMs);
`;

  const res = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf-8',
    stdio: 'pipe',
    env: {
      ...process.env,
      REQ_METHOD: method,
      REQ_URL: url,
      REQ_HEADERS: JSON.stringify(headers),
      REQ_BODY: body,
      REQ_TIMEOUT_MS: String(timeoutMs),
    },
  });

  if (res.status !== 0) {
    throw new Error(`httpRequest failed (exit=${res.status}): ${res.stderr || res.stdout}`);
  }

  return JSON.parse(res.stdout);
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

if (!rootDir || !port) {
  console.error('missing root/port');
  process.exit(2);
}

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

  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  fs.createReadStream(resolvedPath).pipe(res);
});

server.listen(port, host, () => {
  console.log(JSON.stringify({ ok: true, port }, null, 2));
});
`;

  for (let attempt = 0; attempt < 12; attempt++) {
    const port = 35000 + Math.floor(Math.random() * 20000);
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
    for (let i = 0; i < 40; i++) {
      try {
        const health = httpRequestJson({ method: 'GET', url: `${baseUrl}/health`, timeoutMs: 1500 });
        if (health.statusCode === 200) {
          ok = true;
          break;
        }
      } catch {
        // ignore and retry
      }
      sleepSync(120);
    }

    if (!ok) {
      try { proc.kill(); } catch {}
      continue;
    }

    return { proc, baseUrl };
  }

  throw new Error('failed to start static file server');
}

function startAgentCallServer(projectDir) {
  const token = `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const host = '127.0.0.1';
  const script = '.codebuddy/scripts/agent-call-manager.js';

  for (let attempt = 0; attempt < 12; attempt++) {
    const port = 30000 + Math.floor(Math.random() * 20000);
    const proc = spawn(process.execPath, [script, 'serve', '--host', host, '--port', String(port), '--token', token], {
      cwd: projectDir,
      stdio: 'ignore',
    });

    // Give it a moment to bind.
    sleepSync(120);
    if (proc.exitCode !== null) {
      continue;
    }

    const baseUrl = `http://${host}:${port}`;

    // Wait health ready.
    let ok = false;
    for (let i = 0; i < 40; i++) {
      try {
        const health = httpRequestJson({ method: 'GET', url: `${baseUrl}/health`, timeoutMs: 1500 });
        if (health.statusCode === 200) {
          ok = true;
          break;
        }
      } catch {
        // ignore and retry
      }
      sleepSync(120);
    }

    if (!ok) {
      try { proc.kill(); } catch {}
      continue;
    }

    return { proc, token, baseUrl };
  }

  throw new Error('failed to start agent-call-manager serve');
}

function runOrchestratorWatch({ projectDir, taskBookId, requestId, resultAbsPath, timeoutMs = 30000 }) {
  const script = `
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectDir = process.env.PROJECT_DIR;
const taskBookId = process.env.TASK_BOOK_ID;
const requestId = process.env.REQUEST_ID;
const resultAbsPath = process.env.RESULT_ABS_PATH;
const timeoutMs = Number(process.env.WATCH_TIMEOUT_MS || '30000');

if (!projectDir || !taskBookId || !requestId || !resultAbsPath) {
  console.error('missing env');
  process.exit(2);
}

function writePlannerResult() {
  fs.mkdirSync(path.dirname(resultAbsPath), { recursive: true });
  const plannerResult = {
    requestId,
    kind: 'planner',
    status: 'success',
    output: {
      tasks: [
        { planId: 'T1', title: 'Analyze only 1', type: 'analysis', priority: 'critical' },
        { planId: 'T2', title: 'Analyze only 2', type: 'analysis', dependencies: ['T1'] },
      ],
    },
    completedAt: new Date().toISOString(),
  };
  fs.writeFileSync(resultAbsPath, JSON.stringify(plannerResult, null, 2), 'utf-8');
}

const child = spawn(process.execPath, [
  '.codebuddy/scripts/task-orchestrator.js',
  '--taskbook', taskBookId,
  '--tasks-only',
  '--watch',
  '--watch-timeout-ms', String(timeoutMs),
  '--json',
], { cwd: projectDir, stdio: ['ignore', 'pipe', 'pipe'] });

let stdout = '';
let stderr = '';
child.stdout.setEncoding('utf-8');
child.stderr.setEncoding('utf-8');
child.stdout.on('data', (c) => { stdout += c; });
child.stderr.on('data', (c) => { stderr += c; });

const writeTimer = setTimeout(writePlannerResult, 200);
const hardTimer = setTimeout(() => {
  try { child.kill(); } catch {}
}, timeoutMs + 5000);

child.on('error', (e) => {
  clearTimeout(writeTimer);
  clearTimeout(hardTimer);
  console.error(String(e && e.message ? e.message : e));
  process.exit(3);
});

child.on('close', (code) => {
  clearTimeout(writeTimer);
  clearTimeout(hardTimer);
  console.log(JSON.stringify({ exitCode: code, stdout, stderr }, null, 2));
  process.exit(0);
});
`;

  const res = spawnSync(process.execPath, ['-e', script], {
    cwd: projectDir,
    encoding: 'utf-8',
    stdio: 'pipe',
    env: {
      ...process.env,
      PROJECT_DIR: projectDir,
      TASK_BOOK_ID: taskBookId,
      REQUEST_ID: requestId,
      RESULT_ABS_PATH: resultAbsPath,
      WATCH_TIMEOUT_MS: String(timeoutMs),
    },
  });

  if (res.status !== 0) {
    throw new Error(`watch wrapper failed (exit=${res.status}): ${res.stderr || res.stdout}`);
  }

  return JSON.parse(res.stdout);
}

function detectPythonRunner() {
  const candidates = [
    { command: 'python', prefix: [] },
    { command: 'py', prefix: ['-3'] },
  ];

  for (const candidate of candidates) {
    const res = spawnSync(candidate.command, [...candidate.prefix, '--version'], {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    if (res.status === 0) return candidate;
  }

  return null;
}

function runPythonScript(pythonRunner, scriptPath, args, options = {}) {
  if (!pythonRunner) {
    throw new Error('python runner unavailable');
  }

  const res = spawnSync(pythonRunner.command, [...pythonRunner.prefix, scriptPath, ...args], {
    encoding: 'utf-8',
    stdio: 'pipe',
    ...options,
  });

  if (res.status !== 0) {
    throw new Error(`python script failed (exit=${res.status}): ${res.stderr || res.stdout}`);
  }

  return res.stdout;
}

function removePathIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) return;

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      fs.rmSync(targetPath, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 150,
      });
      return;
    } catch (error) {
      lastError = error;
      if (process.platform === 'win32') {
        try {
          execSync(`attrib -R "${targetPath}" /S /D`, { stdio: 'ignore' });
        } catch {
          // ignore cleanup fallback errors
        }
      }
      sleepSync(150 * (attempt + 1));
    }
  }

  throw lastError;
}

const MOCK_PROJECTS_DIR = path.join(__dirname, 'mock-projects');
const TEST_RUNTIME_DIR = path.join(__dirname, '..', 'temp', 'test-run');
const RULE_LOADER_PATH = path.join(__dirname, '..', 'scripts', 'dist', 'codebuddy-loader.js');
const PYTHON_RUNNER = detectPythonRunner();

const TEST_CASES = [
  {
    name: 'Vue 3 project',
    dir: 'vue3-project',
    expectedRules: ['vue3', 'architecture', 'typescript'],
    notExpectedRules: ['vue2'],
  },
  {
    name: 'Vue 2 project',
    dir: 'vue2-project',
    expectedRules: ['vue2-general', 'architecture', 'typescript'],
    notExpectedRules: ['vue3', 'vue2-composition'],
  },
  {
    name: 'Vue 2 + Composition API project',
    dir: 'vue2-composition-project',
    expectedRules: ['vue2-composition', 'architecture', 'typescript'],
    notExpectedRules: ['vue3', 'vue2-general'],
  },
  {
    name: 'Ant Design Vue project',
    dir: 'antdv-project',
    expectedRules: ['vue3', 'architecture', 'typescript'],
    notExpectedRules: ['vue2'],
  },
];

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`闂?${message}`, colors.green);
}

function logError(message) {
  log(`闂?${message}`, colors.red);
}

function logInfo(message) {
  log(`闂傚倸鍊搁崐鐑芥倿閿曞倸鍑犲┑鍌滎焾閻ょ偓绻濋棃娑欘棏闁哄绉归弻鏇＄疀鐎ｎ亞浼勭紓? ${message}`, colors.cyan);
}

function logWarn(message) {
  log(`闂傚倸鍊搁崐椋庣矆娓氣偓閹潡宕惰閺嬫牠鏌￠崶鈺佹瀻闁搞劍妫冮幃妤呮濞戞瑦鍠愮紓? ${message}`, colors.yellow);
}

function prepareProjectSandbox(projectName) {
  const sourceDir = path.join(MOCK_PROJECTS_DIR, projectName);
  const runtimeDir = path.join(
    TEST_RUNTIME_DIR,
    `${projectName}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  );

  fs.mkdirSync(TEST_RUNTIME_DIR, { recursive: true });
  fs.cpSync(sourceDir, runtimeDir, {
    recursive: true,
    filter: src => {
      const rel = path.relative(sourceDir, src);
      if (!rel) return true;
      return rel !== '.codebuddy' && !rel.startsWith(`.codebuddy${path.sep}`);
    },
  });

  return runtimeDir;
}

function prepareRemoteRoot(prefix) {
  const rootDir = path.join(
    TEST_RUNTIME_DIR,
    `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  );
  fs.mkdirSync(rootDir, { recursive: true });
  return rootDir;
}

function copyRelativeFile(sourceRoot, targetRoot, relativePath) {
  const sourcePath = path.join(sourceRoot, relativePath);
  const targetPath = path.join(targetRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function createRemotePackOnlyRoot(profile = 'analysis') {
  const rootDir = prepareRemoteRoot('remote-pack');
  const manifestPath = path.join(__dirname, '..', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const packMeta = manifest.packs && manifest.packs[profile];
  if (!packMeta) {
    throw new Error(`manifest 缂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缂佺姾顫夐妵鍕箛閸洘顎嶉梺?${profile} content pack`);
  }

  fs.writeFileSync(path.join(rootDir, 'manifest.json'), JSON.stringify({
    ...manifest,
    packs: {
      [profile]: packMeta,
    },
  }, null, 2), 'utf-8');
  copyRelativeFile(path.join(__dirname, '..'), rootDir, packMeta.file);

  return rootDir;
}

function createRemotePacklessRoot(profile = 'analysis') {
  const rootDir = prepareRemoteRoot('remote-packless');
  const repoRoot = path.join(__dirname, '..');
  const manifestPath = path.join(repoRoot, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  delete manifest.packs;
  fs.writeFileSync(path.join(rootDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

  for (const file of manifest.files || []) {
    copyRelativeFile(repoRoot, rootDir, file.path);
  }

  const analysisScripts = [
    'scripts/dist/rule-validator.js',
    'scripts/dist/skill-validator.js',
    'scripts/dist/structure-analyzer.js',
    'scripts/dist/module-mapper.js',
    'scripts/dist/report-manager.js',
  ];
  for (const relativePath of analysisScripts) {
    copyRelativeFile(repoRoot, rootDir, relativePath);
  }

  copyRelativeFile(repoRoot, rootDir, '.claude/commands/task.md');
  copyRelativeFile(repoRoot, rootDir, '.claude/commands/agent-call.md');

  return rootDir;
}

function runLoaderInProject(projectDir, args = []) {
  const result = spawnSync(process.execPath, [RULE_LOADER_PATH, ...args], {
    cwd: projectDir,
    stdio: 'pipe',
    encoding: 'utf-8',
  });
  if (result.status !== 0) {
    throw buildExecError(`node "${RULE_LOADER_PATH}" ${args.join(' ')}`.trim(), result);
  }
  return result.stdout;
}

function readInstallState(projectDir) {
  const installStatePath = path.join(projectDir, '.codebuddy', 'install.json');
  return JSON.parse(fs.readFileSync(installStatePath, 'utf-8'));
}

function assertFilePresence(projectDir, relativePath, expected, label) {
  const absolutePath = path.join(projectDir, relativePath);
  const exists = fs.existsSync(absolutePath);
  if (exists !== expected) {
    throw new Error(`${label}: ${relativePath} expected=${expected} actual=${exists}`);
  }
}

function runProfileMatrixSmoke() {
  const projectDir = prepareProjectSandbox('vue3-project');
  const statusJson = () => JSON.parse(runLoaderInProject(projectDir, ['status', '--json']));
  const doctorJson = () => JSON.parse(runLoaderInProject(projectDir, ['doctor', '--json']));

  log(`\n${colors.bold}濠电姷鏁告慨鐑藉极閹间礁纾婚柣鎰▕閻掕姤绻涢崱妯绘儎闁轰礁瀚伴弻娑㈩敃閻樻彃濮曢梺? Loader Distribution Profiles${colors.reset}`);
  log(`闂傚倸鍊搁崐鐑芥嚄閸洖纾块柣銏㈩焾閻ら箖鏌嶉崫鍕櫣缂佹劖顨婇弻鈥愁吋鎼粹€茬敖缂備讲鍋? ${projectDir}`);

  try {
    runLoaderInProject(projectDir);
    let installState = readInstallState(projectDir);
    if (installState.profile !== 'analysis') {
      throw new Error(`婵犵數濮甸鏍窗濡ゅ啯鏆滄俊銈呭暟閻瑩鏌熼悜妯镐粶闁逞屽墾缁犳挸鐣锋總绋课ㄦい鏃囧Г濞?profile 闂傚倸鍊风粈浣革耿闁秴鍌ㄧ憸鏃堝箖濞差亜惟闁宠桨娴囬幗鏇㈡偡濠婂啰绠绘?analysis闂傚倸鍊搁崐鐑芥倿閿旈敮鍋撶粭娑樻噽閻瑩鏌熸潏楣冩闁搞倖鍔栭妵鍕冀椤愵澀娌梺绋款儛娴滎亪寮诲☉銏犲嵆闁靛鍎虫禒顓㈡⒑? ${installState.profile}`);
    }
    assertFilePresence(projectDir, '.codebuddy/scripts/structure-analyzer.js', true, 'analysis profile');
    assertFilePresence(projectDir, '.codebuddy/scripts/task-orchestrator.js', false, 'analysis profile');
    assertFilePresence(projectDir, '.codebuddy/scripts/agent-registry.js', false, 'analysis profile');
    logSuccess('婵犵數濮甸鏍窗濡ゅ啯鏆滄俊銈呭暟閻瑩鏌熼悜妯镐粶闁逞屽墾缁犳挸鐣锋總绋课ㄦい鏃囧Г濞呭秹姊绘担鍝勫付妞ゎ偅娲熷畷鎰板箛閺夎法锛涢梺鐟板⒔缁垶宕戦敓鐘斥拺妞ゆ挶鍔戝顔碱潰閸ャ劋绻嗛柣鎰典簻閳ь剚鍨垮畷鏇㈡焼瀹ュ棙娅囬梺闈涱槴閺呮稓绮婚鐐寸厱婵炴垵宕悘锛勨偓瑙勬礀椤︾敻寮婚弴鐔虹瘈闊洦绋掗宥呪攽?analysis profile');

    runLoaderInProject(projectDir, ['--profile', 'core']);
    installState = readInstallState(projectDir);
    if (installState.profile !== 'core' || installState.enableOrchestrator !== false) {
      throw new Error(`core profile installState 闂傚倷娴囬褏鈧稈鏅犻、娆撳冀椤撶偟鐛ラ梺鍝勭▉閸樿偐澹曡ぐ鎺撶厵闂傚倸顕崝宥夋煕? ${JSON.stringify(installState)}`);
    }
    assertFilePresence(projectDir, '.codebuddy/scripts/rule-validator.js', true, 'core profile');
    assertFilePresence(projectDir, '.codebuddy/scripts/structure-analyzer.js', false, 'core profile');
    assertFilePresence(projectDir, '.codebuddy/scripts/task-orchestrator.js', false, 'core profile');
    const coreDoctor = doctorJson();
    if (!coreDoctor || coreDoctor.ok !== true || coreDoctor.summary.warnCount !== 0 || coreDoctor.summary.failCount !== 0) {
      throw new Error(`core profile doctor 闂傚倷娴囬褏鈧稈鏅犻、娆撳冀椤撶偟鐛ラ梺鍝勭▉閸樿偐澹曡ぐ鎺撶厵闂傚倸顕崝宥夋煕? ${JSON.stringify(coreDoctor)}`);
    }
    logSuccess('core profile passed');

    runLoaderInProject(projectDir, ['--profile', 'orchestrator']);
    installState = readInstallState(projectDir);
    if (installState.profile !== 'orchestrator' || installState.enableOrchestrator !== true) {
      throw new Error(`orchestrator profile installState 闂傚倷娴囬褏鈧稈鏅犻、娆撳冀椤撶偟鐛ラ梺鍝勭▉閸樿偐澹曡ぐ鎺撶厵闂傚倸顕崝宥夋煕? ${JSON.stringify(installState)}`);
    }
    assertFilePresence(projectDir, '.codebuddy/scripts/task-orchestrator.js', true, 'orchestrator profile');
    assertFilePresence(projectDir, '.codebuddy/scripts/contract-validator.js', true, 'orchestrator profile');
    assertFilePresence(projectDir, '.codebuddy/scripts/agent-registry.js', false, 'orchestrator profile');
    assertFilePresence(projectDir, '.codebuddy/workflows/default.workflow.json', true, 'orchestrator profile');
    logSuccess('orchestrator profile passed');

    runLoaderInProject(projectDir, ['--profile', 'full']);
    installState = readInstallState(projectDir);
    if (installState.profile !== 'full' || installState.enableOrchestrator !== true) {
      throw new Error(`full profile installState 闂傚倷娴囬褏鈧稈鏅犻、娆撳冀椤撶偟鐛ラ梺鍝勭▉閸樿偐澹曡ぐ鎺撶厵闂傚倸顕崝宥夋煕? ${JSON.stringify(installState)}`);
    }
    assertFilePresence(projectDir, '.codebuddy/scripts/agent-registry.js', true, 'full profile');
    const fullStatus = statusJson();
    if (!fullStatus || fullStatus.ok !== true || fullStatus.inspection.installState.profile !== 'full') {
      throw new Error(`full profile status 闂傚倷娴囬褏鈧稈鏅犻、娆撳冀椤撶偟鐛ラ梺鍝勭▉閸樿偐澹曡ぐ鎺撶厵闂傚倸顕崝宥夋煕? ${JSON.stringify(fullStatus)}`);
    }
    logSuccess('full profile passed');

    runLoaderInProject(projectDir, ['--enable-orchestrator']);
    installState = readInstallState(projectDir);
    if (installState.profile !== 'full') {
      throw new Error(`--enable-orchestrator 闂傚倸鍊风粈浣革耿闁秴鍌ㄧ憸鏃堝箖濞差亜惟闁靛鍠楃紞搴ㄦ⒑閼姐倕鏋戦悗姘墦閺佹劙宕奸锛邦剙鈹戦悙鑼憼缂侇喖绉归獮鍐磼濮樿鲸娈鹃梺缁樻⒒閳峰牓寮崘顔界厪闊洤顑呴悘鈺呮偨?full闂傚倸鍊搁崐鐑芥倿閿旈敮鍋撶粭娑樻噽閻瑩鏌熸潏楣冩闁搞倖鍔栭妵鍕冀椤愵澀娌梺绋款儛娴滎亪寮诲☉銏犲嵆闁靛鍎虫禒顓㈡⒑? ${installState.profile}`);
    }
    logSuccess('--enable-orchestrator compatibility mapping passed');

    const ruleLevelProjectDir = prepareProjectSandbox('vue2-project');
    const ruleLevelOutputFile = path.join(ruleLevelProjectDir, '.codebuddy', 'rules', 'project-rules.md');
    const layer1ReferenceFile = path.join(
      ruleLevelProjectDir,
      '.codebuddy',
      'rules_cache',
      'layer1_reference',
      'architecture',
      'feature-based-structure.md'
    );

    runLoaderInProject(ruleLevelProjectDir, ['--rule-level', 'summary']);
    let ruleLevelContent = fs.readFileSync(ruleLevelOutputFile, 'utf-8');
    if (!ruleLevelContent.includes('目录结构优先按业务特性组织')) {
      throw new Error('summary rule-level missing feature-based summary section');
    }
    if (ruleLevelContent.includes('### 自检清单') || ruleLevelContent.includes('### ✅ Good (推荐目录结构)')) {
      throw new Error('summary rule-level should exclude quick/full feature-based sections');
    }
    if (!ruleLevelContent.includes('.codebuddy/rules_cache/layer1_reference/architecture/feature-based-structure.md')) {
      throw new Error('summary rule-level missing Layer1 reference index');
    }
    if (!fs.existsSync(layer1ReferenceFile)) {
      throw new Error('summary rule-level should materialize Layer1 reference cache');
    }

    runLoaderInProject(ruleLevelProjectDir, ['--rule-level', 'quick']);
    ruleLevelContent = fs.readFileSync(ruleLevelOutputFile, 'utf-8');
    if (!ruleLevelContent.includes('### 自检清单') || !ruleLevelContent.includes('### 快速避坑')) {
      throw new Error('quick rule-level missing quick sections for Layer1 rules');
    }
    if (ruleLevelContent.includes('### ✅ Good (推荐目录结构)')) {
      throw new Error('quick rule-level should exclude full feature-based examples');
    }
    if (!fs.existsSync(layer1ReferenceFile)) {
      throw new Error('quick rule-level should keep Layer1 reference cache');
    }

    runLoaderInProject(ruleLevelProjectDir, ['--rule-level', 'full']);
    ruleLevelContent = fs.readFileSync(ruleLevelOutputFile, 'utf-8');
    if (!ruleLevelContent.includes('### ✅ Good (推荐目录结构)') || !ruleLevelContent.includes('## 2.1 ⚠️ 灵活性指南（重要）')) {
      throw new Error('full rule-level should retain full Layer1 content');
    }
    if (ruleLevelContent.includes('.codebuddy/rules_cache/layer1_reference/')) {
      throw new Error('full rule-level should not emit Layer1 reference index');
    }
    if (fs.existsSync(layer1ReferenceFile)) {
      throw new Error('full rule-level should clean stale Layer1 reference cache');
    }
    logSuccess('rule-level summary/quick/full passed');

    return true;
  } catch (e) {
    logError(`distribution profile smoke 婵犵數濮烽弫鍛婃叏娴兼潙鍨傛繛宸簻绾惧潡鏌ゅù瀣珔闁搞劍绻堥弻娑㈠箻濡も偓鐎氼剟寮? ${e.message}`);
    return false;
  }
}

function runRemoteContentPackSmoke() {
  log(`\n${colors.bold}濠电姷鏁告慨鐑藉极閹间礁纾婚柣鎰▕閻掕姤绻涢崱妯绘儎闁轰礁瀚伴弻娑㈩敃閻樻彃濮曢梺? Remote Content Pack${colors.reset}`);

  try {
    const packedProjectDir = prepareProjectSandbox('vue3-project');
    const packRoot = createRemotePackOnlyRoot('analysis');
    const packedServer = startStaticFileServer(packRoot);
    try {
      runLoaderInProject(packedProjectDir, ['--remote', packedServer.baseUrl]);
      const installState = readInstallState(packedProjectDir);
      if (installState.profile !== 'analysis') {
        throw new Error(`remote packed profile 闂傚倷娴囬褏鈧稈鏅犻、娆撳冀椤撶偟鐛ラ梺鍝勭▉閸樿偐澹曡ぐ鎺撶厵闂傚倸顕崝宥夋煕? ${installState.profile}`);
      }
      if (!installState.source.contentPackFile) {
        throw new Error('remote packed installState 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敂钘変罕濠电姴锕ょ€氼噣銆呴弻銉︾叆婵犻潧妫Ο鍫ユ煛娴ｉ潻韬柡灞剧洴婵＄兘顢欓懡銈嗘濠?contentPackFile');
      }
      assertFilePresence(packedProjectDir, '.codebuddy/rules/project-rules.md', true, 'remote packed');
      assertFilePresence(packedProjectDir, '.codebuddy/scripts/structure-analyzer.js', true, 'remote packed');
      assertFilePresence(packedProjectDir, '.codebuddy/scripts/task-orchestrator.js', false, 'remote packed');
      const packCacheDir = path.join(packedProjectDir, '.codebuddy', 'cache', 'content-packs');
      if (!fs.existsSync(packCacheDir)) {
        throw new Error(`闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敂钘変罕濠电姴锕ょ€氼噣銆呴弻銉︾厽闁归偊鍓氶幆鍫ユ煛鐎ｂ晝绐旈柡宀€鍠栭獮鎴﹀箛闂堟稒顔勭紓鍌欒兌婵绱炴笟鈧濠氭偄閸忚偐鍔烽梺鎸庢磵閸嬫捇鏌ｈ箛銉ф偧缂佽鲸甯￠幃鈺呭传閸曨亝鐫忕紓?pack 缂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧湱鎲搁悧鍫濈瑨缂佺姳鍗抽弻鐔兼⒒鐎电濡介梺绋款儍閸婃繈寮婚弴鐔虹闁绘劦鍓氶悵鏇㈡⒑缁嬪潡顎楅悗娑掓櫊婵＄敻宕熼姘辩潉闂佹悶鍎滈崒娑氭綎缂? ${packCacheDir}`);
      }
      logSuccess('remote content pack install passed');
    } finally {
      try { packedServer.proc.kill(); } catch {}
    }

    const fallbackProjectDir = prepareProjectSandbox('vue3-project');
    const fallbackRoot = createRemotePacklessRoot('analysis');
    const fallbackServer = startStaticFileServer(fallbackRoot);
    try {
      runLoaderInProject(fallbackProjectDir, ['--remote', fallbackServer.baseUrl]);
      const installState = readInstallState(fallbackProjectDir);
      if (installState.source.contentPackFile) {
        throw new Error(`remote fallback 婵犵數濮烽弫鎼佸磻閻愬搫鍨傞柛顐ｆ礀缁犱即鏌涘┑鍕姢闁活厽鎹囬幃妤呭垂椤愩倖鎲欐繝娈垮枟婵炲﹪寮婚妶鍥ф瀳闁告鍋涢～顏呯節濞堝灝鐏犻柕鍫熸倐瀵鍩勯崘銊х獮闁瑰吋鐣崹濠氬Υ婵犲嫮纾?content pack: ${installState.source.contentPackFile}`);
      }
      assertFilePresence(fallbackProjectDir, '.codebuddy/rules/project-rules.md', true, 'remote fallback');
      assertFilePresence(fallbackProjectDir, '.codebuddy/scripts/structure-analyzer.js', true, 'remote fallback');
      logSuccess('remote file-by-file fallback passed');
    } finally {
      try { fallbackServer.proc.kill(); } catch {}
    }

    return true;
  } catch (e) {
    logError(`remote content pack smoke 婵犵數濮烽弫鍛婃叏娴兼潙鍨傛繛宸簻绾惧潡鏌ゅù瀣珔闁搞劍绻堥弻娑㈠箻濡も偓鐎氼剟寮? ${e.message}`);
    return false;
  }
}

/**
 * 闂傚倸鍊风粈渚€骞栭位鍥敃閿曗偓閻ょ偓绻濇繝鍌滃缂佲偓婢跺鍙忔俊鐐额嚙娴滈箖姊洪棃娑欘棛缂佽埖宀搁悰顔锯偓锝庡枟閺呮繈鏌嶈閸撴稑鈽夐悽绋跨劦妞ゆ帒瀚埛鎴︽煕濠靛棗顏璺哄閳ь剙鍘滈崑鎾绘煙闂傚顦﹂柛姘秺閹鏁愭惔鈥茬敖缂備胶濞€缁犳牠寮婚埄鍐ㄧ窞閻庯綆浜為崝鎼佹⒑缁嬪灝顒㈤柟鐟版喘瀵鏁愭径瀣珕闁荤姴娲╃亸娆愮閹间焦鈷戦悹鍥ｂ偓铏亞缂備緡鍠楅悷锔界┍婵犲洤绠瑰ù锝堝€借閺屾盯濡烽姘兼喘闂?
 */
function runTestCase(testCase) {
  const projectDir = prepareProjectSandbox(testCase.dir);
  if (testCase.dir === 'vue3-project') {
    const packageJsonPath = path.join(projectDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    packageJson.type = 'module';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
  }
  const outputDir = path.join(projectDir, '.codebuddy', 'rules');
  const outputFile = path.join(outputDir, 'project-rules.md');
  const scriptsDir = path.join(projectDir, '.codebuddy', 'scripts');
  const scriptsPackageFile = path.join(scriptsDir, 'package.json');
  const contractValidatorFile = path.join(scriptsDir, 'contract-validator.js');
  const ruleValidatorFile = path.join(scriptsDir, 'rule-validator.js');
  const skillValidatorFile = path.join(scriptsDir, 'skill-validator.js');
  const agentRegistryFile = path.join(scriptsDir, 'agent-registry.js');
  const agentCallManagerFile = path.join(scriptsDir, 'agent-call-manager.js');
  const taskOrchestratorFile = path.join(scriptsDir, 'task-orchestrator.js');
  const workflowDir = path.join(projectDir, '.codebuddy', 'workflows');
  const workflowFile = path.join(workflowDir, 'default.workflow.json');
  const workflowSchemaFile = path.join(workflowDir, 'workflow.schema.json');
  const taskbooksDir = path.join(projectDir, '.codebuddy', 'taskbooks');
  const taskbookSchemaFile = path.join(taskbooksDir, 'taskbook.schema.json');
  const reportsDir = path.join(projectDir, '.codebuddy', 'reports');
  const commandsDir = path.join(projectDir, '.codebuddy', 'commands');
  const commandsReadmeFile = path.join(commandsDir, 'README.md');
  const agentCallCommandFile = path.join(commandsDir, 'agent-call.md');
  const agentCallsDir = path.join(projectDir, '.codebuddy', 'agent-calls');
  const agentCallSchemaFile = path.join(agentCallsDir, 'agent-call.schema.json');

  log(`\n${colors.bold}濠电姷鏁告慨鐑藉极閹间礁纾婚柣鎰▕閻掕姤绻涢崱妯绘儎闁轰礁瀚伴弻娑㈩敃閻樻彃濮曢梺? ${testCase.name}${colors.reset}`);
  log(`闂傚倸鍊搁崐鐑芥嚄閸洖纾块柣銏㈩焾閻ら箖鏌嶉崫鍕櫣缂佹劖顨婇弻鈥愁吋鎼粹€茬敖缂備讲鍋? ${projectDir}`);

  // 濠电姷鏁告慨鐑藉极閹间礁纾绘繛鎴欏灩鐎氬銇勯幒鎴濐仾闁稿绱曢幉鎼佸籍閸稈鍋撴担绯曟瀻闁圭偓濞婇崬鍫曟⒑闂堟侗妾х紒鐘冲灴瀹曟粓顢欑喊杈ㄥ瘜闂侀潧鐗嗗Λ娆撍夐崱娑欑厱閻庯綆鍋勬慨澶岀磼椤旇姤顥堟鐐村姈閹棃濮€閻樿弓绱熼梻鍌欑劍鐎笛呮崲閸岀偛绠犻柟閭﹀枤娑撳秹鏌涘▎蹇ｆФ濞存粍绮撻弻鐔兼焽閿曗偓閸樼敻鏌涚€ｃ劌鐏查柡宀嬬磿娴狅箓宕愰悢濂変純婵＄偑鍊栭幐鎼佸Χ缁嬭法鏆﹂柛妤冨€ｉ悢鍏煎亗閹艰揪绱曢悷銏犫攽閻樺灚鏆╁┑顔诲嵆瀹曞綊鎮℃惔妯荤亙濠电偞鍨跺銊╂儗閹剧粯鐓欑紓浣靛灩閺嬫盯鏌￠崟鈺佸姕濞ｅ洤锕俊鍫曞川椤斿吋顏￠梻浣告惈閹峰宕滈悢鐓庣畺婵せ鍋撻柟顔界懇濡啫鈽夊Δ鈧ˉ姘舵⒒娴ｈ姤纭堕柛鐘叉瀹曟洟妫冨☉杈ㄧ稁婵犵數濮甸懝楣冩倷婵犲洦鐓ユ繝闈涙閸ｇ顭跨憴鍕婵﹦绮幏鍛村川婵犲倹娈橀梺姹囧焺閸ㄦ娊宕戦悙鍨床婵炴垯鍨归悞鍨亜閹哄秷鍏岀紒?fixture 闂傚倸鍊搁崐鐑芥嚄閸洖鍌ㄧ憸鏃堝Υ閸愨晜鍎熼柕蹇嬪焺濞茬鈹戦悩璇у伐闁绘锕畷鎴﹀Ω閿旇桨绨婚梺瑙勬緲閻栫厧顬婇鈧弻?.codebuddy 闂傚倸鍊搁崐椋庣矆娓氣偓楠炲鏁撻悩鑼槷闂佸搫娲㈤崹鍦不閻樿绠归柟纰卞幘閸樻盯鏌℃担闈╄含闁哄瞼鍠栭幃褔宕奸悢鍝勫殥闁?  // 闂傚倸鍊搁崐鎼佸磹妞嬪孩顐介柨鐔哄Т缁€鍫熺箾閸℃ɑ灏伴柛濠呭煐缁绘繈妫冨☉鍗炲壈闂佺琚崝鎴﹀蓟閺囥垹閱囨繝鍨姈绗戦梻?Windows 婵犵數濮烽弫鎼佸磻閻愬搫鍨傞柛顐ｆ礀缁犱即鏌熼梻瀵稿妽闁哄懏绻堥弻鏇㈠醇濠垫劖笑闂佹悶鍔岄崐濠氬箟閹间焦鍋嬮柛顐ｇ箘閻熸煡姊洪幎鑺ユ暠婵☆偄鍟村濠氬即閵忕娀鍞跺┑鐘绘涧閻楀棝鍩涢崼婵冩斀闁绘劘娉涢ˉ宥嗙箾婢跺娲撮柍銉畵瀹曠螖娴ｅ憡鐤傞梻浣圭湽閸ㄨ棄顭囪閸╂稑鐣濋崟顑芥嫼缂備礁顑呭锟狀敁濡ゅ懏鐓熼幒鎶藉礉瀹€鍕ㄢ偓锕傚炊閳哄倸鐝板┑鐐存綑椤戝棝锝炲鍛斀妞ゆ梹鏋婚崗顒傜磼閺屻儳鐣洪柟顕嗙節閹晝绱掑Ο閿嬪闂備礁鎲＄粙鎴︹€﹂鈧埢鎾澄熺悰鈩冩杸濡炪倖姊归崕鎶藉储鐎电硶鍋撳▓鍨珮闁稿锕ユ穱濠囨嚋闂堟稓绐為柣搴秵娴滄粍绔?project-rules.md 闂傚倸鍊峰ù鍥敋瑜忛懞閬嶆嚃閳轰胶绛忕紓鍌欑劍椤洭鎮甸崼鏇熺厱妞ゆ劗濮撮崝姘舵煕濮橆剚璐￠柟鑼焾椤撳吋寰勭€ｎ剛鏆㈤梻鍌欐祰椤曆囧礄閻ｅ瞼绀婇柛鈩冪☉閸屻劑鏌熼锝囦粶闁挎繂顦粻鐟懊归敐鍛础闁告鏁哥槐鎾诲磼濞嗘垵濡介梺鎸庤壘閳规垿顢欓崗鍏兼倷濡炪値鍙€閸庡藝閺夋垟鏀芥い鏇楀亾婵炰匠鍥舵晪闁靛鏅涚粈瀣亜閹哄秷鍏岀紒澶庢硾椤啴濡堕崱妤€顫囬梺绋垮閻╊垰顕ｉ幘顔碱潊闁挎稑瀚敮?
  try {
    execSync(`node "${RULE_LOADER_PATH}" --enable-orchestrator`, {
      cwd: projectDir,
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    if (!fs.existsSync(outputFile)) {
      logError(`闂傚倸鍊风粈渚€骞栭位鍥敍閻愭潙浜辨繝鐢靛Т濞层倗绮绘导瀛樼厵闂傚倸顕ˇ锕傛煕濮樻剚娼愰柕鍥у楠炴﹢宕￠悙鍏告偅婵犵妲呴崑鍛存晝閵忋倕钃熸繛鎴欏灩鍞銈嗙墱閸嬬偤顢撳鍜佹富闁靛牆妫楁慨灞句繆椤愩垹顏柛鈹垮劜瀵板嫰骞囬鍌ゅ晪闁诲氦顫夊ú鏍р枖閿曞倸顫呴柕鍫濇閸樹粙鏌熼悜妯衡枙鐎规洘绻堥獮瀣攽閸喐顔? ${outputFile}`);
      return false;
    }

    if (!fs.existsSync(contractValidatorFile)) {
      logError(`contract-validator 闂傚倸鍊搁崐鐑芥嚄閸洖鍌ㄧ憸鏃堝箖濞差亜惟鐟滃秹寮搁崼鈶╁亾楠炲灝鍔氶柟閿嬪灴閹虫捇宕稿Δ浣哄幗濠德板€愰崑鎾绘煟濡も偓缁绘﹢宕洪姀銈呯睄闁稿本顨呮禍鐐殽閻愯尙浠㈤柛鏃€宀搁弻鐔兼惞椤愩垹顫掑Δ鐘靛仦椤ㄥ﹪骞冮埡鍐＜婵☆垳鍘ч獮? ${contractValidatorFile}`);
      return false;
    }
    logSuccess('闂傚倷娴囬褍顫濋敃鍌︾稏濠㈣埖鍔栭崑銈夋煛閸モ晛小闁绘帒锕ョ换娑㈠幢濡纰嶉梺鍝勵儎缁舵岸寮婚悢鐓庣闁逛即娼у▓顓犵磽?scripts: contract-validator.js');

    if (!fs.existsSync(scriptsPackageFile)) {
      logError(`scripts package.json missing: ${scriptsPackageFile}`);
      return false;
    }
    const scriptsPackage = JSON.parse(fs.readFileSync(scriptsPackageFile, 'utf-8'));
    if (scriptsPackage.type !== 'commonjs') {
      logError(`scripts package.json type must be commonjs: ${scriptsPackageFile}`);
      return false;
    }
    logSuccess('scripts package.json passed');

    if (!fs.existsSync(ruleValidatorFile)) {
      logError(`rule-validator 闂傚倸鍊搁崐鐑芥嚄閸洖鍌ㄧ憸鏃堝箖濞差亜惟鐟滃秹寮搁崼鈶╁亾楠炲灝鍔氶柟閿嬪灴閹虫捇宕稿Δ浣哄幗濠德板€愰崑鎾绘煟濡も偓缁绘﹢宕洪姀銈呯睄闁稿本顨呮禍鐐殽閻愯尙浠㈤柛鏃€宀搁弻鐔兼惞椤愩垹顫掑Δ鐘靛仦椤ㄥ﹪骞冮埡鍐＜婵☆垳鍘ч獮? ${ruleValidatorFile}`);
      return false;
    }
    logSuccess('闂傚倷娴囬褍顫濋敃鍌︾稏濠㈣埖鍔栭崑銈夋煛閸モ晛小闁绘帒锕ョ换娑㈠幢濡纰嶉梺鍝勵儎缁舵岸寮婚悢鐓庣闁逛即娼у▓顓犵磽?scripts: rule-validator.js');

    if (!fs.existsSync(skillValidatorFile)) {
      logError(`skill-validator 闂傚倸鍊搁崐鐑芥嚄閸洖鍌ㄧ憸鏃堝箖濞差亜惟鐟滃秹寮搁崼鈶╁亾楠炲灝鍔氶柟閿嬪灴閹虫捇宕稿Δ浣哄幗濠德板€愰崑鎾绘煟濡も偓缁绘﹢宕洪姀銈呯睄闁稿本顨呮禍鐐殽閻愯尙浠㈤柛鏃€宀搁弻鐔兼惞椤愩垹顫掑Δ鐘靛仦椤ㄥ﹪骞冮埡鍐＜婵☆垳鍘ч獮? ${skillValidatorFile}`);
      return false;
    }
    logSuccess('闂傚倷娴囬褍顫濋敃鍌︾稏濠㈣埖鍔栭崑銈夋煛閸モ晛小闁绘帒锕ョ换娑㈠幢濡纰嶉梺鍝勵儎缁舵岸寮婚悢鐓庣闁逛即娼у▓顓犵磽?scripts: skill-validator.js');

    if (!fs.existsSync(agentRegistryFile)) {
      logError(`agent-registry 闂傚倸鍊搁崐鐑芥嚄閸洖鍌ㄧ憸鏃堝箖濞差亜惟鐟滃秹寮搁崼鈶╁亾楠炲灝鍔氶柟閿嬪灴閹虫捇宕稿Δ浣哄幗濠德板€愰崑鎾绘煟濡も偓缁绘﹢宕洪姀銈呯睄闁稿本顨呮禍鐐殽閻愯尙浠㈤柛鏃€宀搁弻鐔兼惞椤愩垹顫掑Δ鐘靛仦椤ㄥ﹪骞冮埡鍐＜婵☆垳鍘ч獮? ${agentRegistryFile}`);
      return false;
    }
    logSuccess('闂傚倷娴囬褍顫濋敃鍌︾稏濠㈣埖鍔栭崑銈夋煛閸モ晛小闁绘帒锕ョ换娑㈠幢濡纰嶉梺鍝勵儎缁舵岸寮婚悢鐓庣闁逛即娼у▓顓犵磽?scripts: agent-registry.js');

    if (!fs.existsSync(taskOrchestratorFile)) {
      logError(`task-orchestrator 闂傚倸鍊搁崐鐑芥嚄閸洖鍌ㄧ憸鏃堝箖濞差亜惟鐟滃秹寮搁崼鈶╁亾楠炲灝鍔氶柟閿嬪灴閹虫捇宕稿Δ浣哄幗濠德板€愰崑鎾绘煟濡も偓缁绘﹢宕洪姀銈呯睄闁稿本顨呮禍鐐殽閻愯尙浠㈤柛鏃€宀搁弻鐔兼惞椤愩垹顫掑Δ鐘靛仦椤ㄥ﹪骞冮埡鍐＜婵☆垳鍘ч獮? ${taskOrchestratorFile}`);
      return false;
    }
    logSuccess('闂傚倷娴囬褍顫濋敃鍌︾稏濠㈣埖鍔栭崑銈夋煛閸モ晛小闁绘帒锕ョ换娑㈠幢濡纰嶉梺鍝勵儎缁舵岸寮婚悢鐓庣闁逛即娼у▓顓犵磽?scripts: task-orchestrator.js');

    if (!fs.existsSync(agentCallManagerFile)) {
      logError(`agent-call-manager 闂傚倸鍊搁崐鐑芥嚄閸洖鍌ㄧ憸鏃堝箖濞差亜惟鐟滃秹寮搁崼鈶╁亾楠炲灝鍔氶柟閿嬪灴閹虫捇宕稿Δ浣哄幗濠德板€愰崑鎾绘煟濡も偓缁绘﹢宕洪姀銈呯睄闁稿本顨呮禍鐐殽閻愯尙浠㈤柛鏃€宀搁弻鐔兼惞椤愩垹顫掑Δ鐘靛仦椤ㄥ﹪骞冮埡鍐＜婵☆垳鍘ч獮? ${agentCallManagerFile}`);
      return false;
    }
    logSuccess('闂傚倷娴囬褍顫濋敃鍌︾稏濠㈣埖鍔栭崑銈夋煛閸モ晛小闁绘帒锕ョ换娑㈠幢濡纰嶉梺鍝勵儎缁舵岸寮婚悢鐓庣闁逛即娼у▓顓犵磽?scripts: agent-call-manager.js');

    if (!fs.existsSync(workflowFile)) {
      logError(`workflow 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敃鈧壕鍦磼鐎ｎ偓绱╂繛宸簼閺呮煡鏌涘☉鍙樼凹闁诲骸顭峰娲濞戙垻宕紓浣介哺濞茬喖宕洪姀銈呯睄闁稿本顨呮禍鐐殽閻愯尙浠㈤柛鏃€宀搁弻鐔兼惞椤愩垹顫掑Δ鐘靛仦椤ㄥ﹪骞冮埡鍐＜婵☆垳鍘ч獮? ${workflowFile}`);
      return false;
    }
    if (!fs.existsSync(workflowSchemaFile)) {
      logError(`workflow schema 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敃鈧壕鍦磼鐎ｎ偓绱╂繛宸簼閺呮煡鏌涘☉鍙樼凹闁诲骸顭峰娲濞戙垻宕紓浣介哺濞茬喖宕洪姀銈呯睄闁稿本顨呮禍鐐殽閻愯尙浠㈤柛鏃€宀搁弻鐔兼惞椤愩垹顫掑Δ鐘靛仦椤ㄥ﹪骞冮埡鍐＜婵☆垳鍘ч獮? ${workflowSchemaFile}`);
      return false;
    }
    logSuccess('闂傚倷娴囬褍顫濋敃鍌︾稏濠㈣埖鍔栭崑銈夋煛閸モ晛小闁绘帒锕ョ换娑㈠幢濡纰嶉梺鍝勵儎缁舵岸寮婚悢鐓庣闁逛即娼у▓顓犵磽?workflows 闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇楀亾妞ゎ厼鐏濊灒闁兼祴鏅濋悡瀣⒑閸撴彃浜濇繛鍙夛耿瀹? default.workflow.json + workflow.schema.json');

    if (!fs.existsSync(taskbookSchemaFile)) {
      logError(`taskbook schema 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敃鈧壕鍦磼鐎ｎ偓绱╂繛宸簼閺呮煡鏌涘☉鍙樼凹闁诲骸顭峰娲濞戙垻宕紓浣介哺濞茬喖宕洪姀銈呯睄闁稿本顨呮禍鐐殽閻愯尙浠㈤柛鏃€宀搁弻鐔兼惞椤愩垹顫掑Δ鐘靛仦椤ㄥ﹪骞冮埡鍐＜婵☆垳鍘ч獮? ${taskbookSchemaFile}`);
      return false;
    }
    logSuccess('闂傚倷娴囬褍顫濋敃鍌︾稏濠㈣埖鍔栭崑銈夋煛閸モ晛小闁绘帒锕ョ换娑㈠幢濡纰嶉梺鍝勵儎缁舵岸寮婚悢鐓庣闁逛即娼у▓顓犵磽?taskbooks 闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇楀亾妞ゎ厼鐏濊灒闁兼祴鏅濋悡瀣⒑閸撴彃浜濇繛鍙夛耿瀹? taskbook.schema.json');

    if (!fs.existsSync(agentCallCommandFile)) {
      logError(`agent-call command 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敃鈧壕鍦磼鐎ｎ偓绱╂繛宸簼閺呮煡鏌涘☉鍙樼凹闁诲骸顭峰娲濞戙垻宕紓浣介哺濞茬喖宕洪姀銈呯睄闁稿本顨呮禍鐐殽閻愯尙浠㈤柛鏃€宀搁弻鐔兼惞椤愩垹顫掑Δ鐘靛仦椤ㄥ﹪骞冮埡鍐＜婵☆垳鍘ч獮? ${agentCallCommandFile}`);
      return false;
    }
    logSuccess('闂傚倷娴囬褍顫濋敃鍌︾稏濠㈣埖鍔栭崑銈夋煛閸モ晛小闁绘帒锕ョ换娑㈠幢濡纰嶉梺鍝勵儎缁舵岸寮婚悢鐓庣闁逛即娼у▓顓犵磽?commands: agent-call.md');

    if (!fs.existsSync(commandsReadmeFile)) {
      logError(`commands README 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敃鈧壕鍦磼鐎ｎ偓绱╂繛宸簼閺呮煡鏌涘☉鍙樼凹闁诲骸顭峰娲濞戙垻宕紓浣介哺濞茬喖宕洪姀銈呯睄闁稿本顨呮禍鐐殽閻愯尙浠㈤柛鏃€宀搁弻鐔兼惞椤愩垹顫掑Δ鐘靛仦椤ㄥ﹪骞冮埡鍐＜婵☆垳鍘ч獮? ${commandsReadmeFile}`);
      return false;
    }
    logSuccess('闂傚倷娴囬褍顫濋敃鍌︾稏濠㈣埖鍔栭崑銈夋煛閸मो晛小闁绘帒锕ョ换娑㈠幢濡纰嶉梺鍝勵儎缁舵岸寮婚悢鐓庣闁逛即娼у▓顓犵磽?commands: README.md');

    if (!fs.existsSync(agentCallSchemaFile)) {
      logError(`agent-call schema 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敃鈧壕鍦磼鐎ｎ偓绱╂繛宸簼閺呮煡鏌涘☉鍙樼凹闁诲骸顭峰娲濞戙垻宕紓浣介哺濞茬喖宕洪姀銈呯睄闁稿本顨呮禍鐐殽閻愯尙浠㈤柛鏃€宀搁弻鐔兼惞椤愩垹顫掑Δ鐘靛仦椤ㄥ﹪骞冮埡鍐＜婵☆垳鍘ч獮? ${agentCallSchemaFile}`);
      return false;
    }
    logSuccess('闂傚倷娴囬褍顫濋敃鍌︾稏濠㈣埖鍔栭崑銈夋煛閸モ晛小闁绘帒锕ョ换娑㈠幢濡纰嶉梺鍝勵儎缁舵岸寮婚悢鐓庣闁逛即娼у▓顓犵磽?agent-calls 闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇楀亾妞ゎ厼鐏濊灒闁兼祴鏅濋悡瀣⒑閸撴彃浜濇繛鍙夛耿瀹? agent-call.schema.json');

    const content = fs.readFileSync(outputFile, 'utf-8');
    let allPassed = true;

    if (!content.includes('## 第二步：Agent 分类路由（多步骤流程）')) {
      logError('generated prompt missing grouped Agent routing section');
      allPassed = false;
    }
    if (!content.includes('## 第三步：Skill 分类路由（单次操作）')) {
      logError('generated prompt missing grouped Skill routing section');
      allPassed = false;
    }

    for (const rule of testCase.expectedRules) {
      if (content.includes(rule)) {
        logSuccess(`闂傚倸鍊搁崐椋庣矆娓氣偓楠炲鏁撻悩鍐蹭罕闂佸搫娲㈤崹鍦不閻樿绠规繛锝庡墮婵¤偐绱掗悩鍐插摵闁哄本鐩、鏇㈠Χ閸涱喚褰氱紓鍌欑劍閸炶崵绱炴笟鈧璇测槈閵忕姴宓嗛梺闈涱焾閸庨亶锝為鍫熲拺缂侇垱娲樺▍鍛存煕婵犲倹鍋ユ鐐插暙閻ｏ繝骞嶉搹顐も偓濠氭椤愩垺澶勯柟灏栨櫆缁傛帗绺介崨濞炬嫼? ${rule}`);
      } else {
        logError(`缂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缂佺姾顫夐妵鍕箛閸洘顎嶉梺绋块缁夌敻濡甸崟顖氬唨闁靛鍎遍弸娆戠磽娴ｇ懓鏁剧紓宥勭窔瀵鈽夐姀鐘插祮闂侀潧顭堥崕閬嶏綖椤忓牊鈷戠紒顖涙礃濞呭懘鏌涙繝鍌涘仴妤犵偛鍟悾锟犲箥閾忣偆鈧妫呴銏″闁瑰皷鏅滅粋鎺撶附閸涘ň鎷? ${rule}`);
        allPassed = false;
      }
    }

    for (const rule of testCase.notExpectedRules) {
      const rulePattern = new RegExp(`Source:.*${rule}`, 'i');
      if (rulePattern.test(content)) {
        logError(`闂傚倸鍊搁崐椋庣矆娓氣偓楠炲鏁撻悩鍐蹭罕闂佸搫娲㈤崹鍦不閻樿绠规繛锝庡墮婵¤偐绱掗悩鍐插摵闁哄本鐩、鏇㈠Χ閸涱喚浜栭梻浣哥－缁垰顫忔繝姘劦妞ゆ巻鍋撶紒鐘茬Ч瀹曟洟鏌嗗鍛枃闂佸綊鍋婇崰鎺楀磻閹剧粯鍋￠梺顓ㄩ檮閳诲牓姊虹拠鈥虫灍妞ゃ劌鎳橀崺銉﹀緞婵炵偓鐎哄銈嗘寙閸屾粎娉块梻浣瑰濞插繘宕规禒瀣ㄢ偓渚€寮崼婵嬪敹闂佺粯鏌ㄩ崲鍙夌珶閸曨垱鈷掑ù锝呮啞閸熺偞绻涚拠褏鐣电€规洘濞婇、娆戝枈鏉堚晛濮洪梻浣筋潐婢瑰棙鏅跺Δ鍛亗? ${rule}`);
        allPassed = false;
      } else {
        logSuccess(`濠电姷鏁告慨鐢割敊閺嶎厼绐楁俊銈呭暞瀹曟煡鏌熼柇锕€鏋涚紒韬插€濋弻娑滎槼妞ゃ劌鎳橀幃姗€鎼归锝呭伎濠碉紕鍋犻褎绂嶉幆顬棃鎮╅棃娑楁勃闁汇埄鍨界换婵嬫偘椤曗偓楠炴帡骞婇搹顐ｂ拹闁瑰嘲鎳樺畷顐﹀礋椤撶姌褔姊婚崒娆愮グ鐎规洜鏁诲畷浼村箛閻楀牆浠梺闈涳紡閳ь剟宕戦幘鎰佹僵闁绘挸楠搁埛瀣倵? ${rule}`);
      }
    }

    const stats = fs.statSync(outputFile);
    logInfo(`闂傚倸鍊搁崐鐑芥倿閿曞倹鍎戠憸鐗堝笒閸ㄥ倸鈹戦悩瀹犲缂佹劖顨婇弻鐔兼偋閸喓鍑￠梺鎼炲妼閸婂綊骞堥妸銉庣喖骞愭惔锝冣偓鎰攽閳藉棗浜濋柨鏇樺灲瀵鈽夐姀鐘栥劍銇勯弽顐沪妞ゅ骸绉撮—鍐Χ閸℃顫戝┑鈽嗗亜鐎氫即鍨鹃敃鍌氶敜婵°倐鍋撻梺鍗炴喘閺屾盯鍩勯崘鐐暥闂佸搫妫涢崰鎰板箞? ${(stats.size / 1024).toFixed(2)} KB`);

    // E2E: loader status / doctor
    try {
      const statusRaw = execSync(
        `node "${RULE_LOADER_PATH}" status --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const status = JSON.parse(statusRaw);
      if (!status || status.ok !== true || !status.inspection || !status.inspection.installState) {
        throw new Error(`status 闂傚倸鍊风粈渚€骞栭位鍥敍閻愭潙浜辨繝鐢靛Т濞层倗绮绘导瀛樼厵闂傚倸顕ˇ锕傛煕濮樻剚娼愰柕鍥у楠炴﹢宕￠悙鍏告偅缂傚倷绶￠崑鍕矓瑜版帒钃熼柨婵嗘啒閻旂厧绠伴幖杈剧到濞懷勭節? ${statusRaw.slice(0, 1200)}`);
      }
      if (status.inspection.installState.profile !== 'full') {
        throw new Error(`status profile 闂傚倷娴囬褏鈧稈鏅犻、娆撳冀椤撶偟鐛ラ梺鍝勭▉閸樿偐澹曡ぐ鎺撶厵闂傚倸顕崝宥夋煕? ${status.inspection.installState.profile}`);
      }
      if (status.inspection.rulesFileExists !== true) {
        throw new Error('status did not report rulesFileExists=true');
      }

      const doctorRaw = execSync(
        `node "${RULE_LOADER_PATH}" doctor --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const doctor = JSON.parse(doctorRaw);
      if (!doctor || doctor.ok !== true || !doctor.summary || doctor.summary.failCount !== 0) {
        throw new Error(`doctor 闂傚倸鍊风粈渚€骞栭位鍥敍閻愭潙浜辨繝鐢靛Т濞层倗绮绘导瀛樼厵闂傚倸顕ˇ锕傛煕濮樻剚娼愰柕鍥у楠炴﹢宕￠悙鍏告偅缂傚倷绶￠崑鍕矓瑜版帒钃熼柨婵嗘啒閻旂厧绠伴幖杈剧到濞懷勭節? ${doctorRaw.slice(0, 1200)}`);
      }

      logSuccess('loader status/doctor passed');
    } catch (e) {
      logError(`loader status/doctor 婵犵數濮烽弫鍛婃叏娴兼潙鍨傛繛宸簻绾惧潡鏌ゅù瀣珔闁搞劍绻堥弻娑㈠箻濡も偓鐎氼剟寮? ${e.message}`);
      return false;
    }

    // E2E: agent-registry list/show
    try {
      const listRaw = execSync(
        'node ".codebuddy/scripts/agent-registry.js" list --json',
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const list = JSON.parse(listRaw);
      const agents = Array.isArray(list.agents) ? list.agents : [];
      const planner = agents.find(a => a && a.id === 'planner');
      if (!list || list.ok !== true || typeof list.agentCount !== 'number' || list.agentCount !== agents.length || !planner) {
        throw new Error(`agent-registry list 闂傚倸鍊风粈渚€骞栭位鍥敍閻愭潙浜辨繝鐢靛Т濞层倗绮绘导瀛樼厵闂傚倸顕ˇ锕傛煕濮樻剚娼愰柕鍥у楠炴﹢宕￠悙鍏告偅缂傚倷绶￠崑鍕矓瑜版帒钃熼柨婵嗘啒閻旂厧绠伴幖杈剧到濞懷勭節? ${listRaw.slice(0, 1200)}`);
      }

      const showRaw = execSync(
        'node ".codebuddy/scripts/agent-registry.js" show planner --json',
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const show = JSON.parse(showRaw);
      if (!show || show.ok !== true || !show.agent || show.agent.id !== 'planner') {
        throw new Error(`agent-registry show 闂傚倸鍊风粈渚€骞栭位鍥敍閻愭潙浜辨繝鐢靛Т濞层倗绮绘导瀛樼厵闂傚倸顕ˇ锕傛煕濮樻剚娼愰柕鍥у楠炴﹢宕￠悙鍏告偅缂傚倷绶￠崑鍕矓瑜版帒钃熼柨婵嗘啒閻旂厧绠伴幖杈剧到濞懷勭節? ${showRaw.slice(0, 1200)}`);
      }

      let notFoundFailed = false;
      try {
        execSync(
          'node ".codebuddy/scripts/agent-registry.js" show __no_such_agent__ --json',
          { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
        );
      } catch {
        notFoundFailed = true;
      }
      if (!notFoundFailed) {
        throw new Error('agent-registry show not_found 闂傚倸鍊风粈浣革耿闁秴鍌ㄧ憸鏃堝箖濞差亜惟闁靛瀛╃粙鎺楀箯閸涘瓨鍊绘俊顖氭惈缁ㄣ儵姊绘担渚敯闁规椿浜炵划濠氬箣閿旇棄鈧嘲鈹戦悩鍙夊闁绘挾鍠栭弻鐔兼焽閿曗偓閺嬫盯鏌涢弬娆惧剰闁?0 exitCode');
      }

      logSuccess('agent-registry list/show passed');
    } catch (e) {
      logError(`agent-registry E2E 婵犵數濮烽弫鍛婃叏娴兼潙鍨傛繛宸簻绾惧潡鏌ゅù瀣珔闁搞劍绻堥弻娑㈠箻濡も偓鐎氼剟寮? ${e.message}`);
      allPassed = false;
    }

    try {
      const ruleRaw = execSync('node ".codebuddy/scripts/rule-validator.js" check --json', {
        cwd: projectDir,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      const ruleReport = JSON.parse(ruleRaw);
      if (!ruleReport || ruleReport.ok !== true || typeof ruleReport.checkedFileCount !== 'number') {
        throw new Error(`rule-validator 闂傚倸鍊风粈渚€骞栭位鍥敍閻愭潙浜辨繝鐢靛Т濞层倗绮绘导瀛樼厵闂傚倸顕ˇ锕傛煕濮樻剚娼愰柕鍥у楠炴﹢宕￠悙鍏告偅缂傚倷绶￠崑鍕矓瑜版帒钃熼柨婵嗘啒閻旂厧绠伴幖杈剧到濞懷勭節? ${ruleRaw.slice(0, 1200)}`);
      }

      const skillRaw = execSync('node ".codebuddy/scripts/skill-validator.js" check --json', {
        cwd: projectDir,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      const skillReport = JSON.parse(skillRaw);
      if (!skillReport || skillReport.ok !== true || typeof skillReport.checkedSkillCount !== 'number') {
        throw new Error(`skill-validator 闂傚倸鍊风粈渚€骞栭位鍥敍閻愭潙浜辨繝鐢靛Т濞层倗绮绘导瀛樼厵闂傚倸顕ˇ锕傛煕濮樻剚娼愰柕鍥у楠炴﹢宕￠悙鍏告偅缂傚倷绶￠崑鍕矓瑜版帒钃熼柨婵嗘啒閻旂厧绠伴幖杈剧到濞懷勭節? ${skillRaw.slice(0, 1200)}`);
      }

      logSuccess('rule-validator / skill-validator passed');
    } catch (e) {
      logError(`validator E2E 婵犵數濮烽弫鍛婃叏娴兼潙鍨傛繛宸簻绾惧潡鏌ゅù瀣珔闁搞劍绻堥弻娑㈠箻濡も偓鐎氼剟寮? ${e.message}`);
      allPassed = false;
    }

    if (PYTHON_RUNNER) {
      try {
        const skillScriptsDir = path.join(projectDir, '.codebuddy', 'skills', 'skill-creator', 'scripts');
        const targetSkillDir = path.join(projectDir, '.codebuddy', 'skills', 'frontend-testing');
        const distDir = path.join(projectDir, '.codebuddy', 'tmp-skill-dist');
        const quickValidateScript = path.join(skillScriptsDir, 'quick_validate.py');
        const packageScript = path.join(skillScriptsDir, 'package_skill.py');

        fs.rmSync(distDir, { recursive: true, force: true });
        runPythonScript(PYTHON_RUNNER, quickValidateScript, [targetSkillDir], { cwd: projectDir });
        runPythonScript(PYTHON_RUNNER, packageScript, [targetSkillDir, distDir], { cwd: projectDir });

        const packagedSkill = path.join(distDir, 'frontend-testing.skill');
        if (!fs.existsSync(packagedSkill)) {
          throw new Error(`闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敂钘変罕濠电姴锕ょ€氼噣銆呴弻銉︾厽闁归偊鍓氶幆鍫ユ煛鐎ｂ晝绐旈柡宀€鍠栭獮鎴﹀箛闂堟稒顔勭紓?.skill 闂? ${packagedSkill}`);
        }
        if (fs.statSync(packagedSkill).size <= 0) {
          throw new Error(`闂傚倸鍊搁崐鐑芥倿閿曞倹鍎戠憸鐗堝笒閸ㄥ倸鈹戦悩瀹犲缂佹劖顨婇弻鐔兼偋閸喓鍑￠梺鎼炲妼閸婂綊骞堥妸銉庣喖宕归鎯у缚闂?.skill 闂傚倸鍊搁崐椋庣矆娓氣偓楠炲鏁撻悩鍐蹭罕闂佸搫娲㈤崹鍦不閻樼鍋撻獮鍨姎婵炶濡囬埀顒佽壘椤兘寮婚敐澶婄睄闁搞儺鐓堟禒鈺呮⒑? ${packagedSkill}`);
        }

        logSuccess('skill-creator quick_validate / package passed');
      } catch (e) {
        logError(`skill-creator packaging E2E 婵犵數濮烽弫鍛婃叏娴兼潙鍨傛繛宸簻绾惧潡鏌ゅù瀣珔闁搞劍绻堥弻娑㈠箻濡も偓鐎氼剟寮? ${e.message}`);
        allPassed = false;
      }
    } else {
      logWarn('闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敂钘変罕濠电姴锕ょ€氼噣銆呴崣澶岀瘈闂傚牊绋撻幊浣割熆閼搁潧濮囩€瑰憡绻冮妵鍕箳閺傚灝浠樺┑鐘亾闂侇剙绉撮悞鍨亜閹烘埊鍔熺紒澶愭涧闇夋繝濠傚閻帡鏌?Python闂傚倸鍊搁崐鐑芥倿閿旈敮鍋撶粭娑樻噽閻瑩鏌熸潏楣冩闁稿孩顨呴妴鎺戭潩閿濆懍澹曢梻浣筋嚃閸犳鍒掗幘璇叉瀬闁稿瞼鍋為崵宥夋煏婢跺牆鈧牠宕?skill-creator quick_validate / package E2E');
    }

    try {
      const tbRaw = execSync(
        'node ".codebuddy/scripts/taskbook-manager.js" create --title "E2E Workflow" --description "mock e2e" --type new-feature --json',
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const taskBook = JSON.parse(tbRaw);
      const taskBookId = taskBook.id;

      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" add-task ${taskBookId} --title "Analyze project" --type analysis --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" confirm ${taskBookId} --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      execSync(
        `node ".codebuddy/scripts/task-executor.js" ${taskBookId} --approve review_passed`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      const activeTbFile = path.join(taskbooksDir, 'active', `${taskBookId}.json`);
      const historyTbFile = path.join(taskbooksDir, 'history', `${taskBookId}.json`);
      const acceptanceFile = path.join(reportsDir, 'taskbooks', `${taskBookId}.acceptance.json`);
      const archReport = path.join(reportsDir, 'architecture', 'latest.json');
      const modulesReport = path.join(reportsDir, 'modules', 'latest.json');

      if (fs.existsSync(activeTbFile)) {
        logError(`TaskBook 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敂钘変罕濠电姴锕ょ€氼噣銆呴崣澶岀瘈濠电姴鍊归崳鐣岀磼閳ь剚绻濋崒妤佹杸闂佺粯蓱瑜板啯绂嶉悙瀵哥閻庢稒顭囨晶鐢告煛鐏炶濡奸柍瑙勫灴瀹曞崬鈻庨幋顓炴暯缂傚倸鍊风拋鏌ュ磻閹剧粯鐓曢柟鐑樻煥婢瑰敆ive 婵犵數濮烽弫鎼佸磻濞戙埄鏁嬫い鎾跺枑閸欏繘鎮楅棃娑欐喐闁活厽鎹囬弻鐔虹磼閵忕姵鐏嶉梺绋款儍閸婃繈寮婚弴鐔虹闁绘劦鍓氶悵鏃堟⒑閸︻収鏀伴柛鈺傜墵婵＄敻宕熼锝嗘櫍闂佺粯妫冮ˉ鎾活敄閸屾粎纾藉ù锝嗗絻娴? ${activeTbFile}`);
        allPassed = false;
      }
      if (!fs.existsSync(historyTbFile)) {
        logError(`TaskBook 闂傚倷娴囧畷鐢稿窗閹邦喖鍨濋幖娣灪濞呯姵淇婇妶鍛殲闁哄棙绮嶆穱濠囧Χ閸涱喖娅ｉ弶鈺傜箞濮婅櫣绮欑捄銊т紘闂佺顑嗙粙鎴ｇ亱濠殿喗銇涢崑鎾绘煛鐏炲墽娲村┑锛勫厴椤㈡盯鎮欓幖顓涘亾瀹ュ拋娓婚柕鍫濇婵本淇婇銏狀伃闁糕斂鍎插鍕箛椤掑偆鍟嬮柣搴ゎ潐濞叉牕鈻旈敃鍌氼潊闁靛牆妫涢崢浠嬫煙閻戞ê鈻曠€规洘绻堥獮瀣攽閸喐顔? ${historyTbFile}`);
        allPassed = false;
      }
      if (!fs.existsSync(acceptanceFile)) {
        logError(`婵犵數濮撮惀澶愬级鎼存挸浜炬俊銈勭劍閸欏繘鏌熺紒銏犳灈閻庢艾顦伴妵鍕箳閹存繍浠奸梺鍝勵儎閼冲爼骞夐幖浣瑰亱闁割偅绻勯悷銊х磽娴ｅ搫顎岄柛锝忕秮瀵寮撮悢椋庣獮闂佸壊鍋呯换鍌涙叏閺囥垺鈷戦柛婵勫劚閺嬫棃鏌涚€ｎ偆娲撮柛鈹垮劜瀵板嫰骞囬鍌ゅ晪闁诲氦顫夊ú鏍р枖閿曞倸顫呴柕鍫濇閸樹粙鏌熼悜妯衡枙鐎规洘绻堥獮瀣攽閸喐顔? ${acceptanceFile}`);
        allPassed = false;
      }
      if (!fs.existsSync(archReport)) {
        logError(`architecture report 婵犵數濮烽弫鎼佸磻閻愬搫鍨傞柛顐ｆ礀缁犱即鏌涘┑鍕姢闁活厽鎹囬弻鐔虹磼閵忕姵鐏嶉梺绋款儍閸婃繈寮婚弴鐔虹闁绘劦鍓氶悵鏃堟⒑? ${archReport}`);
        allPassed = false;
      }
      if (!fs.existsSync(modulesReport)) {
        logError(`modules report 婵犵數濮烽弫鎼佸磻閻愬搫鍨傞柛顐ｆ礀缁犱即鏌涘┑鍕姢闁活厽鎹囬弻鐔虹磼閵忕姵鐏嶉梺绋款儍閸婃繈寮婚弴鐔虹闁绘劦鍓氶悵鏃堟⒑? ${modulesReport}`);
        allPassed = false;
      }

      if (allPassed) {
        logSuccess('workflow single-task flow passed');
      }
    } catch (e) {
      logError(`workflow E2E 婵犵數濮烽弫鍛婃叏娴兼潙鍨傛繛宸簻绾惧潡鏌ゅù瀣珔闁搞劍绻堥弻娑㈠箻濡も偓鐎氼剟寮? ${e.message}`);
      allPassed = false;
    }

    // E2E: batching - multiple tasks -> multiple batches -> multiple smoke gates
    try {
      const tbRaw = execSync(
        'node ".codebuddy/scripts/taskbook-manager.js" create --title "E2E Batching" --description "mock e2e batching" --type new-feature --json',
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const taskBook = JSON.parse(tbRaw);
      const taskBookId = taskBook.id;

      const batchTasks = [
        { title: 'Batch task 1', files: ['src/batch/a1.ts', 'src/batch/a2.ts', 'src/batch/a3.ts'] },
        { title: 'Batch task 2', files: ['src/batch/b1.ts', 'src/batch/b2.ts', 'src/batch/b3.ts'] },
        { title: 'Batch task 3', files: ['src/batch/c1.ts', 'src/batch/c2.ts', 'src/batch/c3.ts'] },
        { title: 'Batch task 4', files: ['src/batch/d1.ts', 'src/batch/d2.ts', 'src/batch/d3.ts'] },
      ];

      for (const t of batchTasks) {
        execSync(
          `node ".codebuddy/scripts/taskbook-manager.js" add-task ${taskBookId} --title \"${t.title}\" --type analysis --files \"${t.files.join(',')}\" --json`,
          { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
        );
      }

      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" confirm ${taskBookId} --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      execSync(
        `node ".codebuddy/scripts/task-executor.js" ${taskBookId} --approve review_passed`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      const historyTbFile = path.join(taskbooksDir, 'history', `${taskBookId}.json`);
      const acceptanceFile = path.join(reportsDir, 'taskbooks', `${taskBookId}.acceptance.json`);

      if (!fs.existsSync(historyTbFile)) {
        logError(`Batching: TaskBook 闂傚倷娴囧畷鐢稿窗閹邦喖鍨濋幖娣灪濞呯姵淇婇妶鍛殲闁哄棙绮嶆穱濠囧Χ閸涱喖娅ｉ弶鈺傜箞濮婅櫣绮欑捄銊т紘闂佺顑嗙粙鎴ｇ亱濠殿喗銇涢崑鎾绘煛鐏炲墽娲村┑锛勫厴椤㈡盯鎮欓幖顓涘亾瀹ュ拋娓婚柕鍫濇婵本淇婇銏狀伃闁糕斂鍎插鍕箛椤掑偆鍟嬮柣搴ゎ潐濞叉牕鈻旈敃鍌氼潊闁靛牆妫涢崢浠嬫煙閻戞ê鈻曠€规洘绻堥獮瀣攽閸喐顔? ${historyTbFile}`);
        allPassed = false;
      } else {
        const tb = JSON.parse(fs.readFileSync(historyTbFile, 'utf-8'));
        const changelog = Array.isArray(tb.changelog) ? tb.changelog : [];

        const smokeGateEvents = changelog.filter(e => e && e.after && e.after.event === 'gate' && e.after.gateId === 'smoke_passed' && (e.after.stepId === 'implement' || e.after.stepId === 'tdd_implement'));
        const batchEvents = changelog.filter(e => e && e.after && e.after.event === 'batch' && (e.after.stepId === 'implement' || e.after.stepId === 'tdd_implement'));

        if (smokeGateEvents.length < 2) {
          logError(`Batching: smoke_passed gate events too few (expected >=2, got ${smokeGateEvents.length})`);
          allPassed = false;
        } else {
          logSuccess(`Batching: smoke_passed gate events = ${smokeGateEvents.length}`);
        }

        if (batchEvents.length < 4) {
          logError(`Batching: batch events too few (expected >=4, got ${batchEvents.length})`);
          allPassed = false;
        } else {
          logSuccess(`Batching: batch events = ${batchEvents.length}`);
        }
      }

      if (!fs.existsSync(acceptanceFile)) {
        logError(`Batching: 婵犵數濮撮惀澶愬级鎼存挸浜炬俊銈勭劍閸欏繘鏌熺紒銏犳灈閻庢艾顦伴妵鍕箳閹存繍浠奸梺鍝勵儎閼冲爼骞夐幖浣瑰亱闁割偅绻勯悷銊х磽娴ｅ搫顎岄柛锝忕秮瀵寮撮悢椋庣獮闂佸壊鍋呯换鍌涙叏閺囥垺鈷戦柛婵勫劚閺嬫棃鏌涚€ｎ偆娲撮柛鈹垮劜瀵板嫰骞囬鍌ゅ晪闁诲氦顫夊ú鏍р枖閿曞倸顫呴柕鍫濇閸樹粙鏌熼悜妯衡枙鐎规洘绻堥獮瀣攽閸喐顔? ${acceptanceFile}`);
        allPassed = false;
      }

      if (allPassed) {
        logSuccess('workflow single-task flow passed');
      }
    } catch (e) {
      logError(`workflow batching E2E 婵犵數濮烽弫鍛婃叏娴兼潙鍨傛繛宸簻绾惧潡鏌ゅù瀣珔闁搞劍绻堥弻娑㈠箻濡も偓鐎氼剟寮? ${e.message}`);
      allPassed = false;
    }

    // E2E: planner -> apply-plan (闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敃鈧壕鍦磼鐎ｎ偓绱╂繛宸簼閺呮煡鏌涘☉鍙樼凹闁诲骸顭峰娲濞戞氨鐤勯梺绋匡攻濞叉粌鈽夐悽绋跨劦妞ゆ帒瀚ˉ濠冦亜閹扳晛鐏璺哄閺屾盯骞嬪┑鍫⑿ㄩ悗?
    try {
      const tbRaw = execSync(
        'node ".codebuddy/scripts/taskbook-manager.js" create --title "E2E Planner" --description "mock e2e planner" --type new-feature --json',
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const taskBook = JSON.parse(tbRaw);
      const taskBookId = taskBook.id;
      const revision = typeof taskBook.revision === 'number' ? taskBook.revision : 0;

      const planRaw = execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" plan ${taskBookId} --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const plan = JSON.parse(planRaw);
      const requestId = plan.requestId;

      if (!requestId || !plan.promptPath || !plan.resultPath) {
        throw new Error('planner plan 闂傚倸鍊风粈渚€骞栭位鍥敍閻愭潙浜辨繝鐢靛Т濞层倗绮绘导瀛樼厵闂傚倸顕ˇ锕傛煕濮樻剚娼愰柕鍥у楠炴鎹勯惄鎺嬪劤閻ヮ亪宕ｉ妷褏鐓撻梺鍝勬湰缁嬫垿鍩為幋锕€骞㈡俊銈咃梗缁辨垶绻?requestId/promptPath/resultPath');
      }
      if (!fs.existsSync(plan.promptPath)) {
        throw new Error(`planner prompt.md 婵犵數濮烽弫鎼佸磻閻愬搫鍨傞柛顐ｆ礀缁犱即鏌涘┑鍕姢闁活厽鎹囬弻鐔虹磼閵忕姵鐏嶉梺绋款儍閸婃繈寮婚弴鐔虹闁绘劦鍓氶悵鏃堟⒑? ${plan.promptPath}`);
      }

      const result = {
        requestId,
        status: 'success',
        output: {
          tasks: [
            { planId: 'T1', title: 'Analyze requirement', type: 'analysis' },
            { planId: 'T2', title: 'Design approach', type: 'design', dependencies: ['T1'] },
            { planId: 'T3', title: 'Implement changes', type: 'implement', dependencies: ['T2'] },
          ],
        },
        completedAt: new Date().toISOString(),
      };

      fs.writeFileSync(plan.resultPath, JSON.stringify(result, null, 2), 'utf-8');

      const applyRaw = execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" apply-plan ${taskBookId} ${requestId} --if-rev ${revision} --json`,
        {
          cwd: projectDir,
          stdio: 'pipe',
          encoding: 'utf-8',
          env: { ...process.env, CODEBUDDY_TASKBOOK_REQUIRE_IF_REV: '1' },
        }
      );

      const applied = JSON.parse(applyRaw);
      const tb = applied.taskBook;
      const map = applied.planIdToTaskId;

      if (!tb || !Array.isArray(tb.tasks)) {
        throw new Error('apply-plan 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敂钘変罕濠电姴锕ょ€氼噣銆呴弻銉︾叆婵犻潧妫欐径鍕偓瑙勬礃閻擄繝寮婚悢鍛婄秶闁告挆鍛闂?taskBook');
      }
      if (!map || typeof map !== 'object') {
        throw new Error('apply-plan 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敂钘変罕濠电姴锕ょ€氼噣銆呴弻銉︾叆婵犻潧妫欐径鍕偓瑙勬礃閻擄繝寮婚悢鍛婄秶闁告挆鍛闂?planIdToTaskId');
      }

      const t1 = tb.tasks.find(t => t.id === map.T1);
      const t2 = tb.tasks.find(t => t.id === map.T2);
      const t3 = tb.tasks.find(t => t.id === map.T3);

      if (!t1 || !t2 || !t3) {
        throw new Error('apply-plan: task mapping incomplete');
      }
      if (!Array.isArray(t2.dependencies) || t2.dependencies[0] !== t1.id) {
        throw new Error('apply-plan: task mapping incomplete');
      }
      if (!Array.isArray(t3.dependencies) || t3.dependencies[0] !== t2.id) {
        throw new Error('apply-plan: task mapping incomplete');
      }
      if (typeof tb.revision === 'number' && tb.revision !== revision + 1) {
        throw new Error(`apply-plan: revision 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敂钘変罕濠电姴锕ょ€氼噣銆呴崣澶岀瘈闂傚牊绋撴晶鎰版煕鐎ｎ偅宕岀€规洖缍婇、鏇㈠Χ閸モ晛甯掗梻鍌欑劍鐎笛呯矙閹烘绀夋繛鍡楃箳閺嗭箓鏌ｉ弮鍌楁嫛闁轰礁妫楅湁闁挎繂鎳忛幉鎼佹煕閺冩垵鐏犻柍瑙勫灴閹晠顢曢敐鍜佲偓蹇涙⒑閸涘﹣绶遍柛妯烘惈鍗遍柟鎵閳?(expected ${revision + 1}, got ${tb.revision})`);
      }

      logSuccess('planner -> apply-plan flow passed');
    } catch (e) {
      logError(`planner E2E 婵犵數濮烽弫鍛婃叏娴兼潙鍨傛繛宸簻绾惧潡鏌ゅù瀣珔闁搞劍绻堥弻娑㈠箻濡も偓鐎氼剟寮? ${e.message}`);
      allPassed = false;
    }

    // E2E: MANUAL_REQUIRED -> agent-call prompt/result -> resume
    try {
      const tbRaw = execSync(
        'node ".codebuddy/scripts/taskbook-manager.js" create --title "E2E AgentCall" --description "mock e2e agent-call" --type new-feature --json',
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const taskBook = JSON.parse(tbRaw);
      const taskBookId = taskBook.id;

      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" add-task ${taskBookId} --title "Do implementation" --type implement --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" confirm ${taskBookId} --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      const first = spawnSync(process.execPath, ['.codebuddy/scripts/task-executor.js', taskBookId, '--tasks-only'], {
        cwd: projectDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      if (first.status !== 2) {
        throw new Error(`婵犵數濮烽。钘壩ｉ崨鏉戠；闁规崘娉涚欢銈呂旈敐鍛殲闁稿顑嗘穱濠囧Χ閸涱喖顎涢梺杞扮閸燁偊鍩為幋锕€纾兼繝濠傛捣閸斿摜绱撴担鍝勑為柛搴㈠▕楠炲骞栨担鍝ヮ吅闂佹寧妫侀妴鈧柛瀣尰缁楃喖鍩€椤掑嫮宓侀悗锝庡枟閸婄兘鏌℃径瀣仴濠碘剝濞婂缁樻媴閸涘﹥鍎撻梺绋匡功閹虫捇鎮惧畡鎷旂喖鎳栭埡鍐姸?blocked (exit=2)闂傚倸鍊搁崐鐑芥倿閿旈敮鍋撶粭娑樻噽閻瑩鏌熸潏楣冩闁搞倖鍔栭妵鍕冀椤愵澀娌梺绋款儛娴滎亪寮诲☉銏犲嵆闁靛鍎虫禒顓㈡⒑?exit=${first.status}, stderr=${first.stderr}`);
      }

      const activeTbFile = path.join(taskbooksDir, 'active', `${taskBookId}.json`);
      if (!fs.existsSync(activeTbFile)) {
        throw new Error(`TaskBook active 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敃鈧壕鍦磼鐎ｎ偓绱╂繛宸簼閺呮煡鏌涘☉鍙樼凹闁诲骸顭峰娲濞戙垻宕紓浣介哺濞茬喖宕洪姀銈呯睄闁稿本顨呮禍鐐殽閻愯尙浠㈤柛鏃€宀搁弻鐔兼惞椤愩垹顫掑Δ鐘靛仦椤ㄥ﹪骞冮埡鍐＜婵☆垳鍘ч獮? ${activeTbFile}`);
      }

      const tb1 = JSON.parse(fs.readFileSync(activeTbFile, 'utf-8'));
      const blocked = tb1.tasks.find(t => t && t.status === 'blocked');
      if (!blocked || !blocked.blockedReason) {
        throw new Error('blocked task or blockedReason not found');
      }

      const metaLine = String(blocked.blockedReason).split(/\r?\n/).map(s => s.trim()).find(s => s.startsWith('[agent-call]'));
      if (!metaLine) {
        throw new Error('blockedReason missing [agent-call] metadata');
      }
      const meta = JSON.parse(metaLine.slice('[agent-call]'.length).trim());
      if (!meta.requestId || !meta.promptPath || !meta.resultPath) {
        throw new Error('agent-call 闂傚倸鍊搁崐鐑芥嚄閸洍鈧箓宕奸姀鈥冲簥闂佸湱澧楀姗€鎮块濮愪簻闁哄稁鍋勬禒婊勬叏鐟欏嫮鍙€闁哄矉缍佸顕€宕掑顑跨帛缂傚倷鑳舵慨鏉戭嚕閸洖桅闁告洦鍨扮猾宥夋煃瑜滈崜鐔风暦閺囩偟鏆﹂柛銉ｅ妼鎼村﹥绻涢幘鏉戠劰闁稿鎹囬弻?requestId/promptPath/resultPath');
      }

      const promptPath = path.join(projectDir, meta.promptPath);
      const resultPath = path.join(projectDir, meta.resultPath);
      if (!fs.existsSync(promptPath)) {
        throw new Error(`agent-call prompt 婵犵數濮烽弫鎼佸磻閻愬搫鍨傞柛顐ｆ礀缁犱即鏌涘┑鍕姢闁活厽鎹囬弻鐔虹磼閵忕姵鐏嶉梺绋款儍閸婃繈寮婚弴鐔虹闁绘劦鍓氶悵鏃堟⒑? ${promptPath}`);
      }

      const promptMd = fs.readFileSync(promptPath, 'utf-8');
      const headerMatch = promptMd.match(/```json\s*([\s\S]*?)\s*```/);
      if (!headerMatch) {
        throw new Error('agent-call prompt 缂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缂佺姾顫夐妵鍕箛閸洘顎嶉梺?header JSON code block');
      }
      const header = JSON.parse(headerMatch[1]);
      if (!header || typeof header.taskBookRevision !== 'number' || header.taskBookRevision < 0) {
        throw new Error('agent-call prompt header missing taskBookRevision');
      }
      if (typeof header.agentVersion !== 'string' || !header.agentVersion.trim()) {
        throw new Error('agent-call prompt header missing agentVersion');
      }

      const result = {
        requestId: meta.requestId,
        status: 'success',
        output: { actualWork: 'Implemented feature X; ran tests Y; verified Z.' },
        completedAt: new Date().toISOString(),
      };
      fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8');

      const second = spawnSync(process.execPath, ['.codebuddy/scripts/task-executor.js', taskBookId, '--tasks-only'], {
        cwd: projectDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      if (second.status !== 0) {
        throw new Error(`闂傚倸鍊搁崐椋庣矆娓氣偓楠炲鏁撻悩鑼槷闂佸搫绋侀崢浠嬪磻閿熺姵鐓忓璺虹墕閸?result.json 闂傚倸鍊搁崐椋庣矆娓氣偓楠炲鏁撻悩鍐叉疄闂佺粯鍔﹂崜锕€鈻撴禒瀣厱婵犻潧瀚崝銉モ攽椤旇棄鈻曢柡灞诲€楅崰濠囧础閻愭彃绠ｉ梻浣侯焾椤戝棝骞戦崶顒€绠栭柣鎴ｅГ閸嬪鏌涢銈呮瀾閻庢碍濞婂?(exit=0)闂傚倸鍊搁崐鐑芥倿閿旈敮鍋撶粭娑樻噽閻瑩鏌熸潏楣冩闁搞倖鍔栭妵鍕冀椤愵澀娌梺绋款儛娴滎亪寮诲☉銏犲嵆闁靛鍎虫禒顓㈡⒑?exit=${second.status}, stderr=${second.stderr}`);
      }

      const historyTbFile = path.join(taskbooksDir, 'history', `${taskBookId}.json`);
      if (!fs.existsSync(historyTbFile)) {
        throw new Error(`TaskBook history 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敃鈧壕鍦磼鐎ｎ偓绱╂繛宸簼閺呮煡鏌涘☉鍙樼凹闁诲骸顭峰娲濞戙垻宕紓浣介哺濞茬喖宕洪姀銈呯睄闁稿本顨呮禍鐐殽閻愯尙浠㈤柛鏃€宀搁弻鐔兼惞椤愩垹顫掑Δ鐘靛仦椤ㄥ﹪骞冮埡鍐＜婵☆垳鍘ч獮? ${historyTbFile}`);
      }

      const tb2 = JSON.parse(fs.readFileSync(historyTbFile, 'utf-8'));
      const done = tb2.tasks.find(t => t && t.type === 'implement');
      if (!done || done.status !== 'done') {
        throw new Error('agent-call apply 闂?implement 婵犵數濮烽弫鎼佸磻濞戙埄鏁嬫い鎾跺枑閸欏繐螖閿濆懎鏋ら柡浣割儑閹插憡鎯旈妸銉х杽闂侀潧艌閺呮粓宕戦崟顖涚厽闁圭偓濞婇妤呮煟濠靛毟顏堚€旈崘顔嘉ч柛娑卞灣椤斿洭鏌ｆ惔銏犲毈闁告挻绋撳Σ鎰版倷鐎涙ê顎撶紓渚囧灡濞叉﹢锝?done');
      }
      if (!done.actualWork || !String(done.actualWork).includes('Implemented feature')) {
        throw new Error('agent-call apply did not write actualWork');
      }

      const reportRaw = execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" report ${taskBookId} --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const report = JSON.parse(reportRaw);
      if (!report || !Array.isArray(report.agentCalls) || report.agentCalls.length === 0) {
        throw new Error('acceptance report 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敂钘変罕濠电姴锕ょ€氼噣銆呴崣澶岀瘈濠电姴鍊归崳鎶芥煕鐎ｎ偅宕岀€规洖缍婇、鏇㈩敆閸愶絽浜鹃悹鎭掑妷閸?agentCalls[]');
      }
      const appliedEvent = report.agentCalls.find(a => a && a.requestId === meta.requestId && a.action === 'applied');
      if (!appliedEvent) {
        throw new Error('acceptance report missing agent-call applied event');
      }

      const metricsDir = path.join(projectDir, '.codebuddy', 'reports', 'metrics');
      const metricsSummaryPath = path.join(metricsDir, 'latest-summary.json');
      const metricsEventsPath = path.join(metricsDir, 'execution-events.jsonl');
      if (!fs.existsSync(metricsSummaryPath) || !fs.existsSync(metricsEventsPath)) {
        throw new Error('execution metrics files missing after agent-call resume');
      }
      const metricsSummary = JSON.parse(fs.readFileSync(metricsSummaryPath, 'utf-8'));
      if ((metricsSummary?.totals?.agentCallsCreated || 0) < 1 || (metricsSummary?.totals?.agentCallsApplied || 0) < 1 || (metricsSummary?.totals?.resumed || 0) < 1) {
        throw new Error('execution metrics summary missing agent-call counters');
      }
      const metricsEvents = fs.readFileSync(metricsEventsPath, 'utf-8')
        .split(/\r?\n/)
        .filter(Boolean)
        .map(line => JSON.parse(line));
      const createdMetric = metricsEvents.find(event => event && event.eventType === 'agent_call_created' && event.requestId === meta.requestId);
      const appliedMetric = metricsEvents.find(event => event && event.eventType === 'agent_call_applied' && event.requestId === meta.requestId);
      if (!createdMetric || !appliedMetric) {
        throw new Error('execution metrics events missing agent-call created/applied records');
      }

      logSuccess('MANUAL_REQUIRED -> agent-call -> resume passed');
    } catch (e) {
      logError(`agent-call E2E 婵犵數濮烽弫鍛婃叏娴兼潙鍨傛繛宸簻绾惧潡鏌ゅù瀣珔闁搞劍绻堥弻娑㈠箻濡も偓鐎氼剟寮? ${e.message}`);
      allPassed = false;
    }

    // E2E: WorkerExecutor auto-executes rendered prompt and writes result inline
    try {
      const tbRaw = execSync(
        'node ".codebuddy/scripts/taskbook-manager.js" create --title "E2E Worker" --description "mock e2e worker" --type new-feature --json',
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const taskBook = JSON.parse(tbRaw);
      const taskBookId = taskBook.id;

      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" add-task ${taskBookId} --title "Worker implementation" --type implement --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" confirm ${taskBookId} --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      const workerScriptPath = path.join(projectDir, '.mock-worker.js');
      fs.writeFileSync(workerScriptPath, [
        'let raw = "";',
        'process.stdin.setEncoding("utf8");',
        'process.stdin.on("data", chunk => { raw += chunk; });',
        'process.stdin.on("end", () => {',
        '  const payload = JSON.parse(raw || "{}");',
        '  const result = {',
        '    requestId: payload.requestId,',
        '    status: "success",',
        '    output: { actualWork: "Worker completed " + payload.task.title + " via " + payload.agentId },',
        '    artifacts: [{ type: "report", path: ".codebuddy/reports/worker/mock.json" }],',
        '    completedAt: new Date().toISOString(),',
        '  };',
        '  process.stdout.write(JSON.stringify(result));',
        '});',
      ].join('\n'), 'utf-8');

      const workerRun = spawnSync(process.execPath, ['.codebuddy/scripts/task-executor.js', taskBookId, '--tasks-only'], {
        cwd: projectDir,
        env: {
          ...process.env,
          CODEBUDDY_WORKER_COMMAND: 'node .mock-worker.js',
        },
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      if (workerRun.status !== 0) {
        throw new Error(`worker-executor 闂傚倸鍊风粈浣革耿闁秵鍋￠柟鎯版楠炪垽鏌嶉崫鍕偓褰掑级閹间焦鈷戦柛锔诲幖鐢爼鏌ｆ幊閸斿矂锝炶箛鏇熷珰閻熶椒鐒﹀钘夌暦缁嬭鏃堝焵椤掑倻涓嶉柟鎯板Г閻撳繐顭跨捄铏瑰闁告柣鍊濋弻锟犲幢濡搫鎽甸梺?exit=0)闂傚倸鍊烽悞锔锯偓绗涘懐鐭欓柟杈鹃檮閸ゆ劖銇勯弽顐沪闁稿浜弻娑㈠即閵娿儳浠梺?exit=${workerRun.status}, stderr=${workerRun.stderr}`);
      }

      const historyTbFile = path.join(taskbooksDir, 'history', `${taskBookId}.json`);
      if (!fs.existsSync(historyTbFile)) {
        throw new Error(`worker-executor: TaskBook history 闂傚倸鍊风粈渚€骞栭锕€纾圭紒瀣紩濞差亝鏅查柛娑变簼閻庡姊洪棃娑㈢崪缂佽鲸娲熼崺銏ゅ籍閸屾浜炬鐐茬仢閸旀岸鏌熼搹顐㈠妤犵偞顨婇幃鈺冪磼濡厧骞? ${historyTbFile}`);
      }

      const tb2 = JSON.parse(fs.readFileSync(historyTbFile, 'utf-8'));
      const done = tb2.tasks.find(t => t && t.type === 'implement');
      if (!done || done.status !== 'done') {
        throw new Error('worker-executor 闂傚倸鍊风粈浣革耿闁秵鍋￠柟鎯版楠炪垽鏌嶉崫鍕偓褰掑级閹间焦鈷?implement 濠电姷鏁搁崑娑㈩敋椤撶喐鍙忓Δ锝呭枤閺佸鎲告惔銊ョ疄闁靛ň鏅滈崑鍕煟閹炬娊顎楅柣婵嚸—鍐Χ閸涱垳顔囬柣搴㈠嚬閸撴稓妲愰悙瀛樺缂侇垱娲橀～?done');
      }
      if (!done.actualWork || !String(done.actualWork).includes('Worker completed')) {
        throw new Error('worker-executor 闂傚倸鍊风粈渚€骞栭锔藉亱婵犲﹤瀚々鍙夌節婵犲倻澧曢柣銈庡櫍閺岀喖骞戦幇闈涙缂備讲鍋?actualWork');
      }
      if (done.executedBy !== 'worker-executor:tdd-driver') {
        throw new Error(`worker-executor executedBy 闂備浇顕х€涒晠顢欓弽顓炵獥闁哄稁鍘肩壕褰掓煙闂傚鍔嶉柛? ${done.executedBy}`);
      }

      const workerEvent = Array.isArray(tb2.changelog)
        ? tb2.changelog.find(entry => entry && entry.after && entry.after.event === 'worker-executor' && entry.after.action === 'applied')
        : null;
      if (!workerEvent) {
        throw new Error('worker-executor changelog event missing');
      }

      const requestId = workerEvent.after && workerEvent.after.requestId;
      const workerPromptPath = requestId
        ? path.join(agentCallsDir, `${requestId}.prompt.md`)
        : '';
      if (!requestId) {
        throw new Error('worker-executor event missing requestId');
      }
      if (workerPromptPath && fs.existsSync(workerPromptPath)) {
        throw new Error(`worker-executor should not create prompt for successful request: ${workerPromptPath}`);
      }

      const metricsSummaryPath = path.join(projectDir, '.codebuddy', 'reports', 'metrics', 'latest-summary.json');
      const metricsEventsPath = path.join(projectDir, '.codebuddy', 'reports', 'metrics', 'execution-events.jsonl');
      if (!fs.existsSync(metricsSummaryPath) || !fs.existsSync(metricsEventsPath)) {
        throw new Error('execution metrics files missing after worker execution');
      }
      const metricsSummary = JSON.parse(fs.readFileSync(metricsSummaryPath, 'utf-8'));
      if ((metricsSummary?.totals?.workerExecutions || 0) < 1 || (metricsSummary?.totals?.completed || 0) < 1) {
        throw new Error('execution metrics summary missing worker counters');
      }
      const metricsEvents = fs.readFileSync(metricsEventsPath, 'utf-8')
        .split(/\r?\n/)
        .filter(Boolean)
        .map(line => JSON.parse(line));
      const startedMetric = metricsEvents.find(event => event && event.eventType === 'task_started' && event.taskId === done.id);
      const completedMetric = metricsEvents.find(event => event && event.eventType === 'task_completed' && event.taskId === done.id && event.executionMode === 'worker');
      if (!startedMetric || !completedMetric) {
        throw new Error('execution metrics events missing worker start/completion records');
      }

      logSuccess('worker-executor auto execution passed');
    } catch (e) {
      logError(`worker-executor E2E 濠电姷鏁告慨浼村垂濞差亜纾块柤娴嬫櫅閸ㄦ繈鏌涢幘妤€瀚弸? ${e.message}`);
      allPassed = false;
    }
    // E2E: priority scheduling (higher priority first)
    try {
      const tbRaw = execSync(
        'node ".codebuddy/scripts/taskbook-manager.js" create --title "E2E Priority" --description "mock e2e priority" --type new-feature --json',
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const taskBook = JSON.parse(tbRaw);
      const taskBookId = taskBook.id;

      // Deliberately create in non-priority order to verify scheduler sorting.
      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" add-task ${taskBookId} --title "Low priority analysis" --type analysis --priority low --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" add-task ${taskBookId} --title "Medium priority analysis" --type analysis --priority medium --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" add-task ${taskBookId} --title "Critical priority analysis" --type analysis --priority critical --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" confirm ${taskBookId} --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      const run = spawnSync(process.execPath, ['.codebuddy/scripts/task-executor.js', taskBookId, '--tasks-only', '--max-parallel', '1'], {
        cwd: projectDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      if (run.status !== 0) {
        throw new Error(`priority 闂傚倸鍊搁崐椋庣矆娴ｉ潻鑰块梺顒€绉甸崑锟犳煙閹増顥夋鐐灲閺屽秹宕崟顐熷亾瑜版帒绾х紒瀣氨閺€浠嬫煟濮楀棗鏋涢柣蹇ｄ邯閺屾稒鎯旈妶鍛睏闂佸憡甯楃敮鈥崇暦濠婂棭妲奸梺? exit=${run.status}, stderr=${run.stderr}`);
      }

      const historyTbFile = path.join(taskbooksDir, 'history', `${taskBookId}.json`);
      if (!fs.existsSync(historyTbFile)) {
        throw new Error(`priority: TaskBook history 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敃鈧壕鍦磼鐎ｎ偓绱╂繛宸簼閺呮煡鏌涘☉鍙樼凹闁诲骸顭峰娲濞戙垻宕紓浣介哺濞茬喖宕洪姀銈呯睄闁稿本顨呮禍鐐殽閻愯尙浠㈤柛鏃€宀搁弻鐔兼惞椤愩垹顫掑Δ鐘靛仦椤ㄥ﹪骞冮埡鍐＜婵☆垳鍘ч獮? ${historyTbFile}`);
      }

      const tb = JSON.parse(fs.readFileSync(historyTbFile, 'utf-8'));
      const tasks = Array.isArray(tb.tasks) ? tb.tasks : [];
      const analysisTasks = tasks.filter(t => t && t.type === 'analysis');
      if (analysisTasks.length !== 3) {
        throw new Error(`priority: analysis tasks 闂傚倸鍊搁崐宄懊归崶褜娴栭柕濞垮労濞撳鏌熼悜姗嗘當缁绢厸鍋撻梻浣筋潐閸庣厧螞閸曨垱鈷掓い鏍仦閻撶喖鏌熺€电鍓遍柣鎺嶇矙閺屽秶绱掑Ο鐑╂嫽闂侀€炲苯澧紒鐘茬Ч瀹曟洟鏌嗗鍛唵闁诲函缍嗛崰鏍触?(expected 3, got ${analysisTasks.length})`);
      }

      const startedSorted = [...analysisTasks].sort((a, b) => String(a.startedAt || '').localeCompare(String(b.startedAt || '')));
      const firstTitle = startedSorted[0]?.title;
      if (firstTitle !== 'Critical priority analysis') {
        throw new Error(`priority: 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敂钘変罕濠电姴锕ょ€氼噣銆呴崣澶岀瘈闂傚牊绋撴晶鎰版煕鐎ｎ偅宕岀€规洖缍婇、鏇㈠Χ閸モ晛甯掗梻浣筋嚙濞寸兘寮幖浣稿偍鐟滄垿鎮橀幒妤佲拺闁告稑锕︾粻鎾绘倵濮樼厧澧い鏇到铻栭柛鎰典簽閿涙繃绻涙潏鍓у埌闁圭⒈鍋婇幃鐢告晸閻樺磭鍘遍梺瑙勫閺呮稒淇婇懖鈹惧亾濞堝灝鏋熸い銊ワ工椤繐煤椤忓嫭宓嶅銈嗘尵婵敻宕甸崟顖涒拺缂侇垱娲橀鍡涙煛閸涱喚鐭掔€殿噮鍓熼崺鈧?critical (first=${firstTitle})`);
      }

      logSuccess('priority scheduling passed');
    } catch (e) {
      logError(`priority E2E 婵犵數濮烽弫鍛婃叏娴兼潙鍨傛繛宸簻绾惧潡鏌ゅù瀣珔闁搞劍绻堥弻娑㈠箻濡も偓鐎氼剟寮? ${e.message}`);
      allPassed = false;
    }

    // E2E: task-orchestrator (one-command closed loop, tasks-only for speed)
    try {
      const firstRun = spawnSync(process.execPath, [
        '.codebuddy/scripts/task-orchestrator.js',
        'E2E Orchestrator requirement',
        '--type', 'new-feature',
        '--tasks-only',
        '--json',
      ], {
        cwd: projectDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      if (firstRun.status !== 2) {
        throw new Error(`orchestrator 婵犵數濮烽。钘壩ｉ崨鏉戠；闁规崘娉涚欢銈呂旈敐鍛殲闁稿顑嗘穱濠囧Χ閸涱喖顎涢梺杞扮閸熸挳寮诲☉婊呯杸闁规崘娅曢崐顖炴⒑缁嬫寧鎹ｉ柛鐘崇墵瀵鏁撻悩鑼紲濠电偞鍨堕…鍥囬妸褏纾藉ù锝嗗絻娴?blocked(exit=2)闂傚倸鍊搁崐鐑芥倿閿旈敮鍋撶粭娑樻噽閻瑩鏌熸潏楣冩闁搞倖鍔栭妵鍕冀椤愵澀娌梺绋款儛娴滎亪寮诲☉銏犲嵆闁靛鍎虫禒顓㈡⒑?exit=${firstRun.status}, stderr=${firstRun.stderr}`);
      }

      const blocked = JSON.parse(firstRun.stdout);
      if (!blocked || blocked.status !== 'blocked' || !blocked.taskBookId) {
        throw new Error('orchestrator blocked output invalid');
      }

      const taskBookId = blocked.taskBookId;
      const details = blocked.details || {};
      const requestId = details.requestId;
      const resultPath = details.resultPath;

      if (!requestId || !resultPath) {
        throw new Error('orchestrator blocked output invalid');
      }

      const resultAbsPath = path.isAbsolute(resultPath) ? resultPath : path.join(projectDir, resultPath);
      const plannerResult = {
        requestId,
        status: 'success',
        output: {
          tasks: [
            { planId: 'T1', title: 'Analyze only 1', type: 'analysis', priority: 'critical' },
            { planId: 'T2', title: 'Analyze only 2', type: 'analysis', dependencies: ['T1'] },
          ],
        },
        completedAt: new Date().toISOString(),
      };
      fs.writeFileSync(resultAbsPath, JSON.stringify(plannerResult, null, 2), 'utf-8');

      const secondRun = spawnSync(process.execPath, [
        '.codebuddy/scripts/task-orchestrator.js',
        '--taskbook', taskBookId,
        '--tasks-only',
        '--json',
      ], {
        cwd: projectDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      if (secondRun.status !== 0) {
        throw new Error(`orchestrator 缂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣缁€濠囨煃瑜滈崜鐔煎蓟濞戞ǚ妲堥柛妤冨仧娴狀參姊洪崫鍕棛闁告鍟块～蹇撁洪鍕祶濡炪倖鎸炬慨鐢稿吹閸曨垱鈷戠紒顖涙礃椤庡棝鏌￠崨顔剧煉鐎殿噮鍓熼崺鈧い鎺戝閳锋垿鏌涢敂璇插箹閻㈩垰鐖奸弻锝嗗箠闁告梹鍨甸锝嗙節濮橆儵鈺呮煃閸濆嫬鈧憡绂掗悡搴富闁靛牆妫楃粭鎺楁倵濮樼厧澧扮紒?exit=0)闂傚倸鍊搁崐鐑芥倿閿旈敮鍋撶粭娑樻噽閻瑩鏌熸潏楣冩闁搞倖鍔栭妵鍕冀椤愵澀娌梺绋款儛娴滎亪寮诲☉銏犲嵆闁靛鍎虫禒顓㈡⒑?exit=${secondRun.status}, stderr=${secondRun.stderr}`);
      }

      const completed = JSON.parse(secondRun.stdout);
      if (!completed || completed.status !== 'completed' || completed.taskBookId !== taskBookId) {
        throw new Error('orchestrator completed output invalid');
      }

      const historyTbFile = path.join(taskbooksDir, 'history', `${taskBookId}.json`);
      if (!fs.existsSync(historyTbFile)) {
        throw new Error(`orchestrator: TaskBook 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敂钘変罕濠电姴锕ょ€氼噣銆呴崣澶岀瘈濠电姴鍊归崳鐣岀磼閳ь剚绻濋崒妤佹杸闂佺粯蓱瑜板啯绂嶉悙瀵哥閻庢稒顭囨晶鐢告煛鐏炶濡奸柍瑙勫灴瀹曞崬螣閻戞﹩浠╅梻?history: ${historyTbFile}`);
      }

      logSuccess('task-orchestrator flow passed (tasks-only)');
    } catch (e) {
      logError(`task-orchestrator E2E 婵犵數濮烽弫鍛婃叏娴兼潙鍨傛繛宸簻绾惧潡鏌ゅù瀣珔闁搞劍绻堥弻娑㈠箻濡も偓鐎氼剟寮? ${e.message}`);
      allPassed = false;
    }

    // E2E: task-orchestrator --watch (auto-resume without manual rerun; run once for speed)
    if (testCase.dir === 'vue3-project') {
      try {
        const tbRaw = execSync(
          'node ".codebuddy/scripts/taskbook-manager.js" create --title "E2E Watch" --description "mock e2e watch" --type new-feature --json',
          { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
        );
        const taskBookId = JSON.parse(tbRaw).id;

        const requestId = `req-planner-${crypto.createHash('sha1').update(taskBookId).digest('hex').slice(0, 10)}`;
        const resultAbsPath = path.join(projectDir, '.codebuddy', 'agent-calls', `${requestId}.result.json`);
        fs.mkdirSync(path.dirname(resultAbsPath), { recursive: true });

        const watched = runOrchestratorWatch({ projectDir, taskBookId, requestId, resultAbsPath, timeoutMs: 30000 });
        if (watched.exitCode !== 0) {
          throw new Error(`watch orchestrator exit!=0: exit=${watched.exitCode}, stderr=${String(watched.stderr || '').slice(0, 2000)}`);
        }

        const out = String(watched.stdout || '').trim();
        const completed = out ? JSON.parse(out) : null;
        if (!completed || completed.status !== 'completed' || completed.taskBookId !== taskBookId) {
        throw new Error('orchestrator completed output invalid');
        }

        const historyTbFile = path.join(taskbooksDir, 'history', `${taskBookId}.json`);
        if (!fs.existsSync(historyTbFile)) {
          throw new Error(`watch orchestrator: TaskBook 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敂钘変罕濠电姴锕ょ€氼噣銆呴崣澶岀瘈濠电姴鍊归崳鐣岀磼閳ь剚绻濋崒妤佹杸闂佺粯蓱瑜板啯绂嶉悙瀵哥閻庢稒顭囨晶鐢告煛鐏炶濡奸柍瑙勫灴瀹曞崬螣閻戞﹩浠╅梻?history: ${historyTbFile}`);
        }

        logSuccess('task-orchestrator flow passed (tasks-only)');
      } catch (e) {
        logError(`task-orchestrator --watch E2E 婵犵數濮烽弫鍛婃叏娴兼潙鍨傛繛宸簻绾惧潡鏌ゅù瀣珔闁搞劍绻堥弻娑㈠箻濡も偓鐎氼剟寮? ${e.message}`);
        allPassed = false;
      }
    }

    // E2E: agent-call-manager serve (remote orchestrate + writeback)
    try {
      const server = startAgentCallServer(projectDir);
      try {
        const headers = { Authorization: `Bearer ${server.token}`, 'Content-Type': 'application/json' };

        const first = httpRequestJson({
          method: 'POST',
          url: `${server.baseUrl}/orchestrate`,
          headers,
          body: JSON.stringify({ requirement: 'E2E Remote Orchestrate', type: 'new-feature', tasksOnly: true }),
          timeoutMs: 30000,
        });
        const firstBody = JSON.parse(first.body);
        if (!firstBody || firstBody.ok !== true || firstBody.exitCode !== 2) {
          throw new Error(`remote orchestrate 婵犵數濮烽。钘壩ｉ崨鏉戠；闁规崘娉涚欢銈呂旈敐鍛殲闁稿顑嗘穱濠囧Χ閸涱喖顎涢梺杞扮閸熸挳寮诲☉婊呯杸闁规崘娅曢崐顖炴⒑?blocked(exit=2): ${first.body}`);
        }

        const outcome1 = firstBody.outcome;
        if (!outcome1 || outcome1.status !== 'blocked' || !outcome1.taskBookId) {
          throw new Error(`remote orchestrate outcome 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敃鈧悿顕€鏌ｅΔ鈧悧濠囧矗韫囨稒鐓熼柕蹇嬪焺閻掗箖鏌? ${first.body}`);
        }

        const taskBookId = outcome1.taskBookId;
        const requestId = outcome1.details && outcome1.details.requestId;
        if (!requestId) {
          throw new Error(`remote orchestrate 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曢敂钘変罕濠电姴锕ょ€氼噣銆呴弻銉︾叆婵犻潧妫欐径鍕偓瑙勬礃閻擄繝寮婚悢鍛婄秶闁告挆鍛闂?planner requestId: ${first.body}`);
        }

        const plannerResult = {
          requestId,
          kind: 'planner',
          status: 'success',
          output: {
            tasks: [
              { planId: 'T1', title: 'Analyze only 1', type: 'analysis', priority: 'critical' },
              { planId: 'T2', title: 'Analyze only 2', type: 'analysis', dependencies: ['T1'] },
            ],
          },
          completedAt: new Date().toISOString(),
        };

        const write = httpRequestJson({
          method: 'PUT',
          url: `${server.baseUrl}/agent-calls/${encodeURIComponent(requestId)}/result`,
          headers,
          body: JSON.stringify(plannerResult),
          timeoutMs: 15000,
        });
        const writeBody = JSON.parse(write.body);
        if (!writeBody || writeBody.ok !== true) {
          throw new Error(`remote writeback 婵犵數濮烽弫鍛婃叏娴兼潙鍨傛繛宸簻绾惧潡鏌ゅù瀣珔闁搞劍绻堥弻娑㈠箻濡も偓鐎氼剟寮? ${write.body}`);
        }

        const second = httpRequestJson({
          method: 'POST',
          url: `${server.baseUrl}/orchestrate`,
          headers,
          body: JSON.stringify({ taskBookId, tasksOnly: true }),
          timeoutMs: 30000,
        });
        const secondBody = JSON.parse(second.body);
        if (!secondBody || secondBody.ok !== true || secondBody.exitCode !== 0) {
          throw new Error(`remote orchestrate 缂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣缁€濠囨煃瑜滈崜鐔煎蓟濞戞ǚ妲堥柛妤冨仧娴狀參姊洪崫鍕棛闁告濞婂濠氭偄閸忕厧浜楅柟鑹版彧缁查箖骞夋總鍛娾拺闁告繂瀚～锕傛煕閺冣偓閸ㄥ潡鐛崘鈹垮亝闁告劗鍋撻弲銏ゆ⒑閸涘﹥澶勯柛瀣椤?exit=0): ${second.body}`);
        }
        const outcome2 = secondBody.outcome;
        if (!outcome2 || outcome2.status !== 'completed') {
          throw new Error(`remote orchestrate completed 闂傚倸鍊风粈渚€骞栭位鍥敍閻愭潙浜辨繝鐢靛Т濞层倗绮绘导瀛樼厵闂傚倸顕ˇ锕傛煕濮樻剚娼愰柕鍥у楠炴﹢宕￠悙鍏告偅缂傚倷绶￠崑鍕矓瑜版帒钃熼柨婵嗘啒閻旂厧绠伴幖杈剧到濞懷勭節? ${second.body}`);
        }

        logSuccess('agent-call-manager serve remote flow passed');
      } finally {
        try { server.proc.kill(); } catch {}
      }
    } catch (e) {
      logError(`agent-call-manager serve E2E 婵犵數濮烽弫鍛婃叏娴兼潙鍨傛繛宸簻绾惧潡鏌ゅù瀣珔闁搞劍绻堥弻娑㈠箻濡も偓鐎氼剟寮? ${e.message}`);
      allPassed = false;
    }

    return allPassed;

  } catch (e) {
    logError(`闂傚倸鍊搁崐椋庣矆娴ｉ潻鑰块梺顒€绉甸崑锟犳煙閹増顥夋鐐灲閺屽秹宕崟顐熷亾瑜版帒绾х紒瀣氨閺€浠嬫煟濮楀棗鏋涢柣蹇ｄ邯閺屾稒鎯旈妶鍛睏闂佸憡甯楃敮鈥崇暦濠婂棭妲奸梺? ${e.message}`);
    return false;
  }
}

/**
 * 婵犵數濮烽弫鎼佸磻閻愬搫鍨傞柛顐ｆ礀缁犳彃銆掑锝呬壕濡炪們鍨烘穱娲囬崷顓涘亾鐟欏嫭绀堥柡浣割煼瀵宕卞Δ濠傛倯闂佸憡渚楅崰姘跺焵? */
function main() {
  log(`
${colors.bold}CodeBuddy Loader Test Suite${colors.reset}`);

  if (!fs.existsSync(RULE_LOADER_PATH)) {
    logError(`rule loader not found: ${RULE_LOADER_PATH}`);
    logInfo('build scripts first: npm run build');
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    const result = runTestCase(testCase);
    if (result) passed++;
    else failed++;
  }

  if (runProfileMatrixSmoke()) passed++;
  else failed++;

  if (runRemoteContentPackSmoke()) passed++;
  else failed++;

  log(`
${colors.bold}Summary${colors.reset}`);
  logSuccess(`passed: ${passed}`);
  if (failed > 0) {
    logError(`failed: ${failed}`);
  }
  log(`total: ${passed + failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
