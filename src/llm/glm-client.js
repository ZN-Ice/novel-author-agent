/**
 * GLM-5 API 客户端
 * 封装智谱 GLM-5 模型 API 调用
 */
import axios from 'axios';
import config from '../../config/index.js';
import getLogger from '../utils/logger.js';

const logger = getLogger();

/**
 * GLM API 客户端类
 */
class GLMClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || config.glm.apiKey;
    this.baseUrl = options.baseUrl || config.glm.baseUrl;
    this.model = options.model || config.glm.model;
    this.temperature = options.temperature ?? config.glm.temperature;
    this.maxTokens = options.maxTokens ?? config.glm.maxTokens;

    // 创建 axios 实例
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`GLM API 请求: ${config.url}`);
        return config;
      },
      (error) => {
        logger.error(`GLM API 请求错误: ${error.message}`);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`GLM API 响应: ${response.status}`);
        return response;
      },
      (error) => {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;
        logger.error(`GLM API 错误 [${status}]: ${message}`);
        return Promise.reject(error);
      }
    );

    // Token 统计
    this.tokenUsage = {
      totalPrompt: 0,
      totalCompletion: 0,
      totalTokens: 0,
      requestCount: 0,
    };
  }

  /**
   * 发送聊天请求
   * @param {Object} params - 请求参数
   * @returns {Promise<Object>} 响应结果
   */
  async chat(params) {
    const {
      messages,
      temperature = this.temperature,
      maxTokens = this.maxTokens,
      stream = false,
    } = params;

    // 验证消息格式
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('消息列表不能为空');
    }

    const requestData = {
      model: this.model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature,
      max_tokens: maxTokens,
      stream,
    };

    try {
      const response = await this.client.post('/chat/completions', requestData);
      const data = response.data;

      // 更新 Token 统计
      if (data.usage) {
        this.tokenUsage.totalPrompt += data.usage.prompt_tokens || 0;
        this.tokenUsage.totalCompletion += data.usage.completion_tokens || 0;
        this.tokenUsage.totalTokens += data.usage.total_tokens || 0;
        this.tokenUsage.requestCount++;
      }

      return {
        success: true,
        content: data.choices[0]?.message?.content || '',
        role: data.choices[0]?.message?.role || 'assistant',
        usage: data.usage,
        finishReason: data.choices[0]?.finish_reason,
        raw: data,
      };
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      return {
        success: false,
        error: errorMessage,
        content: '',
      };
    }
  }

  /**
   * 发送系统提示 + 用户消息
   * @param {string} systemPrompt - 系统提示
   * @param {string} userMessage - 用户消息
   * @param {Object} options - 选项
   * @returns {Promise<Object>}
   */
  async sendMessage(systemPrompt, userMessage, options = {}) {
    const messages = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: userMessage });

    return await this.chat({
      messages,
      ...options,
    });
  }

  /**
   * 获取 Token 使用统计
   * @returns {Object}
   */
  getTokenUsage() {
    return { ...this.tokenUsage };
  }

  /**
   * 重置 Token 统计
   */
  resetTokenUsage() {
    this.tokenUsage = {
      totalPrompt: 0,
      totalCompletion: 0,
      totalTokens: 0,
      requestCount: 0,
    };
  }

  /**
   * 检查 API 是否可用
   * @returns {Promise<boolean>}
   */
  async checkAvailability() {
    if (!this.apiKey) {
      logger.warn('GLM API Key 未配置');
      return false;
    }

    try {
      // 发送简单测试请求
      const result = await this.sendMessage(
        '你是一个助手',
        '请回复"OK"'
      );
      return result.success;
    } catch (error) {
      logger.error(`GLM API 不可用: ${error.message}`);
      return false;
    }
  }
}

// 单例实例
let clientInstance = null;

/**
 * 获取 GLM 客户端实例
 * @param {Object} options - 配置选项
 * @returns {GLMClient}
 */
export const getGLMClient = (options = {}) => {
  if (!clientInstance) {
    clientInstance = new GLMClient(options);
  }
  return clientInstance;
};

/**
 * 重置客户端实例
 */
export const resetClient = () => {
  clientInstance = null;
};

export default GLMClient;
