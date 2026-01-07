#!/usr/bin/env node
/**
 * Architect Rule Loader Bootstrap Script v1.1
 *
 * 用于私有仓库的规则加载引导脚本。
 * 利用本地 git 凭证从私有仓库拉取规则，无需每个开发者单独配置 token。
 *
 * 使用方式：
 *   1. 将此文件放入业务项目根目录
 *   2. 在 package.json 中添加脚本: "rules:update": "node architect-bootstrap.js"
 *   3. 执行: npm run rules:update
 *
 * 命令行参数：
 *   --yes, -y     跳过用户确认 (用于 CI/CD)
 *   --force, -f   强制刷新缓存
 *   --help, -h    显示帮助信息
 *
 * 配置方式 (在业务项目 package.json 中添加):
 *   "architect": {
 *     "repo": "git@github.com:your-org/my-fe-standards.git",
 *     "branch": "main",
 *     "skipConfirm": false
 *   }
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// ============ 配置 ============

// 默认配置 (可被 package.json 中的 architect 字段覆盖)
const DEFAULT_CONFIG = {
  // 规则仓库地址 (支持 SSH 和 HTTPS)
  repo: 'git@github.com:your-org/my-fe-standards.git',
  // 分支名
  branch: 'main',
  // 规则加载器在仓库中的路径
  loaderPath: 'scripts/dist/rule-loader.js',
  // manifest 在仓库中的路径
  manifestPath: 'manifest.json',
  // 规则目录在仓库中的路径
  rulesPath: 'rules',
  // 配置文件在仓库中的路径
  configPath: 'config/loader-config.json',
  // 本地缓存目录
  cacheDir: '.architect-cache',
  // 是否使用缓存
  useCache: true,
  // 缓存过期时间 (毫秒), 默认 1 小时
  cacheExpiry: 3600000,
  // 是否跳过用户确认
  skipConfirm: false,
};

// 命令行参数
const ARGS = {
  skipConfirm: false,
  forceRefresh: false,
  showHelp: false,
};

// ============ 工具函数 ============

function log(message) {
  console.log(`[Architect] ${message}`);
}

function logError(message) {
  console.error(`[Architect:ERROR] ${message}`);
}

function logWarn(message) {
  console.warn(`[Architect:WARN] ${message}`);
}

function logInfo(message) {
  console.log(`[Architect:INFO] ${message}`);
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║        Architect Bootstrap v1.1 - Private Repo Support           ║
╚══════════════════════════════════════════════════════════════════╝

USAGE:
  node architect-bootstrap.js [options]

OPTIONS:
  --yes, -y       Skip user confirmation (for CI/CD)
  --force, -f     Force refresh cache (ignore cache expiry)
  --help, -h      Show this help message

CONFIGURATION (in package.json):
  {
    "architect": {
      "repo": "git@github.com:your-org/my-fe-standards.git",
      "branch": "main",
      "skipConfirm": false
    }
  }

EXAMPLES:
  # Interactive mode (default)
  node architect-bootstrap.js

  # Skip confirmation (CI/CD)
  node architect-bootstrap.js --yes

  # Force refresh cache
  node architect-bootstrap.js --force

  # Combined
  node architect-bootstrap.js -y -f
`);
  process.exit(0);
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    ARGS.showHelp = true;
  }

  if (args.includes('--yes') || args.includes('-y')) {
    ARGS.skipConfirm = true;
  }

  if (args.includes('--force') || args.includes('-f')) {
    ARGS.forceRefresh = true;
  }
}

/**
 * 读取业务项目的 package.json 获取配置
 */
function loadConfig() {
  const pkgPath = path.join(process.cwd(), 'package.json');

  if (!fs.existsSync(pkgPath)) {
    logWarn('No package.json found, using default config.');
    return DEFAULT_CONFIG;
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const userConfig = pkg.architect || {};

    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
    };
  } catch (e) {
    logWarn(`Failed to parse package.json: ${e.message}`);
    return DEFAULT_CONFIG;
  }
}

/**
 * 检查 git 是否可用
 */
function checkGitAvailable() {
  try {
    execSync('git --version', { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 获取 git 用户信息
 */
function getGitUserInfo() {
  const info = {
    name: null,
    email: null,
    sshKeyExists: false,
    credentialHelper: null,
  };

  try {
    info.name = execSync('git config user.name', { stdio: 'pipe', encoding: 'utf-8' }).trim();
  } catch (e) {
    info.name = '(未配置)';
  }

  try {
    info.email = execSync('git config user.email', { stdio: 'pipe', encoding: 'utf-8' }).trim();
  } catch (e) {
    info.email = '(未配置)';
  }

  // 检查 SSH key
  const sshDir = path.join(os.homedir(), '.ssh');
  const sshKeyFiles = ['id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'];
  for (const keyFile of sshKeyFiles) {
    if (fs.existsSync(path.join(sshDir, keyFile))) {
      info.sshKeyExists = true;
      break;
    }
  }

  // 检查 credential helper
  try {
    info.credentialHelper = execSync('git config credential.helper', { stdio: 'pipe', encoding: 'utf-8' }).trim();
  } catch (e) {
    info.credentialHelper = null;
  }

  return info;
}

/**
 * 显示 git 用户信息并请求确认
 */
function displayGitInfo(gitInfo, config) {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                      Git 账号信息确认                             ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  用户名 (user.name):   ${padRight(gitInfo.name, 40)}║`);
  console.log(`║  邮箱 (user.email):    ${padRight(gitInfo.email, 40)}║`);
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  SSH Key:              ${padRight(gitInfo.sshKeyExists ? '✅ 已配置' : '❌ 未找到', 40)}║`);
  console.log(`║  Credential Helper:    ${padRight(gitInfo.credentialHelper || '❌ 未配置', 40)}║`);
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  目标仓库: ${padRight(config.repo, 51)}║`);
  console.log(`║  目标分支: ${padRight(config.branch, 51)}║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
}

/**
 * 字符串右填充 (处理中文字符宽度)
 */
function padRight(str, length) {
  if (!str) str = '';
  // 计算实际显示宽度 (中文字符占2个宽度)
  let displayWidth = 0;
  for (const char of str) {
    displayWidth += char.charCodeAt(0) > 127 ? 2 : 1;
  }
  const padding = Math.max(0, length - displayWidth);
  return str + ' '.repeat(padding);
}

/**
 * 请求用户确认
 */
function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      const normalized = answer.toLowerCase().trim();
      resolve(normalized === 'y' || normalized === 'yes' || normalized === '');
    });
  });
}

/**
 * 使用 git clone 获取整个规则目录
 */
function gitFetchRules(repo, branch, config) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'architect-'));

  try {
    log(`Cloning rules from ${repo} (branch: ${branch})...`);

    // Shallow clone 整个仓库
    execSync(`git clone --depth=1 --branch=${branch} "${repo}" .`, {
      cwd: tempDir,
      stdio: 'pipe',
    });

    log('Clone successful.');

    // 返回临时目录路径，供后续使用
    return tempDir;
  } catch (e) {
    // 清理
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      // 忽略清理错误
    }
    throw new Error(`Git clone failed: ${e.message}`);
  }
}

/**
 * 检查缓存是否有效
 */
function isCacheValid(config) {
  if (!config.useCache) return false;
  if (ARGS.forceRefresh) return false;

  const cacheDir = path.join(process.cwd(), config.cacheDir);
  const cacheMetaPath = path.join(cacheDir, '.cache-meta.json');

  if (!fs.existsSync(cacheMetaPath)) return false;

  try {
    const meta = JSON.parse(fs.readFileSync(cacheMetaPath, 'utf-8'));
    const age = Date.now() - meta.timestamp;
    return age < config.cacheExpiry;
  } catch (e) {
    return false;
  }
}

/**
 * 更新缓存元数据
 */
function updateCacheMeta(config, gitInfo) {
  const cacheDir = path.join(process.cwd(), config.cacheDir);
  const cacheMetaPath = path.join(cacheDir, '.cache-meta.json');

  fs.writeFileSync(cacheMetaPath, JSON.stringify({
    timestamp: Date.now(),
    repo: config.repo,
    branch: config.branch,
    gitUser: {
      name: gitInfo.name,
      email: gitInfo.email,
    },
  }, null, 2));
}

/**
 * 从缓存加载规则
 */
function loadRulesFromCache(config) {
  const cacheDir = path.join(process.cwd(), config.cacheDir);
  const loaderPath = path.join(cacheDir, 'rule-loader.js');

  if (fs.existsSync(loaderPath)) {
    return loaderPath;
  }
  return null;
}

/**
 * 递归复制目录
 */
function copyDirSync(src, dst) {
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(dst, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

// ============ 主函数 ============

async function main() {
  // 解析命令行参数
  parseArgs();

  if (ARGS.showHelp) {
    showHelp();
  }

  log('Architect Rule Loader Bootstrap v1.1');
  log('=====================================');

  // 1. 检查 git 是否可用
  if (!checkGitAvailable()) {
    logError('Git is not available. Please install git first.');
    process.exit(1);
  }

  // 2. 加载配置
  const config = loadConfig();

  // 3. 获取 git 用户信息
  const gitInfo = getGitUserInfo();

  // 4. 显示信息并请求确认
  const shouldSkipConfirm = ARGS.skipConfirm || config.skipConfirm;

  if (!shouldSkipConfirm) {
    displayGitInfo(gitInfo, config);

    // 检查是否有潜在问题
    if (gitInfo.name === '(未配置)' || gitInfo.email === '(未配置)') {
      logWarn('Git 用户信息未完整配置，可能导致认证失败。');
      logWarn('请运行以下命令配置:');
      logWarn('  git config --global user.name "Your Name"');
      logWarn('  git config --global user.email "your@email.com"');
      console.log('');
    }

    // 检查 SSH 仓库但没有 SSH key
    if (config.repo.startsWith('git@') && !gitInfo.sshKeyExists) {
      logWarn('使用 SSH 仓库地址，但未检测到 SSH Key。');
      logWarn('请确保已配置 SSH Key 并添加到 Git 服务器。');
      console.log('');
    }

    // 检查 HTTPS 仓库但没有 credential helper
    if (config.repo.startsWith('https://') && !gitInfo.credentialHelper) {
      logWarn('使用 HTTPS 仓库地址，但未配置 credential helper。');
      logWarn('可能需要手动输入用户名密码。');
      console.log('');
    }

    const confirmed = await askConfirmation('确认使用以上 Git 账号拉取规则? [Y/n] ');

    if (!confirmed) {
      log('操作已取消。');
      log('');
      log('如需修改 Git 配置，请运行:');
      log('  git config --global user.name "Your Name"');
      log('  git config --global user.email "your@email.com"');
      process.exit(0);
    }
  } else {
    log(`Repository: ${config.repo}`);
    log(`Branch: ${config.branch}`);
    log(`Git User: ${gitInfo.name} <${gitInfo.email}>`);
  }

  // 5. 检查缓存
  const cacheDir = path.join(process.cwd(), config.cacheDir);

  if (isCacheValid(config)) {
    log('Using cached rules (still valid).');
    const cachedLoader = loadRulesFromCache(config);
    if (cachedLoader) {
      // 直接执行缓存的 loader
      require(cachedLoader);
      return;
    }
  }

  // 6. 从远程获取规则
  log('Fetching rules from remote repository...');

  let tempDir = null;
  try {
    tempDir = gitFetchRules(config.repo, config.branch, config);

    // 7. 复制必要文件到缓存目录
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // 复制 rule-loader.js
    const srcLoader = path.join(tempDir, config.loaderPath);
    const dstLoader = path.join(cacheDir, 'rule-loader.js');
    fs.copyFileSync(srcLoader, dstLoader);

    // 复制 manifest.json
    const srcManifest = path.join(tempDir, config.manifestPath);
    const dstManifest = path.join(cacheDir, 'manifest.json');
    if (fs.existsSync(srcManifest)) {
      fs.copyFileSync(srcManifest, dstManifest);
    }

    // 复制 config
    const srcConfig = path.join(tempDir, config.configPath);
    const dstConfigDir = path.join(cacheDir, 'config');
    if (!fs.existsSync(dstConfigDir)) {
      fs.mkdirSync(dstConfigDir, { recursive: true });
    }
    fs.copyFileSync(srcConfig, path.join(dstConfigDir, 'loader-config.json'));

    // 复制 rules 目录
    const srcRules = path.join(tempDir, config.rulesPath);
    const dstRules = path.join(cacheDir, 'rules');
    copyDirSync(srcRules, dstRules);

    // 更新缓存元数据
    updateCacheMeta(config, gitInfo);

    log('Rules cached successfully.');

    // 8. 执行 rule-loader
    log('Executing rule-loader...');
    log('');

    // 修改 rule-loader 的工作目录上下文
    const originalDir = process.cwd();
    process.chdir(cacheDir);

    try {
      // 清除 require 缓存，确保加载最新版本
      delete require.cache[require.resolve(dstLoader)];
      require(dstLoader);
    } finally {
      process.chdir(originalDir);
    }

  } catch (e) {
    logError(e.message);
    logError('');
    logError('Troubleshooting:');
    logError('1. Check if you have access to the repository');
    logError('2. Verify your git credentials are configured correctly');
    logError('3. For SSH: Ensure your SSH key is added to the ssh-agent');
    logError('4. For HTTPS: Ensure git credential helper is configured');
    process.exit(1);
  } finally {
    // 清理临时目录
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        // 忽略清理错误
      }
    }
  }
}

// 执行
main().catch((err) => {
  logError(`Fatal error: ${err.message}`);
  process.exit(1);
});
