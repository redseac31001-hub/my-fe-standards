"use strict";
/**
 * 多工具分发转换器
 *
 * 将 my-fe-standards 的规则、代理、技能转换为不同 AI 编程工具的原生格式。
 * 设计参考 agency-agents/scripts/convert.sh 的 SSMO 模式。
 *
 * 支持的目标工具:
 *   - claude-code: ~/.claude/rules/*.md + CLAUDE.md
 *   - cursor: .cursor/rules/*.mdc
 *   - windsurf: .windsurf/rules/*.md
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
exports.convert = convert;
exports.scanSources = scanSources;
exports.parseFrontmatter = parseFrontmatter;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const cli_entry_1 = require("./lib/cli-entry");
// ---------- Frontmatter 解析 ----------
function parseFrontmatter(content) {
    var _a, _b;
    const lines = content.split('\n');
    if (((_a = lines[0]) === null || _a === void 0 ? void 0 : _a.trim()) !== '---') {
        return { frontmatter: {}, body: content };
    }
    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
        if (((_b = lines[i]) === null || _b === void 0 ? void 0 : _b.trim()) === '---') {
            endIndex = i;
            break;
        }
    }
    if (endIndex === -1) {
        return { frontmatter: {}, body: content };
    }
    const fmLines = lines.slice(1, endIndex);
    const fm = {};
    let currentKey = '';
    let inArray = false;
    const arrayValues = [];
    for (const line of fmLines) {
        const trimmed = line.trim();
        if (inArray) {
            if (trimmed.startsWith('- ')) {
                const value = trimmed.slice(2).trim().replace(/^["']|["']$/g, '');
                arrayValues.push(value);
                continue;
            }
            else {
                fm[currentKey] = [...arrayValues];
                arrayValues.length = 0;
                inArray = false;
            }
        }
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1)
            continue;
        const key = trimmed.slice(0, colonIndex).trim();
        const value = trimmed.slice(colonIndex + 1).trim();
        if (value === '' || value === '|') {
            currentKey = key;
            inArray = true;
            arrayValues.length = 0;
            continue;
        }
        fm[key] = value.replace(/^["']|["']$/g, '');
    }
    if (inArray && arrayValues.length > 0) {
        fm[currentKey] = [...arrayValues];
    }
    const body = lines.slice(endIndex + 1).join('\n').trim();
    return { frontmatter: fm, body };
}
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
        .replace(/^-|-$/g, '');
}
// ---------- 源文件扫描 ----------
function scanSources(sourceRoot) {
    const sources = [];
    const scanDir = (dir, category) => {
        const fullDir = path.join(sourceRoot, dir);
        if (!fs.existsSync(fullDir))
            return;
        const entries = fs.readdirSync(fullDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const agentMd = path.join(fullDir, entry.name, 'AGENT.md');
                const skillMd = path.join(fullDir, entry.name, 'SKILL.md');
                const indexMd = path.join(fullDir, entry.name, 'index.md');
                const target = fs.existsSync(agentMd)
                    ? agentMd
                    : fs.existsSync(skillMd)
                        ? skillMd
                        : fs.existsSync(indexMd)
                            ? indexMd
                            : null;
                if (target) {
                    const content = fs.readFileSync(target, 'utf-8');
                    const { frontmatter, body } = parseFrontmatter(content);
                    sources.push({
                        frontmatter,
                        body,
                        relativePath: path.relative(sourceRoot, target).replace(/\\/g, '/'),
                        category,
                    });
                }
            }
            else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
                const filePath = path.join(fullDir, entry.name);
                const content = fs.readFileSync(filePath, 'utf-8');
                const { frontmatter, body } = parseFrontmatter(content);
                sources.push({
                    frontmatter,
                    body,
                    relativePath: path.relative(sourceRoot, filePath).replace(/\\/g, '/'),
                    category,
                });
            }
        }
    };
    scanDir('agents', 'agent');
    const rulesDir = path.join(sourceRoot, 'rules');
    if (fs.existsSync(rulesDir)) {
        for (const layer of fs.readdirSync(rulesDir, { withFileTypes: true })) {
            if (layer.isDirectory()) {
                scanDir(path.join('rules', layer.name), 'rule');
            }
        }
    }
    scanDir('custom-skills', 'skill');
    return sources;
}
// ---------- 转换器: Claude Code ----------
function convertClaudeCode(sources, outputDir) {
    var _a, _b;
    const rulesDir = path.join(outputDir, '.claude', 'rules');
    fs.mkdirSync(rulesDir, { recursive: true });
    let count = 0;
    for (const source of sources) {
        const name = (_a = source.frontmatter.name) !== null && _a !== void 0 ? _a : path.basename(source.relativePath, '.md');
        const slug = slugify(name);
        const description = (_b = source.frontmatter.description) !== null && _b !== void 0 ? _b : '';
        let content = '';
        if (source.category === 'agent') {
            content = [
                `# ${name}`,
                '',
                description ? `> ${description}` : '',
                '',
                source.body,
            ].filter(Boolean).join('\n');
        }
        else if (source.category === 'rule') {
            content = source.body || '';
        }
        else {
            content = [
                `# ${name}`,
                '',
                description ? `> ${description}` : '',
                '',
                source.body,
            ].filter(Boolean).join('\n');
        }
        if (!content.trim())
            continue;
        const outPath = path.join(rulesDir, `${slug}.md`);
        fs.writeFileSync(outPath, content, 'utf-8');
        count++;
    }
    return count;
}
// ---------- 转换器: Cursor ----------
function convertCursor(sources, outputDir) {
    var _a, _b;
    const rulesDir = path.join(outputDir, '.cursor', 'rules');
    fs.mkdirSync(rulesDir, { recursive: true });
    let count = 0;
    for (const source of sources) {
        const name = (_a = source.frontmatter.name) !== null && _a !== void 0 ? _a : path.basename(source.relativePath, '.md');
        const slug = slugify(name);
        const description = (_b = source.frontmatter.description) !== null && _b !== void 0 ? _b : name;
        const globs = source.frontmatter.tags
            ? source.frontmatter.tags.map((t) => `**/*.${t}`).join(', ')
            : '';
        const content = [
            '---',
            `description: ${description}`,
            `globs: "${globs}"`,
            'alwaysApply: false',
            '---',
            '',
            source.body,
        ].join('\n');
        const outPath = path.join(rulesDir, `${slug}.mdc`);
        fs.writeFileSync(outPath, content, 'utf-8');
        count++;
    }
    return count;
}
// ---------- 转换器: Windsurf ----------
function convertWindsurf(sources, outputDir) {
    var _a, _b;
    const rulesDir = path.join(outputDir, '.windsurf', 'rules');
    fs.mkdirSync(rulesDir, { recursive: true });
    let count = 0;
    for (const source of sources) {
        const name = (_a = source.frontmatter.name) !== null && _a !== void 0 ? _a : path.basename(source.relativePath, '.md');
        const slug = slugify(name);
        const description = (_b = source.frontmatter.description) !== null && _b !== void 0 ? _b : '';
        const triggers = source.frontmatter.triggers;
        const triggerSection = Array.isArray(triggers) && triggers.length > 0
            ? `\n触发场景: ${triggers.join(', ')}\n`
            : '';
        const content = [
            `# ${name}`,
            '',
            description ? `> ${description}` : '',
            triggerSection,
            source.body,
        ].filter(Boolean).join('\n');
        if (!content.trim())
            continue;
        const outPath = path.join(rulesDir, `${slug}.md`);
        fs.writeFileSync(outPath, content, 'utf-8');
        count++;
    }
    return count;
}
// ---------- 主函数 ----------
function convert(options) {
    const sources = scanSources(options.sourceRoot);
    console.log(`扫描到 ${sources.length} 个源文件（${sources.filter(s => s.category === 'rule').length} 规则, ${sources.filter(s => s.category === 'agent').length} 代理, ${sources.filter(s => s.category === 'skill').length} 技能）`);
    const tools = options.tool === 'all'
        ? ['claude-code', 'cursor', 'windsurf']
        : [options.tool];
    const results = [];
    for (const tool of tools) {
        const toolOutDir = path.join(options.outputDir, tool);
        fs.mkdirSync(toolOutDir, { recursive: true });
        let filesWritten = 0;
        switch (tool) {
            case 'claude-code':
                filesWritten = convertClaudeCode(sources, toolOutDir);
                break;
            case 'cursor':
                filesWritten = convertCursor(sources, toolOutDir);
                break;
            case 'windsurf':
                filesWritten = convertWindsurf(sources, toolOutDir);
                break;
        }
        console.log(`[${tool}] 转换了 ${filesWritten} 个文件 → ${toolOutDir}`);
        results.push({ tool, filesWritten, outputDir: toolOutDir });
    }
    return results;
}
// ---------- CLI 入口 ----------
function printUsage() {
    console.log(`
用法: node tool-converter.js [选项]

将 my-fe-standards 的规则/代理/技能转换为不同 AI 工具的原生格式。

选项:
  --tool <name>     目标工具（claude-code | cursor | windsurf | all，默认: all）
  --source <dir>    源目录（默认: 项目根目录）
  --output <dir>    输出目录（默认: ./output/integrations）
  --help            显示帮助

示例:
  node tool-converter.js --tool cursor --output ./dist/integrations
  node tool-converter.js --tool all
`);
}
if ((0, cli_entry_1.isDirectCliEntry)('tool-converter.js')) {
    const args = process.argv.slice(2);
    let tool = 'all';
    let sourceRoot = process.cwd();
    let outputDir = path.join(process.cwd(), 'output', 'integrations');
    let help = false;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--help' || arg === '-h') {
            help = true;
        }
        else if (arg === '--tool' && args[i + 1]) {
            const val = args[++i];
            if (['claude-code', 'cursor', 'windsurf', 'all'].includes(val)) {
                tool = val;
            }
            else {
                console.error(`未知工具: ${val}`);
                process.exit(1);
            }
        }
        else if (arg === '--source' && args[i + 1]) {
            sourceRoot = path.resolve(args[++i]);
        }
        else if (arg === '--output' && args[i + 1]) {
            outputDir = path.resolve(args[++i]);
        }
    }
    if (help) {
        printUsage();
        process.exit(0);
    }
    console.log(`源目录: ${sourceRoot}`);
    console.log(`输出目录: ${outputDir}`);
    console.log(`目标工具: ${tool}`);
    console.log('');
    const results = convert({ tool, sourceRoot, outputDir });
    const total = results.reduce((sum, r) => sum + r.filesWritten, 0);
    console.log(`\n完成。共转换 ${total} 个文件。`);
}
