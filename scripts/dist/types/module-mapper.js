"use strict";
/**
 * Module Mapper 类型定义
 *
 * 功能模块图谱分析器的接口和类型
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MAPPER_CONFIG = exports.BUSINESS_KEYWORDS = void 0;
/**
 * 默认业务关键词映射表
 */
exports.BUSINESS_KEYWORDS = [
    // 用户认证
    { keyword: 'login', name: '登录', category: '用户认证', aliases: ['signin', 'auth'] },
    { keyword: 'register', name: '注册', category: '用户认证', aliases: ['signup'] },
    { keyword: 'verification', name: '身份验证', category: '用户认证', aliases: ['verify', 'validate'] },
    { keyword: 'password', name: '密码管理', category: '用户认证', aliases: ['pwd', 'forgot'] },
    { keyword: 'captcha', name: '验证码', category: '用户认证' },
    { keyword: 'sso', name: '单点登录', category: '用户认证' },
    // 用户管理
    { keyword: 'account', name: '账户', category: '用户管理', aliases: ['user', 'profile'] },
    { keyword: 'personal', name: '个人中心', category: '用户管理', aliases: ['mine', 'my'] },
    { keyword: 'settings', name: '设置', category: '用户管理', aliases: ['setting', 'config'] },
    { keyword: 'enterprise', name: '企业信息', category: '用户管理', aliases: ['company', 'corp'] },
    // 业务办理
    { keyword: 'registry', name: '注册开户', category: '业务办理', aliases: ['reg'] },
    { keyword: 'selfSign', name: '自助签约', category: '业务办理', aliases: ['self-sign', 'selfsign'] },
    { keyword: 'fillInfo', name: '信息填写', category: '业务办理', aliases: ['fill-info', 'fillinfo'] },
    { keyword: 'openAccount', name: '开户', category: '业务办理', aliases: ['open-account', 'openaccount'] },
    { keyword: 'apply', name: '申请', category: '业务办理', aliases: ['application'] },
    { keyword: 'order', name: '订单', category: '业务办理', aliases: ['orders'] },
    { keyword: 'payment', name: '支付', category: '业务办理', aliases: ['pay'] },
    { keyword: 'transaction', name: '交易', category: '业务办理', aliases: ['trans'] },
    // 数据管理
    { keyword: 'dashboard', name: '仪表盘', category: '数据管理', aliases: ['home', 'index'] },
    { keyword: 'report', name: '报表', category: '数据管理', aliases: ['reports', 'statistics'] },
    { keyword: 'list', name: '列表', category: '数据管理', aliases: ['table'] },
    { keyword: 'detail', name: '详情', category: '数据管理', aliases: ['details', 'info'] },
    // 系统设置
    { keyword: 'admin', name: '管理后台', category: '系统设置', aliases: ['management'] },
    { keyword: 'permission', name: '权限管理', category: '系统设置', aliases: ['role', 'auth'] },
    { keyword: 'system', name: '系统管理', category: '系统设置', aliases: ['sys'] },
    // 通用组件
    { keyword: 'components', name: '公共组件', category: '通用组件', aliases: ['component', 'common'] },
    { keyword: 'layouts', name: '布局组件', category: '通用组件', aliases: ['layout'] },
    // 工具函数
    { keyword: 'utils', name: '工具函数', category: '工具函数', aliases: ['util', 'helpers', 'helper'] },
    { keyword: 'hooks', name: 'Hooks', category: '工具函数', aliases: ['composables', 'composable'] },
    { keyword: 'api', name: 'API接口', category: '工具函数', aliases: ['apis', 'services', 'service'] },
    { keyword: 'store', name: '状态管理', category: '工具函数', aliases: ['stores', 'vuex', 'pinia'] },
];
/**
 * 默认配置
 */
exports.DEFAULT_MAPPER_CONFIG = {
    modulePatterns: [
        { pattern: 'views', type: 'page', recursive: true },
        { pattern: 'pages', type: 'page', recursive: true },
        { pattern: 'features', type: 'feature', recursive: true },
        { pattern: 'modules', type: 'feature', recursive: true },
        { pattern: 'components', type: 'shared', recursive: false },
        { pattern: 'composables', type: 'util', recursive: false },
        { pattern: 'hooks', type: 'util', recursive: false },
        { pattern: 'utils', type: 'util', recursive: false },
        { pattern: 'api', type: 'api', recursive: true },
        { pattern: 'services', type: 'api', recursive: true },
        { pattern: 'store', type: 'store', recursive: true },
        { pattern: 'stores', type: 'store', recursive: true },
        { pattern: 'layouts', type: 'layout', recursive: false },
    ],
    entryPatterns: [
        'index.vue',
        'index.tsx',
        'index.ts',
        'App.vue',
        '*.page.vue',
        '*.view.vue',
    ],
    ignorePatterns: [
        'node_modules',
        'dist',
        '.git',
        '.vscode',
        '__tests__',
        '*.test.*',
        '*.spec.*',
    ],
    thresholds: {
        maxFilesPerModule: 50,
        maxLinesPerModule: 5000,
        maxDependencies: 10,
        maxDependents: 20,
    },
};
