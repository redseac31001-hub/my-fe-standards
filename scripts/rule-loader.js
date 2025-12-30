#!/usr/bin/env node
/**
 * Architect Rule Loader Script V5 (Remote Capable)
 * 
 * New Features:
 * - Supports Remote Fetch Mode via --remote <URL>
 * - Async architecture
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// --- Configuration ---
const RULES_ROOT = path.resolve(__dirname, '../rules');
const CONFIG_PATH = path.resolve(__dirname, '../config/loader-config.json');

// --- Global Context ---
let IS_REMOTE = false;
let REMOTE_BASE_URL = '';
let REMOTE_MANIFEST = null;

// --- Networking Helper ---
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`Request Failed. Status Code: ${res.statusCode} URL: ${url}`));
            }
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => { resolve(data); });
        }).on('error', (e) => {
            reject(e);
        });
    });
}

// --- Layer 1: Configuration Loading ---

async function loadConfig() {
    if (IS_REMOTE) {
        // Remote: Get manifest first, which contains config
        try {
            const manifestUrl = `${REMOTE_BASE_URL}/manifest.json`;
            console.log(`[Architect] Fetching manifest from: ${manifestUrl}`);
            const data = await fetchUrl(manifestUrl);
            REMOTE_MANIFEST = JSON.parse(data);

            // Return the embedded config
            const config = REMOTE_MANIFEST.config;
            return {
                LAYERS: {
                    BASE: config.layers.base,
                    BUSINESS: config.layers.business,
                    ACTION: config.layers.action
                },
                OUTPUT_DIR_NAME: config.output.dirName,
                OUTPUT_FILE_NAME: config.output.fileName
            };
        } catch (e) {
            console.error(`[Architect] Failed to fetch remote manifest: ${e.message}`);
            process.exit(1);
        }
    } else {
        // Local
        if (!fs.existsSync(CONFIG_PATH)) {
            console.error(`[Architect] Config file not found: ${CONFIG_PATH}`);
            process.exit(1);
        }
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        return {
            LAYERS: {
                BASE: config.layers.base,
                BUSINESS: config.layers.business,
                ACTION: config.layers.action
            },
            OUTPUT_DIR_NAME: config.output.dirName,
            OUTPUT_FILE_NAME: config.output.fileName
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
    if (!fs.existsSync(pkgPath)) return {};
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
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

// --- Main ---

async function main() {
    // Parse Arguments
    const remoteArgIndex = process.argv.indexOf('--remote');
    if (remoteArgIndex !== -1 && process.argv[remoteArgIndex + 1]) {
        IS_REMOTE = true;
        REMOTE_BASE_URL = process.argv[remoteArgIndex + 1].replace(/\/$/, ''); // Remove trailing slash
        console.log(`[Architect] Running in REMOTE mode. Base URL: ${REMOTE_BASE_URL}`);
    }

    const targetDir = process.cwd(); // Assume run from project root, or process.argv[2] logic
    console.log(`[Architect] Analyzing project at: ${targetDir}`);

    // Load Config
    const { LAYERS, OUTPUT_DIR_NAME, OUTPUT_FILE_NAME } = await loadConfig();

    const pkg = getPackageJson(targetDir);
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    const projectDeps = Object.keys(dependencies);

    const systemPrompt = await getSystemPrompt(targetDir, RULES_ROOT);

    let finalContent = `# Architect Rule Set
> Generated by Architect Rule Loader V5 (${IS_REMOTE ? 'Remote' : 'Local'})
> For: CodeBuddy / AI Coding Assistants

---

${systemPrompt}
{{ ... }}
`;

    // Process Layer 1: Base
    console.log(`[Architect] Processing Base Layer...`);
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
            console.log('[Architect] Detected Vue 3. Loading Script Setup rules.');
            const parts = await loadRulesFromFolder(baseDir, 'vue3');
            finalContent += parts.join('\n');
        } else if (vueProfile.version === 2) {
            if (vueProfile.type === 'composition') {
                console.log('[Architect] Detected Vue 2 + Composition API. Loading Hybrid rules.');
                // Loading specific composition rule for Vue 2
                const parts = await loadRulesFromFolder(baseDir, 'vue2/vue2-composition.md');
                finalContent += parts.join('\n');
            } else {
                console.log('[Architect] Detected Vue 2 (Standard). Loading Options API rules.');
                const parts = await loadRulesFromFolder(baseDir, 'vue2/vue2-general.md');
                finalContent += parts.join('\n');
            }
        }
    }

    // Process Layer 2: Business
    console.log(`[Architect] Processing Business Layer...`);
    finalContent += `\n# ${LAYERS.BUSINESS.title}\n`;
    const bizDir = IS_REMOTE ? LAYERS.BUSINESS.id : path.join(RULES_ROOT, LAYERS.BUSINESS.id);

    for (const depKey of Object.keys(LAYERS.BUSINESS.dependencies)) {
        if (projectDeps.includes(depKey)) {
            console.log(`[Architect] Detected ${depKey}. Loading related rules.`);
            for (const folder of LAYERS.BUSINESS.dependencies[depKey]) {
                const parts = await loadRulesFromFolder(bizDir, folder);
                finalContent += parts.join('\n');
            }
        }
    }

    // Process Layer 3: Action
    console.log(`[Architect] Processing Action Layer...`);
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
    console.log(`[Architect] Success! Rules written to ${outputPath}`);
}

main().catch(err => {
    console.error('[Architect] Fatal Error:', err);
    process.exit(1);
});
