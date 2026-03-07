import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { ContentPack, Context, ManifestContentPack } from '../types';
import { Logger } from './logger';
import { fetchUrl } from './fetcher';

const CONTENT_PACK_SCHEMA_VERSION = '1.0.0';

export interface RemotePackResolution {
  contentRoot: string | null;
  pack: ManifestContentPack | null;
  usedCache: boolean;
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = path.posix.normalize(String(relativePath || '').replace(/\\/g, '/'));
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../') || path.posix.isAbsolute(normalized)) {
    throw new Error(`invalid relative path: ${relativePath}`);
  }
  return normalized;
}

function ensureDirectoryForFile(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

function validateContentPack(pack: ContentPack, packMeta: ManifestContentPack): void {
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

function buildContentRoot(targetDir: string, manifestVersion: string, packMeta: ManifestContentPack): string {
  return path.join(
    targetDir,
    '.codebuddy',
    'cache',
    'content-packs',
    manifestVersion,
    `${packMeta.profile}-${packMeta.sha256.slice(0, 12)}`,
    'contents',
  );
}

export async function ensureRemoteContentPack(
  ctx: Readonly<Context>,
  logger: Logger,
  targetDir: string,
): Promise<RemotePackResolution> {
  const packMeta = ctx.remoteManifest?.packs?.[ctx.profile] || null;
  const manifestVersion = ctx.remoteManifest?.version || '0.0.0';

  if (!ctx.isRemote || !packMeta) {
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
    const packSource = await fetchUrl(ctx, logger, packUrl);
    const actualSha = computeSha256(packSource);
    if (actualSha !== packMeta.sha256) {
      throw new Error(`content pack sha256 mismatch: expected ${packMeta.sha256}, got ${actualSha}`);
    }

    const pack = JSON.parse(packSource) as ContentPack;
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
  } catch (error) {
    logger.warn(`远程内容包不可用，回退逐文件拉取: ${(error as Error).message}`);
    return { contentRoot: null, pack: null, usedCache: false };
  }
}

export async function readRemoteTextAsset(
  ctx: Readonly<Context>,
  logger: Logger,
  relativePath: string,
): Promise<string> {
  const normalized = normalizeRelativePath(relativePath);

  if (ctx.remoteContentRoot) {
    const cachedPath = path.join(ctx.remoteContentRoot, normalized);
    if (fs.existsSync(cachedPath)) {
      return fs.readFileSync(cachedPath, 'utf-8');
    }
    logger.verbose(`远程内容包未命中: ${normalized}，回退逐文件拉取`);
  }

  const url = `${ctx.remoteBaseUrl}/${normalized}`;
  return fetchUrl(ctx, logger, url);
}
