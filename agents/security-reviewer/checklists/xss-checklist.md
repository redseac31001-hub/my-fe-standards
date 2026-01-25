# XSS 漏洞检测清单

## DOM XSS 检测

### 危险 Sink（输出点）

- [ ] `element.innerHTML = ...`
- [ ] `element.outerHTML = ...`
- [ ] `document.write(...)`
- [ ] `document.writeln(...)`
- [ ] `element.insertAdjacentHTML(...)`
- [ ] `eval(...)`
- [ ] `new Function(...)`
- [ ] `setTimeout(string, ...)`
- [ ] `setInterval(string, ...)`
- [ ] `location.href = ...`
- [ ] `location.assign(...)`
- [ ] `location.replace(...)`

### Vue 特定检测

- [ ] `v-html` 指令绑定用户输入
- [ ] 动态组件 `:is` 绑定用户输入
- [ ] `$el.innerHTML` 直接操作
- [ ] 模板字符串拼接 HTML

### React 特定检测

- [ ] `dangerouslySetInnerHTML` 使用
- [ ] `ref.current.innerHTML` 操作
- [ ] URL 参数直接渲染

## 危险 Source（输入点）

- [ ] `location.search`
- [ ] `location.hash`
- [ ] `location.href`
- [ ] `document.referrer`
- [ ] `document.cookie`
- [ ] `window.name`
- [ ] `postMessage` 数据
- [ ] URL 参数
- [ ] 表单输入
- [ ] localStorage/sessionStorage

## 修复方案

### 方案 1：使用安全 API

```javascript
// ❌ 不安全
element.innerHTML = userInput;

// ✅ 安全
element.textContent = userInput;
```

### 方案 2：使用 DOMPurify

```javascript
import DOMPurify from 'dompurify';

// 净化 HTML
const clean = DOMPurify.sanitize(dirty);
element.innerHTML = clean;
```

### 方案 3：白名单过滤

```javascript
const allowedTags = ['p', 'b', 'i', 'em', 'strong'];
const sanitized = sanitizeHtml(userInput, { allowedTags });
```

## 检测命令

```bash
# 搜索 innerHTML 使用
grep -rn "innerHTML\s*=" --include="*.vue" --include="*.ts" --include="*.tsx"

# 搜索 v-html 使用
grep -rn "v-html" --include="*.vue"

# 搜索 eval 使用
grep -rn "eval\s*(" --include="*.ts" --include="*.js"

# 搜索 dangerouslySetInnerHTML
grep -rn "dangerouslySetInnerHTML" --include="*.tsx" --include="*.jsx"
```
