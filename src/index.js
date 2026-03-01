#!/usr/bin/env node

/**
 * 网络小说创作Agent系统 - CLI入口
 */
import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 读取 package.json
const pkgPath = path.join(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

// 导入命令处理函数
import commands from './cli/commands.js';

const program = new Command();

program
  .name('novel')
  .description('网络小说创作Agent系统 - 使用AI辅助小说创作')
  .version(pkg.version);

// crawl 命令
program
  .command('crawl [page]')
  .description('爬取排行榜')
  .action(async (page = 1) => {
    await commands.crawlRank(parseInt(page));
    process.exit(0);
  });

// download 命令
program
  .command('download <bookId>')
  .description('下载指定书籍')
  .action(async (bookId) => {
    await commands.downloadBook(bookId);
    process.exit(0);
  });

// download-top 命令
program
  .command('download-top <count>')
  .description('下载排行榜前N本书')
  .action(async (count) => {
    await commands.downloadTopBooks(parseInt(count));
    process.exit(0);
  });

// search 命令 - 搜索小说
program
  .command('search <keyword>')
  .description('按书名搜索小说')
  .action(async (keyword) => {
    await commands.searchBook(keyword);
    process.exit(0);
  });

// search-download 命令 - 搜索并下载小说
program
  .command('search-download <keyword>')
  .description('搜索并下载小说（精确匹配时自动下载）')
  .option('--auto', '自动下载精确匹配的结果')
  .action(async (keyword, options) => {
    await commands.searchAndDownload(keyword, options.auto);
    process.exit(0);
  });

// classics 命令 - 列出已下载的经典小说
program
  .command('classics')
  .description('列出已下载的经典小说')
  .action(async () => {
    await commands.listClassics();
    process.exit(0);
  });

// list 命令
program
  .command('list')
  .description('列出所有书籍')
  .action(async () => {
    await commands.listBooks();
    process.exit(0);
  });

// info 命令
program
  .command('info <bookId>')
  .description('查看书籍详情')
  .action(async (bookId) => {
    await commands.showBookInfo(bookId);
    process.exit(0);
  });

// progress 命令
program
  .command('progress <bookId>')
  .description('查看进展')
  .action(async (bookId) => {
    await commands.showProgress(bookId);
    process.exit(0);
  });

// analyze 命令
program
  .command('analyze <bookId>')
  .description('分析小说')
  .action(async (bookId) => {
    await commands.analyzeNovel(bookId);
    process.exit(0);
  });

// outline 命令组
const outlineCmd = program
  .command('outline')
  .description('大纲相关操作');

outlineCmd
  .command('create <bookId>')
  .description('创作大纲')
  .option('--genre <genre>', '小说类型')
  .option('--theme <theme>', '主题设定')
  .option('--protagonist <protagonist>', '主角设定')
  .option('--setting <setting>', '世界观设定')
  .option('--compile <instruction>', '自然语言编译指令')
  .action(async (bookId, options) => {
    await commands.createOutline(bookId, options);
    process.exit(0);
  });

outlineCmd
  .command('smart <description>')
  .description('智能大纲创作（输入描述，自动匹配参考小说）')
  .option('--title <title>', '小说名称')
  .option('--no-auto-download', '不自动下载参考小说')
  .action(async (description, options) => {
    await commands.smartOutlineCreate(description, {
      title: options.title,
      autoDownload: options.autoDownload !== false,
    });
    process.exit(0);
  });

outlineCmd
  .command('review <bookId>')
  .description('评价大纲')
  .option('--compile <instruction>', '自然语言编译指令')
  .action(async (bookId, options) => {
    await commands.reviewOutline(bookId, options);
    process.exit(0);
  });

outlineCmd
  .command('optimize <bookId>')
  .description('优化大纲')
  .option('--compile <instruction>', '自然语言编译指令')
  .action(async (bookId, options) => {
    await commands.optimizeOutline(bookId, options);
    process.exit(0);
  });

// chapter 命令组
const chapterCmd = program
  .command('chapter')
  .description('章节相关操作');

chapterCmd
  .command('write <bookId> <chapterNum>')
  .description('创作章节')
  .option('--title <title>', '章节标题')
  .option('--compile <instruction>', '自然语言编译指令')
  .action(async (bookId, chapterNum, options) => {
    await commands.writeChapter(bookId, parseInt(chapterNum), options);
    process.exit(0);
  });

chapterCmd
  .command('review <bookId> <chapterNum>')
  .description('评价章节')
  .option('--compile <instruction>', '自然语言编译指令')
  .action(async (bookId, chapterNum, options) => {
    await commands.reviewChapter(bookId, parseInt(chapterNum), options);
    process.exit(0);
  });

// clean 命令
program
  .command('clean <bookId>')
  .description('清理工作目录')
  .action(async (bookId) => {
    await commands.cleanBook(bookId);
    process.exit(0);
  });

// rebuild-index 命令
program
  .command('rebuild-index')
  .description('重建工作空间索引')
  .action(async () => {
    await commands.rebuildWorkspaceIndex();
    process.exit(0);
  });

// delete-classic 命令 - 删除经典小说
program
  .command('delete-classic <seq>')
  .description('删除经典小说（按序号）')
  .action(async (seq) => {
    await commands.deleteClassicNovel(seq);
    process.exit(0);
  });

// rebuild-classics-index 命令 - 重建经典小说索引
program
  .command('rebuild-classics-index')
  .description('重建经典小说索引')
  .action(async () => {
    await commands.rebuildClassicNovelsIndex();
    process.exit(0);
  });

// sync 命令 - 同步到 GitHub
program
  .command('sync')
  .description('手动同步数据到 GitHub')
  .action(async () => {
    await commands.syncToCloud();
    process.exit(0);
  });

// sync-status 命令 - 查看同步状态
program
  .command('sync-status')
  .description('查看 GitHub 同步状态')
  .action(async () => {
    await commands.checkSyncStatus();
    process.exit(0);
  });

// download-cloud 命令 - 从 GitHub 下载数据
program
  .command('download-cloud')
  .description('从 GitHub 下载数据到本地')
  .action(async () => {
    await commands.downloadFromCloud();
    process.exit(0);
  });

// 错误处理
program.exitOverride((err) => {
  if (err.code === 'commander.help' || err.code === 'commander.version' || err.code === 'commander.helpDisplayed') {
    process.exit(0);
  }
  console.error(chalk.red(`错误: ${err.message}`));
  process.exit(1);
});

program.parseAsync().catch(() => {
  // 忽略，已由 exitOverride 处理
});
