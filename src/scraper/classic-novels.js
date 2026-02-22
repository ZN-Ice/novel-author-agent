/**
 * 经典小说管理器
 * 管理经典小说的下载、存储、章节拆分和分析
 * 目录结构: classic_novels/{序号_小说名}/
 */
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import config from '../../config/index.js';
import getLogger from '../utils/logger.js';
import { ensureDir, readJson, writeJson, formatFileSize, writeText, readText } from '../utils/file-utils.js';
import { parseNovel } from '../parser/novel-parser.js';
import { getGLMClient } from '../llm/glm-client.js';

const logger = getLogger();

/**
 * 索引文件路径
 */
const getIndexFilePath = () => {
  return path.join(config.classicNovels.dir, '.index.json');
};

/**
 * 读取索引文件
 */
const readIndex = async () => {
  const indexPath = getIndexFilePath();
  const index = await readJson(indexPath);
  return index || { nextSeq: 1, novels: {} };
};

/**
 * 写入索引文件
 */
const writeIndex = async (index) => {
  const indexPath = getIndexFilePath();
  await ensureDir(config.classicNovels.dir);
  await writeJson(indexPath, index);
};

/**
 * 获取经典小说存储目录
 */
export const getClassicNovelsDir = () => {
  return config.classicNovels.dir;
};

/**
 * 清理文件名中的非法字符
 */
const sanitizeName = (name) => {
  return (name || '未命名')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 20);
};

/**
 * 生成目录名
 */
const generateDirName = (seq, title) => {
  const safeTitle = sanitizeName(title);
  return `${seq}_${safeTitle}`;
};

/**
 * 获取小说目录路径
 * @param {number|string} seqOrDirName - 序号或目录名
 * @returns {Promise<string>}
 */
export const getNovelDir = async (seqOrDirName) => {
  // 如果是纯数字，当作序号处理
  if (/^\d+$/.test(seqOrDirName)) {
    const seq = parseInt(seqOrDirName);
    const index = await readIndex();
    const novelInfo = index.novels[seq];
    if (novelInfo) {
      return path.join(config.classicNovels.dir, novelInfo.dirName);
    }
    // 扫描目录
    const novels = await listClassicNovels();
    const novel = novels.find(n => n.seq === seq);
    if (novel) {
      return path.join(config.classicNovels.dir, novel.dirName);
    }
    return null;
  }
  return path.join(config.classicNovels.dir, seqOrDirName);
};

/**
 * 解析序号
 */
export const resolveSeq = async (seqOrDirName) => {
  if (/^\d+$/.test(seqOrDirName)) {
    return parseInt(seqOrDirName);
  }
  // 从目录名提取序号
  const match = seqOrDirName.match(/^(\d+)_/);
  return match ? parseInt(match[1]) : null;
};

/**
 * 获取小说文件路径
 */
export const getNovelPath = async (seqOrDirName) => {
  const dir = await getNovelDir(seqOrDirName);
  return dir ? path.join(dir, 'novel.txt') : null;
};

/**
 * 获取小说元信息路径
 */
export const getMetaPath = async (seqOrDirName) => {
  const dir = await getNovelDir(seqOrDirName);
  return dir ? path.join(dir, 'meta.json') : null;
};

/**
 * 获取章节目录路径
 */
export const getChaptersDir = async (seqOrDirName) => {
  const dir = await getNovelDir(seqOrDirName);
  return dir ? path.join(dir, 'chapters') : null;
};

/**
 * 获取分析目录路径
 */
export const getAnalysisDir = async (seqOrDirName) => {
  const dir = await getNovelDir(seqOrDirName);
  return dir ? path.join(dir, 'analysis') : null;
};

/**
 * 创建小说目录结构
 * @param {Object} bookInfo - 书籍信息
 * @returns {Promise<Object>} 创建结果
 */
export const createNovelDir = async (bookInfo) => {
  const index = await readIndex();
  const seq = index.nextSeq;
  const title = bookInfo.title || '未命名';
  const dirName = generateDirName(seq, title);
  const novelDir = path.join(config.classicNovels.dir, dirName);

  logger.info(`创建小说目录: #${seq} ${title}`);

  // 创建目录结构
  await ensureDir(novelDir);
  await ensureDir(path.join(novelDir, 'chapters'));
  await ensureDir(path.join(novelDir, 'analysis'));

  // 创建元信息
  const meta = {
    seq: seq,
    dirName: dirName,
    title: title,
    author: bookInfo.author || '未知',
    category: bookInfo.category || '',
    wordCount: bookInfo.wordCount || '',
    sourceId: bookInfo.id || null,
    source: {
      url: bookInfo.url || '',
      downloadUrl: bookInfo.downloadUrl || '',
    },
    status: 'created', // created, downloaded, parsed, analyzed
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await writeJson(path.join(novelDir, 'meta.json'), meta);

  // 更新索引
  index.nextSeq = seq + 1;
  index.novels[seq] = {
    dirName: dirName,
    title: title,
    createdAt: meta.createdAt,
  };
  await writeIndex(index);

  return {
    seq,
    dirName,
    path: novelDir,
    meta,
  };
};

/**
 * 检查小说是否已存在
 */
export const novelExists = async (seqOrTitle) => {
  // 如果是序号
  if (/^\d+$/.test(seqOrTitle)) {
    const index = await readIndex();
    return !!index.novels[parseInt(seqOrTitle)];
  }
  // 按标题查找
  const novels = await listClassicNovels();
  return novels.some(n => n.title === seqOrTitle);
};

/**
 * 脚本检查小说完整性
 */
export const checkIntegrityByScript = async (filePath, bookInfo) => {
  const result = {
    valid: false,
    issues: [],
    stats: {},
  };

  try {
    if (!existsSync(filePath)) {
      result.issues.push('文件不存在');
      return result;
    }

    const content = await fs.readFile(filePath, 'utf-8');

    if (!content || content.length < 1000) {
      result.issues.push('文件内容过短');
      return result;
    }

    const novelData = await parseNovel(filePath);

    result.stats = {
      fileSize: content.length,
      fileSizeFormatted: formatFileSize(content.length),
      chapterCount: novelData.chapterCount,
      totalWords: novelData.totalWords,
      avgWordsPerChapter: novelData.chapterStats?.avgWords || 0,
    };

    if (novelData.chapterCount < 10) {
      result.issues.push(`章节数量过少 (${novelData.chapterCount} 章)`);
    }

    const expectedWords = parseWordCount(bookInfo.wordCount);
    if (expectedWords > 0 && novelData.totalWords < expectedWords * 0.5) {
      result.issues.push(`字数严重不足`);
    }

    result.valid = result.issues.length === 0 && novelData.chapterCount >= 10;
    return result;
  } catch (error) {
    result.issues.push(`解析错误: ${error.message}`);
    return result;
  }
};

/**
 * 解析字数字符串
 */
const parseWordCount = (wordCountStr) => {
  if (!wordCountStr) return 0;
  const match = wordCountStr.match(/([\d.]+)\s*(万|千|百万)?/);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  const unit = match[2];

  switch (unit) {
    case '万': return Math.round(num * 10000);
    case '千': return Math.round(num * 1000);
    case '百万': return Math.round(num * 1000000);
    default: return Math.round(num);
  }
};

/**
 * 更新小说元信息
 */
export const updateNovelMeta = async (seqOrDirName, updates) => {
  const metaPath = await getMetaPath(seqOrDirName);
  if (!metaPath) return null;

  const meta = await readJson(metaPath);
  if (!meta) return null;

  const updatedMeta = {
    ...meta,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeJson(metaPath, updatedMeta);
  return updatedMeta;
};

/**
 * 保存章节拆分结果
 */
export const saveChapterSplits = async (seqOrDirName, novelData) => {
  const chaptersDir = await getChaptersDir(seqOrDirName);
  if (!chaptersDir) return false;

  // 保存章节索引
  const indexData = {
    totalChapters: novelData.chapterCount,
    totalWords: novelData.totalWords,
    chapters: novelData.chapters.map(c => ({
      number: c.number,
      title: c.title,
      wordCount: c.wordCount,
    })),
  };
  await writeJson(path.join(chaptersDir, '.index.json'), indexData);

  // 保存各章节内容
  for (const chapter of novelData.chapters) {
    const chapterPath = path.join(chaptersDir, `${String(chapter.number).padStart(4, '0')}.txt`);
    const content = `【${chapter.title}】\n\n${chapter.content}`;
    await writeText(chapterPath, content);
  }

  logger.info(`章节拆分完成: ${novelData.chapterCount} 章`);
  return true;
};

/**
 * 列出所有已下载的经典小说
 */
export const listClassicNovels = async () => {
  const dir = getClassicNovelsDir();
  await ensureDir(dir);

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const novels = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;

    const metaPath = path.join(dir, entry.name, 'meta.json');
    if (existsSync(metaPath)) {
      const meta = await readJson(metaPath);
      if (meta) {
        novels.push(meta);
      }
    }
  }

  // 按序号排序
  novels.sort((a, b) => (a.seq || 999) - (b.seq || 999));
  return novels;
};

/**
 * 获取小说详情
 */
export const getNovelInfo = async (seqOrDirName) => {
  const metaPath = await getMetaPath(seqOrDirName);
  if (!metaPath) return null;
  return await readJson(metaPath);
};

/**
 * 删除小说
 */
export const deleteNovel = async (seqOrDirName) => {
  const novelDir = await getNovelDir(seqOrDirName);
  if (!novelDir) return false;

  // 删除目录
  await fs.rm(novelDir, { recursive: true, force: true });

  // 从索引中删除
  const seq = await resolveSeq(seqOrDirName);
  if (seq) {
    const index = await readIndex();
    delete index.novels[seq];
    await writeIndex(index);
  }

  logger.info(`删除小说: #${seqOrDirName}`);
  return true;
};

/**
 * 重建索引
 */
export const rebuildNovelIndex = async () => {
  const dir = getClassicNovelsDir();
  await ensureDir(dir);

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const index = { nextSeq: 1, novels: {} };

  let maxSeq = 0;
  const needsSeq = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;

    const metaPath = path.join(dir, entry.name, 'meta.json');
    if (existsSync(metaPath)) {
      const meta = await readJson(metaPath);
      if (meta) {
        if (meta.seq && meta.seq > 0) {
          maxSeq = Math.max(maxSeq, meta.seq);
          index.novels[meta.seq] = {
            dirName: entry.name,
            title: meta.title,
            createdAt: meta.createdAt,
          };
        } else {
          needsSeq.push({ entry, meta, metaPath });
        }
      }
    }
  }

  // 为没有序号的分配序号
  let nextSeq = maxSeq + 1;
  for (const { entry, meta, metaPath } of needsSeq) {
    meta.seq = nextSeq;
    await writeJson(metaPath, meta);
    index.novels[nextSeq] = {
      dirName: entry.name,
      title: meta.title,
      createdAt: meta.createdAt,
    };
    logger.info(`为《${meta.title}》分配序号: #${nextSeq}`);
    nextSeq++;
  }

  index.nextSeq = nextSeq;
  await writeIndex(index);

  logger.info(`经典小说索引重建完成，共 ${Object.keys(index.novels).length} 本`);
  return index;
};

export default {
  getClassicNovelsDir,
  getNovelDir,
  getNovelPath,
  getMetaPath,
  getChaptersDir,
  getAnalysisDir,
  createNovelDir,
  novelExists,
  checkIntegrityByScript,
  updateNovelMeta,
  saveChapterSplits,
  listClassicNovels,
  getNovelInfo,
  deleteNovel,
  rebuildNovelIndex,
  resolveSeq,
};
