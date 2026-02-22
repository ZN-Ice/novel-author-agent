# 网络小说创作Agent系统

一个基于智谱 GLM-4.7 模型的网络小说创作辅助系统，包含**小说作者**和**小说网站编辑**两个AI角色。

## 功能特性

### 小说作者Agent
- 从知轩藏书网站自动搜索和下载经典小说
- 智能章节拆分和解析
- 分析小说大纲结构和写作风格
- **智能大纲创作** - 输入描述，自动匹配参考小说并创作大纲
- 参考学习经典作品
- 创作和优化小说大纲
- 创作和优化具体章节

### 小说网站编辑Agent
- 评价小说大纲（6个维度评分）
- 评价章节内容（6个维度评分）
- 给出具体优点和改进建议

### 工程管理
- 经典小说独立存储（`classic_novels/{序号_小说名}/`）
- 每本创作书籍独立工作目录（`workspaces/{序号_时间戳_小说名}/`）
- 序号作为主键，方便操作
- 进展记录和历史查询
- 完整的日志系统

## 安装

```bash
# 克隆项目
git clone https://github.com/ZN-Ice/novel-author-agent.git
cd novel-author-agent

# 安装依赖
npm install

# 复制环境变量配置
cp .env.example .env

# 编辑 .env 文件，配置 GLM API Key
```

## 配置

在 `.env` 文件中配置以下环境变量：

```bash
# GLM API 配置（必填）
GLM_API_KEY=your_glm_api_key_here
GLM_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4

# 爬虫配置（可选）
SCRAPER_DELAY=2000
SCRAPER_TIMEOUT=30000
SCRAPER_HEADLESS=true

# 日志配置（可选）
LOG_LEVEL=info
LOG_DIR=./logs
```

## 使用方法

### 经典小说管理

```bash
# 搜索小说
node src/index.js search 诡秘之主

# 搜索并下载（精确匹配时自动下载）
node src/index.js search-download 第一序列 --auto

# 下载指定书籍（通过书籍ID）
node src/index.js download 6174

# 列出已下载的经典小说
node src/index.js classics

# 删除经典小说（按序号）
node src/index.js delete-classic 1

# 重建经典小说索引
node src/index.js rebuild-classics-index
```

### 工作空间管理

```bash
# 列出所有工作空间
node src/index.js list

# 查看书籍详情（按序号）
node src/index.js info 1

# 查看进展
node src/index.js progress 1

# 删除工作空间
node src/index.js clean 1

# 重建工作空间索引
node src/index.js rebuild-index
```

### 智能大纲创作（推荐）

```bash
# 输入描述，自动匹配参考小说并创作大纲
node src/index.js outline smart "我想写一本无限流的小说"

# 指定小说名称
node src/index.js outline smart "都市异能，主角觉醒超能力" --title 我的小说

# 禁止自动下载参考小说
node src/index.js outline smart "玄幻小说" --no-auto-download
```

### 传统创作流程

```bash
# 1. 分析已下载的小说
node src/index.js analyze 1

# 2. 创作大纲
node src/index.js outline create 1 --genre 玄幻

# 3. 评价大纲
node src/index.js outline review 1

# 4. 优化大纲（根据编辑反馈）
node src/index.js outline optimize 1

# 5. 创作章节
node src/index.js chapter write 1 1

# 6. 评价章节
node src/index.js chapter review 1 1
```

## 目录结构

```
novel-author-agent/
├── config/                 # 配置文件
├── src/
│   ├── index.js            # CLI入口
│   ├── llm/                # GLM-4.7 API封装
│   ├── agents/             # AI Agent实现
│   │   ├── author-agent.js # 小说作者Agent
│   │   └── editor-agent.js # 小说编辑Agent
│   ├── scraper/            # 网页爬取模块
│   │   ├── search.js       # 小说搜索
│   │   ├── downloader.js   # 文件下载
│   │   └── classic-novels.js # 经典小说管理
│   ├── parser/             # 小说解析模块
│   ├── workspace/          # 工作目录管理
│   │   ├── manager.js      # 目录管理
│   │   ├── progress.js     # 进展记录
│   │   └── novel-index.js  # 小说分类索引
│   ├── utils/              # 工具函数
│   └── cli/                # CLI命令处理
├── classic_novels/         # 经典小说存储
│   ├── .index.json         # 索引文件
│   └── {序号_小说名}/
│       ├── novel.txt       # 小说原文
│       ├── meta.json       # 元信息
│       ├── chapters/       # 章节拆分
│       └── analysis/       # 分析结果
├── workspaces/             # 创作工作目录
│   ├── .index.json         # 索引文件
│   └── {序号_时间戳_小说名}/
│       ├── meta.json       # 书籍元信息
│       ├── progress.json   # 进展记录
│       ├── source/         # 原始下载
│       ├── analysis/       # 分析结果
│       ├── outline/        # 大纲
│       │   ├── draft/      # 草稿
│       │   └── final/      # 最终版
│       └── chapters/       # 章节
│           ├── draft/      # 草稿
│           └── final/      # 最终版
└── logs/                   # 日志目录
```

## 命令列表

| 命令 | 说明 |
|------|------|
| `crawl [page]` | 爬取排行榜 |
| `search <keyword>` | 按书名搜索小说 |
| `search-download <keyword>` | 搜索并下载小说 |
| `download <bookId>` | 下载指定书籍 |
| `download-top <count>` | 下载排行榜前N本书 |
| `classics` | 列出已下载的经典小说 |
| `delete-classic <seq>` | 删除经典小说 |
| `rebuild-classics-index` | 重建经典小说索引 |
| `list` | 列出所有工作空间 |
| `info <bookId>` | 查看书籍详情 |
| `progress <bookId>` | 查看进展 |
| `clean <bookId>` | 删除工作空间 |
| `rebuild-index` | 重建工作空间索引 |
| `analyze <bookId>` | 分析小说 |
| `outline smart <desc>` | 智能大纲创作 |
| `outline create <bookId>` | 创作大纲 |
| `outline review <bookId>` | 评价大纲 |
| `outline optimize <bookId>` | 优化大纲 |
| `chapter write <bookId> <num>` | 创作章节 |
| `chapter review <bookId> <num>` | 评价章节 |
| `sync` | 手动同步数据到阿里云盘 |
| `sync-status` | 查看云盘同步状态 |
| `download-cloud` | 从阿里云盘下载数据到本地 |

## 阿里云盘同步

本系统支持将数据自动同步到阿里云盘，使用 [aliyunpan](https://github.com/tickstep/aliyunpan) CLI 工具。

### 安装 aliyunpan

```bash
# Windows (winget)
winget install tickstep.aliyunpan --silent

# macOS (brew)
brew install aliyunpan

# Linux
wget https://github.com/tickstep/aliyunpan/releases/download/v0.3.7/aliyunpan-v0.3.7-linux-amd64.zip
unzip aliyunpan-v0.3.7-linux-amd64.zip
cd aliyunpan-v0.3.7-linux-amd64
./aliyunpan
```

### 登录阿里云盘

```bash
aliyunpan login
# 在浏览器中完成授权和扫码登录
```

### 自动同步

以下操作完成后会自动同步到阿里云盘的 `/novel-author-agent/` 目录：
- 下载经典小说 (`download`)
- 智能大纲创作 (`outline smart`)
- 删除工作空间 (`clean`)
- 删除经典小说 (`delete-classic`)

### 手动同步

```bash
# 手动同步所有数据到云盘
node src/index.js sync

# 从云盘下载数据到本地（恢复数据）
node src/index.js download-cloud

# 查看同步状态
node src/index.js sync-status
```

### 云盘目录结构

```
novel-author-agent/
├── classic_novels/  # 经典小说
└── workspaces/      # 工作空间
```

> **注意**: 如果 aliyunpan CLI 工具未安装或未登录，同步会跳过但不会影响主流程。

## 评价维度

### 大纲评价
| 维度 | 说明 |
|------|------|
| plot | 情节设计 - 故事是否引人入胜 |
| character | 人物塑造 - 角色是否立体 |
| worldbuilding | 世界观 - 设定是否完整 |
| structure | 结构完整 - 起承转合是否合理 |
| creativity | 创新程度 - 是否有新意 |
| feasibility | 可执行性 - 大纲是否清晰可执行 |

### 章节评价
| 维度 | 说明 |
|------|------|
| plot | 情节推进 - 节奏是否恰当 |
| character | 人物表现 - 对话是否自然 |
| writing | 文笔表达 - 语言是否流畅 |
| atmosphere | 氛围营造 - 场景氛围是否到位 |
| suspense | 悬念设置 - 是否吸引读者 |
| readability | 读者体验 - 是否容易阅读 |

## 技术栈

- Node.js 18+
- Puppeteer - 网页爬取
- Cheerio - HTML解析
- Winston - 日志系统
- Commander - CLI框架
- 智谱 GLM-4.7 - AI模型

## 注意事项

1. **API Key**: 使用前必须配置 GLM API Key
2. **网络**: 部分网站可能需要代理访问
3. **频率限制**: API调用有频率限制，请合理使用
4. **大文件下载**: 支持流式下载，超时时间10分钟
5. **版权**: 下载的小说仅供学习参考，请勿用于商业用途

## License

MIT
