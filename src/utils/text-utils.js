/**
 * 文本处理工具
 */

/**
 * 清理文本中的多余空白
 * @param {string} text - 原始文本
 * @returns {string} 清理后的文本
 */
export const cleanText = (text) => {
  if (!text) return '';
  return text
    .replace(/[\r\n]+/g, '\n')      // 统一换行
    .replace(/[ \t]+/g, ' ')         // 压缩空格
    .replace(/^\s+|\s+$/gm, '')      // 去除行首尾空白
    .trim();
};

/**
 * 截断文本到指定长度
 * @param {string} text - 原始文本
 * @param {number} maxLength - 最大长度
 * @param {string} suffix - 后缀
 * @returns {string} 截断后的文本
 */
export const truncate = (text, maxLength = 100, suffix = '...') => {
  if (!text || text.length <= maxLength) {
    return text || '';
  }
  return text.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * 统计文本字数（中文按字计算，英文按词计算）
 * @param {string} text - 文本内容
 * @returns {number} 字数
 */
export const countWords = (text) => {
  if (!text) return 0;
  // 移除空白字符
  const cleanContent = text.replace(/\s/g, '');
  return cleanContent.length;
};

/**
 * 估算阅读时间（分钟）
 * @param {string} text - 文本内容
 * @param {number} wordsPerMinute - 每分钟阅读字数
 * @returns {number} 阅读时间（分钟）
 */
export const estimateReadingTime = (text, wordsPerMinute = 500) => {
  const words = countWords(text);
  return Math.ceil(words / wordsPerMinute);
};

/**
 * 分块处理长文本
 * @param {string} text - 原始文本
 * @param {number} chunkSize - 每块大小
 * @param {number} overlap - 重叠大小
 * @returns {string[]} 文本块数组
 */
export const splitIntoChunks = (text, chunkSize = 2000, overlap = 200) => {
  if (!text || text.length <= chunkSize) {
    return text ? [text] : [];
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // 尝试在句子边界处分割
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('。', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > start + chunkSize / 2) {
        end = breakPoint + 1;
      }
    }

    chunks.push(text.substring(start, end).trim());
    start = end - overlap;
    if (start < 0) start = 0;
  }

  return chunks.filter((chunk) => chunk.length > 0);
};

/**
 * 提取文本中的关键信息
 * @param {string} text - 文本内容
 * @returns {Object} 关键信息
 */
export const extractKeyInfo = (text) => {
  return {
    length: text?.length || 0,
    wordCount: countWords(text),
    readingTime: estimateReadingTime(text),
    lineCount: text?.split('\n').length || 0,
    paragraphCount: text?.split(/\n\s*\n/).filter((p) => p.trim()).length || 0,
  };
};

/**
 * 安全的JSON解析
 * @param {string} str - JSON字符串
 * @param {*} defaultValue - 默认值
 * @returns {*} 解析结果
 */
export const safeJsonParse = (str, defaultValue = null) => {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
};

export default {
  cleanText,
  truncate,
  countWords,
  estimateReadingTime,
  splitIntoChunks,
  extractKeyInfo,
  safeJsonParse,
};
