/**
 * 文件操作工具
 */
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

/**
 * 确保目录存在
 * @param {string} dir - 目录路径
 */
export const ensureDir = async (dir) => {
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
};

/**
 * 读取JSON文件
 * @param {string} filePath - 文件路径
 * @returns {Object|null} JSON对象或null
 */
export const readJson = async (filePath) => {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
};

/**
 * 写入JSON文件
 * @param {string} filePath - 文件路径
 * @param {Object} data - 数据对象
 */
export const writeJson = async (filePath, data) => {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

/**
 * 读取文本文件
 * @param {string} filePath - 文件路径
 * @returns {string|null} 文件内容或null
 */
export const readText = async (filePath) => {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    return null;
  }
};

/**
 * 写入文本文件
 * @param {string} filePath - 文件路径
 * @param {string} content - 文件内容
 */
export const writeText = async (filePath, content) => {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  await fs.writeFile(filePath, content, 'utf-8');
};

/**
 * 删除文件或目录
 * @param {string} target - 目标路径
 */
export const remove = async (target) => {
  if (!existsSync(target)) {
    return;
  }
  const stat = await fs.stat(target);
  if (stat.isDirectory()) {
    await fs.rm(target, { recursive: true });
  } else {
    await fs.unlink(target);
  }
};

/**
 * 获取目录下所有文件
 * @param {string} dir - 目录路径
 * @param {string} ext - 扩展名过滤（可选）
 * @returns {string[]} 文件路径列表
 */
export const listFiles = async (dir, ext = null) => {
  if (!existsSync(dir)) {
    return [];
  }
  const files = await fs.readdir(dir);
  let result = files.map((f) => path.join(dir, f));
  if (ext) {
    result = result.filter((f) => f.endsWith(ext));
  }
  return result;
};

/**
 * 获取文件大小（字节）
 * @param {string} filePath - 文件路径
 * @returns {number} 文件大小
 */
export const getFileSize = async (filePath) => {
  if (!existsSync(filePath)) {
    return 0;
  }
  const stat = await fs.stat(filePath);
  return stat.size;
};

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的字符串
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default {
  ensureDir,
  readJson,
  writeJson,
  readText,
  writeText,
  remove,
  listFiles,
  getFileSize,
  formatFileSize,
};
