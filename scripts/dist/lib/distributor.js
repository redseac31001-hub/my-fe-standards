"use strict";
/**
 * 通用文件分发模块
 *
 * 提供远程下载或本地复制的通用分发逻辑，支持 README 生成和子目录预创建
 */
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
exports.distributeItems = distributeItems;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const install_sync_1 = require("./install-sync");
const remote_content_pack_1 = require("./remote-content-pack");
/**
 * 通用文件分发：远程下载或本地复制，支持 README 生成和子目录预创建
 */
async function distributeItems(ctx, logger, targetDir, projectRoot, options) {
    const distributed = [];
    const localDir = path.join(targetDir, options.targetSubDir);
    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
    }
    if (options.preCreateDirs) {
        for (const sub of options.preCreateDirs) {
            const subPath = path.join(localDir, sub);
            if (!fs.existsSync(subPath))
                fs.mkdirSync(subPath, { recursive: true });
        }
    }
    for (const item of options.items) {
        const destPath = path.join(localDir, item.destFile);
        if (ctx.isRemote) {
            try {
                const content = await (0, remote_content_pack_1.readRemoteTextAsset)(ctx, logger, item.sourcePath);
                if (options.tracker) {
                    (0, install_sync_1.writeManagedFile)(options.tracker, destPath, content);
                }
                else {
                    fs.writeFileSync(destPath, content, 'utf-8');
                }
                distributed.push(item.destFile);
                logger.verbose(`已下载 ${options.label}: ${item.destFile}`);
            }
            catch (e) {
                logger.warn(`${options.label} 下载失败: ${item.destFile} - ${e.message}`);
            }
        }
        else {
            const srcPath = path.join(projectRoot, item.sourcePath);
            if (!fs.existsSync(srcPath)) {
                logger.warn(`${options.label} 文件不存在: ${srcPath}`);
                continue;
            }
            try {
                if (options.tracker) {
                    (0, install_sync_1.copyManagedFile)(options.tracker, srcPath, destPath);
                }
                else {
                    fs.copyFileSync(srcPath, destPath);
                }
                distributed.push(item.destFile);
                logger.verbose(`已复制 ${options.label}: ${item.destFile}`);
            }
            catch (e) {
                logger.warn(`${options.label} 复制失败: ${item.destFile} - ${e.message}`);
            }
        }
    }
    if (distributed.length > 0 && options.readme) {
        const readmePath = path.join(localDir, 'README.md');
        if (options.tracker) {
            (0, install_sync_1.writeManagedFile)(options.tracker, readmePath, options.readme);
        }
        else {
            fs.writeFileSync(readmePath, options.readme, 'utf-8');
        }
    }
    return distributed;
}
