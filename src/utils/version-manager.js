/**
 * 版本管理工具
 * 处理 draft 目录的版本号管理和 final 目录的覆盖逻辑
 */
import fs from 'fs/promises';
import path from 'path';
import getLogger from './logger.js';

const logger = getLogger();

/**
 * 获取目录中的下一个版本号
 * @param {string} dirPath - 目录路径
 * @param {string} baseName - 基础文件名（不含扩展名）
 * @returns {Promise<number>} 下一个版本号
 */
export async function getNextVersion(dirPath, baseName) {
  try {
    const files = await fs.readdir(dirPath);
    const pattern = new RegExp(`^${baseName}-v(\\d+)\\.txt$`);
    const versions = files
      .map((f) => {
        const match = f.match(pattern);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((v) => v > 0);

    return versions.length > 0 ? Math.max(...versions) + 1 : 1;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return 1;
    }
    throw error;
  }
}

/**
 * 保存带版本号的文件到 draft 目录
 * @param {string} dirPath - 目录路径
 * @param {string} baseName - 基础文件名（不含扩展名）
 * @param {string} content - 文件内容
 * @returns {Promise<{filePath: string, version: number}>} 保存的文件路径和版本号
 */
export async function saveVersionedFile(dirPath, baseName, content) {
  await fs.mkdir(dirPath, { recursive: true });

  const version = await getNextVersion(dirPath, baseName);
  const fileName = `${baseName}-v${version}.txt`;
  const filePath = path.join(dirPath, fileName);

  await fs.writeFile(filePath, content, 'utf-8');
  logger.debug(`保存版本文件: ${filePath}`);

  return { filePath, version };
}

/**
 * 保存覆盖文件到 final 目录
 * @param {string} dirPath - 目录路径
 * @param {string} fileName - 文件名（含扩展名）
 * @param {string} content - 文件内容
 * @returns {Promise<string>} 保存的文件路径
 */
export async function saveFinalFile(dirPath, fileName, content) {
  await fs.mkdir(dirPath, { recursive: true });

  const filePath = path.join(dirPath, fileName);
  await fs.writeFile(filePath, content, 'utf-8');
  logger.debug(`保存最终文件: ${filePath}`);

  return filePath;
}

/**
 * 获取最新版本的文件
 * @param {string} dirPath - 目录路径
 * @param {string} baseName - 基础文件名（不含扩展名）
 * @returns {Promise<{filePath: string, content: string, version: number}|null>} 最新版本文件
 */
export async function getLatestVersion(dirPath, baseName) {
  try {
    const files = await fs.readdir(dirPath);
    const pattern = new RegExp(`^${baseName}-v(\\d+)\\.txt$`);
    const versionFiles = files
      .map((f) => {
        const match = f.match(pattern);
        return match ? { file: f, version: parseInt(match[1], 10) } : null;
      })
      .filter((v) => v !== null);

    if (versionFiles.length === 0) {
      return null;
    }

    const latest = versionFiles.reduce((max, current) =>
      current.version > max.version ? current : max
    );

    const filePath = path.join(dirPath, latest.file);
    const content = await fs.readFile(filePath, 'utf-8');

    return { filePath, content, version: latest.version };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * 验证自然语言指令
 * @param {string} instruction - 自然语言指令
 * @returns {boolean} 是否有效
 */
export function validateInstruction(instruction) {
  if (!instruction || typeof instruction !== 'string') {
    return false;
  }

  const trimmed = instruction.trim();
  if (trimmed.length < 2 || trimmed.length > 500) {
    return false;
  }

  return true;
}

/**
 * 提取指令类型
 * @param {string} instruction - 自然语言指令
 * @returns {string} 指令类型（outline/chapter/review/other）
 */
export function extractInstructionType(instruction) {
  const lower = instruction.toLowerCase();

  const outlineKeywords = ['大纲', 'outline', '剧情', '情节', '章节标题', '人物关系', '世界观', '主线'];
  const chapterKeywords = ['章节', 'chapter', '内容', '对话', '描写', '叙述', '正文'];

  const outlineCount = outlineKeywords.filter((k) => lower.includes(k)).length;
  const chapterCount = chapterKeywords.filter((k) => lower.includes(k)).length;

  if (outlineCount > chapterCount) {
    return 'outline';
  } else if (chapterCount > outlineCount) {
    return 'chapter';
  }

  return 'other';
}

export default {
  getNextVersion,
  saveVersionedFile,
  saveFinalFile,
  getLatestVersion,
  validateInstruction,
  extractInstructionType,
};
