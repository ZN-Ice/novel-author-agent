/**
 * Agent 基类
 * 提供通用的 Agent 功能
 */
import getLogger from '../utils/logger.js';
import { getGLMClient } from '../llm/glm-client.js';

const logger = getLogger();

/**
 * Agent 基类
 */
class BaseAgent {
  /**
   * @param {Object} options - 配置选项
   * @param {string} options.name - Agent名称
   * @param {string} options.description - Agent描述
   * @param {string} options.systemPrompt - 系统提示
   */
  constructor(options = {}) {
    this.name = options.name || 'BaseAgent';
    this.description = options.description || '';
    this.systemPrompt = options.systemPrompt || '';
    this.llm = getGLMClient();
    this.conversationHistory = [];
  }

  /**
   * 调用 LLM
   * @param {string} userMessage - 用户消息
   * @param {Object} options - 选项
   * @returns {Promise<Object>}
   */
  async call(userMessage, options = {}) {
    const { addToHistory = true, systemPrompt = null } = options;

    logger.debug(`[${this.name}] 调用 LLM`);

    // 构建消息
    const messages = [];

    // 添加系统提示
    const sysPrompt = systemPrompt || this.systemPrompt;
    if (sysPrompt) {
      messages.push({ role: 'system', content: sysPrompt });
    }

    // 添加历史对话
    messages.push(...this.conversationHistory);

    // 添加当前消息
    messages.push({ role: 'user', content: userMessage });

    // 调用 LLM
    const result = await this.llm.chat({ messages });

    if (result.success && addToHistory) {
      // 保存到历史
      this.conversationHistory.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: result.content }
      );
    }

    return result;
  }

  /**
   * 调用 LLM 并解析 JSON 响应
   * @param {string} userMessage - 用户消息
   * @param {Object} options - 选项
   * @returns {Promise<Object>}
   */
  async callForJson(userMessage, options = {}) {
    const result = await this.call(userMessage, options);

    if (!result.success) {
      return result;
    }

    // 尝试解析 JSON
    try {
      // 提取 JSON 块
      let content = result.content;

      // 尝试提取 ```json ... ``` 块
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        content = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(content);
      return {
        success: true,
        content: result.content,
        data: parsed,
        usage: result.usage,
      };
    } catch (error) {
      logger.warn(`[${this.name}] JSON 解析失败: ${error.message}`);
      return {
        success: false,
        error: 'JSON 解析失败',
        content: result.content,
      };
    }
  }

  /**
   * 清空对话历史
   */
  clearHistory() {
    this.conversationHistory = [];
    logger.debug(`[${this.name}] 对话历史已清空`);
  }

  /**
   * 获取对话历史
   * @returns {Array}
   */
  getHistory() {
    return [...this.conversationHistory];
  }

  /**
   * 设置系统提示
   * @param {string} prompt - 系统提示
   */
  setSystemPrompt(prompt) {
    this.systemPrompt = prompt;
  }

  /**
   * 获取 Token 使用统计
   * @returns {Object}
   */
  getTokenUsage() {
    return this.llm.getTokenUsage();
  }

  /**
   * 格式化输出
   * @param {string} content - 内容
   * @returns {string}
   */
  formatOutput(content) {
    return `[${this.name}]:\n${content}`;
  }
}

export default BaseAgent;
