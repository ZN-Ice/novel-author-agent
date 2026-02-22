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
node src/index.js search 序列
node src/index.js search 第一序列

# 搜索并下载（精确匹配时自动下载）
node src/index.js search-download 第一序列 --auto

# 下载指定书籍（通过书籍ID）
node src/index.js download 6174

# 下载排行榜前5本书
node src/index.js download-top 5
```

### 书籍管理

```bash
# 列出已下载的经典小说
node src/index.js classics

# 列出所有工作目录中的书籍
node src/index.js list

# 查看书籍详情
node src/index.js info <book-id>

# 查看进展记录
node src/index.js progress <book-id>
```

### 小说分析（需要 GLM API Key）

```bash
# 分析已下载的小说（大纲+风格）
node src/index.js analyze <book-id>
```

### 大纲创作流程

```bash
# 1. 创作大纲
node src/index.js outline create <book-id> --genre 玄幻 --theme "主题描述"

# 2. 评价大纲（编辑给出评分和改进建议）
node src/index.js outline review <book-id>

# 3. 确认执行（如果之前有确认弹窗）
node src/index.js outline confirm <book-id>
```

### 章节创作流程

```bash
# 1. 创作章节
node src/index.js chapter write <book-id> 1

# 2. 评价章节
node src/index.js chapter review <book-id> 1
```

## 典型工作流程

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
3. node src/index.js analyze <id>       # 分析大纲和写作风格
```

### 创作新小说

```
1. node src/index.js outline create <id> --genre 奇幻  # 创作大纲
2. node src/index.js outline review <id>                # 评价大纲
3. node src/index.js chapter write <id> 1               # 创作第一章
```

## 两个AI角色

### 作者 Agent
- 负责创作大纲和章节内容
- 基于学习到的风格进行创作
- 接受编辑的反馈进行修改

### 编辑 Agent
- 评价大纲和章节质量
- 给出具体的改进建议
- 评分维度：情节、人物、节奏、文笔等

## 目录结构

```
classic_novels/           # 下载的经典小说存储目录
├── 小说名.txt           # 小说原文
└── 小说名.meta.json     # 元信息（完整性检查等）

workspaces/{book-id}/     # 创作工作目录
├── source.txt            # 原始文本
├── analysis.json         # 分析结果（大纲、风格）
├── outline.md            # 创作的大纲
├── chapters/
│   ├── 001.md            # 第一章
│   └── 002.md            # 第二章
└── reviews/
    ├── outline.json      # 大纲评价
    └── chapter_001.json  # 章节评价
```

## 注意事项

- 下载的小说仅供学习分析，请勿用于商业用途
- 创作的内容由AI生成，需要人工审核
- 建议先分析多本同类型小说，学习风格后再创作
