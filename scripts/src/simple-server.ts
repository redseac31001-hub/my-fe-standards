#!/usr/bin/env node
/**
 * 简单 HTTP 服务器
 *
 * 用于本地测试远程加载模式
 *
 * 用法：
 *   node simple-server.js
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const PORT: number = 8080;
const ROOT: string = path.join(__dirname, '../..');

const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // 安全处理路径，防止路径遍历攻击
  const safePath: string = path.normalize(req.url || '/').replace(/^(\.\.[\/\\])+/, '');
  const filePath: string = path.join(ROOT, safePath);

  // 验证路径在 ROOT 目录内
  if (!filePath.startsWith(ROOT)) {
    console.log(`  -> 403 Forbidden: ${filePath} (路径遍历尝试)`);
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext: string = path.extname(filePath);
  let contentType: string = 'text/plain';

  if (ext === '.json') contentType = 'application/json';
  if (ext === '.md') contentType = 'text/markdown';
  if (ext === '.js') contentType = 'application/javascript';

  fs.readFile(filePath, (err: NodeJS.ErrnoException | null, content: Buffer) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.log(`  -> 404 Not Found: ${filePath}`);
        res.writeHead(404);
        res.end('Not Found');
      } else {
        console.log(`  -> 500 Server Error: ${err.code}`);
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
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
