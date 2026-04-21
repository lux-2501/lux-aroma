# 芳序

`芳序` 现在被整理成了一个标准静态站仓库，适合直接部署到 GitHub Pages，也更方便后续继续维护。

## 目录结构

- `index.html`: 页面骨架、SEO 元信息和资源引入
- `assets/css/styles.css`: 全站样式
- `assets/js/data.js`: 精油资料和七则配方数据
- `assets/js/app.js`: 页面交互、深链、状态持久化和无障碍行为
- `.nojekyll`: 让 GitHub Pages 直接按静态文件发布

## 当前能力

- GitHub Pages 友好的首页入口
- 当前配方的深链定位，例如 `#formula-03`
- `localStorage` 状态记忆，刷新后保留已调整的滴数
- 更完整的 `tablist` / `tabpanel` 语义
- 移动端当前项自动滚动到可视区
- 剪贴板 API 不可用时的手动抄录 fallback

## 维护方式

- 改文案或配方：编辑 `assets/js/data.js`
- 改版式和视觉：编辑 `assets/css/styles.css`
- 改交互逻辑：编辑 `assets/js/app.js`
- GitHub Pages 会直接发布仓库根目录下的 `index.html`

## 本地预览

直接打开 `index.html` 即可，或者在仓库根目录起一个简单静态服务器。

## 发布到 GitHub Pages

1. 把这个目录作为仓库根目录推送到 GitHub
2. 在仓库设置中打开 `Pages`
3. 选择 `Deploy from a branch`
4. 选择 `main` 分支和 `/ (root)` 目录

发布完成后，站点会出现在：

`https://<你的 GitHub 用户名>.github.io/<仓库名>/`

## 下一步建议

- 增加封面图和社交分享预览图
- 加一个“复制当前链接”按钮
- 给每种精油补充气味角色与替代关系说明
- 增加自定义域名和 favicon
