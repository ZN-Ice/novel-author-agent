/**
 * CLI 命令处理
 */
import chalk from 'chalk';
import getLogger from '../utils/logger.js';
import { formatFileSize } from '../utils/file-utils.js';
import { getRankPage, getRankList, getTopBooks } from '../scraper/rank-list.js';
import { getBookInfo } from '../scraper/book-page.js';
import { downloadNovel } from '../scraper/downloader.js';
import { parseNovel, extractSample } from '../parser/novel-parser.js';
import {
  createWorkspace,
  getMeta,
  updateMeta,
  listWorkspaces,
  getWorkspacePath,
  getFilePath,
  deleteWorkspace,
} from '../workspace/manager.js';
import {
  getProgress,
  addProgress,
  PHASES,
  ACTIONS,
  getProgressStats,
} from '../workspace/progress.js';
import { getAuthorAgent } from '../agents/author-agent.js';
import { getEditorAgent } from '../agents/editor-agent.js';
import { closeBrowser } from '../scraper/browser.js';
import { writeText, writeJson, readText, ensureDir } from '../utils/file-utils.js';
import path from 'path';
import config from '../../config/index.js';
import { validateConfig } from '../../config/index.js';

const logger = getLogger();

/**
 * 输出信息
 */
export const output = {
  info: (msg) => console.log(chalk.blue('ℹ'), msg),
  success: (msg) => console.log(chalk.green('✔'), msg),
  warn: (msg) => console.log(chalk.yellow('⚠'), msg),
  error: (msg) => console.log(chalk.red('✖'), msg),
  title: (msg) => console.log(chalk.bold.cyan(`\n${msg}\n`)),
  json: (data) => console.log(JSON.stringify(data, null, 2)),
};

/**
 * 爬取排行榜
 */
export async function crawlRank(page = 1) {
  output.title(`爬取排行榜第 ${page} 页`);

  try {
    const books = await getRankPage(page);

    output.success(`获取到 ${books.length} 本书`);
    console.log();

    books.forEach((book, index) => {
      console.log(
        chalk.dim(`${index + 1}.`),
        chalk.white(book.title),
        chalk.gray(`(${book.downloads} 下载)`),
        chalk.dim(`[${book.id}]`)
      );
    });

    return books;
  } catch (error) {
    output.error(`爬取失败: ${error.message}`);
    throw error;
  } finally {
    await closeBrowser();
  }
}

/**
 * 下载指定书籍
 */
export async function downloadBook(bookId) {
  output.title(`下载书籍 ${bookId}`);

  try {
    // 获取书籍信息
    output.info('获取书籍信息...');
    const bookInfo = await getBookInfo(bookId);

    if (!bookInfo.downloadUrl) {
      output.error('该书籍没有下载链接');
      return null;
    }

    console.log();
    console.log(chalk.white(`  书名: ${bookInfo.title}`));
    console.log(chalk.white(`  作者: ${bookInfo.author}`));
    console.log(chalk.white(`  分类: ${bookInfo.category}`));
    console.log(chalk.white(`  字数: ${bookInfo.wordCount}`));
    console.log();

    // 创建工作目录
    output.info('创建工作目录...');
    const workspace = await createWorkspace(bookInfo);

    // 下载文件
    output.info('下载小说文件...');
    const savePath = getFilePath(workspace.bookId, 'source', 'original.txt');
    const result = await downloadNovel(bookInfo.downloadUrl, savePath);

    if (result.success) {
      output.success(`下载完成: ${result.sizeFormatted}`);

      // 更新元信息
      await updateMeta(workspace.bookId, {
        status: PHASES.DOWNLOADED,
        fileSize: result.size,
      });

      // 记录进展
      await addProgress(workspace.bookId, {
        phase: PHASES.DOWNLOADED,
        action: ACTIONS.DOWNLOAD,
        status: 'completed',
        details: { fileSize: result.size, path: savePath },
      });

      return { ...workspace, downloadResult: result };
    } else {
      output.error(`下载失败: ${result.error}`);
      return null;
    }
  } catch (error) {
    output.error(`下载失败: ${error.message}`);
    throw error;
  } finally {
    await closeBrowser();
  }
}

/**
 * 下载排行榜前N本书
 */
export async function downloadTopBooks(count = 5) {
  output.title(`下载排行榜前 ${count} 本书`);

  try {
    const books = await getTopBooks(count);
    output.info(`找到 ${books.length} 本书`);

    const results = [];
    for (const book of books) {
      output.info(`下载: ${book.title}`);
      const result = await downloadBook(book.id);
      results.push({ book, result });
    }

    return results;
  } catch (error) {
    output.error(`批量下载失败: ${error.message}`);
    throw error;
  }
}

/**
 * 列出所有书籍
 */
export async function listBooks() {
  output.title('书籍列表');

  const books = await listWorkspaces();

  if (books.length === 0) {
    output.info('暂无书籍');
    return [];
  }

  books.forEach((book, index) => {
    const statusColors = {
      created: 'gray',
      downloaded: 'blue',
      analyzing: 'yellow',
      outlining: 'cyan',
      writing: 'magenta',
      completed: 'green',
    };
    const statusColor = statusColors[book.status] || 'white';

    console.log(
      chalk.dim(`${index + 1}.`),
      chalk.white(book.title),
      chalk.gray(`(${book.author})`),
      chalk[statusColor](`[${book.status}]`),
      chalk.dim(book.id.substring(0, 8))
    );
  });

  return books;
}

/**
 * 查看书籍详情
 */
export async function showBookInfo(bookId) {
  output.title('书籍详情');

  const meta = await getMeta(bookId);
  if (!meta) {
    output.error('书籍不存在');
    return null;
  }

  console.log(chalk.white(`  ID: ${meta.id}`));
  console.log(chalk.white(`  书名: ${meta.title}`));
  console.log(chalk.white(`  作者: ${meta.author}`));
  console.log(chalk.white(`  分类: ${meta.category || '未知'}`));
  console.log(chalk.white(`  字数: ${meta.wordCount || '未知'}`));
  console.log(chalk.white(`  状态: ${meta.status}`));
  console.log(chalk.white(`  创建时间: ${meta.createdAt}`));
  console.log(chalk.white(`  更新时间: ${meta.updatedAt}`));

  if (meta.source?.url) {
    console.log(chalk.white(`  来源: ${meta.source.url}`));
  }

  return meta;
}

/**
 * 查看进展
 */
export async function showProgress(bookId) {
  output.title('进展记录');

  const meta = await getMeta(bookId);
  if (!meta) {
    output.error('书籍不存在');
    return null;
  }

  console.log(chalk.white(`书名: ${meta.title}`));
  console.log(chalk.white(`状态: ${meta.status}`));
  console.log();

  const progress = await getProgress(bookId);
  const stats = await getProgressStats(bookId);

  console.log(chalk.cyan('统计信息:'));
  console.log(chalk.white(`  总记录数: ${stats.totalEntries}`));
  console.log(chalk.white(`  完成数: ${stats.completedCount}`));
  console.log(chalk.white(`  失败数: ${stats.failedCount}`));
  console.log();

  if (progress.history.length > 0) {
    console.log(chalk.cyan('历史记录:'));

    progress.history.slice(-10).reverse().forEach((entry, index) => {
      const statusIcon = entry.status === 'completed' ? chalk.green('✔') :
                        entry.status === 'failed' ? chalk.red('✖') :
                        chalk.yellow('⏳');

      console.log(
        statusIcon,
        chalk.white(entry.action),
        chalk.gray(new Date(entry.timestamp).toLocaleString())
      );
    });
  }

  return { meta, progress, stats };
}

/**
 * 分析小说
 */
export async function analyzeNovel(bookId) {
  output.title('分析小说');

  // 验证配置
  const validation = validateConfig();
  if (!validation.valid) {
    output.error('配置错误:');
    validation.errors.forEach((err) => output.error(`  - ${err}`));
    return null;
  }

  const meta = await getMeta(bookId);
  if (!meta) {
    output.error('书籍不存在');
    return null;
  }

  // 读取源文件
  const sourcePath = getFilePath(bookId, 'source', 'original.txt');
  const content = await readText(sourcePath);

  if (!content) {
    output.error('源文件不存在，请先下载');
    return null;
  }

  output.info('解析小说结构...');

  // 解析小说
  const novelData = await parseNovel(sourcePath);

  console.log();
  console.log(chalk.white(`  章节数: ${novelData.chapterCount}`));
  console.log(chalk.white(`  总字数: ${novelData.totalWords}`));
  console.log();

  // 保存解析结果
  const analysisPath = getFilePath(bookId, 'analysis', 'parsed.json');
  await writeJson(analysisPath, {
    chapterCount: novelData.chapterCount,
    totalWords: novelData.totalWords,
    chapterStats: novelData.chapterStats,
    chapterTitles: novelData.chapters.map((c) => ({
      number: c.number,
      title: c.title,
      wordCount: c.wordCount,
    })),
  });

  output.success('解析完成');

  // 分析大纲
  output.info('分析大纲结构...');
  await updateMeta(bookId, { status: PHASES.ANALYZING });
  await addProgress(bookId, {
    phase: PHASES.ANALYZING,
    action: ACTIONS.PARSE,
    status: 'completed',
    details: { chapters: novelData.chapterCount },
  });

  const authorAgent = getAuthorAgent();
  const outlineResult = await authorAgent.analyzeOutline(novelData);

  if (outlineResult.success) {
    const outlinePath = getFilePath(bookId, 'analysis', 'outline-analysis.txt');
    await writeText(outlinePath, outlineResult.content);
    output.success('大纲分析完成');

    await addProgress(bookId, {
      phase: PHASES.ANALYZED,
      action: ACTIONS.ANALYZE_OUTLINE,
      status: 'completed',
    });
  }

  // 分析风格
  output.info('分析写作风格...');
  const styleResult = await authorAgent.analyzeStyle(novelData);

  if (styleResult.success) {
    const stylePath = getFilePath(bookId, 'analysis', 'style-analysis.txt');
    await writeText(stylePath, styleResult.content);
    output.success('风格分析完成');

    await addProgress(bookId, {
      phase: PHASES.ANALYZED,
      action: ACTIONS.ANALYZE_STYLE,
      status: 'completed',
    });
  }

  await updateMeta(bookId, { status: PHASES.ANALYZED });

  return {
    novelData,
    outlineAnalysis: outlineResult,
    styleAnalysis: styleResult,
  };
}

/**
 * 创作大纲
 */
export async function createOutline(bookId, options = {}) {
  output.title('创作大纲');

  const validation = validateConfig();
  if (!validation.valid) {
    output.error('配置错误:');
    validation.errors.forEach((err) => output.error(`  - ${err}`));
    return null;
  }

  const meta = await getMeta(bookId);
  if (!meta) {
    output.error('书籍不存在');
    return null;
  }

  output.info('正在创作大纲...');

  const authorAgent = getAuthorAgent();
  const result = await authorAgent.createOutline({
    genre: options.genre || meta.category || '玄幻',
    theme: options.theme || '',
    protagonist: options.protagonist || '',
    setting: options.setting || '',
  });

  if (result.success) {
    const outlinePath = getFilePath(bookId, 'outline/draft', 'outline-v1.txt');
    await writeText(outlinePath, result.content);

    await updateMeta(bookId, { status: PHASES.OUTLINING });
    await addProgress(bookId, {
      phase: PHASES.OUTLINING,
      action: ACTIONS.CREATE_OUTLINE,
      status: 'completed',
    });

    output.success('大纲创作完成');
    console.log();
    console.log(chalk.white(result.content.substring(0, 500) + '...'));

    return result;
  } else {
    output.error(`创作失败: ${result.error}`);
    return result;
  }
}

/**
 * 评价大纲
 */
export async function reviewOutline(bookId) {
  output.title('评价大纲');

  const validation = validateConfig();
  if (!validation.valid) {
    output.error('配置错误:');
    validation.errors.forEach((err) => output.error(`  - ${err}`));
    return null;
  }

  const outlinePath = getFilePath(bookId, 'outline/draft', 'outline-v1.txt');
  const outline = await readText(outlinePath);

  if (!outline) {
    output.error('大纲不存在，请先创作大纲');
    return null;
  }

  output.info('正在评价大纲...');

  const editorAgent = getEditorAgent();
  const result = await editorAgent.reviewOutline(outline);

  if (result.success) {
    const reviewPath = getFilePath(bookId, 'outline/draft', 'review.json');
    await writeJson(reviewPath, result.review);

    await addProgress(bookId, {
      phase: PHASES.OUTLINING,
      action: ACTIONS.REVIEW_OUTLINE,
      status: 'completed',
      details: { score: result.review.overallScore },
    });

    output.success('评价完成');
    console.log();
    console.log(chalk.white(`总评分: ${result.review.overallScore}/10`));
    console.log();
    console.log(chalk.cyan('各维度评分:'));
    Object.entries(result.review.dimensions || {}).forEach(([key, value]) => {
      console.log(chalk.white(`  ${key}: ${value}/10`));
    });
    console.log();
    console.log(chalk.cyan('优点:'));
    (result.review.strengths || []).forEach((s) => {
      console.log(chalk.green(`  + ${s}`));
    });
    console.log();
    console.log(chalk.cyan('改进建议:'));
    (result.review.improvements || []).forEach((s) => {
      console.log(chalk.yellow(`  - ${s}`));
    });

    return result;
  } else {
    output.error(`评价失败: ${result.error}`);
    return result;
  }
}

/**
 * 优化大纲
 */
export async function optimizeOutline(bookId) {
  output.title('优化大纲');

  const validation = validateConfig();
  if (!validation.valid) {
    output.error('配置错误:');
    validation.errors.forEach((err) => output.error(`  - ${err}`));
    return null;
  }

  const outlinePath = getFilePath(bookId, 'outline/draft', 'outline-v1.txt');
  const reviewPath = getFilePath(bookId, 'outline/draft', 'review.json');

  const outline = await readText(outlinePath);
  const review = await readJson(reviewPath);

  if (!outline || !review) {
    output.error('大纲或评价不存在');
    return null;
  }

  output.info('正在优化大纲...');

  const authorAgent = getAuthorAgent();
  const result = await authorAgent.optimizeOutline(outline, review);

  if (result.success) {
    const version = Date.now();
    const optimizedPath = getFilePath(bookId, 'outline/final', `outline-v${version}.txt`);
    await writeText(optimizedPath, result.content);

    await addProgress(bookId, {
      phase: PHASES.OUTLINED,
      action: ACTIONS.OPTIMIZE_OUTLINE,
      status: 'completed',
    });

    await updateMeta(bookId, { status: PHASES.OUTLINED });

    output.success('大纲优化完成');

    return result;
  } else {
    output.error(`优化失败: ${result.error}`);
    return result;
  }
}

/**
 * 创作章节
 */
export async function writeChapter(bookId, chapterNum, options = {}) {
  output.title(`创作第 ${chapterNum} 章`);

  const validation = validateConfig();
  if (!validation.valid) {
    output.error('配置错误:');
    validation.errors.forEach((err) => output.error(`  - ${err}`));
    return null;
  }

  const meta = await getMeta(bookId);
  if (!meta) {
    output.error('书籍不存在');
    return null;
  }

  // 读取大纲
  const outlinePath = getFilePath(bookId, 'outline/final');
  let outline = '';
  try {
    const files = await import('fs/promises');
    const dir = await files.readdir(outlinePath);
    if (dir.length > 0) {
      const latestFile = dir.sort().pop();
      outline = await readText(path.join(outlinePath, latestFile));
    }
  } catch {
    output.warn('未找到最终大纲，使用草稿');
    outline = await readText(getFilePath(bookId, 'outline/draft', 'outline-v1.txt')) || '';
  }

  const chapterTitle = options.title || `第${chapterNum}章`;

  output.info('正在创作章节...');

  const authorAgent = getAuthorAgent();
  const result = await authorAgent.writeChapter({
    outline,
    chapterNumber: chapterNum,
    chapterTitle,
  });

  if (result.success) {
    const chapterPath = getFilePath(bookId, 'chapters/draft', `chapter-${chapterNum}.txt`);
    await writeText(chapterPath, result.content);

    await updateMeta(bookId, { status: PHASES.WRITING });
    await addProgress(bookId, {
      phase: PHASES.WRITING,
      action: ACTIONS.WRITE_CHAPTER,
      status: 'completed',
      details: { chapter: chapterNum },
    });

    output.success('章节创作完成');
    console.log();
    console.log(chalk.white(result.content.substring(0, 500) + '...'));

    return result;
  } else {
    output.error(`创作失败: ${result.error}`);
    return result;
  }
}

/**
 * 评价章节
 */
export async function reviewChapter(bookId, chapterNum) {
  output.title(`评价第 ${chapterNum} 章`);

  const validation = validateConfig();
  if (!validation.valid) {
    output.error('配置错误:');
    validation.errors.forEach((err) => output.error(`  - ${err}`));
    return null;
  }

  const chapterPath = getFilePath(bookId, 'chapters/draft', `chapter-${chapterNum}.txt`);
  const content = await readText(chapterPath);

  if (!content) {
    output.error('章节不存在，请先创作');
    return null;
  }

  output.info('正在评价章节...');

  const editorAgent = getEditorAgent();
  const result = await editorAgent.reviewChapter(content, { chapterNumber: chapterNum });

  if (result.success) {
    const reviewPath = getFilePath(bookId, 'chapters/draft', `chapter-${chapterNum}-review.json`);
    await writeJson(reviewPath, result.review);

    await addProgress(bookId, {
      phase: PHASES.WRITING,
      action: ACTIONS.REVIEW_CHAPTER,
      status: 'completed',
      details: { chapter: chapterNum, score: result.review.overallScore },
    });

    output.success('评价完成');
    console.log();
    console.log(chalk.white(`总评分: ${result.review.overallScore}/10`));
    console.log();
    console.log(chalk.cyan('各维度评分:'));
    Object.entries(result.review.dimensions || {}).forEach(([key, value]) => {
      console.log(chalk.white(`  ${key}: ${value}/10`));
    });
    console.log();
    console.log(chalk.cyan('优点:'));
    (result.review.strengths || []).forEach((s) => {
      console.log(chalk.green(`  + ${s}`));
    });
    console.log();
    console.log(chalk.cyan('改进建议:'));
    (result.review.improvements || []).forEach((s) => {
      console.log(chalk.yellow(`  - ${s}`));
    });

    return result;
  } else {
    output.error(`评价失败: ${result.error}`);
    return result;
  }
}

/**
 * 清理工作目录
 */
export async function cleanBook(bookId) {
  output.title('清理工作目录');

  const result = await deleteWorkspace(bookId);

  if (result) {
    output.success('清理完成');
  } else {
    output.error('清理失败');
  }

  return result;
}

/**
 * 显示帮助信息
 */
export function showHelp() {
  console.log(`
${chalk.cyan('novel-author-agent')} - 网络小说创作Agent系统

${chalk.yellow('用法:')}
  node src/index.js <command> [options]

${chalk.yellow('命令:')}
  crawl [page]               爬取排行榜（默认第1页）
  download <book-id>         下载指定书籍
  download-top <n>           下载排行榜前N本书
  list                       列出所有书籍
  info <book-id>             查看书籍详情
  progress <book-id>         查看进展
  analyze <book-id>          分析小说
  outline create <book-id>   创作大纲
  outline review <book-id>   评价大纲
  outline optimize <book-id> 优化大纲
  chapter write <book-id> <num>  创作章节
  chapter review <book-id> <num> 评价章节
  clean <book-id>            清理工作目录

${chalk.yellow('选项:')}
  --genre <type>             小说类型（大纲创作时使用）
  --theme <theme>            主题设定
  --title <title>            章节标题

${chalk.yellow('示例:')}
  node src/index.js crawl 1
  node src/index.js download 6174
  node src/index.js analyze uuid-xxx
  node src/index.js outline create uuid-xxx --genre 玄幻
  node src/index.js chapter write uuid-xxx 1
`);
}

export default {
  crawlRank,
  downloadBook,
  downloadTopBooks,
  listBooks,
  showBookInfo,
  showProgress,
  analyzeNovel,
  createOutline,
  reviewOutline,
  optimizeOutline,
  writeChapter,
  reviewChapter,
  cleanBook,
  showHelp,
};
