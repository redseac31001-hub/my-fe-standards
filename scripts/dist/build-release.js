"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_OUTPUT_DIR = path.join(PROJECT_ROOT, 'release', 'standards');
const RELEASE_FILES = [
    'manifest.json',
    'scripts/dist/codebuddy-install.js',
    'scripts/dist/codebuddy-loader.bundle.js',
    'packs/content-pack-core.json',
    'packs/content-pack-analysis.json',
    'packs/content-pack-orchestrator.json',
    'packs/content-pack-full.json',
];
const RELEASE_MANIFEST_FILE = 'release-manifest.json';
function parseOutputDir(args) {
    const outIndex = args.indexOf('--out');
    if (outIndex === -1) {
        return DEFAULT_OUTPUT_DIR;
    }
    const value = args[outIndex + 1];
    if (!value || value.startsWith('-')) {
        throw new Error('--out requires a directory path');
    }
    return path.isAbsolute(value) ? value : path.resolve(PROJECT_ROOT, value);
}
function ensureSourceFilesExist() {
    const missing = RELEASE_FILES
        .map((relativePath) => path.join(PROJECT_ROOT, relativePath))
        .filter((absolutePath) => !fs.existsSync(absolutePath));
    if (missing.length > 0) {
        throw new Error([
            'release packaging requires build artifacts first',
            ...missing.map((filePath) => `missing: ${filePath}`),
            'run `npm run build` and retry',
        ].join('\n'));
    }
}
function ensureParentDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
function readPreviousReleaseManifest(outputDir) {
    const manifestPath = path.join(outputDir, RELEASE_MANIFEST_FILE);
    if (!fs.existsSync(manifestPath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    }
    catch (_a) {
        return null;
    }
}
function cleanupStaleReleaseFiles(outputDir, nextFiles) {
    const previousManifest = readPreviousReleaseManifest(outputDir);
    if (!previousManifest) {
        return;
    }
    const nextFileSet = new Set(nextFiles.map((filePath) => filePath.replace(/\\/g, '/')));
    for (const previousFile of previousManifest.files) {
        const normalized = previousFile.path.replace(/\\/g, '/');
        if (nextFileSet.has(normalized)) {
            continue;
        }
        const absolutePath = path.join(outputDir, normalized);
        if (!fs.existsSync(absolutePath)) {
            continue;
        }
        try {
            fs.rmSync(absolutePath, { recursive: true, force: true });
        }
        catch (error) {
            console.warn(`Skip stale release cleanup: ${normalized} (${error.message})`);
        }
    }
}
function copyReleaseFile(relativePath, outputDir) {
    const sourcePath = path.join(PROJECT_ROOT, relativePath);
    const destPath = path.join(outputDir, relativePath);
    const content = fs.readFileSync(sourcePath);
    ensureParentDir(destPath);
    fs.writeFileSync(destPath, content);
    return {
        path: relativePath.replace(/\\/g, '/'),
        size: content.length,
        sha256: (0, crypto_1.createHash)('sha256').update(content).digest('hex'),
    };
}
function getProjectVersion() {
    const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version || '0.0.0';
}
function writeReleaseManifest(outputDir, files) {
    const manifest = {
        generatedAt: new Date().toISOString(),
        version: getProjectVersion(),
        outputDir,
        files,
    };
    const manifestPath = path.join(outputDir, RELEASE_MANIFEST_FILE);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}
function main() {
    const outputDir = parseOutputDir(process.argv.slice(2));
    ensureSourceFilesExist();
    fs.mkdirSync(outputDir, { recursive: true });
    cleanupStaleReleaseFiles(outputDir, RELEASE_FILES);
    const files = RELEASE_FILES.map((relativePath) => copyReleaseFile(relativePath, outputDir));
    writeReleaseManifest(outputDir, files);
    console.log(`Release package ready: ${outputDir}`);
    for (const file of files) {
        console.log(` - ${file.path}`);
    }
    console.log(` - ${RELEASE_MANIFEST_FILE}`);
}
main();
