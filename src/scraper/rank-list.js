/**
 * 排行榜爬取
 * 从知轩藏书网站获取下载排行榜
 */
import config from '../../config/index.js';
import getLogger from '../utils/logger.js';
import { createPage, gotoPage, getHtml, delay, closeBrowser } from './browser.js';
import * as cheerio from 'cheerio';

const logger = getLogger();

/**
 * 从排行榜页面提取书籍列表
 * @param {string} html - 页面HTML
 * @returns {Array} 书籍列表
 */
const parseRankList = (html) => {
  const $ = cheerio.load(html);
  const books = [];

  // 查找排行榜中的书籍条目 - 使用更精确的选择器
  $('mio-tile').each((_, element) => {
    const $tile = $(element);

    // 获取链接
    const $link = $tile.find('a[href*="/book/"]');
    const href = $link.attr('href');

    // 提取书籍ID
    const match = href?.match(/\/book\/(\d+)\.html/);
    if (!match) return;

    const bookId = match[1];

    // 获取标题 - 从 span.link 或 h3.header 中获取
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

    // 提取下载量
    const downloadsText = $tile.find('.downloads').text();
    const downloadsMatch = downloadsText?.match(/(\d+)/);
    const downloads = downloadsMatch ? parseInt(downloadsMatch[1]) : 0;

    // 避免重复
    if (books.some((b) => b.id === bookId)) {
      return;
    }

    books.push({
      id: bookId,
      title,
      url: `${config.scraper.baseUrl}/book/${bookId}.html`,
      downloads,
    });
  });

  // 备用方案：如果没有找到mio-tile，使用旧方法
  if (books.length === 0) {
    $('a[href*="/book/"]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href');
      const match = href?.match(/\/book\/(\d+)\.html/);
      if (!match) return;

      const bookId = match[1];
      let title = $link.find('span.link').text().trim() || $link.text().trim();
      title = title.replace(/《|》/g, '').trim();

      if (!title || books.some((b) => b.id === bookId)) return;

      const $parent = $link.closest('mio-tile, div, li, article');
      const downloadsText = $parent.find('.downloads').text();
      const downloadsMatch = downloadsText?.match(/(\d+)/);
      const downloads = downloadsMatch ? parseInt(downloadsMatch[1]) : 0;

      books.push({
        id: bookId,
        title,
        url: `${config.scraper.baseUrl}/book/${bookId}.html`,
        downloads,
      });
    });
  }

  return books;
};

/**
 * 获取单页排行榜
 * @param {number} page - 页码
 * @returns {Promise<Array>} 书籍列表
 */
export const getRankPage = async (page = 1) => {
  const url = `${config.scraper.baseUrl}/rank/topdownload${page > 1 ? `?page=${page}` : ''}`;
  logger.info(`获取排行榜第 ${page} 页: ${url}`);

  const puppeteerPage = await createPage();
  try {
    await gotoPage(puppeteerPage, url);

    // 等待Angular渲染完成 - 等待书籍链接出现
    try {
      await puppeteerPage.waitForSelector('a[href*="/book/"]', { timeout: 10000 });
    } catch {
      logger.warn('等待书籍链接超时，尝试直接解析');
    }

    await delay(2000); // 额外等待内容渲染

    const html = await getHtml(puppeteerPage);

    // 调试：保存HTML到文件
    if (process.env.DEBUG) {
      const fs = await import('fs');
      await fs.promises.writeFile('debug-rank.html', html);
      logger.debug('HTML已保存到 debug-rank.html');
    }

    const books = parseRankList(html);

    logger.info(`第 ${page} 页获取到 ${books.length} 本书`);
    return books;
  } finally {
    await puppeteerPage.close();
  }
};

/**
 * 获取多页排行榜
 * @param {number} maxPages - 最大页数
 * @returns {Promise<Array>} 书籍列表
 */
export const getRankList = async (maxPages = 1) => {
  const allBooks = [];

  for (let page = 1; page <= maxPages; page++) {
    const books = await getRankPage(page);
    allBooks.push(...books);

    if (page < maxPages) {
      await delay(config.scraper.delay);
    }
  }

  // 按下载量排序
  allBooks.sort((a, b) => b.downloads - a.downloads);

  logger.info(`排行榜共获取 ${allBooks.length} 本书`);
  return allBooks;
};

/**
 * 获取排行榜前N本书
 * @param {number} count - 数量
 * @returns {Promise<Array>} 书籍列表
 */
export const getTopBooks = async (count = 10) => {
  const books = [];
  let page = 1;

  while (books.length < count) {
    const pageBooks = await getRankPage(page);
    if (pageBooks.length === 0) break;

    books.push(...pageBooks);
    page++;

    await delay(config.scraper.delay);
  }

  // 去重并排序
  const uniqueBooks = Array.from(
    new Map(books.map((b) => [b.id, b])).values()
  );
  uniqueBooks.sort((a, b) => b.downloads - a.downloads);

  return uniqueBooks.slice(0, count);
};

export default {
  getRankPage,
  getRankList,
  getTopBooks,
};
