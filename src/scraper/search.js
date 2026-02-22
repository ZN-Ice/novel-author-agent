/**
 * 小说搜索模块
 * 从知轩藏书网站搜索小说
 */
import config from '../../config/index.js';
import getLogger from '../utils/logger.js';
import { createPage, gotoPage, getHtml, delay } from './browser.js';
import * as cheerio from 'cheerio';

const logger = getLogger();

/**
 * 解析搜索结果页面
 * @param {string} html - 页面HTML
 * @returns {Array} 搜索结果列表
 */
const parseSearchResults = (html) => {
  const $ = cheerio.load(html);
  const results = [];

  // 查找搜索结果中的书籍条目 - 与排行榜页面结构类似
  $('mio-tile').each((_, element) => {
    const $tile = $(element);

    // 获取链接
    const $link = $tile.find('a[href*="/book/"]');
    const href = $link.attr('href');

    // 提取书籍ID
    const match = href?.match(/\/book\/(\d+)\.html/);
    if (!match) return;

    const bookId = match[1];

    // 获取标题
    let title = $tile.find('span.link').text().trim();
    if (!title) {
      title = $tile.find('h3.header').text().trim();
    }
    if (!title) {
      title = $link.text().trim();
    }

    // 清理标题
    title = title.replace(/《|》/g, '').trim();

    // 如果标题为空，跳过
    if (!title) {
      return;
    }

    // 获取作者
    let author = '';
    const authorText = $tile.text();
    const authorMatch = authorText.match(/作者[：:]\s*([^\n]+)/);
    if (authorMatch) {
      author = authorMatch[1].trim();
    }

    // 获取分类
    let category = '';
    const $category = $tile.find('.category, .tag');
    if ($category.length) {
      category = $category.text().trim();
    }

    // 获取字数
    let wordCount = '';
    const wordMatch = authorText.match(/([\d.]+[万千百]?)\s*字/);
    if (wordMatch) {
      wordCount = wordMatch[1];
    }

    // 避免重复
    if (results.some((b) => b.id === bookId)) {
      return;
    }

    results.push({
      id: bookId,
      title,
      author,
      category,
      wordCount,
      url: `${config.scraper.baseUrl}/book/${bookId}.html`,
    });
  });

  // 备用方案：直接查找书籍链接
  if (results.length === 0) {
    $('a[href*="/book/"]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href');
      const match = href?.match(/\/book\/(\d+)\.html/);
      if (!match) return;

      const bookId = match[1];
      let title = $link.find('span.link').text().trim() || $link.text().trim();
      title = title.replace(/《|》/g, '').trim();

      if (!title || results.some((b) => b.id === bookId)) return;

      const $parent = $link.closest('mio-tile, div, li, article');
      const parentText = $parent.text();
      const authorMatch = parentText.match(/作者[：:]\s*([^\n]+)/);
      const author = authorMatch ? authorMatch[1].trim() : '';

      results.push({
        id: bookId,
        title,
        author,
        category: '',
        wordCount: '',
        url: `${config.scraper.baseUrl}/book/${bookId}.html`,
      });
    });
  }

  return results;
};

/**
 * 搜索小说
 * @param {string} keyword - 搜索关键词
 * @returns {Promise<Object>} 搜索结果
 */
export const searchNovels = async (keyword) => {
  const encodedKeyword = encodeURIComponent(keyword);
  const url = `${config.scraper.baseUrl}/search?q=${encodedKeyword}`;

  logger.info(`搜索小说: "${keyword}"`);
  logger.debug(`搜索URL: ${url}`);

  const puppeteerPage = await createPage();
  try {
    await gotoPage(puppeteerPage, url);

    // 等待Angular渲染完成 - 等待书籍链接或无结果提示出现
    try {
      await puppeteerPage.waitForSelector('a[href*="/book/"], .no-results, .empty', { timeout: 10000 });
    } catch {
      logger.warn('等待搜索结果超时，尝试直接解析');
    }

    await delay(2000); // 额外等待内容渲染

    const html = await getHtml(puppeteerPage);

    // 调试：保存HTML到文件
    if (process.env.DEBUG) {
      const fs = await import('fs');
      await fs.promises.writeFile('debug-search.html', html);
      logger.debug('HTML已保存到 debug-search.html');
    }

    const results = parseSearchResults(html);

    logger.info(`搜索到 ${results.length} 个结果`);

    return {
      keyword,
      found: results.length > 0,
      count: results.length,
      results,
    };
  } finally {
    await puppeteerPage.close();
  }
};

/**
 * 精确匹配搜索 - 查找书名完全匹配的小说
 * @param {string} bookName - 书名
 * @returns {Promise<Object>} 搜索结果
 */
export const searchExactNovel = async (bookName) => {
  const searchResult = await searchNovels(bookName);

  if (!searchResult.found) {
    return {
      ...searchResult,
      exactMatch: null,
    };
  }

  // 查找精确匹配
  const exactMatch = searchResult.results.find(
    (book) => book.title === bookName || book.title.includes(bookName)
  );

  return {
    ...searchResult,
    exactMatch,
  };
};

/**
 * 交互式搜索 - 用于不确定书名时显示所有匹配选项
 * @param {string} keyword - 搜索关键词
 * @returns {Promise<Object>} 搜索结果，包含所有匹配项供用户选择
 */
export const searchWithOptions = async (keyword) => {
  const searchResult = await searchNovels(keyword);

  // 检查是否有精确匹配或以关键词开头的匹配
  const hasExactMatch = searchResult.results.some(
    (book) => book.title === keyword ||
              book.title.startsWith(keyword + '（') ||
              book.title.startsWith(keyword + '(') ||
              book.title.includes(keyword)
  );

  return {
    keyword: searchResult.keyword,
    found: searchResult.found,
    count: searchResult.count,
    results: searchResult.results,
    hasMultiple: searchResult.results.length > 1,
    hasExactMatch,
  };
};

export default {
  searchNovels,
  searchExactNovel,
  searchWithOptions,
};
