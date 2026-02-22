/**
 * 阿里云盘同步工具
 * 使用 aliyunpan CLI 将 classic_novels 和 workspaces 同步到阿里云盘
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import config from '../../config/index.js';
import getLogger from '../utils/logger.js';
import path from 'path';
import { existsSync } from 'fs';

const execAsync = promisify(exec);
const logger = getLogger();

/**
 * 云盘目标目录
 */
const CLOUD_BASE_DIR = '/novel-author-agent';

/**
 * 检查 aliyunpan CLI 是否可用
 * @returns {Promise<boolean>}
 */
export const isAliyunpanAvailable = async () => {
  try {
    const { stdout } = await execAsync('aliyunpan version', {
      timeout: 5000,
    });
    return stdout.includes('aliyunpan');
  } catch (error) {
    return false;
  }
};

/**
 * 同步本地目录到阿里云盘
 * @param {string} localDir - 本地目录路径
 * @param {string} cloudDir - 云盘目录路径
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 同步结果
 */
export const syncToCloud = async (localDir, cloudDir, options = {}) => {
  const { silent = false } = options;

  // 检查本地目录是否存在
  if (!existsSync(localDir)) {
    const msg = `本地目录不存在: ${localDir}`;
    if (!silent) logger.warn(msg);
    return { success: false, error: msg };
  }

  // 检查 aliyunpan 是否可用
  const available = await isAliyunpanAvailable();
  if (!available) {
    const msg = 'aliyunpan CLI 工具不可用，跳过云盘同步';
    if (!silent) logger.warn(msg);
    return { success: false, error: msg };
  }

  try {
    // 使用 upload 命令上传目录
    // upload <本地文件/目录路径> <云盘目录路径>
    const command = `aliyunpan upload "${localDir}" "${cloudDir}"`;

    if (!silent) {
      logger.info(`同步到云盘: ${path.basename(localDir)} -> ${cloudDir}`);
    }

    const { stdout, stderr } = await execAsync(command, {
      timeout: 300000, // 5分钟超时
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });

    // 检查上传结果
    if (stderr && !stderr.includes('成功')) {
      // 有些警告信息在 stderr 中，但不代表失败
      if (stderr.includes('失败') || stderr.includes('错误')) {
        throw new Error(stderr);
      }
    }

    if (!silent) {
      logger.info(`云盘同步完成: ${path.basename(localDir)}`);
    }

    return { success: true, output: stdout };
  } catch (error) {
    const msg = `云盘同步失败: ${error.message}`;
    if (!silent) logger.error(msg);
    return { success: false, error: msg };
  }
};

/**
 * 同步经典小说目录到云盘
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 同步结果
 */
export const syncClassicNovels = async (options = {}) => {
  const localDir = config.classicNovels.dir;
  const cloudDir = `${CLOUD_BASE_DIR}/classic_novels`;

  return await syncToCloud(localDir, cloudDir, options);
};

/**
 * 同步工作空间目录到云盘
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 同步结果
 */
export const syncWorkspaces = async (options = {}) => {
  const localDir = config.workspace.dir;
  const cloudDir = `${CLOUD_BASE_DIR}/workspaces`;

  return await syncToCloud(localDir, cloudDir, options);
};

/**
 * 同步所有数据到云盘
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 同步结果
 */
export const syncAllToCloud = async (options = {}) => {
  const { silent = false } = options;
  const results = {
    classicNovels: null,
    workspaces: null,
  };

  if (!silent) {
    logger.info('开始同步数据到阿里云盘...');
  }

  // 同步经典小说
  results.classicNovels = await syncClassicNovels(options);

  // 同步工作空间
  results.workspaces = await syncWorkspaces(options);

  const success = results.classicNovels?.success && results.workspaces?.success;

  if (!silent) {
    if (success) {
      logger.info('云盘同步完成');
    } else {
      logger.warn('云盘同步部分失败，请检查日志');
    }
  }

  return {
    success,
    results,
  };
};

/**
 * 在云盘创建基础目录
 * @returns {Promise<Object>} 创建结果
 */
export const ensureCloudDirs = async () => {
  const available = await isAliyunpanAvailable();
  if (!available) {
    logger.warn('aliyunpan CLI 工具不可用，跳过云盘目录创建');
    return { success: false, error: 'aliyunpan CLI 不可用' };
  }

  try {
    // 创建基础目录
    const dirs = [
      CLOUD_BASE_DIR,
      `${CLOUD_BASE_DIR}/classic_novels`,
      `${CLOUD_BASE_DIR}/workspaces`,
    ];

    for (const dir of dirs) {
      try {
        await execAsync(`aliyunpan mkdir "${dir}"`, { timeout: 10000 });
      } catch (e) {
        // 目录可能已存在，忽略错误
      }
    }

    logger.info('云盘目录初始化完成');
    return { success: true };
  } catch (error) {
    logger.error(`云盘目录创建失败: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * 检查云盘同步状态
 * @returns {Promise<Object>} 状态信息
 */
export const checkSyncStatus = async () => {
  const available = await isAliyunpanAvailable();

  return {
    available,
    tool: 'aliyunpan',
    cloudBaseDir: CLOUD_BASE_DIR,
    localDirs: {
      classicNovels: config.classicNovels.dir,
      workspaces: config.workspace.dir,
    },
  };
};

export default {
  isAliyunpanAvailable,
  syncToCloud,
  syncClassicNovels,
  syncWorkspaces,
  syncAllToCloud,
  ensureCloudDirs,
  checkSyncStatus,
};
