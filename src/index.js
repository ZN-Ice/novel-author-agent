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
  .action(async (bookId, options) => {
    await commands.createOutline(bookId, options);
    process.exit(0);
  });

outlineCmd
  .command('review <bookId>')
  .description('评价大纲')
  .action(async (bookId) => {
    await commands.reviewOutline(bookId);
    process.exit(0);
  });

outlineCmd
  .command('optimize <bookId>')
  .description('优化大纲')
  .action(async (bookId) => {
    await commands.optimizeOutline(bookId);
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
  .action(async (bookId, chapterNum, options) => {
    await commands.writeChapter(bookId, parseInt(chapterNum), options);
    process.exit(0);
  });

chapterCmd
  .command('review <bookId> <chapterNum>')
  .description('评价章节')
  .action(async (bookId, chapterNum) => {
    await commands.reviewChapter(bookId, parseInt(chapterNum));
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
