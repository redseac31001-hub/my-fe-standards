/**
 * 规则服务类
 * 提供规则查询、依赖检测等核心功能
 */
export declare class RuleService {
    private cache;
    private rulesRoot;
    private configPath;
    constructor();
    /**
     * 获取项目的前端架构规则
     */
    getProjectRules(projectPath: string, taskType?: string, detailLevel?: string): Promise<string>;
    /**
     * 检测项目依赖和技术栈
     */
    detectDependencies(projectPath: string): Promise<any>;
    /**
     * 按 ID 获取单个规则
     */
    getRuleById(ruleId: string, detailLevel?: string): Promise<string>;
    /**
     * 搜索规则库
     */
    searchRules(query: string, layer?: string): Promise<any[]>;
    /**
     * 读取 package.json
     */
    private getPackageJson;
    /**
     * 检测 Vue 版本
     */
    private checkVueProfile;
    /**
     * 检测使用的 UI 库
     */
    private detectLibraries;
    /**
     * 根据详略级别提取内容
     */
    private extractContentByLevel;
    /**
     * 提取规则摘要
     */
    private extractSummary;
    /**
     * 计算匹配次数
     */
    private countMatches;
    /**
     * 加载 Layer 1 规则（基础层）
     */
    private loadLayer1Rules;
    /**
     * 加载 Layer 2 规则（业务层）
     */
    private loadLayer2Rules;
    /**
     * 加载 Layer 3 规则（动作层）
     */
    private loadLayer3Rules;
    /**
     * 从目录加载所有规则
     */
    private loadRulesFromDir;
}
//# sourceMappingURL=rule-service.d.ts.map