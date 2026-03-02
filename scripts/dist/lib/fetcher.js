"use strict";
/**
 * 网络请求模块
 *
 * 提供 HTTP/HTTPS 请求能力，支持重定向、重试和超时
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
exports.fetchUrl = fetchUrl;
const https = __importStar(require("https"));
const http = __importStar(require("http"));
function fetchUrl(ctx, logger, url, retries = 3) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        logger.verbose(`Fetching: ${url} (Retries left: ${retries})`);
        const request = client.get(url, (res) => {
            // 处理重定向
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                logger.verbose(`Redirecting to: ${res.headers.location}`);
                fetchUrl(ctx, logger, res.headers.location, retries).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                if (res.statusCode && res.statusCode >= 500 && retries > 0) {
                    res.resume();
                    logger.warn(`HTTP ${res.statusCode}. Retrying...`);
                    setTimeout(() => {
                        fetchUrl(ctx, logger, url, retries - 1).then(resolve).catch(reject);
                    }, 1000);
                    return;
                }
                res.resume();
                reject(new Error(`HTTP ${res.statusCode}: Failed to fetch ${url}`));
                return;
            }
            let data = '';
            res.on('data', (chunk) => { data += chunk.toString(); });
            res.on('end', () => {
                logger.verbose(`Fetched ${data.length} bytes from ${url}`);
                resolve(data);
            });
        });
        request.on('error', (e) => {
            if (retries > 0) {
                logger.warn(`Network Error (${e.code}). Retrying...`);
                setTimeout(() => {
                    fetchUrl(ctx, logger, url, retries - 1).then(resolve).catch(reject);
                }, 1000);
                return;
            }
            reject(new Error(`Network Error: ${e.message} (URL: ${url})`));
        });
        request.setTimeout(ctx.requestTimeout, () => {
            request.destroy();
            if (retries > 0) {
                logger.warn(`Request Timeout. Retrying...`);
                setTimeout(() => {
                    fetchUrl(ctx, logger, url, retries - 1).then(resolve).catch(reject);
                }, 1000);
                return;
            }
            reject(new Error(`Request Timeout: ${url}`));
        });
    });
}
