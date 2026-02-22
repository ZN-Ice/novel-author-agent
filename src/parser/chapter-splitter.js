/**
 * 章节拆分器
 * 识别和拆分小说章节
 */
import config from '../../config/index.js';
import getLogger from '../utils/logger.js';
import { cleanText, countWords } from '../utils/text-utils.js';

const logger = getLogger();

/**
 * 预定义的章节标题模式
 */
const CHAPTER_PATTERNS = [
  // 标准格式
  /^第[零一二三四五六七八九十百千万\d]+[章节回卷部集]\s*[：:_·]?\s*.{0,50}$/,
  // 带括号格式
  /^[【\[](第.{1,5}[章节回])[】\]].{0,50}$/,
  // 数字格式
  /^[\d]+[、.．].{1,50}$/,
  // 中文数字格式
  /^[零一二三四五六七八九十百千万]+[、.．].{1,50}$/,
  // Chapter 格式
  /^Chapter\s*\d+.*$/i,
  // 卷格式
  /^[第][零一二三四五六七八九十百千万\d]+[卷部].{0,30}$/,
  // 简单数字章节
  /^第[\d]+.{0,30}$/,
];

/**
 * 检测文本是否为章节标题
 * @param {string} line - 文本行
 * @returns {boolean}
 */
export const isChapterTitle = (line) => {
  if (!line || line.trim().length === 0) {
    return false;
  }

  const trimmed = line.trim();

  // 太长的行不是标题
  if (trimmed.length > 60) {
    return false;
  }

  // 检查是否匹配任何模式
  return CHAPTER_PATTERNS.some((pattern) => pattern.test(trimmed));
};

/**
 * 从文本中提取章节标题
 * @param {string} line - 文本行
 * @returns {Object|null} 章节信息
 */
export const parseChapterTitle = (line) => {
  if (!isChapterTitle(line)) {
    return null;
  }

  const trimmed = line.trim();

  // 提取章节号
  let number = null;
  let title = trimmed;

  // 尝试提取数字
  const numberMatch = trimmed.match(/第([零一二三四五六七八九十百千万\d]+)[章节回]/);
  if (numberMatch) {
    number = chineseToNumber(numberMatch[1]);
    title = trimmed;
  }

  // 尝试提取简单数字
  if (number === null) {
    const simpleMatch = trimmed.match(/^(\d+)/);
    if (simpleMatch) {
      number = parseInt(simpleMatch[1]);
    }
  }

  return {
    number,
    title,
    raw: trimmed,
  };
};

/**
 * 中文数字转阿拉伯数字
 * @param {string} str - 中文数字字符串
 * @returns {number}
 */
const chineseToNumber = (str) => {
  if (!str) return 0;

  // 如果是纯数字
  if (/^\d+$/.test(str)) {
    return parseInt(str);
  }

  const chineseNums = {
    零: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
    百: 100,
    千: 1000,
    万: 10000,
  };

  let result = 0;
  let temp = 0;
  let unit = 1;

  for (let i = str.length - 1; i >= 0; i--) {
    const char = str[i];
    const num = chineseNums[char];

    if (num === undefined) continue;

    if (num >= 10) {
      if (temp === 0) temp = 1;
      unit = num;
      result += temp * unit;
      temp = 0;
    } else {
      temp = num;
    }
  }

  result += temp;

  return result || parseInt(str) || 0;
};

/**
 * 拆分小说章节
 * @param {string} content - 小说内容
 * @param {Object} options - 选项
 * @returns {Array<Object>} 章节列表
 */
export const splitChapters = (content, options = {}) => {
  const { minChapterLength = 100, includeEmpty = false } = options;

  logger.info('开始拆分章节...');

  const lines = content.split('\n');
  const chapters = [];
  let currentChapter = null;
  let currentContent = [];
  let chapterCount = 0;

  for (const line of lines) {
    const chapterInfo = parseChapterTitle(line);

    if (chapterInfo) {
      // 保存上一章
      if (currentChapter && currentContent.length > 0) {
        const chapterText = currentContent.join('\n').trim();
        if (includeEmpty || chapterText.length >= minChapterLength) {
          currentChapter.content = chapterText;
          currentChapter.wordCount = countWords(chapterText);
          currentChapter.lineCount = currentContent.length;
          chapters.push(currentChapter);
        }
      }

      // 开始新章节
      chapterCount++;
      currentChapter = {
        number: chapterInfo.number || chapterCount,
        title: chapterInfo.title,
        content: '',
        wordCount: 0,
        lineCount: 0,
      };
      currentContent = [];
    } else if (currentChapter) {
      // 添加到当前章节内容
      currentContent.push(line);
    }
  }

  // 保存最后一章
  if (currentChapter && currentContent.length > 0) {
    const chapterText = currentContent.join('\n').trim();
    if (includeEmpty || chapterText.length >= minChapterLength) {
      currentChapter.content = chapterText;
      currentChapter.wordCount = countWords(chapterText);
      currentChapter.lineCount = currentContent.length;
      chapters.push(currentChapter);
    }
  }

  logger.info(`章节拆分完成，共 ${chapters.length} 章`);

  return chapters;
};

/**
 * 获取章节统计信息
 * @param {Array<Object>} chapters - 章节列表
 * @returns {Object} 统计信息
 */
export const getChapterStats = (chapters) => {
  if (!chapters || chapters.length === 0) {
    return {
      total: 0,
      totalWords: 0,
      avgWords: 0,
      maxWords: 0,
      minWords: 0,
    };
  }

  const wordCounts = chapters.map((c) => c.wordCount);

  return {
    total: chapters.length,
    totalWords: wordCounts.reduce((a, b) => a + b, 0),
    avgWords: Math.round(wordCounts.reduce((a, b) => a + b, 0) / chapters.length),
    maxWords: Math.max(...wordCounts),
    minWords: Math.min(...wordCounts),
  };
};

export default {
  isChapterTitle,
  parseChapterTitle,
  splitChapters,
  getChapterStats,
};
