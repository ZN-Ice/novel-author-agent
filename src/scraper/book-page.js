/**
 * 书籍详情页爬取
 */
import config from '../../config/index.js';
import getLogger from '../utils/logger.js';
import { createPage, gotoPage, getHtml, delay } from './browser.js';
import * as cheerio from 'cheerio';

const logger = getLogger();

/**
 * 解析书籍详情页
 * @param {string} html - 页面HTML
 * @param {string} bookId - 书籍ID
 * @returns {Object} 书籍详情
 */
const parseBookPage = (html, bookId) => {
  const $ = cheerio.load(html);
  const book = {
    id: bookId,
    url: `${config.scraper.baseUrl}/book/${bookId}.html`,
    title: '',
    author: '',
    summary: '',
    wordCount: '',
    status: '',
    category: '',
    tags: [],
    votes: {},
    downloadUrl: '',
  };

  // 提取标题
  const titleMatch = $('title').text().match(/《(.+?)》/);
  if (titleMatch) {
    book.title = titleMatch[1];
  }

  // 从页面内容提取信息
  const pageText = $.text();

  // 提取作者
  const authorMatch = pageText.match(/【作者】[：:]*\s*(.+)/);
  if (authorMatch) {
    book.author = authorMatch[1].trim();
  }

  // 提取字数
  const wordMatch = pageText.match(/【字数】[：:]*\s*(.+)/);
  if (wordMatch) {
    book.wordCount = wordMatch[1].trim();
  }

  // 提取状态
  const statusMatch = pageText.match(/【状态】[：:]*\s*(.+)/);
  if (statusMatch) {
    book.status = statusMatch[1].trim();
  }

  // 提取分类
  const categoryMatch = pageText.match(/【分类】[：:]*\s*(.+)/);
  if (categoryMatch) {
    book.category = categoryMatch[1].trim();
  }

  // 提取内容简介
  const summaryMatch = pageText.match(/【内容简介】[：:]*\s*([\s\S]+?)(?=【|$)/);
  if (summaryMatch) {
    book.summary = summaryMatch[1].trim();
  }

  // 提取下载链接
  const downloadMatch = html.match(/href="(https?:\/\/download\.zxcs\.zip\/[^"]+)"/);
  if (downloadMatch) {
    book.downloadUrl = downloadMatch[1];
  }

  // 提取评价数据
  const votes = { xiancao: 0, liangcao: 0, gancao: 0, kucao: 0, ducao: 0 };

  // 查找评价区域
  $('.downloads, [class*="vote"], [class*="rank"]').each((_, element) => {
    const text = $(element).text();
    const numberMatch = text.match(/(\d+)/);
    if (numberMatch && text.includes('仙草')) {
      votes.xiancao = parseInt(numberMatch[1]);
    } else if (numberMatch && text.includes('粮草')) {
      votes.liangcao = parseInt(numberMatch[1]);
    } else if (numberMatch && text.includes('干草')) {
      votes.gancao = parseInt(numberMatch[1]);
    } else if (numberMatch && text.includes('枯草')) {
      votes.kucao = parseInt(numberMatch[1]);
    } else if (numberMatch && text.includes('毒草')) {
      votes.ducao = parseInt(numberMatch[1]);
    }
  });

  book.votes = votes;

  return book;
};

/**
 * 获取书籍详情
 * @param {string} bookId - 书籍ID
 * @returns {Promise<Object>} 书籍详情
 */
export const getBookInfo = async (bookId) => {
  const url = `${config.scraper.baseUrl}/book/${bookId}.html`;
  logger.info(`获取书籍详情: ${url}`);

  const page = await createPage();
  try {
    await gotoPage(page, url);
    await delay(1000);

    const html = await getHtml(page);
    const book = parseBookPage(html, bookId);

    logger.info(`获取书籍成功: ${book.title} - ${book.author}`);
    return book;
  } finally {
    await page.close();
  }
};

/**
 * 批量获取书籍详情
 * @param {Array<string>} bookIds - 书籍ID列表
 * @returns {Promise<Array>} 书籍详情列表
 */
export const getBookInfoBatch = async (bookIds) => {
  const books = [];

  for (const bookId of bookIds) {
    try {
      const book = await getBookInfo(bookId);
      books.push(book);
      await delay(config.scraper.delay);
    } catch (error) {
      logger.error(`获取书籍 ${bookId} 失败: ${error.message}`);
    }
  }

  return books;
};

export default {
  getBookInfo,
  getBookInfoBatch,
};
