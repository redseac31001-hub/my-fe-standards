#!/usr/bin/env node
"use strict";
/**
 * 简单 HTTP 服务器
 *
 * 用于本地测试远程加载模式
 *
 * 用法：
 *   node simple-server.js
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
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const PORT = 8080;
const ROOT = path.join(__dirname, '../..');
const server = http.createServer((req, res) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    // 安全处理路径，防止路径遍历攻击
    const safePath = path.normalize(req.url || '/').replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(ROOT, safePath);
    // 验证路径在 ROOT 目录内
    if (!filePath.startsWith(ROOT)) {
        console.log(`  -> 403 Forbidden: ${filePath} (路径遍历尝试)`);
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    const ext = path.extname(filePath);
    let contentType = 'text/plain';
    if (ext === '.json')
        contentType = 'application/json';
    if (ext === '.md')
        contentType = 'text/markdown';
    if (ext === '.js')
        contentType = 'application/javascript';
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.log(`  -> 404 Not Found: ${filePath}`);
                res.writeHead(404);
                res.end('Not Found');
            }
            else {
                console.log(`  -> 500 Server Error: ${err.code}`);
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        }
        else {
            console.log(`  -> 200 OK (${content.length} bytes)`);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`Serving files from: ${ROOT}`);
});
