# 网络小说创作Agent系统 - 实现计划

## 需求重述

### 系统角色
1. **小说作者Agent**：
   - **自动下载**: 从 https://zxcs.zip/rank/topdownload 搜索和下载经典小说
   - 章节拆分和解析
   - 分析小说大纲结构
   - 参考学习经典作品
   - 创作和优化小说大纲
   - 创作和优化具体章节

2. **小说网站编辑Agent**：
   - 评价小说大纲
   - 评价章节内容
   - 给出量化评分
   - 指出优点和改进意见

### 工程结构需求
- 每本书有独立工作目录
- 支持命令查看工作目录
- 进展记录存储
- 历史进展查看
- 日志系统用于问题定位

### 技术要求
- JavaScript/Node.js 工程
- 使用智谱 GLM-5 模型

---

## 网站分析结果

### 目标网站结构

```
排行榜页面: https://zxcs.zip/rank/topdownload
├── 分页: ?page=1, ?page=2, ...
├── 书籍链接: /book/{id}.html
│
书籍详情页: https://zxcs.zip/book/{id}.html
├── 元信息: 书名、作者、字数、分类、标签、简介
├── 评价: 仙草/粮草/干草/枯草/毒草 投票数
└── 下载链接: https://download.zxcs.zip/{书名}.txt
```

### 下载示例
```
排行榜: https://zxcs.zip/rank/topdownload
  └── 凡人修仙传: /book/1064.html
        └── 下载: https://download.zxcs.zip/《凡人修仙传》....txt
```

---

## 项目结构设计

```
novel-author-agent/
├── package.json
├── .env.example                    # 环境变量模板
├── .gitignore
├── config/
│   └── index.js                    # 配置管理
├── src/
│   ├── index.js                    # CLI入口
│   ├── llm/
│   │   └── glm-client.js           # GLM-5 API封装
│   ├── agents/
│   │   ├── base-agent.js           # Agent基类
│   │   ├── author-agent.js         # 小说作者Agent
│   │   └── editor-agent.js         # 小说编辑Agent
│   ├── scraper/
│   │   ├── browser.js              # 浏览器工具(Puppeteer)
│   │   ├── rank-list.js            # 排行榜爬取
│   │   ├── book-page.js            # 书籍详情页爬取
│   │   └── downloader.js           # 小说文件下载
│   ├── parser/
│   │   ├── chapter-splitter.js     # 章节拆分
│   │   └── novel-parser.js         # 小说解析
│   ├── workspace/
│   │   ├── manager.js              # 工作目录管理
│   │   └── progress.js             # 进展记录
│   ├── utils/
│   │   ├── logger.js               # 日志系统
│   │   ├── file-utils.js           # 文件操作
│   │   └── text-utils.js           # 文本处理
│   └── cli/
│       └── commands.js             # CLI命令
├── workspaces/                     # 书籍工作目录
│   └── {book-id}/
│       ├── meta.json               # 书籍元信息
│       ├── progress.json           # 进展记录
│       ├── source/                 # 原始下载
│       │   └── original.txt
│       ├── analysis/               # 分析结果
│       │   ├── outline.json        # 大纲分析
│       │   └── style.json          # 风格分析
│       ├── outline/                # 大纲
│       │   ├── draft/              # 草稿
│       │   └── final/              # 最终版
│       └── chapters/               # 章节
│           ├── draft/              # 草稿
│           └── final/              # 最终版
└── logs/                           # 日志目录
```

---

## 实现阶段

### Phase 1: 项目初始化 [复杂度: 低]

**目标**: 搭建项目骨架和基础工具

**步骤**:
1. 初始化 Node.js 项目
2. 安装依赖:
   - `puppeteer` - 浏览器自动化（处理SPA页面）
   - `axios` - HTTP请求
   - `cheerio` - HTML解析
   - `commander` - CLI框架
   - `chalk` - 终端美化输出
   - `winston` - 日志系统
   - `uuid` - 唯一ID生成
   - `iconv-lite` - 编码转换
   - `dotenv` - 环境变量
3. 创建目录结构
4. 实现日志系统 (`src/utils/logger.js`)
5. 实现配置管理 (`config/index.js`)

**交付物**:
- 可运行的 Node.js 项目
- 日志系统可用

---

### Phase 2: 网页爬取模块 [复杂度: 中]

**目标**: 实现从知轩藏书网站自动搜索和下载小说

**步骤**:
1. **浏览器工具** (`src/scraper/browser.js`)
   - Puppeteer封装
   - 处理SPA页面渲染
   - 请求延迟和重试

2. **排行榜爬取** (`src/scraper/rank-list.js`)
   - 获取下载排行榜列表
   - 支持分页
   - 提取书籍ID、标题、作者、下载量

3. **书籍详情页** (`src/scraper/book-page.js`)
   - 解析书籍元信息
   - 提取下载链接
   - 获取评价数据

4. **文件下载** (`src/scraper/downloader.js`)
   - 下载TXT文件
   - 处理文件名编码
   - 进度显示

**数据结构**:
```javascript
// 排行榜书籍信息
{
  id: '6174',
  title: '诡秘之主',
  author: '爱潜水的乌贼',
  downloads: 52872,
  url: '/book/6174.html'
}

// 书籍详情
{
  id: '6174',
  title: '诡秘之主',
  author: '爱潜水的乌贼',
  wordCount: '446.53万',
  status: '完本',
  category: '玄幻',
  tags: ['网络小说'],
  summary: '...',
  votes: { xiancao: 5458, liangcao: 220, ... },
  downloadUrl: 'https://download.zxcs.zip/...'
}
```

**交付物**:
- 可爬取排行榜列表
- 可获取书籍详情
- 可下载小说文件

---

### Phase 3: 小说解析模块 [复杂度: 中]

**目标**: 解析下载的小说，拆分章节

**步骤**:
1. **章节拆分** (`src/parser/chapter-splitter.js`)
   - 识别章节标题模式:
     - `第X章 标题`
     - `第X节 标题`
     - `Chapter X`
     - 自定义正则
   - 提取章节内容
   - 处理异常格式

2. **小说解析** (`src/parser/novel-parser.js`)
   - 解析整体结构
   - 统计信息（章节数、字数）
   - 生成结构化数据

**章节模式识别**:
```javascript
const CHAPTER_PATTERNS = [
  /^第[零一二三四五六七八九十百千万]+章\s+.+$/,    // 第一章 标题
  /^第\d+章\s+.+$/,                               // 第1章 标题
  /^Chapter\s+\d+.+$/i,                          // Chapter 1
  /^【第.+章】.+$/,                               // 【第一章】标题
];
```

**交付物**:
- 章节自动拆分
- 结构化输出

---

### Phase 4: 工作目录管理 [复杂度: 低]

**目标**: 管理每本书的独立工作目录和进展记录

**步骤**:
1. **工作目录管理** (`src/workspace/manager.js`)
   - 创建书籍目录
   - 管理目录结构
   - 书籍元信息存储

2. **进展记录** (`src/workspace/progress.js`)
   - 记录每个阶段的进展
   - 时间戳追踪
   - 历史查询

**元信息结构** (`meta.json`):
```json
{
  "id": "uuid-xxx",
  "sourceId": "6174",
  "title": "诡秘之主",
  "author": "爱潜水的乌贼",
  "category": "玄幻",
  "wordCount": "446.53万",
  "source": {
    "url": "https://zxcs.zip/book/6174.html",
    "downloadUrl": "https://download.zxcs.zip/..."
  },
  "status": "analyzing",
  "createdAt": "2026-02-19T12:00:00Z",
  "updatedAt": "2026-02-19T14:00:00Z"
}
```

**进展记录结构** (`progress.json`):
```json
{
  "bookId": "uuid-xxx",
  "history": [
    {
      "timestamp": "2026-02-19T12:00:00Z",
      "phase": "download",
      "action": "下载原始文件",
      "status": "completed",
      "details": { "fileSize": "9.15MB" }
    },
    {
      "timestamp": "2026-02-19T12:30:00Z",
      "phase": "analysis",
      "action": "分析大纲结构",
      "status": "in_progress",
      "details": { "chapters": 1432 }
    }
  ]
}
```

**交付物**:
- 工作目录创建
- 进展追踪系统

---

### Phase 5: GLM-5 API 集成 [复杂度: 中]

**目标**: 封装智谱 GLM-5 API 调用

**步骤**:
1. **API客户端** (`src/llm/glm-client.js`)
   - API认证
   - 请求封装
   - 流式输出支持
   - 错误处理和重试
   - Token计数

2. **Prompt模板管理**
   - 大纲分析模板
   - 大纲创作模板
   - 章节创作模板
   - 评价模板

**API调用示例**:
```javascript
const glmClient = new GLMClient(process.env.GLM_API_KEY);

const response = await glmClient.chat({
  messages: [
    { role: 'system', content: '你是一个专业的小说编辑...' },
    { role: 'user', content: '请分析以下小说的大纲结构...' }
  ],
  temperature: 0.7,
  maxTokens: 4096
});
```

**交付物**:
- GLM-5 API封装
- Prompt模板

---

### Phase 6: 小说作者Agent [复杂度: 高]

**目标**: 实现小说作者的核心创作功能

**步骤**:
1. **Agent基类** (`src/agents/base-agent.js`)
   - 统一的LLM调用
   - 错误处理
   - 日志记录

2. **大纲分析** (`src/agents/author-agent.js`)
   - 分析参考小说的结构
   - 提取情节节点
   - 识别叙事模式

3. **风格学习**
   - 分析写作风格
   - 提取常用表达
   - 人物对话模式

4. **大纲创作**
   - 根据题材生成大纲
   - 设定人物角色
   - 规划情节发展

5. **大纲优化**
   - 根据编辑反馈修改
   - 完善情节逻辑

6. **章节创作**
   - 根据大纲写章节
   - 保持风格一致性

7. **章节优化**
   - 根据反馈修改
   - 润色文字

**交付物**:
- 完整的小说作者Agent
- 分析和创作流程

---

### Phase 7: 小说编辑Agent [复杂度: 中]

**目标**: 实现小说编辑的评价功能

**步骤**:
1. **评价体系设计**
   - 评分维度定义
   - 评价标准制定

2. **大纲评价** (`src/agents/editor-agent.js`)
   - 结构完整性
   - 情节吸引力
   - 人物设定合理性

3. **章节评价**
   - 内容质量
   - 文笔水平
   - 节奏把控

4. **反馈生成**
   - 具体优点
   - 改进建议
   - 量化评分

**评价维度**:
| 维度 | 权重 | 描述 |
|------|------|------|
| 情节设计 | 25% | 故事是否引人入胜 |
| 人物塑造 | 20% | 角色是否立体 |
| 节奏把控 | 15% | 叙事节奏是否恰当 |
| 文笔表达 | 20% | 语言是否流畅优美 |
| 创新程度 | 10% | 是否有新意 |
| 逻辑自洽 | 10% | 是否前后一致 |

**评价输出**:
```json
{
  "overallScore": 7.8,
  "dimensions": {
    "plot": 8.0,
    "character": 7.5,
    "pacing": 8.0,
    "writing": 7.5,
    "creativity": 8.0,
    "logic": 7.5
  },
  "strengths": [
    "情节设计紧凑，悬念设置合理",
    "人物形象鲜明"
  ],
  "improvements": [
    "建议增加环境描写",
    "部分对话可更加自然"
  ],
  "suggestions": "..."
}
```

**交付物**:
- 小说编辑Agent
- 结构化评价输出

---

### Phase 8: CLI命令行界面 [复杂度: 中]

**目标**: 提供用户友好的命令行交互

**命令设计**:

| 命令 | 描述 |
|------|------|
| `novel crawl [page]` | 爬取排行榜（默认第1页） |
| `novel download <book-id>` | 下载指定书籍 |
| `novel download-top <n>` | 下载排行榜前N本书 |
| `novel list` | 列出所有书籍 |
| `novel info <book-id>` | 查看书籍详情 |
| `novel progress <book-id>` | 查看进展 |
| `novel analyze <book-id>` | 分析参考小说 |
| `novel outline create <book-id>` | 创作大纲 |
| `novel outline review <book-id>` | 编辑评价大纲 |
| `novel outline optimize <book-id>` | 优化大纲 |
| `novel chapter write <book-id> <num>` | 创作章节 |
| `novel chapter review <book-id> <num>` | 评价章节 |
| `novel chapter optimize <book-id> <num>` | 优化章节 |
| `novel logs` | 查看日志 |
| `novel clean <book-id>` | 清理工作目录 |

**使用示例**:
```bash
# 爬取排行榜前2页
node src/index.js crawl 2

# 下载排行榜前5本小说
node src/index.js download-top 5

# 分析《诡秘之主》的大纲
node src/index.js analyze uuid-xxx

# 创作新大纲
node src/index.js outline create uuid-xxx --genre 玄幻

# 查看进展
node src/index.js progress uuid-xxx
```

**交付物**:
- 完整的CLI工具
- 帮助文档

---

## 依赖清单

```json
{
  "name": "novel-author-agent",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "chalk": "^4.1.2",
    "cheerio": "^1.0.0",
    "commander": "^11.0.0",
    "dotenv": "^16.3.0",
    "iconv-lite": "^0.6.3",
    "puppeteer": "^21.0.0",
    "uuid": "^9.0.0",
    "winston": "^3.11.0",
    "winston-daily-rotate-file": "^4.7.1"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

---

## 风险评估

| 风险 | 级别 | 描述 | 缓解措施 |
|------|------|------|----------|
| 网站反爬虫 | 高 | 目标网站可能封禁IP | Puppeteer模拟真人行为、请求延迟、代理支持 |
| 下载链接失效 | 中 | 部分下载链接可能失效 | 错误处理、重试机制、日志记录 |
| GLM-5 API限制 | 中 | API调用频率/Token限制 | 请求队列、分块处理、缓存 |
| 章节格式多样 | 中 | 不同小说章节格式不同 | 多种正则模式、自适应识别 |
| 生成质量不稳定 | 中 | AI生成内容质量波动 | 多轮优化、编辑反馈循环 |
| 内容合规 | 高 | 生成内容需符合规范 | 内容审核机制 |

---

## 实现顺序

```
Phase 1 (项目初始化)
    ↓
Phase 2 (网页爬取) ←→ Phase 3 (小说解析)
    ↓
Phase 4 (工作目录) ←→ Phase 5 (GLM-5集成)
    ↓
Phase 6 (作者Agent) ←→ Phase 7 (编辑Agent)
    ↓
Phase 8 (CLI界面)
```

---

## 环境变量配置

```bash
# .env.example
GLM_API_KEY=your_glm_api_key_here
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4

# 爬虫配置
SCRAPER_DELAY=2000
SCRAPER_TIMEOUT=30000

# 日志级别
LOG_LEVEL=info
```

---

## 等待确认

**请确认是否继续此计划？**

回复选项:
- `yes` 或 `proceed` - 开始实现
- `modify: [修改内容]` - 修改计划
- `skip phase X` - 跳过某阶段
- `questions` - 如有疑问
