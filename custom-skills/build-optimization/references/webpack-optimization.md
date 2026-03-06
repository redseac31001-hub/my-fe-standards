# Webpack Optimization

Use this reference when the project is on Webpack or when the bottleneck is chunking strategy, persistent cache usage, or duplicate vendor code.

## SplitChunks Baseline

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
          reuseExistingChunk: true,
        },
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
  },
};
```

## Filesystem Cache

```javascript
module.exports = {
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },
};
```

Use this when repeated local or CI builds are unnecessarily recompiling unchanged modules.

## What To Watch

- Too many tiny chunks can hurt runtime performance.
- Shared cache groups should reflect real dependency boundaries, not guesses.
- Measure rebuild speed separately from cold build speed.
- If Module Federation or custom loaders are involved, validate cache safety after every change.
