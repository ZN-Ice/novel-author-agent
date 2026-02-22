/**
 * 小说编辑 Agent
 * 负责评价大纲和章节内容
 */
import BaseAgent from './base-agent.js';
import getLogger from '../utils/logger.js';

const logger = getLogger();

/**
 * 系统提示模板
 */
const SYSTEM_PROMPTS = {
  OUTLINE_REVIEW: `你是一位资深的小说主编，具有丰富的网络小说审稿经验。你的任务是评价小说大纲的质量。

请从以下维度进行评分（每项0-10分）：
1. **情节设计** (plot): 故事是否引人入胜，是否有足够的冲突和悬念
2. **人物塑造** (character): 角色设定是否立体，动机是否合理
3. **世界观** (worldbuilding): 设定是否新颖、完整、自洽
4. **结构完整** (structure): 大纲是否完整，起承转合是否合理
5. **创新程度** (creativity): 是否有新意，能否吸引读者
6. **可执行性** (feasibility): 大纲是否清晰可执行

请用 JSON 格式输出评价结果：
{
  "overallScore": 总分(0-10),
  "dimensions": {
    "plot": 分数,
    "character": 分数,
    "worldbuilding": 分数,
    "structure": 分数,
    "creativity": 分数,
    "feasibility": 分数
  },
  "strengths": ["优点1", "优点2", ...],
  "improvements": ["改进建议1", "改进建议2", ...],
  "suggestions": "详细的改进意见"
}`,

  CHAPTER_REVIEW: `你是一位专业的小说编辑，擅长发现文字中的问题并给出建设性意见。你的任务是评价小说章节的质量。

请从以下维度进行评分（每项0-10分）：
1. **情节推进** (plot): 情节是否有推进，节奏是否恰当
2. **人物表现** (character): 人物行为是否符合设定，对话是否自然
3. **文笔表达** (writing): 语言是否流畅，描写是否生动
4. **氛围营造** (atmosphere): 场景氛围是否到位
5. **悬念设置** (suspense): 是否有吸引读者的悬念
6. **读者体验** (readability): 是否容易阅读，有无卡顿感

请用 JSON 格式输出评价结果：
{
  "overallScore": 总分(0-10),
  "dimensions": {
    "plot": 分数,
    "character": 分数,
    "writing": 分数,
    "atmosphere": 分数,
    "suspense": 分数,
    "readability": 分数
  },
  "strengths": ["优点1", "优点2", ...],
  "improvements": ["改进建议1", "改进建议2", ...],
  "suggestions": "详细的改进意见",
  "highlightExcerpts": ["精彩片段1", "精彩片段2"],
  "problemExcerpts": ["问题片段1及说明"]
}`,
};

/**
 * 小说编辑 Agent 类
 */
class EditorAgent extends BaseAgent {
  constructor() {
    super({
      name: 'EditorAgent',
      description: '小说编辑Agent - 负责评价和反馈',
    });
  }

  /**
   * 评价大纲
   * @param {string} outline - 大纲内容
   * @param {Object} options - 选项
   * @returns {Promise<Object>}
   */
  async reviewOutline(outline, options = {}) {
    logger.info(`[${this.name}] 开始评价大纲`);

    const { genre = '', reference = '' } = options;

    const userMessage = `请评价以下小说大纲：

**大纲内容**:
${outline}

${genre ? `**类型**: ${genre}` : ''}
${reference ? `**参考对标**: ${reference}` : ''}

请给出专业的评价和建议。`;

    const result = await this.callForJson(userMessage, {
      systemPrompt: SYSTEM_PROMPTS.OUTLINE_REVIEW,
    });

    if (result.success) {
      logger.info(`[${this.name}] 大纲评价完成 - 总分: ${result.data?.overallScore}`);
      return {
        success: true,
        review: result.data,
        raw: result.content,
        usage: result.usage,
      };
    }

    return result;
  }

  /**
   * 评价章节
   * @param {string} chapterContent - 章节内容
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>}
   */
  async reviewChapter(chapterContent, context = {}) {
    logger.info(`[${this.name}] 开始评价章节`);

    const { chapterNumber, chapterTitle, outline = '' } = context;

    const userMessage = `请评价以下小说章节：

**章节信息**:
- 第 ${chapterNumber || '?'} 章: ${chapterTitle || '未知'}

${outline ? `**大纲参考**:\n${outline.substring(0, 1000)}` : ''}

**章节内容**:
${chapterContent}

请给出专业的评价和建议。`;

    const result = await this.callForJson(userMessage, {
      systemPrompt: SYSTEM_PROMPTS.CHAPTER_REVIEW,
    });

    if (result.success) {
      logger.info(`[${this.name}] 章节评价完成 - 总分: ${result.data?.overallScore}`);
      return {
        success: true,
        review: result.data,
        raw: result.content,
        usage: result.usage,
      };
    }

    return result;
  }

  /**
   * 批量评价章节
   * @param {Array<Object>} chapters - 章节列表
   * @returns {Promise<Array>}
   */
  async reviewChapters(chapters) {
    const results = [];

    for (const chapter of chapters) {
      const result = await this.reviewChapter(chapter.content, {
        chapterNumber: chapter.number,
        chapterTitle: chapter.title,
      });
      results.push({
        chapterNumber: chapter.number,
        chapterTitle: chapter.title,
        ...result,
      });

      // 间隔以避免请求过快
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return results;
  }

  /**
   * 生成整体评价报告
   * @param {Array<Object>} reviews - 评价列表
   * @returns {Object}
   */
  generateReport(reviews) {
    if (!reviews || reviews.length === 0) {
      return null;
    }

    const validReviews = reviews.filter((r) => r.success && r.review);
    const scores = validReviews.map((r) => r.review.overallScore);

    const dimensionAverages = {};
    const dimensionNames = ['plot', 'character', 'writing', 'atmosphere', 'suspense', 'readability',
                           'worldbuilding', 'structure', 'creativity', 'feasibility'];

    for (const dim of dimensionNames) {
      const dimScores = validReviews
        .map((r) => r.review.dimensions?.[dim])
        .filter((s) => s !== undefined);
      if (dimScores.length > 0) {
        dimensionAverages[dim] = Number((dimScores.reduce((a, b) => a + b, 0) / dimScores.length).toFixed(1));
      }
    }

    const allStrengths = validReviews.flatMap((r) => r.review.strengths || []);
    const allImprovements = validReviews.flatMap((r) => r.review.improvements || []);

    return {
      totalReviews: reviews.length,
      validReviews: validReviews.length,
      averageScore: scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      dimensionAverages,
      commonStrengths: this.getTopItems(allStrengths, 5),
      commonImprovements: this.getTopItems(allImprovements, 5),
    };
  }

  /**
   * 获取出现频率最高的项目
   * @param {Array} items - 项目列表
   * @param {number} top - 前N个
   * @returns {Array}
   */
  getTopItems(items, top = 5) {
    const counts = {};
    for (const item of items) {
      if (item) {
        counts[item] = (counts[item] || 0) + 1;
      }
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, top)
      .map(([item]) => item);
  }
}

// 单例
let editorAgentInstance = null;

/**
 * 获取编辑 Agent 实例
 * @returns {EditorAgent}
 */
export const getEditorAgent = () => {
  if (!editorAgentInstance) {
    editorAgentInstance = new EditorAgent();
  }
  return editorAgentInstance;
};

export default EditorAgent;
