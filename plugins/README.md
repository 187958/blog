# 本地插件维护说明

本博客的两个自研组件，以 Quartz v5 本地插件形式实现。代码随仓库提交，GitHub Actions 部署时会自动加载，无需额外配置。

## 目录结构

```
plugins/
├── article-list/          # 首页文章卡片列表（带前端分页）
│   ├── package.json       # 插件清单（quartz 字段声明组件入口）
│   └── dist/
│       ├── index.js
│       └── components/
│           ├── index.js
│           └── ArticleList.js   # 组件本体（渲染 + 样式 + 交互脚本）
└── blog-calendar/         # 右栏日历（按日期检索）
    ├── package.json
    └── dist/
        ├── index.js
        └── components/
            ├── index.js
            └── BlogCalendar.js  # 组件本体
```

`quartz.config.yaml` 中通过本地路径注册：

```yaml
plugins:
  - source: ./plugins/article-list
    enabled: true
    layout:
      position: beforeBody   # 首页正文区域（仅首页有文章内容）
      priority: 40
  - source: ./plugins/blog-calendar
    enabled: true
    layout:
      position: right
      priority: 25
      display: desktop-only  # 移动端自动隐藏
```

## 常见调整

### 修改每页文章数

编辑 `plugins/article-list/dist/components/ArticleList.js`，有两处要同步改（一处是构建时 SSR，一处是浏览器端脚本）：

```js
const POSTS_PER_PAGE = 10   // 文件顶部
var PER_PAGE = 10           // 内嵌 inline 脚本里（搜 PER_PAGE）
```

### 修改卡片/日历样式

组件的 CSS 以字符串形式写在各自的组件文件里（`ArticleList.js` / `BlogCalendar.js` 中的 `css` 定义），改完重新构建即可生效。

### 修改公式背景

- 底纹图案：`quartz/static/formula-bg-light.svg`（浅色）、`formula-bg-dark.svg`（暗色），直接编辑 SVG 里的文本内容和 `fill-opacity`
- 引用方式：`quartz/styles/custom.scss` 中的 `body { background-image: ... }`

### 修改日历/列表行为

两个组件通过自定义事件通信：

- `blog-calendar-select`：日历点击日期 → 列表筛选
- `blog-list-filter-changed`：列表筛选状态 → 日历高亮同步

改交互逻辑时搜索这两个事件名即可定位。

## 换电脑 / 重新克隆后的环境配置

1. 安装 Node ≥ 22（`node -v` 确认）
2. `npm install`（Windows 上用 `npm.cmd install` 或确保终端能找到 npm）
3. `npx quartz plugin install`
4. **Windows 特有**：如果上一步报 `EPERM` 符号链接权限错误，用管理员终端或开发者模式执行目录联接：

   ```cmd
   mklink /J .quartz\plugins\article-list plugins\article-list
   mklink /J .quartz\plugins\blog-calendar plugins\blog-calendar
   ```

   （macOS / Linux / CI 环境无此问题，符号链接会自动创建）

5. `npx quartz build` 验证；本地预览 `npm run dev`（端口 7100）

## 注意事项

- **不要**把这两个插件挪进 `.quartz/plugins/` 下修改——那是缓存目录，会被 `plugin install` 重建
- 修改插件后必须重新 `npx quartz build` 才会生效
- 文章卡片的摘要由 Quartz 自动截取正文生成，会带出 LaTeX 源码；在文章 front-matter 加 `description: 自定义摘要` 可覆盖
- 组件是手写 ESM，不依赖 tsup/sass 等构建工具，CI 环境只需 `npm ci` + `npx quartz plugin install` 即可构建
