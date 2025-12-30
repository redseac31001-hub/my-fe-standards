/**
 * Manifest Generator for Remote Fetch Mode
 * 
 * 遍历 rules 目录，生成 manifest.json 清单文件。
 * 供 rule-loader.js 在远程模式下通过 HTTP 读取文件列表。
 */

const fs = require('fs');
const path = require('path');

const RULES_ROOT = path.resolve(__dirname, '../rules');
const CONFIG_PATH = path.resolve(__dirname, '../config/loader-config.json');
const OUTPUT_PATH = path.resolve(__dirname, '../manifest.json'); // 放在根目录方便访问

function scanDirectory(dir, relativeTo) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const relativePath = path.relative(relativeTo, fullPath).replace(/\\/g, '/'); // 统一为 POSIX 路径
        const stat = fs.statSync(fullPath);

        if (stat && stat.isDirectory()) {
            results = results.concat(scanDirectory(fullPath, relativeTo));
        } else {
            // 只包含 markdown 文件
            if (file.endsWith('.md')) {
                results.push({
                    path: relativePath,
                    size: stat.size,
                    name: file
                });
            }
        }
    });
    return results;
}

function main() {
    console.log('[Manifest] Scanning rules directory...');

    // 1. 读取所有规则文件
    const files = scanDirectory(RULES_ROOT, path.resolve(__dirname, '..'));

    // 2. 读取 Loader 配置 (方便远程 Loader 直接获取策略，无需再次请求 config 文件)
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

    // 3. 构造 Manifest 对象
    const manifest = {
        generatedAt: new Date().toISOString(),
        version: "1.0.0",
        config: config, // 内嵌配置
        files: files    // 文件列表
    };

    // 4. 写入文件
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(manifest, null, 2));
    console.log(`[Manifest] Generated at ${OUTPUT_PATH}`);
    console.log(`[Manifest] Total files: ${files.length}`);
}

main();
