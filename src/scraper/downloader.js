/**
 * 小说文件下载器
 */
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import iconv from 'iconv-lite';
import config from '../../config/index.js';
import getLogger from '../utils/logger.js';
import { ensureDir, formatFileSize } from '../utils/file-utils.js';

const logger = getLogger();

/**
 * 下载小说文件
 * @param {string} downloadUrl - 下载链接
 * @param {string} savePath - 保存路径
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 下载结果
 */
export const downloadNovel = async (downloadUrl, savePath, options = {}) => {
  const { encoding = 'utf-8' } = options;

  logger.info(`开始下载: ${downloadUrl}`);

  try {
    // 确保目录存在
    await ensureDir(path.dirname(savePath));

    // 下载文件
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'arraybuffer',
      timeout: config.scraper.timeout * 2,
      headers: {
        'User-Agent': config.scraper.userAgent,
        'Referer': config.scraper.baseUrl,
      },
    });

    // 获取原始数据
    const buffer = Buffer.from(response.data);

    // 尝试检测编码
    let content;
    const detectedEncoding = detectEncoding(buffer);

    if (detectedEncoding && detectedEncoding !== 'utf-8') {
      logger.debug(`检测到编码: ${detectedEncoding}`);
      content = iconv.decode(buffer, detectedEncoding);
    } else {
      content = buffer.toString('utf-8');
    }

    // 统一转换为 UTF-8
    await fs.writeFile(savePath, content, 'utf-8');

    const stats = await fs.stat(savePath);
    const fileSize = formatFileSize(stats.size);

    logger.info(`下载完成: ${savePath} (${fileSize})`);

    return {
      success: true,
      path: savePath,
      size: stats.size,
      sizeFormatted: fileSize,
      encoding: detectedEncoding || 'utf-8',
    };
  } catch (error) {
    logger.error(`下载失败: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * 检测文本编码
 * @param {Buffer} buffer - 文件buffer
 * @returns {string|null} 编码名称
 */
const detectEncoding = (buffer) => {
  // 检查 BOM
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return 'utf-8';
  }
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return 'utf-16le';
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return 'utf-16be';
  }

  // 检查是否为 GBK 编码（常见于中文小说）
  const sample = buffer.slice(0, Math.min(buffer.length, 10000));
  let gbkScore = 0;
  let utf8Score = 0;

  for (let i = 0; i < sample.length - 1; i++) {
    const byte1 = sample[i];
    const byte2 = sample[i + 1];

    // GBK 编码范围
    if (
      (byte1 >= 0x81 && byte1 <= 0xfe && byte2 >= 0x40 && byte2 <= 0xfe) ||
      (byte1 >= 0xa1 && byte1 <= 0xf7 && byte2 >= 0xa1 && byte2 <= 0xfe)
    ) {
      gbkScore++;
    }

    // UTF-8 中文编码范围
    if (byte1 >= 0xe4 && byte1 <= 0xe9) {
      utf8Score++;
    }
  }

  // 如果 GBK 特征更明显，使用 GBK
  if (gbkScore > utf8Score * 1.5) {
    return 'gbk';
  }

  return null;
};

/**
 * 批量下载小说
 * @param {Array<Object>} books - 书籍列表（包含downloadUrl）
 * @param {string} saveDir - 保存目录
 * @returns {Promise<Array>} 下载结果列表
 */
export const downloadBatch = async (books, saveDir) => {
  const results = [];

  for (const book of books) {
    if (!book.downloadUrl) {
      logger.warn(`书籍 ${book.title} 没有下载链接`);
      results.push({
        bookId: book.id,
        title: book.title,
        success: false,
        error: '没有下载链接',
      });
      continue;
    }

    // 生成安全的文件名
    const safeName = book.title.replace(/[\\/:*?"<>|]/g, '_');
    const savePath = path.join(saveDir, `${safeName}.txt`);

    const result = await downloadNovel(book.downloadUrl, savePath);
    results.push({
      bookId: book.id,
      title: book.title,
      ...result,
    });

    // 延迟避免被封
    await new Promise((resolve) => setTimeout(resolve, config.scraper.delay));
  }

  const successCount = results.filter((r) => r.success).length;
  logger.info(`批量下载完成: ${successCount}/${results.length} 成功`);

  return results;
};

export default {
  downloadNovel,
  downloadBatch,
};
