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

  // 查找排行榜中的书籍条目
  $('a[href*="/book/"]').each((_, element) => {
    const $link = $(element);
    const href = $link.attr('href');

    // 提取书籍ID
    const match = href?.match(/\/book\/(\d+)\.html/);
    if (!match) return;

    const bookId = match[1];

    // 获取标题（从链接文本或子元素）
    let title = $link.text().trim();

    // 如果标题为空或包含"下载"，跳过
    if (!title || title.includes('下载') || title.includes('阅读')) {
      return;
    }

    // 提取下载量
    const $parent = $link.closest('div, li, article');
    const downloadsText = $parent.find('.downloads').text();
    const downloadsMatch = downloadsText?.match(/(\d+)/);
    const downloads = downloadsMatch ? parseInt(downloadsMatch[1]) : 0;

    // 避免重复
    if (books.some((b) => b.id === bookId)) {
      return;
    }

    books.push({
      id: bookId,
      title: title.replace(/《|》/g, '').trim(),
      url: `${config.scraper.baseUrl}/book/${bookId}.html`,
      downloads,
    });
  });

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
    await delay(1000); // 等待内容渲染

    const html = await getHtml(puppeteerPage);
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
