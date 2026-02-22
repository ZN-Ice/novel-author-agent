/**
 * 进展记录管理
 * 记录和查询书籍处理进展
 */
import path from 'path';
import config from '../../config/index.js';
import getLogger from '../utils/logger.js';
import { readJson, writeJson } from '../utils/file-utils.js';

const logger = getLogger();

/**
 * 阶段定义
 */
export const PHASES = {
  CREATED: 'created',
  DOWNLOADED: 'downloaded',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  OUTLINING: 'outlining',
  OUTLINED: 'outlined',
  WRITING: 'writing',
  COMPLETED: 'completed',
};

/**
 * 操作类型
 */
export const ACTIONS = {
  CREATE_WORKSPACE: '创建工作目录',
  DOWNLOAD: '下载原始文件',
  PARSE: '解析小说结构',
  ANALYZE_OUTLINE: '分析大纲结构',
  ANALYZE_STYLE: '分析写作风格',
  CREATE_OUTLINE: '创作大纲',
  REVIEW_OUTLINE: '评价大纲',
  OPTIMIZE_OUTLINE: '优化大纲',
  WRITE_CHAPTER: '创作章节',
  REVIEW_CHAPTER: '评价章节',
  OPTIMIZE_CHAPTER: '优化章节',
};

/**
 * 获取进展记录
 * @param {string} bookId - 书籍ID
 * @returns {Promise<Object>} 进展记录
 */
export const getProgress = async (bookId) => {
  const progressPath = path.join(config.workspace.dir, bookId, 'progress.json');
  const progress = await readJson(progressPath);
  return progress || { bookId, history: [] };
};

/**
 * 添加进展记录
 * @param {string} bookId - 书籍ID
 * @param {Object} entry - 进展条目
 * @returns {Promise<Object>} 更新后的进展记录
 */
export const addProgress = async (bookId, entry) => {
  const progress = await getProgress(bookId);

  const newEntry = {
    timestamp: new Date().toISOString(),
    phase: entry.phase || PHASES.CREATED,
    action: entry.action || '',
    status: entry.status || 'in_progress', // in_progress, completed, failed
    details: entry.details || {},
    error: entry.error || null,
  };

  progress.history.push(newEntry);

  const progressPath = path.join(config.workspace.dir, bookId, 'progress.json');
  await writeJson(progressPath, progress);

  logger.debug(`添加进展记录: ${bookId} - ${newEntry.action}`);

  return progress;
};

/**
 * 获取最新进展
 * @param {string} bookId - 书籍ID
 * @returns {Promise<Object|null>} 最新进展条目
 */
export const getLatestProgress = async (bookId) => {
  const progress = await getProgress(bookId);
  if (progress.history.length === 0) {
    return null;
  }
  return progress.history[progress.history.length - 1];
};

/**
 * 获取指定阶段的进展
 * @param {string} bookId - 书籍ID
 * @param {string} phase - 阶段
 * @returns {Promise<Array>} 阶段进展列表
 */
export const getProgressByPhase = async (bookId, phase) => {
  const progress = await getProgress(bookId);
  return progress.history.filter((entry) => entry.phase === phase);
};

/**
 * 获取进展统计
 * @param {string} bookId - 书籍ID
 * @returns {Promise<Object>} 统计信息
 */
export const getProgressStats = async (bookId) => {
  const progress = await getProgress(bookId);
  const history = progress.history;

  const stats = {
    totalEntries: history.length,
    completedCount: 0,
    failedCount: 0,
    inProgressCount: 0,
    phaseCounts: {},
    lastActivity: null,
  };

  for (const entry of history) {
    // 状态统计
    if (entry.status === 'completed') stats.completedCount++;
    else if (entry.status === 'failed') stats.failedCount++;
    else stats.inProgressCount++;

    // 阶段统计
    if (!stats.phaseCounts[entry.phase]) {
      stats.phaseCounts[entry.phase] = 0;
    }
    stats.phaseCounts[entry.phase]++;

    // 最后活动时间
    if (!stats.lastActivity || new Date(entry.timestamp) > new Date(stats.lastActivity)) {
      stats.lastActivity = entry.timestamp;
    }
  }

  return stats;
};

/**
 * 清除进展历史
 * @param {string} bookId - 书籍ID
 * @returns {Promise<void>}
 */
export const clearProgress = async (bookId) => {
  const progressPath = path.join(config.workspace.dir, bookId, 'progress.json');
  await writeJson(progressPath, { bookId, history: [] });
  logger.info(`清除进展历史: ${bookId}`);
};

/**
 * 标记操作完成
 * @param {string} bookId - 书籍ID
 * @param {string} action - 操作名称
 * @param {Object} details - 详情
 * @returns {Promise<Object>}
 */
export const markCompleted = async (bookId, action, details = {}) => {
  return await addProgress(bookId, {
    action,
    status: 'completed',
    details,
  });
};

/**
 * 标记操作失败
 * @param {string} bookId - 书籍ID
 * @param {string} action - 操作名称
 * @param {string} error - 错误信息
 * @returns {Promise<Object>}
 */
export const markFailed = async (bookId, action, error) => {
  return await addProgress(bookId, {
    action,
    status: 'failed',
    error,
  });
};

export default {
  PHASES,
  ACTIONS,
  getProgress,
  addProgress,
  getLatestProgress,
  getProgressByPhase,
  getProgressStats,
  clearProgress,
  markCompleted,
  markFailed,
};
