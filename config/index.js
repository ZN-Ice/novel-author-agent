/**
 * 配置管理
 * 统一管理应用配置和环境变量
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * 应用配置
 */
export const config = {
  // GLM API 配置
  glm: {
    apiKey: process.env.GLM_API_KEY || '',
    baseUrl: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-plus', // 使用 GLM-4-Plus 模型（GLM-5的调用名称）
    temperature: 0.7,
    maxTokens: 4096,
  },

  // 爬虫配置
  scraper: {
    baseUrl: 'https://zxcs.zip',
    downloadUrl: 'https://download.zxcs.zip',
    delay: parseInt(process.env.SCRAPER_DELAY) || 2000,
    timeout: parseInt(process.env.SCRAPER_TIMEOUT) || 30000,
    headless: process.env.SCRAPER_HEADLESS !== 'false',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },

  // 日志配置
  log: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || path.join(__dirname, '../logs'),
  },

  // 工作目录配置
  workspace: {
    dir: process.env.WORKSPACE_DIR || path.join(__dirname, '../workspaces'),
  },

  // 章节识别模式
  chapterPatterns: [
    /^第[零一二三四五六七八九十百千万0-9]+[章节回]\s*[：:]*\s*.+$/,  // 第一章 标题
    /^第[零一二三四五六七八九十百千万0-9]+[章节回]\s*$/,              // 第一章
    /^Chapter\s*\d+.*$/i,                                             // Chapter 1
    /^【第.+[章节回]】.*$/,                                            // 【第一章】标题
    /^[零一二三四五六七八九十百千万0-9]+[、.．].+$/,                   // 一、标题
  ],
};

/**
 * 验证配置
 * @returns {Object} 验证结果
 */
export const validateConfig = () => {
  const errors = [];

  if (!config.glm.apiKey) {
    errors.push('GLM_API_KEY 未设置，请在 .env 文件中配置');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default config;
