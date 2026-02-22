# Novel Author Agent

网络小说创作Agent系统，使用智谱GLM-4.7模型辅助小说创作。

## 功能概述

本系统包含两个AI角色：
- **小说作者Agent**：下载经典小说、分析大纲和风格、创作和优化小说
- **小说网站编辑Agent**：评价大纲和章节、给出评分和改进建议

## 环境要求

- Node.js 18+
- 智谱GLM API Key

## 安装配置

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置 GLM_API_KEY
```

## 目录结构

```
novel-author-agent/
├── src/index.js              # CLI入口
├── classic_novels/           # 经典小说存储目录
├── workspaces/               # 书籍工作目录
│   └── {book-id}/
│       ├── meta.json         # 书籍元信息
│       ├── progress.json     # 进展记录
│       ├── source/           # 原始文件
│       ├── analysis/         # 分析结果
│       ├── outline/          # 大纲
│       └── chapters/         # 章节
└── logs/                     # 日志目录
```

## CLI命令

### 基础命令

```bash
# 爬取排行榜
node src/index.js crawl [page]

# 下载指定书籍（存放到 classic_novels 目录）
node src/index.js download <book-id>

# 下载排行榜前N本书
node src/index.js download-top <count>

# 列出已下载的经典小说
node src/index.js classics

# 列出工作目录中的书籍
node src/index.js list

# 查看书籍详情
node src/index.js info <book-id>

# 查看进展记录
node src/index.js progress <book-id>
```

### 分析和创作命令

```bash
# 分析小说（大纲+风格）
node src/index.js analyze <book-id>

# 创作大纲
node src/index.js outline create <book-id> --genre <类型> --theme <主题>

# 评价大纲
node src/index.js outline review <book-id>

# 优化大纲
node src/index.js outline optimize <book-id>

# 创作章节
node src/index.js chapter write <book-id> <章节号> --title <标题>

# 评价章节
node src/index.js chapter review <book-id> <章节号>

# 清理工作目录
node src/index.js clean <book-id>
```

## 典型工作流程

### 1. 学习经典小说

```bash
# 爬取排行榜找到感兴趣的书籍
node src/index.js crawl 1

# 下载经典小说（如《诡秘之主》ID: 6174）
node src/index.js download 6174

# 创建工作目录并分析
node src/index.js analyze <book-id>
```

### 2. 创作新小说

```bash
# 创作大纲
node src/index.js outline create <book-id> --genre 玄幻 --theme "少年逆袭"

# 评价大纲
node src/index.js outline review <book-id>

# 根据反馈优化
node src/index.js outline optimize <book-id>

# 创作章节
node src/index.js chapter write <book-id> 1

# 评价章节
node src/index.js chapter review <book-id> 1
```

## 评价维度

### 大纲评价（6维度）
| 维度 | 说明 |
|------|------|
| plot | 情节设计 |
| character | 人物塑造 |
| worldbuilding | 世界观设定 |
| structure | 结构完整性 |
| creativity | 创新程度 |
| feasibility | 可执行性 |

### 章节评价（6维度）
| 维度 | 说明 |
|------|------|
| plot | 情节推进 |
| character | 人物表现 |
| writing | 文笔表达 |
| atmosphere | 氛围营造 |
| suspense | 悬念设置 |
| readability | 读者体验 |

## 完整性检查

下载小说时会自动进行完整性检查：

1. **脚本检查**
   - 章节数量（>=10章）
   - 字数验证
   - 文件大小

2. **LLM检查**
   - 开头内容分析
   - 结尾内容分析
   - 章节标题验证

如果文件已存在且完整，会跳过下载。

## 配置说明

### 环境变量

```bash
# GLM API配置（必填）
GLM_API_KEY=your_api_key
GLM_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4

# 爬虫配置（可选）
SCRAPER_DELAY=2000
SCRAPER_TIMEOUT=30000

# 日志配置（可选）
LOG_LEVEL=info
```

### 模型配置

默认使用 `glm-4.7` 模型，可在 `config/index.js` 中修改。

## API参考

### 作为模块使用

```javascript
import { getAuthorAgent } from './src/agents/author-agent.js';
import { getEditorAgent } from './src/agents/editor-agent.js';

const author = getAuthorAgent();
const editor = getEditorAgent();

// 分析小说大纲
const outlineResult = await author.analyzeOutline(novelData);

// 创作大纲
const createResult = await author.createOutline({
  genre: '玄幻',
  theme: '少年逆袭',
});

// 评价大纲
const reviewResult = await editor.reviewOutline(outline);

// 创作章节
const chapterResult = await author.writeChapter({
  outline,
  chapterNumber: 1,
  chapterTitle: '第一章 开端',
});
```

### 经典小说管理

```javascript
import {
  checkNovelIntegrity,
  listClassicNovels,
  getNovelPath,
} from './src/scraper/classic-novels.js';

// 检查小说完整性
const checkResult = await checkNovelIntegrity(bookInfo, true);

// 列出已下载的小说
const novels = await listClassicNovels();

// 获取小说路径
const path = getNovelPath(bookInfo);
```

## 注意事项

1. **API限制**：GLM API有调用频率限制，批量操作时会自动延迟
2. **网络要求**：部分网站可能需要代理访问
3. **内容合规**：生成内容仅供学习参考，请勿用于商业用途
4. **存储管理**：`classic_novels/` 和 `workspaces/` 目录会占用磁盘空间

## 故障排查

### 查看日志
```bash
# 日志目录
ls logs/

# 查看最新日志
tail -f logs/combined-*.log
```

### 常见问题

1. **GLM API余额不足**
   - 检查智谱账户余额
   - 确认使用正确的API地址：`/api/coding/paas/v4`

2. **下载超时**
   - 检查网络连接
   - 增加 `SCRAPER_TIMEOUT` 值

3. **章节解析不准确**
   - 小说格式可能不标准
   - 查看 `analysis/parsed.json` 了解解析结果
