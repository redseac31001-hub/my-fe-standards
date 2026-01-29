"use strict";
/**
 * Reports 模块类型定义
 *
 * 项目记忆系统（Project Memory）的接口和类型
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MANIFEST = exports.DEFAULT_RETENTION_POLICY = void 0;
/**
 * 默认保留策略
 */
exports.DEFAULT_RETENTION_POLICY = {
    snapshots: {
        maxCount: 10,
        maxAgeDays: 30,
    },
    health: {
        dailyRetentionDays: 90,
        weeklyRetentionDays: 365,
    },
    tasks: {
        maxCount: 50,
        maxAgeDays: 180,
    },
    cache: {
        maxAgeDays: 7,
    },
};
/**
 * 默认 Manifest
 */
exports.DEFAULT_MANIFEST = {
    version: '1.0.0',
    projectName: '',
    lastUpdated: '',
    reports: {
        architecture: null,
        modules: null,
        health: null,
        tasks: null,
    },
    settings: {
        retentionDays: 30,
        maxSnapshots: 10,
        autoCleanup: true,
    },
};
