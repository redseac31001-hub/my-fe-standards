#!/usr/bin/env node
/**
 * Architect Rule Loader Script V6 (Enhanced Robustness)
 * 
 * Features:
 * - Supports Remote Fetch Mode via --remote <URL>
 * - Async architecture
 * - Enhanced error handling and user-friendly messages
 * - Verbose mode for debugging
 * - Request timeout handling
 * 
 * Usage:
 *   node rule-loader.js [options]
 * 
 * Options:
 *   --help, -h        Show this help message
 *   --remote <URL>    Fetch rules from remote URL (e.g., https://raw.githubusercontent.com/user/repo/main)
 *   --verbose, -v     Enable verbose logging for debugging
 *   --timeout <ms>    Set network request timeout in milliseconds (default: 10000)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// --- Configuration ---
const RULES_ROOT = path.resolve(__dirname, '../rules');
const CONFIG_PATH = path.resolve(__dirname, '../config/loader-config.json');
const DEFAULT_TIMEOUT = 10000; // 10 seconds

// --- Global Context ---
let IS_REMOTE = false;
let IS_VERBOSE = false;
let REMOTE_BASE_URL = '';
let REMOTE_MANIFEST = null;
let REQUEST_TIMEOUT = DEFAULT_TIMEOUT;

// --- Logging Helpers ---
function log(message) {
    console.log(`[Architect] ${message}`);
}

function logVerbose(message) {
    if (IS_VERBOSE) {
        console.log(`[Architect:DEBUG] ${message}`);
    }
}

function logError(message) {
    console.error(`[Architect:ERROR] ${message}`);
}

function logWarn(message) {
    console.warn(`[Architect:WARN] ${message}`);
}

// --- Help ---
function showHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║           Architect Rule Loader v6 - Frontend Standards         ║
╚══════════════════════════════════════════════════════════════════╝

USAGE:
  node rule-loader.js [options]

OPTIONS:
  --help, -h           Show this help message and exit
  --remote <URL>       Fetch rules from a remote URL instead of local files
                       Example: --remote https://raw.githubusercontent.com/user/repo/main
  --verbose, -v        Enable verbose/debug logging
  --timeout <ms>       Set network request timeout (default: 10000ms)

EXAMPLES:
  # Local mode (uses ./rules directory)
  node rule-loader.js

  # Remote mode (fetches from GitHub)
  node rule-loader.js --remote https://raw.githubusercontent.com/myorg/fe-standards/main

  # Verbose mode for debugging
  node rule-loader.js --verbose

OUTPUT:
  Generates .codebuddy/project-rules.md in the current working directory.

For more information, visit: https://github.com/your-org/my-fe-standards
`);
    process.exit(0);
}

// --- Networking Helper ---
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;

        logVerbose(`Fetching: ${url}`);

        const request = client.get(url, (res) => {
            // Handle redirects (GitHub raw URLs sometimes redirect)
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                logVerbose(`Redirecting to: ${res.headers.location}`);
                return fetchUrl(res.headers.location).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`HTTP ${res.statusCode}: Failed to fetch ${url}`));
            }

            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                logVerbose(`Fetched ${data.length} bytes from ${url}`);
                resolve(data);
            });
        });

        request.on('error', (e) => {
            reject(new Error(`Network Error: ${e.message} (URL: ${url})`));
        });

        // Timeout handling
        request.setTimeout(REQUEST_TIMEOUT, () => {
            request.destroy();
            reject(new Error(`Request Timeout: ${url} did not respond within ${REQUEST_TIMEOUT}ms`));
        });
    });
}

// --- Layer 1: Configuration Loading ---

async function loadConfig() {
    if (IS_REMOTE) {
        // Remote: Get manifest first, which contains config
        try {
            const manifestUrl = `${REMOTE_BASE_URL}/manifest.json`;
            log(`Fetching manifest from: ${manifestUrl}`);
            const data = await fetchUrl(manifestUrl);
            REMOTE_MANIFEST = JSON.parse(data);

            logVerbose(`Manifest loaded. Version: ${REMOTE_MANIFEST.version}, Files: ${REMOTE_MANIFEST.files.length}`);

            // Return the embedded config
            const config = REMOTE_MANIFEST.config;
            return {
                LAYERS: {
                    BASE: config.layers.base,
                    BUSINESS: config.layers.business,
                    ACTION: config.layers.action
                },
                OUTPUT_DIR_NAME: config.output.dirName,
                OUTPUT_FILE_NAME: config.output.fileName,
                FRONTMATTER: config.frontmatter || {}
            };
        } catch (e) {
            logError(`Failed to fetch remote manifest: ${e.message}`);
            logError('Please ensure the URL is correct and the manifest.json is accessible.');
            process.exit(1);
        }
    } else {
        // Local
        if (!fs.existsSync(CONFIG_PATH)) {
            logError(`Config file not found: ${CONFIG_PATH}`);
            logError('Run this script from the my-fe-standards repository root, or use --remote mode.');
            process.exit(1);
        }
        logVerbose(`Loading local config from: ${CONFIG_PATH}`);
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        return {
            LAYERS: {
                BASE: config.layers.base,
                BUSINESS: config.layers.business,
                ACTION: config.layers.action
            },
            OUTPUT_DIR_NAME: config.output.dirName,
            OUTPUT_FILE_NAME: config.output.fileName,
            FRONTMATTER: config.frontmatter || {}
        };
    }
}

// --- Layer 2: Rule Content Loading ---

async function loadRulesFromFolder(layerDir, subFolder) {
    // Note: layerDir is absolute path in Local mode, but just a layer ID in Remote mode

    if (IS_REMOTE) {
        // Remote Strategy: Filter manifest.files
        // path in manifest is like "rules/layer1_base/architecture/feature-based-structure.md"
        // subFolder is like "architecture"

        const targetPathStart = `rules/${layerDir}/${subFolder}`;

        // Find matching files in manifest
        const matches = REMOTE_MANIFEST.files.filter(f => f.path.startsWith(targetPathStart));

        if (matches.length === 0) return [];

        const contentPromises = matches.map(async (file) => {
            const fileUrl = `${REMOTE_BASE_URL}/${file.path}`;
            try {
                // Determine source label (e.g., architecture/feature.md)
                const sourceLabel = file.path.split('/').slice(-2).join('/');
                const content = await fetchUrl(fileUrl);
                return `\n<!-- Source: ${sourceLabel} -->\n${content}`;
            } catch (e) {
                console.warn(`[Architect] Warning: Failed to fetch ${fileUrl}`);
                return '';
            }
        });

        return Promise.all(contentPromises);

    } else {
        // Local Strategy (Original)
        const targetPath = path.join(layerDir, subFolder);
        if (!fs.existsSync(targetPath)) return [];

        if (targetPath.endsWith('.md')) {
            return [`\n<!-- Source: ${subFolder} -->\n${fs.readFileSync(targetPath, 'utf-8')}`];
        }

        if (fs.statSync(targetPath).isDirectory()) {
            const files = fs.readdirSync(targetPath);
            return files
                .filter(f => f.endsWith('.md'))
                .map(f => `\n<!-- Source: ${subFolder}/${f} -->\n${fs.readFileSync(path.join(targetPath, f), 'utf-8')}`);
        }
        return [];
    }
}

// --- Helpers ---

function getPackageJson(targetDir) {
    const pkgPath = path.join(targetDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        logWarn(`No package.json found at: ${pkgPath}`);
        logWarn('Running without dependency detection. Only default rules will be loaded.');
        return {};
    }
    logVerbose(`Reading package.json from: ${pkgPath}`);
    try {
        return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    } catch (e) {
        logError(`Failed to parse package.json: ${e.message}`);
        return {};
    }
}


function checkVueProfile(dependencies) {
    const vueVersion = dependencies['vue'];
    if (!vueVersion) return null;

    // Vue 3
    if (vueVersion.startsWith('3') || vueVersion.startsWith('^3') || vueVersion.startsWith('~3')) {
        return { version: 3, type: 'standard' };
    }

    // Vue 2
    if (vueVersion.startsWith('2') || vueVersion.startsWith('^2') || vueVersion.startsWith('~2')) {
        // Check for Composition API Plugin (Vue 2 + Composition API)
        if (dependencies['@vue/composition-api']) {
            return { version: 2, type: 'composition' };
        }
        return { version: 2, type: 'options' };
    }
    return null;
}

async function getSystemPrompt(targetDir, localRulesRoot) {
    // In Local mode, we look relative to script location. In Remote mode, system prompt is just empty or optional.
    // For now, let's keep system prompt local-check only or hardcode a simple one if remote.
    // Ideally, the system prompt should also be a file in the manifest.

    if (IS_REMOTE) {
        // Option: Fetch .codebuddy/context.md if it exists in manifest?
        // For simplicity now, skip or use default.
        return '';
    } else {
        const contextPath = path.join(localRulesRoot, '..', '.codebuddy', 'context.md');
        if (fs.existsSync(contextPath)) {
            console.log('[Architect] Loaded context.md as System Prompt.');
            return fs.readFileSync(contextPath, 'utf-8');
        }
        return '';
    }
}

// --- Argument Parsing ---

function parseArgs() {
    const args = process.argv.slice(2);

    // Help
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
    }

    // Verbose
    if (args.includes('--verbose') || args.includes('-v')) {
        IS_VERBOSE = true;
        logVerbose('Verbose mode enabled.');
    }

    // Remote
    const remoteIndex = args.indexOf('--remote');
    if (remoteIndex !== -1) {
        const url = args[remoteIndex + 1];
        if (!url || url.startsWith('-')) {
            logError('--remote requires a URL argument.');
            logError('Example: node rule-loader.js --remote https://raw.githubusercontent.com/user/repo/main');
            process.exit(1);
        }
        IS_REMOTE = true;
        REMOTE_BASE_URL = url.replace(/\/$/, ''); // Remove trailing slash
        logVerbose(`Remote mode enabled. Base URL: ${REMOTE_BASE_URL}`);
    }

    // Timeout
    const timeoutIndex = args.indexOf('--timeout');
    if (timeoutIndex !== -1) {
        const timeoutValue = parseInt(args[timeoutIndex + 1], 10);
        if (isNaN(timeoutValue) || timeoutValue <= 0) {
            logWarn('Invalid --timeout value, using default 10000ms.');
        } else {
            REQUEST_TIMEOUT = timeoutValue;
            logVerbose(`Request timeout set to: ${REQUEST_TIMEOUT}ms`);
        }
    }
}

// --- Main ---

async function main() {
    // Parse Arguments
    parseArgs();

    log(IS_REMOTE ? `Running in REMOTE mode. Base URL: ${REMOTE_BASE_URL}` : 'Running in LOCAL mode.');

    const targetDir = process.cwd();
    log(`Analyzing project at: ${targetDir}`);

    // Load Config
    const { LAYERS, OUTPUT_DIR_NAME, OUTPUT_FILE_NAME, FRONTMATTER } = await loadConfig();

    const pkg = getPackageJson(targetDir);
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    const projectDeps = Object.keys(dependencies);

    logVerbose(`Detected ${projectDeps.length} dependencies.`);

    const systemPrompt = await getSystemPrompt(targetDir, RULES_ROOT);

    // Generate YAML frontmatter for CodeBuddy compatibility
    const updatedAt = new Date().toISOString();
    const frontmatterBlock = `---
description: ${FRONTMATTER.description || 'Frontend Architecture Standards'}
alwaysApply: ${FRONTMATTER.alwaysApply !== undefined ? FRONTMATTER.alwaysApply : true}
enabled: ${FRONTMATTER.enabled !== undefined ? FRONTMATTER.enabled : true}
updatedAt: ${updatedAt}
provider: ${FRONTMATTER.provider || ''}
---

`;

    let finalContent = `${frontmatterBlock}# Architect Rule Set
> Generated by Architect Rule Loader V6 (${IS_REMOTE ? 'Remote' : 'Local'})
> Generated at: ${updatedAt}
> For: CodeBuddy / AI Coding Assistants

---

${systemPrompt}
`;

    // Process Layer 1: Base
    log('Processing Base Layer...');
    finalContent += `\n# ${LAYERS.BASE.title}\n`;

    // In Remote mode, baseDir is just the ID "layer1_base". In Local, it's absolute path.
    const baseDir = IS_REMOTE ? LAYERS.BASE.id : path.join(RULES_ROOT, LAYERS.BASE.id);

    // 1. Load Static Base Rules
    for (const folder of LAYERS.BASE.staticDeps) {
        const parts = await loadRulesFromFolder(baseDir, folder);
        finalContent += parts.join('\n');
    }


    // 2. Load Vue Version Specific Rules (Smart Detection)
    const vueProfile = checkVueProfile(dependencies);

    if (vueProfile) {
        if (vueProfile.version === 3) {
            log('Detected Vue 3. Loading Script Setup rules.');
            const parts = await loadRulesFromFolder(baseDir, 'vue3');
            finalContent += parts.join('\n');
        } else if (vueProfile.version === 2) {
            if (vueProfile.type === 'composition') {
                log('Detected Vue 2 + Composition API. Loading Hybrid rules.');
                // Loading specific composition rule for Vue 2
                const parts = await loadRulesFromFolder(baseDir, 'vue2/vue2-composition.md');
                finalContent += parts.join('\n');
            } else {
                log('Detected Vue 2 (Standard). Loading Options API rules.');
                const parts = await loadRulesFromFolder(baseDir, 'vue2/vue2-general.md');
                finalContent += parts.join('\n');
            }
        }
    } else {
        logWarn('No Vue detected. Skipping Vue-specific rules.');
    }

    // Process Layer 2: Business
    log('Processing Business Layer...');
    finalContent += `\n# ${LAYERS.BUSINESS.title}\n`;
    const bizDir = IS_REMOTE ? LAYERS.BUSINESS.id : path.join(RULES_ROOT, LAYERS.BUSINESS.id);

    let businessRulesLoaded = 0;
    for (const depKey of Object.keys(LAYERS.BUSINESS.dependencies)) {
        if (projectDeps.includes(depKey)) {
            log(`Detected ${depKey}. Loading related rules.`);
            for (const folder of LAYERS.BUSINESS.dependencies[depKey]) {
                const parts = await loadRulesFromFolder(bizDir, folder);
                finalContent += parts.join('\n');
                businessRulesLoaded++;
            }
        }
    }
    if (businessRulesLoaded === 0) {
        logVerbose('No business-specific dependencies detected.');
    }

    // Process Layer 3: Action
    log('Processing Action Layer...');
    finalContent += `\n# ${LAYERS.ACTION.title}\n`;
    const actionDir = IS_REMOTE ? LAYERS.ACTION.id : path.join(RULES_ROOT, LAYERS.ACTION.id);

    for (const item of LAYERS.ACTION.defaults) {
        const parts = await loadRulesFromFolder(actionDir, item + '.md');
        finalContent += parts.join('\n');
    }

    // Output
    const outputDir = path.join(targetDir, OUTPUT_DIR_NAME);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, OUTPUT_FILE_NAME);
    fs.writeFileSync(outputPath, finalContent, 'utf-8');
    log(`✅ Success! Rules written to ${outputPath}`);
    log(`Total content size: ${(finalContent.length / 1024).toFixed(2)} KB`);
}

main().catch(err => {
    console.error('[Architect] Fatal Error:', err);
    process.exit(1);
});
