/**
 * 工作目录管理器
 * 管理每本书的独立工作目录
 * 目录命名格式: {序号}_{时间戳}_{小说名}
 * book-id 使用序号
 */
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import config from '../../config/index.js';
import getLogger from '../utils/logger.js';
import { ensureDir, readJson, writeJson, listFiles, remove } from '../utils/file-utils.js';

const logger = getLogger();

/**
 * 工作目录子目录
 */
const SUB_DIRS = [
  'source',
  'analysis',
  'outline/draft',
  'outline/final',
  'chapters/draft',
  'chapters/final',
];

/**
 * 索引文件路径
 */
const getIndexFilePath = () => {
  return path.join(config.workspace.dir, '.index.json');
};

/**
 * 读取索引文件
 * @returns {Promise<Object>} 索引数据
 */
const readIndex = async () => {
  const indexPath = getIndexFilePath();
  const index = await readJson(indexPath);
  return index || { nextSeq: 1, books: {} };
};

/**
 * 写入索引文件
 * @param {Object} index - 索引数据
 */
const writeIndex = async (index) => {
  const indexPath = getIndexFilePath();
  await ensureDir(config.workspace.dir);
  await writeJson(indexPath, index);
};

/**
 * 格式化时间戳
 * @returns {string} YYYYMMDD_HHMMSS 格式
 */
const formatTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hour}${minute}${second}`;
};

/**
 * 清理文件名中的非法字符
 * @param {string} name - 原始名称
 * @returns {string} 清理后的名称
 */
const sanitizeName = (name) => {
  return (name || '未命名')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 20); // 限制长度
};

/**
 * 生成目录名
 * @param {number} seq - 序号
 * @param {string} title - 小说名
 * @returns {string} 目录名
 */
const generateDirName = (seq, title) => {
  const timestamp = formatTimestamp();
  const safeTitle = sanitizeName(title);
  return `${seq}_${timestamp}_${safeTitle}`;
};

/**
 * 创建新的书籍工作目录
 * @param {Object} bookInfo - 书籍信息
 * @returns {Promise<Object>} 创建的工作目录信息
 */
export const createWorkspace = async (bookInfo) => {
  // 读取索引并获取下一个序号
  const index = await readIndex();
  const seq = index.nextSeq;
  const title = bookInfo.title || '未命名';
  const dirName = generateDirName(seq, title);
  const workspaceDir = path.join(config.workspace.dir, dirName);

  logger.info(`创建工作目录: #${seq} ${title}`);

  // 创建目录结构
  await ensureDir(workspaceDir);
  for (const subDir of SUB_DIRS) {
    await ensureDir(path.join(workspaceDir, subDir));
  }

  // 创建元信息文件
  const meta = {
    id: dirName,       // 完整目录名作为内部ID
    seq: seq,          // 序号作为用户使用的book-id
    sourceId: bookInfo.id || null,
    title: title,
    author: bookInfo.author || '未知',
    category: bookInfo.category || '',
    wordCount: bookInfo.wordCount || '',
    status: 'created',
    source: {
      url: bookInfo.url || '',
      downloadUrl: bookInfo.downloadUrl || '',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await writeJson(path.join(workspaceDir, 'meta.json'), meta);

  // 创建空的进展记录
  const progress = {
    bookId: dirName,
    seq: seq,
    history: [],
  };
  await writeJson(path.join(workspaceDir, 'progress.json'), progress);

  // 更新索引
  index.nextSeq = seq + 1;
  index.books[seq] = {
    dirName: dirName,
    title: title,
    createdAt: meta.createdAt,
  };
  await writeIndex(index);

  logger.info(`工作目录创建成功: #${seq} ${title}`);

  return {
    bookId: seq,      // 返回序号作为book-id
    seq: seq,
    dirName: dirName,
    path: workspaceDir,
    meta,
  };
};

/**
 * 通过序号解析目录名
 * @param {number|string} seqOrDirName - 序号或目录名
 * @returns {Promise<string|null>} 目录名
 */
export const resolveBookId = async (seqOrDirName) => {
  // 如果是纯数字，当作序号处理
  if (/^\d+$/.test(seqOrDirName)) {
    const seq = parseInt(seqOrDirName);
    const index = await readIndex();
    const bookInfo = index.books[seq];
    if (bookInfo) {
      return bookInfo.dirName;
    }
    // 如果索引中没有，尝试扫描目录
    const workspaces = await listWorkspaces();
    const workspace = workspaces.find(w => w.seq === seq);
    if (workspace) {
      return workspace.id;
    }
    return null;
  }

  // 否则当作目录名处理
  return seqOrDirName;
};

/**
 * 获取书籍元信息
 * @param {string|number} seqOrId - 序号或目录名
 * @returns {Promise<Object|null>} 元信息
 */
export const getMeta = async (seqOrId) => {
  const dirName = await resolveBookId(seqOrId);
  if (!dirName) return null;

  const metaPath = path.join(config.workspace.dir, dirName, 'meta.json');
  return await readJson(metaPath);
};

/**
 * 更新书籍元信息
 * @param {string|number} seqOrId - 序号或目录名
 * @param {Object} updates - 更新内容
 * @returns {Promise<Object>} 更新后的元信息
 */
export const updateMeta = async (seqOrId, updates) => {
  const dirName = await resolveBookId(seqOrId);
  if (!dirName) {
    throw new Error(`书籍不存在: ${seqOrId}`);
  }

  const meta = await getMeta(dirName);
  if (!meta) {
    throw new Error(`书籍不存在: ${dirName}`);
  }

  const updatedMeta = {
    ...meta,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const metaPath = path.join(config.workspace.dir, dirName, 'meta.json');
  await writeJson(metaPath, updatedMeta);

  logger.debug(`更新书籍元信息: #${meta.seq} ${meta.title}`);
  return updatedMeta;
};

/**
 * 获取工作目录路径
 * @param {string|number} seqOrId - 序号或目录名
 * @returns {Promise<string>} 工作目录路径
 */
export const getWorkspacePath = async (seqOrId) => {
  const dirName = await resolveBookId(seqOrId);
  return path.join(config.workspace.dir, dirName);
};

/**
 * 获取所有书籍列表
 * @returns {Promise<Array>} 书籍列表
 */
export const listWorkspaces = async () => {
  await ensureDir(config.workspace.dir);

  const dirs = await listFiles(config.workspace.dir);
  const workspaces = [];

  for (const dir of dirs) {
    // 跳过索引文件
    if (dir.endsWith('.json')) continue;

    const dirName = path.basename(dir);
    const metaPath = path.join(config.workspace.dir, dirName, 'meta.json');

    if (existsSync(metaPath)) {
      const meta = await readJson(metaPath);
      if (meta) {
        workspaces.push(meta);
      }
    }
  }

  // 按序号排序
  workspaces.sort((a, b) => (a.seq || 999) - (b.seq || 999));

  return workspaces;
};

/**
 * 删除工作目录
 * @param {string|number} seqOrId - 序号或目录名
 * @returns {Promise<boolean>}
 */
export const deleteWorkspace = async (seqOrId) => {
  const dirName = await resolveBookId(seqOrId);
  if (!dirName) {
    throw new Error(`书籍不存在: ${seqOrId}`);
  }

  const workspacePath = path.join(config.workspace.dir, dirName);
  await remove(workspacePath);

  // 从索引中删除
  const meta = await getMeta(dirName);
  if (meta && meta.seq) {
    const index = await readIndex();
    delete index.books[meta.seq];
    await writeIndex(index);
  }

  logger.info(`删除工作目录: #${seqOrId}`);
  return true;
};

/**
 * 检查工作目录是否存在
 * @param {string|number} seqOrId - 序号或目录名
 * @returns {Promise<boolean>}
 */
export const workspaceExists = async (seqOrId) => {
  const dirName = await resolveBookId(seqOrId);
  if (!dirName) return false;
  const meta = await getMeta(dirName);
  return meta !== null;
};

/**
 * 获取书籍文件路径
 * @param {string|number} seqOrId - 序号或目录名
 * @param {string} type - 文件类型
 * @param {string} name - 文件名
 * @returns {Promise<string>} 文件路径
 */
export const getFilePath = async (seqOrId, type, name = '') => {
  const dirName = await resolveBookId(seqOrId);
  const workspacePath = path.join(config.workspace.dir, dirName);
  return path.join(workspacePath, type, name);
};

/**
 * 重建索引（用于修复索引文件）
 * @returns {Promise<Object>} 重建后的索引
 */
export const rebuildIndex = async () => {
  const workspaces = await listWorkspaces();
  const index = { nextSeq: 1, books: {} };

  // 找出已有序号的最大值
  let maxSeq = 0;
  const needsSeq = [];

  for (const meta of workspaces) {
    if (meta.seq && meta.seq > 0) {
      maxSeq = Math.max(maxSeq, meta.seq);
      index.books[meta.seq] = {
        dirName: meta.id,
        title: meta.title,
        createdAt: meta.createdAt,
      };
    } else {
      needsSeq.push(meta);
    }
  }

  // 为没有序号的工作空间分配序号
  let nextSeq = maxSeq + 1;
  for (const meta of needsSeq) {
    // 更新meta文件
    const metaPath = path.join(config.workspace.dir, meta.id, 'meta.json');
    meta.seq = nextSeq;
    await writeJson(metaPath, meta);

    index.books[nextSeq] = {
      dirName: meta.id,
      title: meta.title,
      createdAt: meta.createdAt,
    };

    logger.info(`为《${meta.title}》分配序号: #${nextSeq}`);
    nextSeq++;
  }

  index.nextSeq = nextSeq;
  await writeIndex(index);

  logger.info(`索引重建完成，共 ${workspaces.length} 本书，下一个序号: ${index.nextSeq}`);
  return index;
};

export default {
  createWorkspace,
  getMeta,
  updateMeta,
  getWorkspacePath,
  listWorkspaces,
  deleteWorkspace,
  workspaceExists,
  getFilePath,
  resolveBookId,
  rebuildIndex,
};
