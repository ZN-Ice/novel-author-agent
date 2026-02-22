/**
 * 小说作者 Agent
 * 负责小说分析、大纲创作和章节写作
 */
import BaseAgent from './base-agent.js';
import getLogger from '../utils/logger.js';
import { truncate, splitIntoChunks } from '../utils/text-utils.js';

const logger = getLogger();

/**
 * 系统提示模板
 */
const SYSTEM_PROMPTS = {
  OUTLINE_ANALYSIS: `你是一位资深的小说编辑和写作专家。你的任务是分析小说的大纲结构，提炼出核心的情节节点和叙事模式。

请从以下维度进行分析：
1. **整体架构**：小说的篇章结构（起承转合）
2. **主线情节**：核心故事线的发展脉络
3. **人物成长**：主角的成长轨迹和关键转折点
4. **世界观设定**：背景设定的展开方式
5. **节奏把控**：高潮和过渡的分布
6. **悬念设计**：伏笔和悬念的埋设技巧

请用简洁清晰的语言进行分析，重点关注可复用的写作技巧和结构模式。`,

  STYLE_ANALYSIS: `你是一位资深的文学评论家和写作教练。你的任务是分析小说的写作风格和技巧。

请从以下维度进行分析：
1. **叙事视角**：第一人称/第三人称，全知视角/限制视角
2. **语言风格**：正式/口语化，华丽/朴实
3. **对话技巧**：对话与叙述的比例，对话推进剧情的方式
4. **描写手法**：环境描写、心理描写、动作描写的特点
5. **修辞运用**：比喻、象征等修辞手法的使用
6. **节奏控制**：段落长短、句子节奏

请给出具体的例子和建议。`,

  OUTLINE_CREATION: `你是一位才华横溢的小说作家。你的任务是根据给定的题材和要求创作小说大纲。

大纲应包含以下要素：
1. **基本信息**：书名、类型、预计字数
2. **一句话简介**：用一句话概括故事
3. **世界观设定**：故事发生的背景和设定
4. **主要人物**：
   - 主角：姓名、性格、背景、目标
   - 重要配角：与主角的关系、在故事中的作用
5. **主线大纲**：分阶段（开篇、发展、高潮、结局）的情节规划
6. **关键节点**：重要的转折点和冲突点
7. **伏笔设计**：需要埋设的伏笔
8. **主题思想**：故事想要表达的核心主题

请确保大纲完整、逻辑自洽、有吸引力。`,

  OUTLINE_OPTIMIZATION: `你是一位经验丰富的小说编辑。你的任务是根据编辑反馈优化小说大纲。

请仔细阅读原有大纲和编辑的反馈意见，然后：
1. 分析反馈中提出的问题
2. 提出具体的改进方案
3. 输出优化后的大纲

保持原大纲的优点，针对性地解决反馈中提到的问题。`,

  CHAPTER_WRITING: `你是一位专业的网络小说作家。你的任务是根据大纲创作小说章节。

写作要求：
1. **紧扣大纲**：章节内容要符合大纲的情节发展
2. **保持风格**：与前文风格保持一致
3. **情节推进**：每章要有明确的情节推进
4. **人物塑造**：通过对话和行动展现人物性格
5. **悬念设置**：章节结尾设置适当的悬念
6. **字数控制**：单章2000-4000字为宜

请直接输出章节正文内容，不需要额外的说明。`,

  CHAPTER_OPTIMIZATION: `你是一位细心的小说编辑。你的任务是根据反馈意见优化章节内容。

请：
1. 仔细阅读原章节内容
2. 分析编辑反馈中的具体问题
3. 针对性地修改和润色
4. 保持原文的整体风格和情节

输出优化后的完整章节内容。`,

  SMART_OUTLINE_CREATION: `你是一位才华横溢的小说作家和编辑。你的任务是根据用户的描述创作小说大纲。

你需要：
1. 理解用户想要创作的小说类型和风格
2. 参考已有的经典小说大纲结构
3. 融合参考小说的优点，创作出原创大纲
4. 确保大纲完整、逻辑自洽、有吸引力

大纲应包含以下要素：
1. **基本信息**：书名、类型、预计字数
2. **一句话简介**：用一句话概括故事
3. **世界观设定**：故事发生的背景和设定
4. **主要人物**：
   - 主角：姓名、性格、背景、目标
   - 重要配角：与主角的关系、在故事中的作用
5. **主线大纲**：分阶段（开篇、发展、高潮、结局）的情节规划
6. **关键节点**：重要的转折点和冲突点
7. **伏笔设计**：需要埋设的伏笔
8. **主题思想**：故事想要表达的核心主题`,
};

/**
 * 小说作者 Agent 类
 */
class AuthorAgent extends BaseAgent {
  constructor() {
    super({
      name: 'AuthorAgent',
      description: '小说作者Agent - 负责分析、创作和优化',
    });
  }

  /**
   * 分析小说大纲
   * @param {Object} novelData - 解析后的小说数据
   * @returns {Promise<Object>}
   */
  async analyzeOutline(novelData) {
    logger.info(`[${this.name}] 开始分析小说大纲`);

    // 提取章节标题作为大纲基础
    const chapterTitles = novelData.chapters.slice(0, 50).map((c, i) =>
      `第${c.number || i + 1}章: ${c.title}`
    ).join('\n');

    // 提取部分章节内容
    const samples = novelData.chapters.slice(0, 3).map((c, i) =>
      `\n【第${c.number || i + 1}章 样本】\n${truncate(c.content, 2000)}`
    ).join('\n');

    const userMessage = `请分析以下小说的大纲结构：

**书名**: ${novelData.fileName}
**总字数**: ${novelData.totalWords}
**章节数**: ${novelData.chapterCount}

**章节列表（前50章）**:
${chapterTitles}

**章节内容样本**:
${samples}

请分析这本小说的大纲结构、情节设计和写作技巧。`;

    const result = await this.call(userMessage, {
      systemPrompt: SYSTEM_PROMPTS.OUTLINE_ANALYSIS,
    });

    if (result.success) {
      logger.info(`[${this.name}] 大纲分析完成`);
    }

    return result;
  }

  /**
   * 分析写作风格
   * @param {Object} novelData - 解析后的小说数据
   * @returns {Promise<Object>}
   */
  async analyzeStyle(novelData) {
    logger.info(`[${this.name}] 开始分析写作风格`);

    // 提取多个章节样本
    const samples = novelData.chapters.slice(0, 5).map((c, i) =>
      `【第${c.number || i + 1}章 ${c.title}】\n${truncate(c.content, 1500)}`
    ).join('\n\n');

    const userMessage = `请分析以下小说片段的写作风格：

**书名**: ${novelData.fileName}

${samples}

请详细分析写作风格和技巧。`;

    const result = await this.call(userMessage, {
      systemPrompt: SYSTEM_PROMPTS.STYLE_ANALYSIS,
    });

    if (result.success) {
      logger.info(`[${this.name}] 风格分析完成`);
    }

    return result;
  }

  /**
   * 创作小说大纲
   * @param {Object} requirements - 创作要求
   * @returns {Promise<Object>}
   */
  async createOutline(requirements) {
    logger.info(`[${this.name}] 开始创作大纲`);

    const {
      genre = '玄幻',
      theme = '',
      protagonist = '',
      setting = '',
      reference = '',
    } = requirements;

    const userMessage = `请创作一部小说的大纲。

**创作要求**:
- 类型: ${genre}
- 主题/核心冲突: ${theme || '由你决定'}
- 主角设定: ${protagonist || '由你决定'}
- 世界观设定: ${setting || '由你决定'}
${reference ? `- 参考风格: ${reference}` : ''}

请创作一个完整、有吸引力的小说大纲。`;

    const result = await this.call(userMessage, {
      systemPrompt: SYSTEM_PROMPTS.OUTLINE_CREATION,
    });

    if (result.success) {
      logger.info(`[${this.name}] 大纲创作完成`);
    }

    return result;
  }

  /**
   * 智能大纲创作 - 根据描述自动选择参考小说并创作大纲
   * @param {string} description - 用户描述（如"我想写一本玄幻小说"）
   * @param {Object} options - 额外选项
   * @returns {Promise<Object>}
   */
  async createOutlineByDescription(description, options = {}) {
    logger.info(`[${this.name}] 开始智能大纲创作: ${description}`);

    const { matchResult, referenceOutlines = [] } = options;

    // 构建参考信息
    let referenceSection = '';
    if (referenceOutlines.length > 0) {
      referenceSection = '\n\n**参考小说大纲分析**:\n';
      referenceOutlines.forEach((ref, index) => {
        referenceSection += `\n### 参考${index + 1}: 《${ref.title}》
${ref.analysis ? truncate(ref.analysis, 2000) : '（无分析数据）'}
`;
      });
    }

    const userMessage = `用户想要创作小说，描述如下：
"${description}"

${matchResult?.analyzedGenre ? `**分析出的类型**: ${matchResult.analyzedGenre}` : ''}
${matchResult?.analyzedThemes?.length ? `**分析出的主题**: ${matchResult.analyzedThemes.join('、')}` : ''}
${referenceSection}

请根据用户的描述，${referenceOutlines.length > 0 ? '参考已有经典小说的大纲结构，' : ''}创作一个原创的小说大纲。

要求：
1. 大纲要原创，不能抄袭参考小说
2. 要借鉴参考小说的优秀结构和叙事技巧
3. 大纲要完整、有吸引力、逻辑自洽`;

    const result = await this.call(userMessage, {
      systemPrompt: SYSTEM_PROMPTS.SMART_OUTLINE_CREATION,
    });

    if (result.success) {
      logger.info(`[${this.name}] 智能大纲创作完成`);
    }

    return result;
  }

  /**
   * 优化大纲
   * @param {string} currentOutline - 当前大纲
   * @param {Object} feedback - 编辑反馈
   * @returns {Promise<Object>}
   */
  async optimizeOutline(currentOutline, feedback) {
    logger.info(`[${this.name}] 开始优化大纲`);

    const userMessage = `请根据编辑反馈优化以下大纲：

**当前大纲**:
${currentOutline}

**编辑反馈**:
- 总体评分: ${feedback.overallScore || 'N/A'}/10
- 优点: ${feedback.strengths?.join('、') || '无'}
- 改进建议: ${feedback.improvements?.join('、') || '无'}
- 详细意见: ${feedback.suggestions || '无'}

请输出优化后的完整大纲。`;

    const result = await this.call(userMessage, {
      systemPrompt: SYSTEM_PROMPTS.OUTLINE_OPTIMIZATION,
    });

    if (result.success) {
      logger.info(`[${this.name}] 大纲优化完成`);
    }

    return result;
  }

  /**
   * 创作章节
   * @param {Object} params - 创作参数
   * @returns {Promise<Object>}
   */
  async writeChapter(params) {
    const {
      outline,
      chapterNumber,
      chapterTitle,
      previousContent = '',
      style = '',
    } = params;

    logger.info(`[${this.name}] 开始创作第 ${chapterNumber} 章`);

    const userMessage = `请根据大纲创作章节。

**大纲概要**:
${truncate(outline, 3000)}

**本章信息**:
- 章节: 第${chapterNumber}章
- 标题: ${chapterTitle}

${previousContent ? `**前文提要**:\n${truncate(previousContent, 1000)}` : ''}

${style ? `**写作风格参考**:\n${truncate(style, 500)}` : ''}

请创作完整的章节内容。`;

    const result = await this.call(userMessage, {
      systemPrompt: SYSTEM_PROMPTS.CHAPTER_WRITING,
    });

    if (result.success) {
      logger.info(`[${this.name}] 第 ${chapterNumber} 章创作完成`);
    }

    return result;
  }

  /**
   * 优化章节
   * @param {string} chapterContent - 章节内容
   * @param {Object} feedback - 编辑反馈
   * @returns {Promise<Object>}
   */
  async optimizeChapter(chapterContent, feedback) {
    logger.info(`[${this.name}] 开始优化章节`);

    const userMessage = `请根据编辑反馈优化以下章节：

**原章节内容**:
${chapterContent}

**编辑反馈**:
- 评分: ${feedback.overallScore || 'N/A'}/10
- 优点: ${feedback.strengths?.join('、') || '无'}
- 改进建议: ${feedback.improvements?.join('、') || '无'}
- 详细意见: ${feedback.suggestions || '无'}

请输出优化后的完整章节内容。`;

    const result = await this.call(userMessage, {
      systemPrompt: SYSTEM_PROMPTS.CHAPTER_OPTIMIZATION,
    });

    if (result.success) {
      logger.info(`[${this.name}] 章节优化完成`);
    }

    return result;
  }
}

// 单例
let authorAgentInstance = null;

/**
 * 获取作者 Agent 实例
 * @returns {AuthorAgent}
 */
export const getAuthorAgent = () => {
  if (!authorAgentInstance) {
    authorAgentInstance = new AuthorAgent();
  }
  return authorAgentInstance;
};

export default AuthorAgent;
