# Notion 笔记集成 — 开发记录

## 2026-05-09

### 需求
在个人网站笔记模块接入 Notion，实现：输入 Notion 链接 → 自动拉取内容 → 网站展示。

### 实现内容

#### 1. 后端 (server.mjs)
- 新增 `NOTION_API_KEY` 环境变量
- 新增 Notion API 代理：提取 page_id、拉取页面、转换 blocks 为 HTML
- 支持的 Notion 块类型：heading、paragraph、quote、callout、code、image、bookmark、list、todo、divider
- 文章存储在 `/var/lib/berlin2003-ai/notion-articles.json`
- API 接口：
  - `POST /api/notion/import` — 导入（需登录）
  - `GET /api/notion/articles` — 列表（公开，`?public=true` 筛选）
  - `GET /api/notion/articles/:id` — 详情（公开）
  - `DELETE /api/notion/articles/:id` — 删除（需登录）

#### 2. Caddy 路由
在 `/etc/caddy/sites-enabled/personal-site.caddy` 新增：
- `/api/notion/articles*` — 公开反向代理到 8787
- `/api/notion/*` — basicauth + 反向代理到 8787

#### 3. 前端页面
- `/notes/` — 使用 section-lab 风格（统一后的 berlin2003-site 版本），原有设计保留，Notion 文章以 section-lab-panel 卡片展示在静态内容下方
- `/notes/article/?id=xxx` — 文章详情页，居中大标题（2.4rem），无 Notion 原文链接
- `/studio/notion/` — 后台导入页，表单：Notion 链接 + 分类 + 是否公开 + 导入按钮
- `/studio/` — 新增 "Notion 笔记导入" 入口链接

#### 4. 部署信息
- 服务器：ubuntu@163.192.5.251:22，密钥 `C:\Users\lenovo\ssh\ssh-key-2026-04-14.key`
- 部署流程：scp 上传到 /tmp → ssh sudo cp 到目标位置 → chown www-data
- 环境变量：`/etc/berlin2003-ai.env`，已添加 `NOTION_API_KEY`
- 服务：`berlin2003-ai.service`，重启命令 `sudo systemctl restart berlin2003-ai`

#### 5. Notion Integration
- Notion API Key 配置在 `/etc/berlin2003-ai.env`
- 每个要导入的 Notion 页面需要手动连接 Integration（... → Connections）

### 踩坑记录
- Caddy 必须配置 `/api/notion/*` 路由，否则请求会被文件服务器吃掉返回 404
- sed 修改 Caddyfile 会破坏格式，应该先下载本地编辑再上传
- Notion API 返回 404 通常是页面没有 share 给 Integration
- notes 页面不能用 edition-body 风格，要用 section-lab 风格
- 文章详情页不要用 section-lab-copy 包裹标题，padding 会限宽
- 标题区域要用 grid-template-columns:1fr 单栏布局
- 不要暴露 Notion 原文链接给外部访客

## 2026-05-10

### 需求
将 Notion 文章分类从扁平三层（论文笔记/项目笔记/技术总结）改为模块化两级结构，与前端页面对应。

### 新分类结构
- **项目** — 无子分类，文章展示在 `/projects/` 页面
- **笔记** — 4 个子分类，文章展示在 `/notes/` 页面对应区域
  - 论文阅读
  - 模型判断
  - 部署记录
  - 页面改版

### 实现内容

#### 1. 后端 (server.mjs)
- `CATEGORIES` → `MODULE_MAP`，包含模块和子分类映射
- 文章对象新增 `module` 字段，`category` 改为子分类（项目文章为 null）
- 新增 `normalizeArticle()` 用于旧数据兼容
- 导入接口接收 `module` + `category`，验证模块和子分类合法性
- 列表接口新增 `?module=` 过滤参数
- 文章详情接口返回包含 `module` 字段

#### 2. 导入表单 (studio/notion/)
- 新增模块选择器（项目/笔记）
- 选择笔记时显示子分类下拉框，选择项目时隐藏
- 提交时发送 `module` + `category`

#### 3. 笔记页 (/notes/)
- 底部 4 个子分类容器替换原统一容器
- notes-feed.js 按 `module=笔记` 拉取，分发到对应子分类区块

#### 4. 项目页 (/projects/)
- 新增动态文章展示区域
- 新增 projects-feed.js，按 `module=项目` 拉取公开文章

#### 5. 文章详情页
- 分类标签改为「模块 · 子分类」格式
