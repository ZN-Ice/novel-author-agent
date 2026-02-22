/**
 * 小说解析器
 * 解析小说文件并提取结构化信息
 */
import path from 'path';
import getLogger from '../utils/logger.js';
import { readText } from '../utils/file-utils.js';
import { countWords, extractKeyInfo } from '../utils/text-utils.js';
import { splitChapters, getChapterStats } from './chapter-splitter.js';

const logger = getLogger();

/**
 * 解析小说文件
 * @param {string} filePath - 文件路径
 * @param {Object} options - 解析选项
 * @returns {Promise<Object>} 解析结果
 */
export const parseNovel = async (filePath, options = {}) => {
  logger.info(`开始解析小说: ${filePath}`);

  const content = await readText(filePath);
  if (!content) {
    throw new Error(`无法读取文件: ${filePath}`);
  }

  const fileName = path.basename(filePath, path.extname(filePath));

  // 拆分章节
  const chapters = splitChapters(content, options);
  const stats = getChapterStats(chapters);

  // 提取基本信息
  const result = {
    fileName,
    filePath,
    fileSize: content.length,
    totalCharacters: content.length,
    totalWords: countWords(content),
    chapterCount: chapters.length,
    chapterStats: stats,
    chapters,
    rawContent: content,
    parsedAt: new Date().toISOString(),
  };

  logger.info(
    `小说解析完成: ${chapters.length}章, ${stats.totalWords}字`
  );

  return result;
};

/**
 * 提取小说样本（用于分析）
 * @param {Object} novelData - 解析后的小说数据
 * @param {Object} options - 选项
 * @returns {Object} 样本数据
 */
export const extractSample = (novelData, options = {}) => {
  const {
    chapterCount = 5,
    maxWordsPerChapter = 3000,
    includeFirstChapter = true,
    includeLastChapter = true,
  } = options;

  const chapters = novelData.chapters;
  const samples = [];

  if (chapters.length === 0) {
    return { samples: [], description: '无章节可提取' };
  }

  // 第一章
  if (includeFirstChapter && chapters.length > 0) {
    const chapter = chapters[0];
    samples.push({
      position: 'first',
      number: chapter.number,
      title: chapter.title,
      content: truncateContent(chapter.content, maxWordsPerChapter),
      wordCount: chapter.wordCount,
    });
  }

  // 中间章节
  const middleStart = includeFirstChapter ? 1 : 0;
  const middleEnd = includeLastChapter ? chapters.length - 1 : chapters.length;
  const middleRange = middleEnd - middleStart;

  if (middleRange > 0 && chapterCount > (includeFirstChapter ? 1 : 0) + (includeLastChapter ? 1 : 0)) {
    const step = Math.max(1, Math.floor(middleRange / (chapterCount - (includeFirstChapter ? 1 : 0) - (includeLastChapter ? 1 : 0))));

    for (let i = middleStart; i < middleEnd && samples.length < chapterCount - (includeLastChapter ? 1 : 0); i += step) {
      const chapter = chapters[i];
      samples.push({
        position: 'middle',
        number: chapter.number,
        title: chapter.title,
        content: truncateContent(chapter.content, maxWordsPerChapter),
        wordCount: chapter.wordCount,
      });
    }
  }

  // 最后一章
  if (includeLastChapter && chapters.length > 1) {
    const chapter = chapters[chapters.length - 1];
    samples.push({
      position: 'last',
      number: chapter.number,
      title: chapter.title,
      content: truncateContent(chapter.content, maxWordsPerChapter),
      wordCount: chapter.wordCount,
    });
  }

  return {
    samples,
    totalChapters: chapters.length,
    sampleRatio: samples.length / chapters.length,
  };
};

/**
 * 截断内容到指定长度
 * @param {string} content - 内容
 * @param {number} maxWords - 最大字数
 * @returns {string}
 */
const truncateContent = (content, maxWords) => {
  if (!content || content.length <= maxWords) {
    return content;
  }

  // 尝试在句号处截断
  const truncated = content.substring(0, maxWords);
  const lastPeriod = truncated.lastIndexOf('。');

  if (lastPeriod > maxWords * 0.8) {
    return truncated.substring(0, lastPeriod + 1);
  }

  return truncated + '...';
};

/**
 * 获取小说结构摘要
 * @param {Object} novelData - 解析后的小说数据
 * @returns {Object} 结构摘要
 */
export const getStructureSummary = (novelData) => {
  const { chapters, chapterStats } = novelData;

  // 分析章节长度分布
  const lengths = chapters.map((c) => c.wordCount);
  const avgLength = chapterStats.avgWords;

  const shortChapters = chapters.filter((c) => c.wordCount < avgLength * 0.5).length;
  const mediumChapters = chapters.filter((c) => c.wordCount >= avgLength * 0.5 && c.wordCount <= avgLength * 1.5).length;
  const longChapters = chapters.filter((c) => c.wordCount > avgLength * 1.5).length;

  return {
    totalChapters: chapters.length,
    totalWords: chapterStats.totalWords,
    averageChapterLength: avgLength,
    lengthDistribution: {
      short: shortChapters,
      medium: mediumChapters,
      long: longChapters,
    },
    chapterTitleSamples: chapters.slice(0, 10).map((c) => c.title),
  };
};

export default {
  parseNovel,
  extractSample,
  getStructureSummary,
};
