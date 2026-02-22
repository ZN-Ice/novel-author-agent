/**
 * 浏览器工具
 * 使用 Puppeteer 进行网页爬取
 */
import puppeteer from 'puppeteer';
import config from '../../config/index.js';
import getLogger from '../utils/logger.js';

const logger = getLogger();

let browserInstance = null;

/**
 * 获取浏览器实例
 * @returns {Promise<Browser>}
 */
export const getBrowser = async () => {
  if (!browserInstance || !browserInstance.isConnected()) {
    logger.info('启动浏览器实例...');
    browserInstance = await puppeteer.launch({
      headless: config.scraper.headless ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
    });
    logger.info('浏览器实例已启动');
  }
  return browserInstance;
};

/**
 * 关闭浏览器实例
 */
export const closeBrowser = async () => {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    logger.info('浏览器实例已关闭');
  }
};

/**
 * 创建新页面
 * @returns {Promise<Page>}
 */
export const createPage = async () => {
  const browser = await getBrowser();
  const page = await browser.newPage();

  // 设置 User-Agent
  await page.setUserAgent(config.scraper.userAgent);

  // 设置超时
  page.setDefaultTimeout(config.scraper.timeout);

  // 屏蔽不必要的资源
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const resourceType = request.resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
      request.abort();
    } else {
      request.continue();
    }
  });

  return page;
};

/**
 * 访问页面并等待渲染
 * @param {Page} page - Puppeteer页面对象
 * @param {string} url - 目标URL
 * @param {Object} options - 选项
 * @returns {Promise<Page>}
 */
export const gotoPage = async (page, url, options = {}) => {
  const { waitUntil = 'domcontentloaded', timeout = 60000 } = options;

  logger.debug(`访问页面: ${url}`);
  await page.goto(url, { waitUntil, timeout });

  // 等待页面完全加载
  await page.waitForFunction(
    () => document.readyState === 'complete',
    { timeout: 10000 }
  ).catch(() => {});

  // 额外等待Angular渲染
  await delay(3000);

  return page;
};

/**
 * 延迟执行
 * @param {number} ms - 延迟毫秒数
 */
export const delay = (ms = config.scraper.delay) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * 获取页面HTML内容
 * @param {Page} page - Puppeteer页面对象
 * @returns {Promise<string>}
 */
export const getHtml = async (page) => {
  return await page.content();
};

/**
 * 安全执行页面操作（带重试）
 * @param {Function} action - 操作函数
 * @param {number} retries - 重试次数
 * @returns {Promise<*>}
 */
export const safeAction = async (action, retries = 3) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const result = await action();
      return result;
    } catch (error) {
      lastError = error;
      logger.warn(`操作失败，第 ${i + 1} 次重试: ${error.message}`);
      await delay(config.scraper.delay * (i + 1));
    }
  }
  throw lastError;
};

export default {
  getBrowser,
  closeBrowser,
  createPage,
  gotoPage,
  delay,
  getHtml,
  safeAction,
};
