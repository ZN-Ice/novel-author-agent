/**
 * GitHub 仓库同步工具
 * 使用 git 将 classic_novels 和 workspaces 同步到 GitHub 仓库
 * 所有文件操作通过命令行方式处理
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { tmpdir } from 'os';
import getLogger from './logger.js';
import config from '../../config/index.js';

const execAsync = promisify(exec);
const logger = getLogger();

/**
 * 临时目录基础路径
 */
const TEMP_BASE = path.join(tmpdir(), 'novel-github-sync');

/**
 * 检查 git 是否可用
 * @returns {Promise<boolean>}
 */
export const isGitAvailable = async () => {
  try {
    const { stdout } = await execAsync('git --version', {
      timeout: 5000,
    });
    return stdout.includes('git');
  } catch (error) {
    return false;
  }
};

/**
 * 检查 GitHub 备份配置是否完整
 * @returns {boolean}
 */
export const isGitHubConfigured = () => {
  return !!(config.githubBackup.repo && config.githubBackup.branch);
};

/**
 * 创建目录（命令行方式）
 * @param {string} dirPath - 目录路径
 */
const createDir = async (dirPath) => {
  try {
    // 使用 PowerShell 创建目录
    if (process.platform === 'win32') {
      await execAsync(`if not exist "${dirPath}" mkdir "${dirPath}"`, {
        timeout: 5000,
        shell: 'cmd.exe',
      });
    } else {
      await execAsync(`mkdir -p "${dirPath}"`, {
        timeout: 5000,
      });
    }
  } catch (error) {
    // 目录可能已存在，忽略错误
  }
};

/**
 * 删除目录（命令行方式）
 * @param {string} dirPath - 目录路径
 */
const deleteDir = async (dirPath) => {
  try {
    if (process.platform === 'win32') {
      // Windows 使用 rmdir /s /q
      await execAsync(`if exist "${dirPath}" rmdir /s /q "${dirPath}"`, {
        timeout: 30000,
        shell: 'cmd.exe',
      });
    } else {
      // Unix 使用 rm -rf
      await execAsync(`rm -rf "${dirPath}"`, {
        timeout: 30000,
      });
    }
  } catch (error) {
    logger.warn(`删除目录失败: ${error.message}`);
  }
};

/**
 * 拷贝目录（命令行方式）
 * @param {string} srcPath - 源路径
 * @param {string} destPath - 目标路径
 */
const copyDir = async (srcPath, destPath) => {
  try {
    if (process.platform === 'win32') {
      // Windows 使用 xcopy
      await execAsync(`xcopy /e /i /y /h "${srcPath}" "${destPath}"`, {
        timeout: 60000,
        shell: 'cmd.exe',
      });
    } else {
      // Unix 使用 cp -r
      await execAsync(`cp -r "${srcPath}" "${destPath}"`, {
        timeout: 60000,
      });
    }
  } catch (error) {
    throw new Error(`拷贝目录失败: ${error.message}`);
  }
};

/**
 * 克隆 GitHub 仓库到临时目录
 * @param {string} tempDir - 临时目录路径
 * @returns {Promise<Object>} 克隆结果
 */
const cloneRepo = async (tempDir) => {
  try {
    const repo = config.githubBackup.repo;
    const branch = config.githubBackup.branch;

    logger.debug(`克隆仓库: ${repo} (分支: ${branch})`);

    // 首先尝试克隆指定分支
    try {
      const { stdout, stderr } = await execAsync(
        `git clone --depth 1 --branch ${branch} "${repo}" "${tempDir}"`,
        {
          timeout: 300000, // 5分钟超时
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        }
      );
      return { success: true, stdout, stderr };
    } catch (cloneError) {
      // 如果指定分支不存在，克隆默认分支并创建新分支
      if (cloneError.message.includes('not found') || cloneError.message.includes('Remote branch')) {
        logger.debug(`分支 ${branch} 不存在，克隆默认分支...`);

        // 使用父目录克隆
        const parentDir = path.dirname(tempDir);
        const cloneDir = path.join(parentDir, `clone-${Date.now()}`);

        await execAsync(
          `git clone --depth 1 "${repo}" "${cloneDir}"`,
          {
            timeout: 300000,
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
          }
        );

        // 删除目标目录（如果存在）
        await deleteDir(tempDir);

        // 创建父目录
        await createDir(parentDir);

        // 移动目录
        if (process.platform === 'win32') {
          await execAsync(`move "${cloneDir}" "${tempDir}"`, {
            timeout: 10000,
            shell: 'cmd.exe',
          });
        } else {
          await execAsync(`mv "${cloneDir}" "${tempDir}"`, {
            timeout: 10000,
          });
        }

        // 创建并切换到新分支
        await execAsync(`git checkout -b ${branch}`, {
          cwd: tempDir,
          timeout: 10000,
        });

        return { success: true, createdBranch: true };
      }
      throw cloneError;
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 拉取仓库最新代码
 * @param {string} repoDir - 仓库目录
 * @returns {Promise<Object>} 拉取结果
 */
const pullRepo = async (repoDir) => {
  try {
    logger.debug('拉取最新代码...');

    const { stdout, stderr } = await execAsync(
      `git pull origin ${config.githubBackup.branch}`,
      {
        cwd: repoDir,
        timeout: 60000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      }
    );

    return { success: true, stdout, stderr };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 提交并推送更改
 * @param {string} repoDir - 仓库目录
 * @param {string} message - 提交消息
 * @param {boolean} isNewBranch - 是否是新创建的分支
 * @returns {Promise<Object>} 提交结果
 */
const commitAndPush = async (repoDir, message, isNewBranch = false) => {
  try {
    logger.debug('提交更改...');

    // 检查是否有更改
    const { stdout: statusOutput } = await execAsync('git status --porcelain', {
      cwd: repoDir,
      timeout: 10000,
    });

    if (!statusOutput.trim()) {
      logger.debug('没有更改需要提交');
      return { success: true, nothingToCommit: true };
    }

    // 添加所有更改
    await execAsync('git add .', {
      cwd: repoDir,
      timeout: 300000,
    });

    // 提交
    await execAsync(`git commit -m "${message}"`, {
      cwd: repoDir,
      timeout: 300000,
    });

    logger.debug('推送到远程...');

    // 推送 - 新分支使用 -u 参数设置上游
    const pushCommand = isNewBranch
      ? `git push -u origin ${config.githubBackup.branch}`
      : `git push origin ${config.githubBackup.branch}`;

    const { stdout, stderr } = await execAsync(pushCommand, {
      cwd: repoDir,
      timeout: 120000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

    return { success: true, stdout, stderr };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 配置 git 用户信息
 * @param {string} repoDir - 仓库目录
 */
const configureGitUser = async (repoDir) => {
  try {
    await execAsync('git config user.name "Novel Author Agent"', {
      cwd: repoDir,
      timeout: 5000,
    });
    await execAsync('git config user.email "novel-agent@local"', {
      cwd: repoDir,
      timeout: 5000,
    });
  } catch (error) {
    logger.warn(`配置 git 用户信息失败: ${error.message}`);
  }
};

/**
 * 同步本地目录到 GitHub
 * @param {string} localDir - 本地目录路径
 * @param {string} remoteDirName - 远程目录名称 (classic_novels 或 workspaces)
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 同步结果
 */
export const syncToGitHub = async (localDir, remoteDirName, options = {}) => {
  const { silent = false } = options;
  const timestamp = Date.now();
  const tempDir = path.join(TEMP_BASE, `sync-${timestamp}`);
  const remoteDir = path.join(tempDir, remoteDirName);

  try {
    // 检查 git 是否可用
    const gitAvailable = await isGitAvailable();
    if (!gitAvailable) {
      const msg = 'git 不可用，跳过 GitHub 同步';
      if (!silent) logger.warn(msg);
      return { success: false, error: msg };
    }

    // 检查 GitHub 配置
    if (!isGitHubConfigured()) {
      const msg = 'GitHub 备份配置不完整，请检查 GITHUB_BACKUP_REPO 和 GITHUB_BACKUP_BRANCH';
      if (!silent) logger.warn(msg);
      return { success: false, error: msg };
    }

    if (!silent) {
      logger.info(`同步到 GitHub: ${path.basename(localDir)} -> ${remoteDirName}/`);
    }

    // 创建临时目录
    await createDir(tempDir);

    // 克隆仓库
    const cloneResult = await cloneRepo(tempDir);
    if (!cloneResult.success) {
      throw new Error(`克隆仓库失败: ${cloneResult.error}`);
    }

    // 配置 git 用户信息
    await configureGitUser(tempDir);

    // 拉取最新代码
    await pullRepo(tempDir);

    // 删除远程目录（如果存在）- 确保每次备份都是全新的
    await deleteDir(remoteDir);

    // 创建远程目录
    await createDir(remoteDir);

    // 拷贝本地文件到远程目录
    if (!silent) {
      logger.debug(`拷贝文件: ${localDir} -> ${remoteDir}`);
    }
    await copyDir(localDir, remoteDir);

    // 提交并推送
    const timeString = new Date().toISOString();
    const commitResult = await commitAndPush(
      tempDir,
      `chore: 同步 ${remoteDirName} - ${timeString}`,
      cloneResult.createdBranch // 是否是新创建的分支
    );

    if (!commitResult.success) {
      throw new Error(`提交推送失败: ${commitResult.error}`);
    }

    if (!silent) {
      if (commitResult.nothingToCommit) {
        logger.info(`GitHub 同步完成 (无变更)`);
      } else {
        logger.info(`GitHub 同步完成: ${path.basename(localDir)}`);
      }
    }

    return { success: true, nothingToCommit: commitResult.nothingToCommit };
  } catch (error) {
    const msg = `GitHub 同步失败: ${error.message}`;
    if (!silent) logger.error(msg);
    return { success: false, error: msg };
  } finally {
    // 清理临时目录
    await deleteDir(tempDir);
  }
};

/**
 * 同步经典小说目录到 GitHub
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 同步结果
 */
export const syncClassicNovels = async (options = {}) => {
  const localDir = config.classicNovels.dir;
  const remoteDirName = config.githubBackup.classicNovelsDir;

  return await syncToGitHub(localDir, remoteDirName, options);
};

/**
 * 同步工作空间目录到 GitHub
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 同步结果
 */
export const syncWorkspaces = async (options = {}) => {
  const localDir = config.workspace.dir;
  const remoteDirName = config.githubBackup.workspacesDir;

  return await syncToGitHub(localDir, remoteDirName, options);
};

/**
 * 同步所有数据到 GitHub
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 同步结果
 */
export const syncAllToGitHub = async (options = {}) => {
  const { silent = false } = options;
  const results = {
    classicNovels: null,
    workspaces: null,
  };

  if (!silent) {
    logger.info('开始同步数据到 GitHub...');
  }

  // 同步经典小说
  results.classicNovels = await syncClassicNovels(options);

  // 同步工作空间
  results.workspaces = await syncWorkspaces(options);

  const success = results.classicNovels?.success !== false && results.workspaces?.success !== false;

  if (!silent) {
    if (success) {
      logger.info('GitHub 同步完成');
    } else {
      logger.warn('GitHub 同步部分失败，请检查日志');
    }
  }

  return {
    success,
    results,
  };
};

/**
 * 从 GitHub 下载目录到本地
 * @param {string} remoteDirName - 远程目录名称
 * @param {string} localDir - 本地目录路径
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 下载结果
 */
export const downloadFromGitHub = async (remoteDirName, localDir, options = {}) => {
  const { silent = false } = options;
  const timestamp = Date.now();
  const tempDir = path.join(TEMP_BASE, `download-${timestamp}`);
  const remoteDir = path.join(tempDir, remoteDirName);

  try {
    // 检查 git 是否可用
    const gitAvailable = await isGitAvailable();
    if (!gitAvailable) {
      const msg = 'git 不可用，跳过 GitHub 下载';
      if (!silent) logger.warn(msg);
      return { success: false, error: msg };
    }

    // 检查 GitHub 配置
    if (!isGitHubConfigured()) {
      const msg = 'GitHub 备份配置不完整，请检查 GITHUB_BACKUP_REPO 和 GITHUB_BACKUP_BRANCH';
      if (!silent) logger.warn(msg);
      return { success: false, error: msg };
    }

    if (!silent) {
      logger.info(`从 GitHub 下载: ${remoteDirName}/ -> ${localDir}`);
    }

    // 创建临时目录
    await createDir(tempDir);

    // 克隆仓库
    const cloneResult = await cloneRepo(tempDir);
    if (!cloneResult.success) {
      throw new Error(`克隆仓库失败: ${cloneResult.error}`);
    }

    // 检查远程目录是否存在
    const checkResult = await execAsync(`if exist "${remoteDir}" (echo exists) else (echo not_exists)`, {
      shell: 'cmd.exe',
      timeout: 5000,
    });

    if (!checkResult.stdout.includes('exists')) {
      const msg = `远程目录不存在: ${remoteDirName}`;
      if (!silent) logger.warn(msg);
      return { success: false, error: msg };
    }

    // 确保本地目录存在
    await createDir(localDir);

    // 删除本地目录（如果存在）- 确保每次恢复都是全新的
    await deleteDir(localDir);

    // 创建本地目录
    await createDir(localDir);

    // 拷贝远程文件到本地
    if (!silent) {
      logger.debug(`拷贝文件: ${remoteDir} -> ${localDir}`);
    }
    await copyDir(remoteDir, localDir);

    if (!silent) {
      logger.info(`GitHub 下载完成: ${remoteDirName}`);
    }

    return { success: true };
  } catch (error) {
    const msg = `GitHub 下载失败: ${error.message}`;
    if (!silent) logger.error(msg);
    return { success: false, error: msg };
  } finally {
    // 清理临时目录
    await deleteDir(tempDir);
  }
};

/**
 * 从 GitHub 下载经典小说目录
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 下载结果
 */
export const downloadClassicNovels = async (options = {}) => {
  const remoteDirName = config.githubBackup.classicNovelsDir;
  const localDir = config.classicNovels.dir;

  return await downloadFromGitHub(remoteDirName, localDir, options);
};

/**
 * 从 GitHub 下载工作空间目录
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 下载结果
 */
export const downloadWorkspaces = async (options = {}) => {
  const remoteDirName = config.githubBackup.workspacesDir;
  const localDir = config.workspace.dir;

  return await downloadFromGitHub(remoteDirName, localDir, options);
};

/**
 * 从 GitHub 下载所有数据
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 下载结果
 */
export const downloadAllFromGitHub = async (options = {}) => {
  const { silent = false } = options;
  const results = {
    classicNovels: null,
    workspaces: null,
  };

  if (!silent) {
    logger.info('开始从 GitHub 下载数据...');
  }

  // 下载经典小说
  results.classicNovels = await downloadClassicNovels(options);

  // 下载工作空间
  results.workspaces = await downloadWorkspaces(options);

  const success = results.classicNovels?.success && results.workspaces?.success;

  if (!silent) {
    if (success) {
      logger.info('GitHub 下载完成');
    } else {
      logger.warn('GitHub 下载部分失败，请检查日志');
    }
  }

  return {
    success,
    results,
  };
};

/**
 * 检查 GitHub 同步状态
 * @returns {Promise<Object>} 状态信息
 */
export const checkSyncStatus = async () => {
  const gitAvailable = await isGitAvailable();

  return {
    available: gitAvailable && isGitHubConfigured(),
    gitAvailable,
    configured: isGitHubConfigured(),
    tool: 'git',
    repo: config.githubBackup.repo,
    branch: config.githubBackup.branch,
    remoteDirs: {
      classicNovels: config.githubBackup.classicNovelsDir,
      workspaces: config.githubBackup.workspacesDir,
    },
    localDirs: {
      classicNovels: config.classicNovels.dir,
      workspaces: config.workspace.dir,
    },
  };
};

// 导出兼容旧接口的函数名
export const syncToCloud = syncToGitHub;
export const syncAllToCloud = syncAllToGitHub;
export const downloadFromCloud = downloadFromGitHub;
export const downloadAllFromCloud = downloadAllFromGitHub;
export const isAliyunpanAvailable = isGitAvailable;

export default {
  isGitAvailable,
  isGitHubConfigured,
  syncToGitHub,
  syncClassicNovels,
  syncWorkspaces,
  syncAllToGitHub,
  downloadFromGitHub,
  downloadClassicNovels,
  downloadWorkspaces,
  downloadAllFromGitHub,
  checkSyncStatus,
};
