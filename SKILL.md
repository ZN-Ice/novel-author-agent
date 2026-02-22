---
name: novel-author
description: 网络小说创作AI助手。用于下载经典小说、分析大纲结构、学习写作风格、创作和优化小说大纲与章节。当用户想要创作小说、分析小说结构、学习写作技巧时使用此技能。
argument-hint: <command> [args]
---

# 网络小说创作Agent

一个基于智谱 GLM-4.7 模型的网络小说创作辅助系统。

## 快速开始

确保已配置 `.env` 文件：
```bash
GLM_API_KEY=your_api_key
GLM_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4
```

## 可用命令

### 爬取和下载

```bash
# 爬取排行榜（第1页）
node src/index.js crawl 1

# 搜索小说（按书名或关键词）
node src/index.js search 诡秘之主
node src/index.js search 第一序列

# 搜索并下载（精确匹配时自动下载）
node src/index.js search-download 第一序列 --auto

# 下载指定书籍（通过书籍ID，自动完成章节拆分和大纲分析）
node src/index.js download 6174

# 下载排行榜前5本书
node src/index.js download-top 5
```

### 经典小说管理

```bash
# 列出已下载的经典小说（显示序号、状态、章节数）
node src/index.js classics

# 删除经典小说（按序号）
node src/index.js delete-classic 1

# 重建经典小说索引
node src/index.js rebuild-classics-index
```

### 工作空间管理

```bash
# 列出所有工作空间（显示序号、小说名、状态）
node src/index.js list

# 查看书籍详情（使用序号）
node src/index.js info 1

# 查看进展记录
node src/index.js progress 1

# 删除工作空间（按序号）
node src/index.js clean 1

# 重建工作空间索引
node src/index.js rebuild-index
```

### 小说分析（需要 GLM API Key）

```bash
# 分析已下载的小说（大纲+风格）
node src/index.js analyze <book-id>
```

### 智能大纲创作（推荐）

```bash
# 输入描述，自动匹配参考小说并创作大纲
node src/index.js outline smart "我想写一本玄幻小说"
node src/index.js outline smart "无限流，主角进入各种副本" --title 我的小说
node src/index.js outline smart "都市异能，主角觉醒超能力"

# 禁止自动下载参考小说
node src/index.js outline smart "玄幻小说" --no-auto-download
```

### 传统大纲创作流程

```bash
# 创作大纲 - 需要先有工作空间
node src/index.js outline create <book-id> --genre 玄幻 --theme "主题描述"

# 评价大纲（编辑给出评分和改进建议）
node src/index.js outline review <book-id>

# 优化大纲
node src/index.js outline optimize <book-id>
```

### 章节创作流程

```bash
# 创作章节
node src/index.js chapter write <book-id> 1

# 评价章节
node src/index.js chapter review <book-id> 1
```

### 云盘同步

```bash
# 查看云盘同步状态
node src/index.js sync-status

# 手动同步所有数据到阿里云盘
node src/index.js sync

# 从阿里云盘下载数据到本地（恢复数据）
node src/index.js download-cloud
```

## 阿里云盘同步

系统支持自动将数据同步到阿里云盘，使用 [aliyunpan](https://github.com/tickstep/aliyunpan) CLI 工具。

### 安装和登录

```bash
# Windows
winget install tickstep.aliyunpan --silent

# 登录
aliyunpan login
```

### 自动同步

以下操作完成后会自动同步到 `/novel-author-agent/` 目录：
- 下载经典小说
- 智能大纲创作
- 删除工作空间
- 删除经典小说

> 如果工具未安装或未登录，同步会跳过但不会影响主流程。

## 典型工作流程

### 推荐流程：智能大纲创作

```
1. node src/index.js search-download 诡秘之主 --auto  # 下载参考小说
2. node src/index.js outline smart "我想写一本克苏鲁风格的玄幻小说" --title 我的小说
3. node src/index.js outline review 1                  # 评价大纲
4. node src/index.js outline optimize 1                # 优化大纲
5. node src/index.js chapter write 1 1                 # 创作第一章
6. node src/index.js chapter review 1 1                # 评价第一章
```

### 搜索和下载小说

```
1. node src/index.js search 第一序列    # 搜索小说
2. node src/index.js search-download 第一序列 --auto  # 搜索并自动下载
3. node src/index.js classics           # 查看已下载的经典小说
```

### 学习已有小说

```
1. node src/index.js crawl 1           # 查看排行榜
2. node src/index.js download 6174     # 下载感兴趣的书籍
3. node src/index.js classics          # 查看下载结果
```

## 序号系统

项目使用序号作为主键管理所有书籍，方便操作：

- **经典小说**: 使用 `classics` 命令查看序号
- **工作空间**: 使用 `list` 命令查看序号

```bash
# 使用序号操作
node src/index.js info 1              # 查看序号为1的工作空间
node src/index.js delete-classic 1    # 删除序号为1的经典小说
node src/index.js clean 1             # 删除序号为1的工作空间
```

## 两个AI角色

### 作者 Agent
- 分析小说大纲结构和写作风格
- 智能匹配参考小说
- 创作大纲和章节内容
- 接受编辑的反馈进行修改

### 编辑 Agent
- 评价大纲和章节质量
- 给出具体的改进建议
- 评分维度：情节、人物、节奏、文笔等

## 目录结构

```
novel-author-agent/
├── classic_novels/              # 经典小说存储
│   ├── .index.json              # 索引文件
│   └── {序号_小说名}/
│       ├── novel.txt            # 小说原文
│       ├── meta.json            # 元信息
│       ├── chapters/            # 章节拆分
│       │   ├── .index.json      # 章节索引
│       │   ├── 0001.txt         # 第一章
│       │   └── ...
│       └── analysis/            # 分析结果
│           ├── outline-analysis.txt
│           └── style-analysis.txt
│
└── workspaces/                  # 创作工作目录
    ├── .index.json              # 索引文件
    └── {序号_时间戳_小说名}/
        ├── meta.json            # 书籍元信息
        ├── progress.json        # 进展记录
        ├── outline/
        │   ├── draft/           # 大纲草稿
        │   └── final/           # 最终大纲
        └── chapters/
            ├── draft/           # 章节草稿
            └── final/           # 最终章节
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

## 常见问题

### Q: 下载超时怎么办？
A: 大文件（>10MB）需要较长时间，系统已设置10分钟超时。如果仍然超时，检查网络连接。

### Q: 如何查看创作进展？
A: 使用 `progress` 命令：
```bash
node src/index.js progress <序号>
```

### Q: 序号显示为"?"怎么办？
A: 运行重建索引命令：
```bash
node src/index.js rebuild-index        # 重建工作空间索引
node src/index.js rebuild-classics-index  # 重建经典小说索引
```

## 注意事项

- 下载的小说仅供学习分析，请勿用于商业用途
- 创作的内容由AI生成，需要人工审核
- 建议先分析多本同类型小说，学习风格后再创作
- API调用有频率限制，请合理使用
