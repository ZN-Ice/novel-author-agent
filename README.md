# 网络小说创作Agent系统

一个基于智谱 GLM-5 模型的网络小说创作辅助系统，包含**小说作者**和**小说网站编辑**两个AI角色。

## 功能特性

### 小说作者Agent
- 从知轩藏书网站自动下载经典小说
- 智能章节拆分和解析
- 分析小说大纲结构和写作风格
- 参考学习经典作品
- 创作和优化小说大纲
- 创作和优化具体章节

### 小说网站编辑Agent
- 评价小说大纲（6个维度评分）
- 评价章节内容（6个维度评分）
- 给出具体优点和改进建议

### 工程管理
- 每本书独立工作目录
- 进展记录和历史查询
- 完整的日志系统

## 安装

```bash
# 克隆项目
git clone https://github.com/yourusername/novel-author-agent.git
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
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4

# 爬虫配置（可选）
SCRAPER_DELAY=2000
SCRAPER_TIMEOUT=30000
SCRAPER_HEADLESS=true

# 日志配置（可选）
LOG_LEVEL=info
LOG_DIR=./logs
```

## 使用方法

### 基本命令

```bash
# 查看帮助
node src/index.js --help

# 爬取排行榜（第1页）
node src/index.js crawl 1

# 下载指定书籍（通过书籍ID）
node src/index.js download 6174

# 下载排行榜前5本书
node src/index.js download-top 5

# 列出所有书籍
node src/index.js list

# 查看书籍详情
node src/index.js info <book-id>

# 查看进展
node src/index.js progress <book-id>
```

### 小说分析和创作流程

```bash
# 1. 分析已下载的小说
node src/index.js analyze <book-id>

# 2. 创作大纲
node src/index.js outline create <book-id> --genre 玄幻

# 3. 评价大纲
node src/index.js outline review <book-id>

# 4. 优化大纲（根据编辑反馈）
node src/index.js outline optimize <book-id>

# 5. 创作章节
node src/index.js chapter write <book-id> 1

# 6. 评价章节
node src/index.js chapter review <book-id> 1
```

## 目录结构

```
novel-author-agent/
├── config/                 # 配置文件
├── src/
│   ├── index.js            # CLI入口
│   ├── llm/                # GLM-5 API封装
│   ├── agents/             # AI Agent实现
│   │   ├── author-agent.js # 小说作者Agent
│   │   └── editor-agent.js # 小说编辑Agent
│   ├── scraper/            # 网页爬取模块
│   ├── parser/             # 小说解析模块
│   ├── workspace/          # 工作目录管理
│   ├── utils/              # 工具函数
│   └── cli/                # CLI命令处理
├── workspaces/             # 书籍工作目录
│   └── {book-id}/
│       ├── meta.json       # 书籍元信息
│       ├── progress.json   # 进展记录
│       ├── source/         # 原始下载
│       ├── analysis/       # 分析结果
│       ├── outline/        # 大纲
│       └── chapters/       # 章节
└── logs/                   # 日志目录
```

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
- 智谱 GLM-5 - AI模型

## 注意事项

1. **API Key**: 使用前必须配置 GLM API Key
2. **网络**: 部分网站可能需要代理访问
3. **频率限制**: API调用有频率限制，请合理使用
4. **版权**: 下载的小说仅供学习参考，请勿用于商业用途

## License

MIT
