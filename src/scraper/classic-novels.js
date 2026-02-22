/**
 * 经典小说管理器
 * 管理经典小说的下载、存储和完整性检查
 */
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import config from '../../config/index.js';
import getLogger from '../utils/logger.js';
import { ensureDir, readJson, writeJson, formatFileSize } from '../utils/file-utils.js';
import { parseNovel } from '../parser/novel-parser.js';
import { getGLMClient } from '../llm/glm-client.js';

const logger = getLogger();

/**
 * 获取经典小说存储目录
 * @returns {string}
 */
export const getClassicNovelsDir = () => {
  return config.classicNovels.dir;
};

/**
 * 获取小说存储路径
 * @param {Object} bookInfo - 书籍信息
 * @returns {string}
 */
export const getNovelPath = (bookInfo) => {
  const safeName = (bookInfo.title || 'unknown').replace(/[\\/:*?"<>|]/g, '_');
  return path.join(getClassicNovelsDir(), `${safeName}.txt`);
};

/**
 * 获取小说元信息路径
 * @param {Object} bookInfo - 书籍信息
 * @returns {string}
 */
export const getMetaPath = (bookInfo) => {
  const safeName = (bookInfo.title || 'unknown').replace(/[\\/:*?"<>|]/g, '_');
  return path.join(getClassicNovelsDir(), `${safeName}.meta.json`);
};

/**
 * 检查小说是否已存在
 * @param {Object} bookInfo - 书籍信息
 * @returns {Promise<boolean>}
 */
export const novelExists = async (bookInfo) => {
  const novelPath = getNovelPath(bookInfo);
  return existsSync(novelPath);
};

/**
 * 脚本检查小说完整性
 * @param {string} filePath - 文件路径
 * @param {Object} bookInfo - 书籍信息
 * @returns {Promise<Object>} 检查结果
 */
export const checkIntegrityByScript = async (filePath, bookInfo) => {
  const result = {
    valid: false,
    issues: [],
    stats: {},
  };

  try {
    // 检查文件是否存在
    if (!existsSync(filePath)) {
      result.issues.push('文件不存在');
      return result;
    }

    // 读取文件内容
    const content = await fs.readFile(filePath, 'utf-8');

    // 基本检查
    if (!content || content.length < 1000) {
      result.issues.push('文件内容过短');
      return result;
    }

    // 解析小说结构
    const novelData = await parseNovel(filePath);

    result.stats = {
      fileSize: content.length,
      fileSizeFormatted: formatFileSize(content.length),
      chapterCount: novelData.chapterCount,
      totalWords: novelData.totalWords,
      avgWordsPerChapter: novelData.chapterStats.avgWords,
    };

    // 检查章节数量
    if (novelData.chapterCount < 10) {
      result.issues.push(`章节数量过少 (${novelData.chapterCount} 章)`);
    }

    // 检查字数
    const expectedWords = parseWordCount(bookInfo.wordCount);
    if (expectedWords > 0 && novelData.totalWords < expectedWords * 0.5) {
      result.issues.push(`字数严重不足 (期望约${expectedWords}字，实际${novelData.totalWords}字)`);
    }

    // 检查是否有明显的截断
    const lastChapter = novelData.chapters[novelData.chapters.length - 1];
    if (lastChapter && lastChapter.content) {
      const lastContent = lastChapter.content.trim();
      // 检查是否有明显的未完结标志
      if (lastContent.endsWith('...') || lastContent.endsWith('未完待续')) {
        result.issues.push('最后一章可能被截断');
      }
    }

    // 判断是否通过
    result.valid = result.issues.length === 0 && novelData.chapterCount >= 10;

    return result;
  } catch (error) {
    result.issues.push(`解析错误: ${error.message}`);
    return result;
  }
};

/**
 * 解析字数字符串
 * @param {string} wordCountStr - 字数字符串（如 "446.53万"）
 * @returns {number}
 */
const parseWordCount = (wordCountStr) => {
  if (!wordCountStr) return 0;

  const match = wordCountStr.match(/([\d.]+)\s*(万|千|百万)?/);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  const unit = match[2];

  switch (unit) {
    case '万':
      return Math.round(num * 10000);
    case '千':
      return Math.round(num * 1000);
    case '百万':
      return Math.round(num * 1000000);
    default:
      return Math.round(num);
  }
};

/**
 * 使用大模型检查小说完整性
 * @param {string} filePath - 文件路径
 * @param {Object} bookInfo - 书籍信息
 * @param {Object} scriptResult - 脚本检查结果
 * @returns {Promise<Object>} 检查结果
 */
export const checkIntegrityByLLM = async (filePath, bookInfo, scriptResult) => {
  const llm = getGLMClient();

  try {
    // 读取文件的开头和结尾部分
    const content = await fs.readFile(filePath, 'utf-8');
    const headContent = content.substring(0, 2000);
    const tailContent = content.substring(Math.max(0, content.length - 2000));

    // 获取章节标题样本
    const novelData = await parseNovel(filePath);
    const chapterSamples = novelData.chapters.slice(0, 5).map(c => c.title)
      .concat(novelData.chapters.slice(-5).map(c => c.title));

    const prompt = `请检查以下小说文件的完整性。

**书籍信息**:
- 书名: ${bookInfo.title}
- 作者: ${bookInfo.author}
- 预期字数: ${bookInfo.wordCount || '未知'}

**脚本检查结果**:
- 文件大小: ${scriptResult.stats.fileSizeFormatted}
- 章节数: ${scriptResult.stats.chapterCount}
- 总字数: ${scriptResult.stats.totalWords}
- 问题: ${scriptResult.issues.length > 0 ? scriptResult.issues.join(', ') : '无'}

**开头内容**:
${headContent}

**结尾内容**:
${tailContent}

**章节标题样本**:
${chapterSamples.join('\n')}

请判断这本小说是否完整，用JSON格式回复：
{
  "isComplete": true/false,
  "confidence": 0.0-1.0,
  "analysis": "简要分析",
  "issues": ["问题1", "问题2"]
}`;

    const result = await llm.sendMessage(
      '你是一个专业的小说编辑，擅长检查小说内容的完整性和质量。',
      prompt
    );

    if (result.success) {
      // 尝试解析JSON
      try {
        let jsonStr = result.content;
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        }
        const llmResult = JSON.parse(jsonStr);
        return {
          valid: llmResult.isComplete && llmResult.confidence > 0.7,
          confidence: llmResult.confidence,
          analysis: llmResult.analysis,
          issues: llmResult.issues || [],
        };
      } catch {
        // JSON解析失败，根据内容判断
        const isComplete = result.content.includes('完整') && !result.content.includes('不完整');
        return {
          valid: isComplete,
          confidence: 0.5,
          analysis: result.content.substring(0, 500),
          issues: [],
        };
      }
    }

    return {
      valid: false,
      confidence: 0,
      analysis: 'LLM检查失败',
      issues: [result.error],
    };
  } catch (error) {
    return {
      valid: false,
      confidence: 0,
      analysis: `LLM检查异常: ${error.message}`,
      issues: [error.message],
    };
  }
};

/**
 * 综合检查小说完整性
 * @param {Object} bookInfo - 书籍信息
 * @param {boolean} useLLM - 是否使用LLM检查
 * @returns {Promise<Object>} 检查结果
 */
export const checkNovelIntegrity = async (bookInfo, useLLM = true) => {
  const filePath = getNovelPath(bookInfo);

  // 首先检查文件是否存在
  const exists = await novelExists(bookInfo);
  if (!exists) {
    return {
      exists: false,
      valid: false,
      scriptCheck: null,
      llmCheck: null,
    };
  }

  // 脚本检查
  const scriptCheck = await checkIntegrityByScript(filePath, bookInfo);

  // 如果脚本检查通过（没有问题），直接认为完整
  if (scriptCheck.valid) {
    // 可选：使用LLM进行补充验证，但不影响最终结果
    let llmCheck = null;
    if (useLLM) {
      try {
        llmCheck = await checkIntegrityByLLM(filePath, bookInfo, scriptCheck);
      } catch (error) {
        logger.warn(`LLM检查失败: ${error.message}`);
      }
    }

    return {
      exists: true,
      valid: true, // 脚本检查通过，直接认为完整
      scriptCheck,
      llmCheck,
    };
  }

  // 脚本检查发现问题，使用LLM进一步确认
  if (useLLM) {
    const llmCheck = await checkIntegrityByLLM(filePath, bookInfo, scriptCheck);

    // 如果LLM确认有问题，则认为不完整
    // 如果LLM认为完整且置信度高，可以覆盖脚本检查结果
    if (llmCheck.valid && llmCheck.confidence > 0.8) {
      return {
        exists: true,
        valid: true,
        scriptCheck,
        llmCheck,
      };
    }

    return {
      exists: true,
      valid: false,
      scriptCheck,
      llmCheck,
    };
  }

  return {
    exists: true,
    valid: false,
    scriptCheck,
    llmCheck: null,
  };
};

/**
 * 保存小说元信息
 * @param {Object} bookInfo - 书籍信息
 * @param {Object} checkResult - 检查结果
 */
export const saveNovelMeta = async (bookInfo, checkResult) => {
  const metaPath = getMetaPath(bookInfo);
  const meta = {
    ...bookInfo,
    checkedAt: new Date().toISOString(),
    integrity: {
      valid: checkResult.valid,
      scriptCheck: checkResult.scriptCheck?.stats || {},
      llmCheck: checkResult.llmCheck ? {
        confidence: checkResult.llmCheck.confidence,
        analysis: checkResult.llmCheck.analysis,
      } : null,
    },
  };

  await writeJson(metaPath, meta);
};

/**
 * 读取小说元信息
 * @param {Object} bookInfo - 书籍信息
 * @returns {Promise<Object|null>}
 */
export const readNovelMeta = async (bookInfo) => {
  const metaPath = getMetaPath(bookInfo);
  return await readJson(metaPath);
};

/**
 * 列出所有已下载的经典小说
 * @returns {Promise<Array>}
 */
export const listClassicNovels = async () => {
  const dir = getClassicNovelsDir();
  await ensureDir(dir);

  const files = await fs.readdir(dir);
  const metaFiles = files.filter(f => f.endsWith('.meta.json'));

  const novels = [];
  for (const metaFile of metaFiles) {
    const meta = await readJson(path.join(dir, metaFile));
    if (meta) {
      novels.push(meta);
    }
  }

  return novels;
};

export default {
  getClassicNovelsDir,
  getNovelPath,
  getMetaPath,
  novelExists,
  checkIntegrityByScript,
  checkIntegrityByLLM,
  checkNovelIntegrity,
  saveNovelMeta,
  readNovelMeta,
  listClassicNovels,
};
