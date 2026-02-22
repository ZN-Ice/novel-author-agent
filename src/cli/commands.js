/**
 * CLI 命令处理
 */
import chalk from 'chalk';
import getLogger from '../utils/logger.js';
import { formatFileSize } from '../utils/file-utils.js';
import { getRankPage, getRankList, getTopBooks } from '../scraper/rank-list.js';
import { getBookInfo } from '../scraper/book-page.js';
import { downloadNovel } from '../scraper/downloader.js';
import { searchNovels, searchWithOptions } from '../scraper/search.js';
import { parseNovel, extractSample } from '../parser/novel-parser.js';
import {
  createWorkspace,
  getMeta,
  updateMeta,
  listWorkspaces,
  getWorkspacePath,
  getFilePath,
  deleteWorkspace,
  rebuildIndex,
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
import { writeText, writeJson, readText, ensureDir, readJson } from '../utils/file-utils.js';
import {
  getNovelPath,
  getNovelDir,
  novelExists,
  checkIntegrityByScript,
  createNovelDir,
  updateNovelMeta,
  saveChapterSplits,
  listClassicNovels,
  getClassicNovelsDir,
  deleteNovel,
  rebuildNovelIndex,
  getNovelInfo,
} from '../scraper/classic-novels.js';
import {
  matchReferenceNovels,
  extractSearchKeywords,
  buildCategoryIndex,
} from '../workspace/novel-index.js';
import path from 'path';
import config from '../../config/index.js';
import { validateConfig } from '../../config/index.js';
import { syncClassicNovels, syncWorkspaces, syncAllToCloud } from '../utils/cloud-sync.js';

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

    // 检查是否已存在（按标题）
    const exists = await novelExists(bookInfo.title);
    if (exists) {
      output.success('小说已存在，跳过下载');
      output.info('使用 classics 命令查看已下载的小说');
      return { skipped: true, bookInfo };
    }

    // 创建小说目录
    output.info('创建小说目录...');
    const novelDir = await createNovelDir(bookInfo);
    const seq = novelDir.seq;

    console.log(chalk.cyan(`  序号: #${seq}`));
    console.log(chalk.cyan(`  目录: ${novelDir.dirName}`));
    console.log();

    // 下载文件
    output.info('下载小说文件...');
    const savePath = await getNovelPath(seq);
    const result = await downloadNovel(bookInfo.downloadUrl, savePath);

    if (!result.success) {
      output.error(`下载失败: ${result.error}`);
      return null;
    }

    output.success(`下载完成: ${result.sizeFormatted}`);

    // 更新状态为已下载
    await updateNovelMeta(seq, { status: 'downloaded' });

    // 解析小说结构
    output.info('解析小说结构...');
    const novelData = await parseNovel(savePath);

    console.log();
    console.log(chalk.white(`  章节数: ${novelData.chapterCount}`));
    console.log(chalk.white(`  总字数: ${novelData.totalWords}`));
    console.log();

    // 保存章节拆分
    output.info('保存章节拆分...');
    await saveChapterSplits(seq, novelData);

    // 更新状态为已解析
    await updateNovelMeta(seq, {
      status: 'parsed',
      chapterCount: novelData.chapterCount,
      totalWords: novelData.totalWords,
    });

    // 分析大纲
    output.info('分析小说大纲...');
    const authorAgent = getAuthorAgent();
    const outlineResult = await authorAgent.analyzeOutline(novelData);

    if (outlineResult.success) {
      const analysisDir = path.join(getClassicNovelsDir(), novelDir.dirName, 'analysis');
      await ensureDir(analysisDir);
      await writeText(path.join(analysisDir, 'outline-analysis.txt'), outlineResult.content);
      output.success('大纲分析完成');
    }

    // 分析风格
    output.info('分析写作风格...');
    const styleResult = await authorAgent.analyzeStyle(novelData);

    if (styleResult.success) {
      const analysisDir = path.join(getClassicNovelsDir(), novelDir.dirName, 'analysis');
      await ensureDir(analysisDir);
      await writeText(path.join(analysisDir, 'style-analysis.txt'), styleResult.content);
      output.success('风格分析完成');
    }

    // 更新状态为已分析
    await updateNovelMeta(seq, { status: 'analyzed' });

    console.log();
    output.success('下载和处理完成');
    console.log();
    console.log(chalk.cyan('小说信息:'));
    console.log(chalk.white(`  序号: #${seq}`));
    console.log(chalk.white(`  书名: ${bookInfo.title}`));
    console.log(chalk.white(`  章节数: ${novelData.chapterCount}`));
    console.log(chalk.white(`  总字数: ${novelData.totalWords}`));
    console.log(chalk.white(`  目录: ${novelDir.path}`));

    // 同步到云盘
    output.info('同步到阿里云盘...');
    const syncResult = await syncClassicNovels();
    if (syncResult.success) {
      output.success('云盘同步完成');
    } else {
      output.warn(`云盘同步跳过: ${syncResult.error}`);
    }

    return {
      seq,
      bookInfo,
      novelData,
      path: novelDir.path,
    };
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
  output.title('工作空间列表');

  const books = await listWorkspaces();

  if (books.length === 0) {
    output.info('暂无工作空间');
    output.info('使用以下命令创建：');
    console.log(chalk.gray('  node src/index.js outline smart "我想写一本玄幻小说"'));
    return [];
  }

  console.log(chalk.dim('序号  小说名                        状态'));
  console.log(chalk.dim('─'.repeat(50)));

  books.forEach((book) => {
    const statusColors = {
      created: 'gray',
      downloaded: 'blue',
      analyzing: 'yellow',
      outlining: 'cyan',
      writing: 'magenta',
      completed: 'green',
    };
    const statusColor = statusColors[book.status] || 'white';
    const statusText = {
      created: '已创建',
      downloaded: '已下载',
      analyzing: '分析中',
      outlining: '大纲中',
      writing: '写作中',
      completed: '已完成',
    };
    const status = statusText[book.status] || book.status;

    // 格式化序号和标题
    const seq = String(book.seq || '?').padEnd(4);
    const title = (book.title || '未命名').substring(0, 20).padEnd(22);

    console.log(
      chalk.cyan(`#${seq}`),
      chalk.white(title),
      chalk[statusColor](status)
    );
  });

  console.log();
  output.info(`共 ${books.length} 个工作空间`);
  console.log();
  output.info('使用序号操作：');
  console.log(chalk.gray('  node src/index.js info 1'));
  console.log(chalk.gray('  node src/index.js outline review 1'));
  console.log(chalk.gray('  node src/index.js chapter write 1 1'));

  return books;
}

/**
 * 查看书籍详情
 */
export async function showBookInfo(bookId) {
  output.title('书籍详情');

  const meta = await getMeta(bookId);
  if (!meta) {
    output.error(`书籍不存在: #${bookId}`);
    return null;
  }

  console.log(chalk.cyan(`  序号: #${meta.seq || bookId}`));
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
 * 智能大纲创作 - 根据描述自动选择参考小说
 * @param {string} description - 用户描述
 * @param {Object} options - 选项
 */
export async function smartOutlineCreate(description, options = {}) {
  output.title('智能大纲创作');
  console.log(chalk.white(`描述: "${description}"`));
  console.log();

  const validation = validateConfig();
  if (!validation.valid) {
    output.error('配置错误:');
    validation.errors.forEach((err) => output.error(`  - ${err}`));
    return null;
  }

  try {
    // 步骤1: 分析描述，匹配参考小说
    output.info('分析描述，寻找参考小说...');
    const matchResult = await matchReferenceNovels(description, 3);

    if (matchResult.analyzedGenre) {
      console.log(chalk.cyan(`  分析类型: ${matchResult.analyzedGenre}`));
    }
    if (matchResult.analyzedThemes?.length) {
      console.log(chalk.cyan(`  分析主题: ${matchResult.analyzedThemes.join('、')}`));
    }

    // 检查是否有推荐
    let referenceOutlines = [];

    if (matchResult.recommendations?.length > 0) {
      console.log();
      output.success(`找到 ${matchResult.recommendations.length} 本参考小说:`);
      matchResult.recommendations.forEach((rec, i) => {
        console.log(chalk.white(`  ${i + 1}. 《${rec.title}》- ${rec.reason}`));
      });

      // 读取参考小说的分析结果
      for (const rec of matchResult.recommendations) {
        const novelPath = getNovelPath({ title: rec.title });
        const metaPath = novelPath.replace('.txt', '.meta.json');
        const meta = await readJson(metaPath);

        if (meta) {
          // 查找对应的工作空间
          const workspaces = await listWorkspaces();
          const workspace = workspaces.find(w => w.title === rec.title);

          if (workspace) {
            const analysisPath = await getFilePath(workspace.id, 'analysis', 'outline-analysis.txt');
            const analysis = await readText(analysisPath);
            referenceOutlines.push({
              title: rec.title,
              analysis: analysis || '',
            });
          }
        }
      }
    } else if (matchResult.suggestedKeywords?.length > 0) {
      console.log();
      output.warn('小说库中没有找到直接匹配的小说');
      output.info('建议搜索以下关键词下载参考小说:');
      matchResult.suggestedKeywords.forEach((kw, i) => {
        console.log(chalk.yellow(`  ${i + 1}. ${kw}`));
      });

      // 尝试自动下载
      if (options.autoDownload !== false) {
        console.log();
        output.info('尝试自动下载参考小说...');

        for (const keyword of matchResult.suggestedKeywords.slice(0, 2)) {
          try {
            const searchResult = await searchWithOptions(keyword);
            if (searchResult.found && searchResult.results.length > 0) {
              const book = searchResult.results[0];
              output.info(`下载: ${book.title}`);
              await downloadBook(book.id);
            }
          } catch (e) {
            output.warn(`搜索 "${keyword}" 失败: ${e.message}`);
          }
        }

        // 重新匹配
        output.info('重新匹配参考小说...');
        const newMatchResult = await matchReferenceNovels(description, 3);
        if (newMatchResult.recommendations?.length > 0) {
          matchResult.recommendations = newMatchResult.recommendations;
          referenceOutlines = [];

          for (const rec of matchResult.recommendations) {
            const workspaces = await listWorkspaces();
            const workspace = workspaces.find(w => w.title === rec.title);
            if (workspace) {
              const analysisPath = await getFilePath(workspace.id, 'analysis', 'outline-analysis.txt');
              const analysis = await readText(analysisPath);
              referenceOutlines.push({
                title: rec.title,
                analysis: analysis || '',
              });
            }
          }
        }
      }
    }

    // 步骤2: 创作大纲
    console.log();
    output.info('正在创作大纲...');

    const authorAgent = getAuthorAgent();
    const result = await authorAgent.createOutlineByDescription(description, {
      matchResult,
      referenceOutlines,
    });

    if (result.success) {
      // 创建新的工作空间保存大纲
      const workspace = await createWorkspace({
        title: options.title || `新小说-${Date.now()}`,
        category: matchResult.analyzedGenre || '未分类',
      });

      const outlinePath = await getFilePath(workspace.bookId, 'outline/draft', 'outline-v1.txt');
      await writeText(outlinePath, result.content);

      await updateMeta(workspace.bookId, {
        status: PHASES.OUTLINING,
        category: matchResult.analyzedGenre || '未分类',
      });

      await addProgress(workspace.bookId, {
        phase: PHASES.OUTLINING,
        action: '智能大纲创作',
        status: 'completed',
        details: {
          description,
          references: matchResult.recommendations?.map(r => r.title) || [],
        },
      });

      output.success('大纲创作完成');
      console.log();
      console.log(chalk.cyan(`工作空间: #${workspace.seq} ${workspace.meta.title}`));
      console.log();
      console.log(chalk.white(result.content.substring(0, 800) + '...'));

      // 同步到云盘
      output.info('同步到阿里云盘...');
      const syncResult = await syncWorkspaces();
      if (syncResult.success) {
        output.success('云盘同步完成');
      } else {
        output.warn(`云盘同步跳过: ${syncResult.error}`);
      }

      return {
        success: true,
        workspace,
        outline: result.content,
        references: matchResult.recommendations || [],
      };
    } else {
      output.error(`创作失败: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (error) {
    output.error(`智能大纲创作失败: ${error.message}`);
    throw error;
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

    // 同步到云盘
    output.info('同步到阿里云盘...');
    const syncResult = await syncWorkspaces();
    if (syncResult.success) {
      output.success('云盘同步完成');
    } else {
      output.warn(`云盘同步跳过: ${syncResult.error}`);
    }
  } else {
    output.error('清理失败');
  }

  return result;
}

/**
 * 重建索引
 */
export async function rebuildWorkspaceIndex() {
  output.title('重建工作空间索引');

  const index = await rebuildIndex();

  output.success(`索引重建完成`);
  console.log();
  console.log(chalk.white(`  工作空间数: ${Object.keys(index.books).length}`));
  console.log(chalk.white(`  下一个序号: ${index.nextSeq}`));

  return index;
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
  download <book-id>         下载指定书籍到 classic_novels 目录
  download-top <n>           下载排行榜前N本书
  search <keyword>           按书名搜索小说
  search-download <keyword>  搜索并下载小说（精确匹配时自动下载）
  classics                   列出已下载的经典小说
  list                       列出所有工作目录中的书籍
  info <book-id>             查看书籍详情
  progress <book-id>         查看进展
  analyze <book-id>          分析小说
  outline create <book-id>   创作大纲（指定书籍）
  outline smart <desc>       智能大纲创作（输入描述，自动找参考）
  outline review <book-id>   评价大纲
  outline optimize <book-id> 优化大纲
  chapter write <book-id> <num>  创作章节
  chapter review <book-id> <num> 评价章节
  clean <book-id>            清理工作目录

${chalk.yellow('说明:')}
  <book-id> 可以是序号（如 1, 2, 3）或完整目录名
  <desc> 是小说描述，如 "我想写一本玄幻小说"

${chalk.yellow('选项:')}
  --genre <type>             小说类型（大纲创作时使用）
  --theme <theme>            主题设定
  --title <title>            章节标题/小说名
  --no-auto-download         智能大纲时不自动下载参考小说

${chalk.yellow('示例:')}
  node src/index.js crawl 1
  node src/index.js search 序列
  node src/index.js search-download 第一序列 --auto
  node src/index.js download 6174
  node src/index.js classics
  node src/index.js list
  node src/index.js outline smart "我想写一本无限流的小说"
  node src/index.js outline smart "都市异能，主角觉醒超能力" --title 我的小说
  node src/index.js analyze 1
  node src/index.js outline create 1 --genre 玄幻
  node src/index.js chapter write 1 1
`);
}

/**
 * 列出已下载的经典小说
 */
export async function listClassics() {
  output.title('已下载的经典小说');

  const novels = await listClassicNovels();

  if (novels.length === 0) {
    output.info('暂无已下载的经典小说');
    output.info(`下载目录: ${getClassicNovelsDir()}`);
    output.info('使用以下命令下载：');
    console.log(chalk.gray('  node src/index.js search <书名>'));
    console.log(chalk.gray('  node src/index.js download <book-id>'));
    return [];
  }

  console.log(chalk.dim('序号  小说名                        作者          章节数'));
  console.log(chalk.dim('─'.repeat(65)));

  novels.forEach((novel) => {
    const statusIcon = novel.status === 'analyzed' ? chalk.green('✔') :
                       novel.status === 'parsed' ? chalk.blue('○') :
                       novel.status === 'downloaded' ? chalk.yellow('◐') :
                       chalk.gray('○');

    // 格式化序号和标题
    const seq = String(novel.seq || '?').padEnd(4);
    const title = (novel.title || '未命名').substring(0, 18).padEnd(20);
    const author = (novel.author || '未知').substring(0, 10).padEnd(12);
    const chapters = novel.chapterCount ? `${novel.chapterCount}章` : '?章';

    console.log(
      chalk.cyan(`#${seq}`),
      statusIcon,
      chalk.white(title),
      chalk.gray(author),
      chalk.dim(chapters)
    );
  });

  console.log();
  output.info(`共 ${novels.length} 本经典小说`);
  output.info(`存储目录: ${getClassicNovelsDir()}`);
  console.log();
  output.info('状态说明:');
  console.log(chalk.green('  ✔ 已分析'));
  console.log(chalk.blue('  ○ 已解析'));
  console.log(chalk.yellow('  ◐ 已下载'));
  console.log(chalk.gray('  ○ 已创建'));

  return novels;
}

/**
 * 搜索小说
 */
export async function searchBook(keyword) {
  output.title(`搜索小说: "${keyword}"`);

  try {
    const result = await searchWithOptions(keyword);

    if (!result.found) {
      output.warn(`未找到与 "${keyword}" 相关的小说`);
      console.log();
      output.info('建议：');
      output.info('  1. 检查书名是否正确');
      output.info('  2. 尝试使用更简短的关键词');
      output.info('  3. 使用部分书名进行搜索');
      return { found: false, results: [] };
    }

    output.success(`找到 ${result.count} 个结果`);
    console.log();

    result.results.forEach((book, index) => {
      const exactBadge = book.title === keyword ? chalk.green(' [精确匹配]') : '';
      console.log(
        chalk.dim(`${index + 1}.`),
        chalk.white(book.title),
        chalk.gray(`(${book.author || '未知作者'})`),
        chalk.dim(`[${book.id}]`),
        exactBadge
      );
    });

    console.log();

    if (result.hasMultiple && !result.hasExactMatch) {
      output.info('找到多个匹配结果，请使用完整的书籍ID下载：');
      console.log();
      result.results.forEach((book, index) => {
        console.log(chalk.gray(`  node src/index.js download ${book.id}  # ${book.title}`));
      });
    } else if (result.hasExactMatch) {
      const exactBook = result.results.find(b => b.title === keyword);
      if (exactBook) {
        output.info(`找到精确匹配，可以直接下载：`);
        console.log();
        console.log(chalk.gray(`  node src/index.js download ${exactBook.id}`));
      }
    }

    return result;
  } catch (error) {
    output.error(`搜索失败: ${error.message}`);
    throw error;
  } finally {
    await closeBrowser();
  }
}

/**
 * 搜索并下载小说
 * 如果找到精确匹配则直接下载，否则显示所有选项
 */
export async function searchAndDownload(keyword, autoDownload = false) {
  output.title(`搜索并下载: "${keyword}"`);

  try {
    const result = await searchWithOptions(keyword);

    if (!result.found) {
      output.warn(`未找到与 "${keyword}" 相关的小说`);
      return { found: false, downloaded: false, results: [] };
    }

    output.success(`找到 ${result.count} 个结果`);
    console.log();

    // 显示所有结果
    result.results.forEach((book, index) => {
      const exactBadge = book.title === keyword ? chalk.green(' [精确匹配]') :
                         book.title.startsWith(keyword + '（') || book.title.startsWith(keyword + '(') ?
                         chalk.green(' [精确匹配]') :
                         book.title.includes(keyword) ? chalk.cyan(' [包含关键词]') : '';
      console.log(
        chalk.dim(`${index + 1}.`),
        chalk.white(book.title),
        chalk.gray(`(${book.author || '未知作者'})`),
        chalk.dim(`[${book.id}]`),
        exactBadge
      );
    });

    console.log();

    // 查找最佳匹配（精确匹配或以关键词开头）
    const findBestMatch = () => {
      // 优先查找完全相等
      let match = result.results.find(b => b.title === keyword);
      if (match) return match;

      // 查找以关键词+括号开头的（如 "第一序列（校对版全本）"）
      match = result.results.find(b =>
        b.title.startsWith(keyword + '（') || b.title.startsWith(keyword + '(')
      );
      if (match) return match;

      // 查找包含关键词的
      match = result.results.find(b => b.title.includes(keyword));
      return match;
    };

    // 如果有精确匹配且启用自动下载，直接下载
    if (autoDownload && result.hasExactMatch) {
      const exactBook = findBestMatch();
      if (exactBook) {
        output.info(`找到精确匹配，开始下载: ${exactBook.title}`);
        console.log();
        // 注意：这里不调用 closeBrowser，因为 downloadBook 会处理
        const downloadResult = await downloadBook(exactBook.id);
        return {
          found: true,
          downloaded: !!downloadResult,
          autoDownloaded: true,
          selectedBook: exactBook,
          downloadResult,
          allResults: result.results,
        };
      }
    }

    // 如果只有一个结果，提示可以下载
    if (result.count === 1) {
      const book = result.results[0];
      output.info(`只有一个结果，可以下载：`);
      console.log();
      console.log(chalk.gray(`  node src/index.js download ${book.id}`));
    } else {
      output.info('找到多个结果，请选择要下载的书籍ID：');
      console.log();
      result.results.forEach((book, index) => {
        console.log(chalk.gray(`  node src/index.js download ${book.id}  # ${index + 1}. ${book.title}`));
      });
    }

    return {
      found: true,
      downloaded: false,
      autoDownloaded: false,
      allResults: result.results,
    };
  } catch (error) {
    output.error(`搜索下载失败: ${error.message}`);
    throw error;
  } finally {
    // 只有在没有自动下载的情况下才关闭浏览器
    // 如果自动下载，downloadBook 会处理关闭
  }
}

/**
 * 删除经典小说
 */
export async function deleteClassicNovel(seqOrDirName) {
  output.title('删除经典小说');

  const meta = await getNovelInfo(seqOrDirName);
  if (!meta) {
    output.error(`小说不存在: #${seqOrDirName}`);
    return false;
  }

  console.log(chalk.white(`  序号: #${meta.seq}`));
  console.log(chalk.white(`  书名: ${meta.title}`));
  console.log();

  const result = await deleteNovel(seqOrDirName);

  if (result) {
    output.success(`已删除: ${meta.title}`);

    // 同步到云盘
    output.info('同步到阿里云盘...');
    const syncResult = await syncClassicNovels();
    if (syncResult.success) {
      output.success('云盘同步完成');
    } else {
      output.warn(`云盘同步跳过: ${syncResult.error}`);
    }
  } else {
    output.error('删除失败');
  }

  return result;
}

/**
 * 重建经典小说索引
 */
export async function rebuildClassicNovelsIndex() {
  output.title('重建经典小说索引');

  const index = await rebuildNovelIndex();

  output.success(`索引重建完成`);
  console.log();
  console.log(chalk.white(`  小说数: ${Object.keys(index.novels).length}`));
  console.log(chalk.white(`  下一个序号: ${index.nextSeq}`));

  return index;
}

/**
 * 手动同步到阿里云盘
 */
export async function syncToCloud() {
  output.title('同步数据到阿里云盘');

  const result = await syncAllToCloud();

  console.log();
  console.log(chalk.cyan('同步结果:'));
  console.log(chalk.white(`  经典小说: ${result.results.classicNovels?.success ? '成功' : '失败'}`));
  console.log(chalk.white(`  工作空间: ${result.results.workspaces?.success ? '成功' : '失败'}`));

  if (result.success) {
    output.success('所有数据同步完成');
  } else {
    output.warn('部分数据同步失败');
    if (!result.results.classicNovels?.success) {
      console.log(chalk.yellow(`  经典小说失败原因: ${result.results.classicNovels?.error}`));
    }
    if (!result.results.workspaces?.success) {
      console.log(chalk.yellow(`  工作空间失败原因: ${result.results.workspaces?.error}`));
    }
  }

  return result;
}

/**
 * 查看云盘同步状态
 */
export async function checkSyncStatus() {
  output.title('云盘同步状态');

  const { isAliyunpanAvailable, checkSyncStatus: getStatus } = await import('../utils/cloud-sync.js');
  const status = await getStatus();

  console.log();
  console.log(chalk.white(`  CLI工具: ${status.tool}`));
  console.log(chalk.white(`  状态: ${status.available ? chalk.green('可用') : chalk.red('不可用')}`));
  console.log(chalk.white(`  云盘目录: ${status.cloudBaseDir}`));
  console.log();
  console.log(chalk.cyan('本地目录:'));
  console.log(chalk.white(`  经典小说: ${status.localDirs.classicNovels}`));
  console.log(chalk.white(`  工作空间: ${status.localDirs.workspaces}`));

  return status;
}

export default {
  crawlRank,
  downloadBook,
  downloadTopBooks,
  listClassics,
  listBooks,
  showBookInfo,
  showProgress,
  analyzeNovel,
  createOutline,
  smartOutlineCreate,
  reviewOutline,
  optimizeOutline,
  writeChapter,
  reviewChapter,
  cleanBook,
  rebuildWorkspaceIndex,
  showHelp,
  searchBook,
  searchAndDownload,
  deleteClassicNovel,
  rebuildClassicNovelsIndex,
  syncToCloud,
  checkSyncStatus,
};
