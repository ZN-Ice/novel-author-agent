/**
 * 日志系统
 * 使用 winston 实现多级别日志和文件轮转
 */
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 日志级别定义
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// 日志颜色
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(LOG_COLORS);

// 日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
    let log = `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      log += ` ${JSON.stringify(metadata)}`;
    }
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

// 控制台格式（带颜色）
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let log = `[${timestamp}] [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      log += ` ${JSON.stringify(metadata)}`;
    }
    return log;
  })
);

// 获取日志目录
const getLogDir = () => {
  const logDir = process.env.LOG_DIR || path.join(__dirname, '../../logs');
  return logDir;
};

// 创建 logger 实例
const createLogger = () => {
  const level = process.env.LOG_LEVEL || 'info';
  const logDir = getLogDir();

  const transports = [
    // 控制台输出
    new winston.transports.Console({
      format: consoleFormat,
      level,
    }),
    // 错误日志文件
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
    }),
    // 综合日志文件
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: logFormat,
    }),
  ];

  return winston.createLogger({
    levels: LOG_LEVELS,
    transports,
  });
};

// 单例 logger
let loggerInstance = null;

/**
 * 获取 logger 实例
 * @returns {winston.Logger}
 */
export const getLogger = () => {
  if (!loggerInstance) {
    loggerInstance = createLogger();
  }
  return loggerInstance;
};

// 默认导出（导出函数本身，而不是调用结果）
export default getLogger;
