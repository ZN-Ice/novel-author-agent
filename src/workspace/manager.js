/**
 * 工作目录管理器
 * 管理每本书的独立工作目录
 */
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
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
 * 创建新的书籍工作目录
 * @param {Object} bookInfo - 书籍信息
 * @returns {Promise<Object>} 创建的工作目录信息
 */
export const createWorkspace = async (bookInfo) => {
  const bookId = uuidv4();
  const workspaceDir = path.join(config.workspace.dir, bookId);

  logger.info(`创建工作目录: ${workspaceDir}`);

  // 创建目录结构
  await ensureDir(workspaceDir);
  for (const subDir of SUB_DIRS) {
    await ensureDir(path.join(workspaceDir, subDir));
  }

  // 创建元信息文件
  const meta = {
    id: bookId,
    sourceId: bookInfo.id || null,
    title: bookInfo.title || '未命名',
    author: bookInfo.author || '未知',
    category: bookInfo.category || '',
    wordCount: bookInfo.wordCount || '',
    status: 'created', // created, downloaded, analyzing, outlining, writing, completed
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
    bookId,
    history: [],
  };
  await writeJson(path.join(workspaceDir, 'progress.json'), progress);

  logger.info(`工作目录创建成功: ${meta.title} (${bookId})`);

  return {
    bookId,
    path: workspaceDir,
    meta,
  };
};

/**
 * 获取书籍元信息
 * @param {string} bookId - 书籍ID
 * @returns {Promise<Object|null>} 元信息
 */
export const getMeta = async (bookId) => {
  const metaPath = path.join(config.workspace.dir, bookId, 'meta.json');
  return await readJson(metaPath);
};

/**
 * 更新书籍元信息
 * @param {string} bookId - 书籍ID
 * @param {Object} updates - 更新内容
 * @returns {Promise<Object>} 更新后的元信息
 */
export const updateMeta = async (bookId, updates) => {
  const meta = await getMeta(bookId);
  if (!meta) {
    throw new Error(`书籍不存在: ${bookId}`);
  }

  const updatedMeta = {
    ...meta,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const metaPath = path.join(config.workspace.dir, bookId, 'meta.json');
  await writeJson(metaPath, updatedMeta);

  logger.debug(`更新书籍元信息: ${bookId}`);
  return updatedMeta;
};

/**
 * 获取工作目录路径
 * @param {string} bookId - 书籍ID
 * @returns {string} 工作目录路径
 */
export const getWorkspacePath = (bookId) => {
  return path.join(config.workspace.dir, bookId);
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
    const bookId = path.basename(dir);
    const meta = await getMeta(bookId);
    if (meta) {
      workspaces.push(meta);
    }
  }

  // 按创建时间排序（最新的在前）
  workspaces.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return workspaces;
};

/**
 * 删除工作目录
 * @param {string} bookId - 书籍ID
 * @returns {Promise<boolean>}
 */
export const deleteWorkspace = async (bookId) => {
  const workspacePath = getWorkspacePath(bookId);
  await remove(workspacePath);
  logger.info(`删除工作目录: ${bookId}`);
  return true;
};

/**
 * 检查工作目录是否存在
 * @param {string} bookId - 书籍ID
 * @returns {Promise<boolean>}
 */
export const workspaceExists = async (bookId) => {
  const meta = await getMeta(bookId);
  return meta !== null;
};

/**
 * 获取书籍文件路径
 * @param {string} bookId - 书籍ID
 * @param {string} type - 文件类型
 * @param {string} name - 文件名
 * @returns {string} 文件路径
 */
export const getFilePath = (bookId, type, name = '') => {
  const workspacePath = getWorkspacePath(bookId);
  return path.join(workspacePath, type, name);
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
};
