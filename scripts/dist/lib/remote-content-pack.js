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
exports.ensureRemoteContentPack = ensureRemoteContentPack;
exports.readRemoteTextAsset = readRemoteTextAsset;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const fetcher_1 = require("./fetcher");
const CONTENT_PACK_SCHEMA_VERSION = '1.0.0';
function normalizeRelativePath(relativePath) {
    const normalized = path.posix.normalize(String(relativePath || '').replace(/\\/g, '/'));
    if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../') || path.posix.isAbsolute(normalized)) {
        throw new Error(`invalid relative path: ${relativePath}`);
    }
    return normalized;
}
function ensureDirectoryForFile(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
function computeSha256(content) {
    return (0, crypto_1.createHash)('sha256').update(content, 'utf-8').digest('hex');
}
function validateContentPack(pack, packMeta) {
    if (!pack || typeof pack !== 'object') {
        throw new Error('content pack must be an object');
    }
    if (pack.schemaVersion !== CONTENT_PACK_SCHEMA_VERSION) {
        throw new Error(`unsupported content pack schema: ${String(pack.schemaVersion)}`);
    }
    if (pack.profile !== packMeta.profile) {
        throw new Error(`content pack profile mismatch: expected ${packMeta.profile}, got ${pack.profile}`);
    }
    if (!Array.isArray(pack.entries)) {
        throw new Error('content pack entries must be an array');
    }
    if (pack.entryCount !== pack.entries.length) {
        throw new Error(`content pack entryCount mismatch: expected ${pack.entryCount}, got ${pack.entries.length}`);
    }
}
function buildContentRoot(targetDir, manifestVersion, packMeta) {
    return path.join(targetDir, '.codebuddy', 'cache', 'content-packs', manifestVersion, `${packMeta.profile}-${packMeta.sha256.slice(0, 12)}`, 'contents');
}
async function ensureRemoteContentPack(ctx, logger, targetDir) {
    var _a, _b, _c;
    const packMeta = ((_b = (_a = ctx.remoteManifest) === null || _a === void 0 ? void 0 : _a.packs) === null || _b === void 0 ? void 0 : _b[ctx.profile]) || null;
    const manifestVersion = ((_c = ctx.remoteManifest) === null || _c === void 0 ? void 0 : _c.version) || '0.0.0';
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
    const markerPath = path.join(path.dirname(contentRoot), 'pack-meta.json');
    if (fs.existsSync(contentRoot) && fs.existsSync(markerPath)) {
        logger.log(`远程内容包: 使用本地缓存 ${packMeta.profile} (${packMeta.sha256.slice(0, 12)})`);
        return { contentRoot, pack: packMeta, usedCache: true };
    }
    try {
        const packUrl = `${ctx.remoteBaseUrl}/${packMeta.file}`;
        logger.log(`远程内容包: 下载 ${packMeta.profile} -> ${packUrl}`);
        const packSource = await (0, fetcher_1.fetchUrl)(ctx, logger, packUrl);
        const actualSha = computeSha256(packSource);
        if (actualSha !== packMeta.sha256) {
            throw new Error(`content pack sha256 mismatch: expected ${packMeta.sha256}, got ${actualSha}`);
        }
        const pack = JSON.parse(packSource);
        validateContentPack(pack, packMeta);
        const packRoot = path.dirname(contentRoot);
        fs.rmSync(packRoot, { recursive: true, force: true });
        fs.mkdirSync(contentRoot, { recursive: true });
        for (const entry of pack.entries) {
            const normalized = normalizeRelativePath(entry.path);
            const destPath = path.join(contentRoot, normalized);
            ensureDirectoryForFile(destPath);
            fs.writeFileSync(destPath, entry.content, 'utf-8');
            const entrySha = computeSha256(entry.content);
            if (entry.sha256 !== entrySha) {
                throw new Error(`content pack entry sha256 mismatch: ${normalized}`);
            }
        }
        fs.writeFileSync(markerPath, JSON.stringify({
            schemaVersion: CONTENT_PACK_SCHEMA_VERSION,
            profile: packMeta.profile,
            file: packMeta.file,
            format: packMeta.format,
            sha256: packMeta.sha256,
            entryCount: packMeta.entryCount,
            generatedAt: packMeta.generatedAt,
        }, null, 2), 'utf-8');
        logger.log(`远程内容包: 已缓存 ${packMeta.profile} (${pack.entryCount} files)`);
        return { contentRoot, pack: packMeta, usedCache: false };
    }
    catch (error) {
        if (ctx.strictRemotePack) {
            throw new Error(`pack-only mode requires a valid ${ctx.profile} content pack: ${error.message}`);
        }
        logger.warn(`远程内容包不可用，回退逐文件拉取: ${error.message}`);
        return { contentRoot: null, pack: null, usedCache: false };
    }
}
async function readRemoteTextAsset(ctx, logger, relativePath) {
    const normalized = normalizeRelativePath(relativePath);
    if (ctx.remoteContentRoot) {
        const cachedPath = path.join(ctx.remoteContentRoot, normalized);
        if (fs.existsSync(cachedPath)) {
            return fs.readFileSync(cachedPath, 'utf-8');
        }
        if (ctx.strictRemotePack) {
            throw new Error(`pack-only mode blocked raw fallback for ${normalized}`);
        }
        logger.verbose(`远程内容包未命中: ${normalized}，回退逐文件拉取`);
    }
    if (ctx.strictRemotePack) {
        throw new Error(`pack-only mode requires cached asset: ${normalized}`);
    }
    const url = `${ctx.remoteBaseUrl}/${normalized}`;
    return (0, fetcher_1.fetchUrl)(ctx, logger, url);
}
