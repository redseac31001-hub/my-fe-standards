import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { VueProfile, PackageJson, DetailLevel } from './types.js';

// ES 模块中获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 规则服务类
 * 提供规则查询、依赖检测等核心功能
 */
export class RuleService {
  private cache: Map<string, any> = new Map();
  private rulesRoot: string;
  private configPath: string;

  constructor() {
    this.rulesRoot = path.resolve(__dirname, '../../rules');
    this.configPath = path.resolve(__dirname, '../../config/loader-config.json');
  }

  /**
   * 获取项目的前端架构规则
   */
  async getProjectRules(
    projectPath: string,
    taskType?: string,
    detailLevel: string = 'full'
  ): Promise<string> {
    // 读取 package.json
    const pkg = this.getPackageJson(projectPath);
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };

    // 检测 Vue 版本
    const vueProfile = this.checkVueProfile(dependencies);

    // 生成规则内容
    let output = '# 前端架构规则\n\n';
    output += `> 项目路径: ${projectPath}\n`;
    output += `> 任务类型: ${taskType || 'all'}\n`;
    output += `> 详略级别: ${detailLevel}\n\n`;

    // 添加 Vue 信息
    if (vueProfile) {
      output += `## 检测到的技术栈\n\n`;
      output += `- **Vue 版本**: ${vueProfile.version}\n`;
      output += `- **类型**: ${vueProfile.type}\n\n`;
    }

    // 加载 Layer 1 规则（基础层）
    output += await this.loadLayer1Rules(vueProfile, detailLevel as DetailLevel);

    // 加载 Layer 2 规则（业务层）
    output += await this.loadLayer2Rules(dependencies, detailLevel as DetailLevel);

    // 加载 Layer 3 规则（动作层）
    output += await this.loadLayer3Rules(taskType, detailLevel as DetailLevel);

    return output;
  }

  /**
   * 检测项目依赖和技术栈
   */
  async detectDependencies(projectPath: string): Promise<any> {
    const pkg = this.getPackageJson(projectPath);
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    const vueProfile = this.checkVueProfile(dependencies);

    return {
      dependencies: Object.keys(dependencies),
      vueProfile,
      detectedLibraries: this.detectLibraries(dependencies),
      projectName: pkg.name || 'unknown',
      projectVersion: pkg.version || 'unknown',
    };
  }

  /**
   * 按 ID 获取单个规则
   */
  async getRuleById(ruleId: string, detailLevel: string = 'full'): Promise<string> {
    const rulePath = path.join(this.rulesRoot, `${ruleId}.md`);

    if (!fs.existsSync(rulePath)) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    const content = fs.readFileSync(rulePath, 'utf-8');
    return this.extractContentByLevel(content, detailLevel as DetailLevel);
  }

  /**
   * 搜索规则库
   */
  async searchRules(query: string, layer?: string): Promise<any[]> {
    const results: any[] = [];
    const searchDir = layer ? path.join(this.rulesRoot, layer) : this.rulesRoot;

    if (!fs.existsSync(searchDir)) {
      return results;
    }

    // 递归搜索规则文件
    const searchFiles = (dir: string, basePath: string = '') => {
      const files = fs.readdirSync(dir);

      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          searchFiles(fullPath, path.join(basePath, file));
        } else if (file.endsWith('.md')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lowerQuery = query.toLowerCase();
          const lowerContent = content.toLowerCase();

          if (lowerContent.includes(lowerQuery)) {
            const ruleId = path.join(basePath, file.replace('.md', ''));
            const summary = this.extractSummary(content);

            results.push({
              ruleId,
              file: file,
              path: fullPath,
              summary,
              matches: this.countMatches(content, query),
            });
          }
        }
      }
    };

    searchFiles(searchDir);

    // 按匹配次数排序
    results.sort((a, b) => b.matches - a.matches);

    return results;
  }

  // ============ 私有辅助方法 ============

  /**
   * 读取 package.json
   */
  private getPackageJson(targetDir: string): PackageJson {
    const pkgPath = path.join(targetDir, 'package.json');

    if (!fs.existsSync(pkgPath)) {
      console.warn(`No package.json found at: ${pkgPath}`);
      return {};
    }

    try {
      return JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as PackageJson;
    } catch (e) {
      const error = e as Error;
      console.error(`Failed to parse package.json: ${error.message}`);
      return {};
    }
  }

  /**
   * 检测 Vue 版本
   */
  private checkVueProfile(dependencies: Record<string, string>): VueProfile | null {
    const vueVersion = dependencies['vue'];
    if (!vueVersion) return null;

    if (vueVersion.startsWith('3') || vueVersion.startsWith('^3') || vueVersion.startsWith('~3')) {
      return { version: 3, type: 'standard' };
    }

    if (vueVersion.startsWith('2') || vueVersion.startsWith('^2') || vueVersion.startsWith('~2')) {
      if (dependencies['@vue/composition-api']) {
        return { version: 2, type: 'composition' };
      }
      return { version: 2, type: 'options' };
    }

    return null;
  }

  /**
   * 检测使用的 UI 库
   */
  private detectLibraries(dependencies: Record<string, string>): string[] {
    const libraries: string[] = [];

    if ('ant-design-vue' in dependencies) libraries.push('antdv');
    if ('tdesign-vue-next' in dependencies) libraries.push('tdesign');
    if ('vant' in dependencies) libraries.push('vant');
    if ('element-plus' in dependencies) libraries.push('element-plus');
    if ('naive-ui' in dependencies) libraries.push('naive-ui');

    return libraries;
  }

  /**
   * 根据详略级别提取内容
   */
  private extractContentByLevel(content: string, level: DetailLevel): string {
    if (level === 'full') {
      return content;
    }

    const levelMarkers: Record<DetailLevel, string[]> = {
      summary: ['@level:summary'],
      quick: ['@level:summary', '@level:quick'],
      full: ['@level:summary', '@level:quick', '@level:full'],
    };

    const allowedMarkers = levelMarkers[level];
    const markerRegex = /<!--\s*(@level:\w+)\s*-->/g;
    const sections: Array<{ marker: string; content: string }> = [];

    // 查找所有标记位置
    const markers: Array<{ marker: string; index: number }> = [];
    let match: RegExpExecArray | null;

    while ((match = markerRegex.exec(content)) !== null) {
      markers.push({ marker: match[1], index: match.index });
    }

    // 如果没有标记，返回全部内容
    if (markers.length === 0) {
      return content;
    }

    // 提取标记前的内容
    if (markers[0].index > 0) {
      const preContent = content.substring(0, markers[0].index).trim();
      if (preContent) {
        sections.push({ marker: '@level:summary', content: preContent });
      }
    }

    // 提取各标记区块
    for (let i = 0; i < markers.length; i++) {
      const currentMarker = markers[i];
      const nextMarker = markers[i + 1];

      const markerEndMatch = content.substring(currentMarker.index).match(/<!--\s*@level:\w+\s*-->/);
      const markerLength = markerEndMatch ? markerEndMatch[0].length : 0;
      const startIndex = currentMarker.index + markerLength;
      const endIndex = nextMarker ? nextMarker.index : content.length;

      const sectionContent = content.substring(startIndex, endIndex).trim();
      if (sectionContent) {
        sections.push({ marker: currentMarker.marker, content: sectionContent });
      }
    }

    // 过滤并合并内容
    const filteredSections = sections.filter((section) =>
      allowedMarkers.includes(section.marker)
    );

    return filteredSections.map((s) => s.content).join('\n\n');
  }

  /**
   * 提取规则摘要
   */
  private extractSummary(content: string): string {
    // 尝试提取第一段或前 200 个字符
    const lines = content.split('\n');
    let summary = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('<!--')) {
        summary = trimmed;
        break;
      }
    }

    if (summary.length > 200) {
      summary = summary.substring(0, 200) + '...';
    }

    return summary || '无摘要';
  }

  /**
   * 计算匹配次数
   */
  private countMatches(content: string, query: string): number {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let count = 0;
    let pos = 0;

    while ((pos = lowerContent.indexOf(lowerQuery, pos)) !== -1) {
      count++;
      pos += lowerQuery.length;
    }

    return count;
  }

  /**
   * 加载 Layer 1 规则（基础层）
   */
  private async loadLayer1Rules(vueProfile: VueProfile | null, detailLevel: DetailLevel): Promise<string> {
    let output = '## Layer 1: 基础规则\n\n';

    const layer1Dir = path.join(this.rulesRoot, 'layer1_base');
    if (!fs.existsSync(layer1Dir)) {
      return output + '> 未找到基础规则\n\n';
    }

    // 加载架构规则
    const archDir = path.join(layer1Dir, 'architecture');
    if (fs.existsSync(archDir)) {
      output += await this.loadRulesFromDir(archDir, detailLevel);
    }

    // 加载 TypeScript 规则
    const tsDir = path.join(layer1Dir, 'typescript');
    if (fs.existsSync(tsDir)) {
      output += await this.loadRulesFromDir(tsDir, detailLevel);
    }

    // 根据 Vue 版本加载对应规则
    if (vueProfile) {
      const vueDir = path.join(layer1Dir, `vue${vueProfile.version}`);
      if (fs.existsSync(vueDir)) {
        output += await this.loadRulesFromDir(vueDir, detailLevel);
      }
    }

    return output;
  }

  /**
   * 加载 Layer 2 规则（业务层）
   */
  private async loadLayer2Rules(dependencies: Record<string, string>, detailLevel: DetailLevel): Promise<string> {
    let output = '## Layer 2: 业务规则\n\n';

    const layer2Dir = path.join(this.rulesRoot, 'layer2_business');
    if (!fs.existsSync(layer2Dir)) {
      return output + '> 未找到业务规则\n\n';
    }

    const libraries = this.detectLibraries(dependencies);
    if (libraries.length === 0) {
      return output + '> 未检测到 UI 库\n\n';
    }

    for (const lib of libraries) {
      const libFile = path.join(layer2Dir, `${lib}.md`);
      if (fs.existsSync(libFile)) {
        const content = fs.readFileSync(libFile, 'utf-8');
        output += this.extractContentByLevel(content, detailLevel) + '\n\n';
      }
    }

    return output;
  }

  /**
   * 加载 Layer 3 规则（动作层）
   */
  private async loadLayer3Rules(taskType: string | undefined, detailLevel: DetailLevel): Promise<string> {
    let output = '## Layer 3: 动作清单\n\n';

    const layer3Dir = path.join(this.rulesRoot, 'layer3_action');
    if (!fs.existsSync(layer3Dir)) {
      return output + '> 未找到动作清单\n\n';
    }

    if (!taskType || taskType === 'all') {
      output += '> 任务类型: 全部\n\n';
      output += await this.loadRulesFromDir(layer3Dir, detailLevel);
    } else {
      const taskFile = path.join(layer3Dir, `${taskType}.md`);
      if (fs.existsSync(taskFile)) {
        const content = fs.readFileSync(taskFile, 'utf-8');
        output += this.extractContentByLevel(content, detailLevel) + '\n\n';
      } else {
        output += `> 未找到任务类型 "${taskType}" 的规则\n\n`;
      }
    }

    return output;
  }

  /**
   * 从目录加载所有规则
   */
  private async loadRulesFromDir(dir: string, detailLevel: DetailLevel): Promise<string> {
    let output = '';

    if (!fs.existsSync(dir)) {
      return output;
    }

    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isFile() && file.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        output += `### ${file.replace('.md', '')}\n\n`;
        output += this.extractContentByLevel(content, detailLevel) + '\n\n';
      }
    }

    return output;
  }
}
