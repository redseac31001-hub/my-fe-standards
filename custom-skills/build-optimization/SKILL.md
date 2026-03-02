---
name: build-optimization
description: 构建优化技能，涵盖 Vite/Webpack 配置优化、构建缓存和 CI 加速。触发条件：构建优化、构建速度慢、Vite 配置、Webpack 配置、包体积分析。
triggers:
  - "构建优化/Webpack/Vite/打包/分包"
---

# Build Optimization Skill

构建工具优化专项技能，提供 Vite/Webpack 配置优化、构建加速和 CI 优化的最佳实践。

## 核心能力

1. **Vite 配置优化** - 开发/生产环境优化
2. **Webpack 优化** - SplitChunks、缓存策略
3. **构建缓存** - 加速重复构建
4. **依赖分析** - 识别冗余依赖
5. **CI 构建优化** - 流水线加速

## Vite 优化配置

### 开发环境优化

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // 预构建依赖
    warmup: {
      clientFiles: ['./src/main.ts', './src/App.vue']
    }
  },
  optimizeDeps: {
    // 强制预构建
    include: ['vue', 'vue-router', 'pinia', 'axios'],
    // 排除不需要预构建的
    exclude: ['your-local-package']
  }
});
```

### 生产环境优化

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    // 启用压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    // 代码分割
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'vue-router', 'pinia'],
          'ui': ['ant-design-vue'],
          'utils': ['lodash-es', 'dayjs']
        }
      }
    },
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 设置 chunk 大小警告阈值
    chunkSizeWarningLimit: 500
  }
});
```

### 构建缓存

```typescript
// vite.config.ts
export default defineConfig({
  cacheDir: 'node_modules/.vite',
  build: {
    // 启用构建缓存
    cache: true
  }
});
```

## Webpack 优化配置

### SplitChunks 策略

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          reuseExistingChunk: true
        },
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true
        }
      }
    }
  }
};
```

### 持久化缓存

```javascript
// webpack.config.js
module.exports = {
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename]
    }
  }
};
```

## 依赖分析

### 检测未使用的依赖

```bash
# 使用 depcheck
npx depcheck

# 使用 knip
npx knip
```

### 检测重复依赖

```bash
# 检查 node_modules 中的重复包
npx npm-dedupe

# 分析依赖树
npm ls --all
```

## CI 构建优化

### 缓存策略

```yaml
# GitHub Actions 示例
- name: Cache node_modules
  uses: actions/cache@v3
  with:
    path: |
      node_modules
      ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

- name: Cache Vite
  uses: actions/cache@v3
  with:
    path: node_modules/.vite
    key: ${{ runner.os }}-vite-${{ hashFiles('**/vite.config.ts') }}
```

### 并行构建

```yaml
# 并行运行 lint 和 test
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
```

## 资源文件

根据具体需求，读取以下参考文档：

- **Vite 配置优化**: `references/vite/config-optimization.md`
- **Vite 插件性能**: `references/vite/plugin-performance.md`
- **Vite 构建缓存**: `references/vite/build-cache.md`
- **SplitChunks 配置**: `references/webpack/split-chunks.md`
- **缓存组策略**: `references/webpack/cache-groups.md`
- **依赖分析**: `references/common/dependency-analysis.md`
- **CI 构建优化**: `references/common/ci-optimization.md`

## 常用命令

```bash
# Vite 包分析
npx vite-bundle-visualizer

# Webpack 包分析
npx webpack-bundle-analyzer stats.json

# 检查未使用的依赖
npx depcheck

# 检查重复依赖
npm dedupe --dry-run
```
