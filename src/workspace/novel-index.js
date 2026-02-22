/**
 * 小说分类索引管理
 * 管理经典小说的分类标签，用于智能匹配参考小说
 */
import path from 'path';
import config from '../../config/index.js';
import getLogger from '../utils/logger.js';
import { ensureDir, readJson, writeJson } from '../utils/file-utils.js';
import { listClassicNovels } from '../scraper/classic-novels.js';
import { getGLMClient } from '../llm/glm-client.js';

const logger = getLogger();

/**
 * 分类索引文件路径
 */
const getIndexFilePath = () => {
  return path.join(config.classicNovels.dir, '.category-index.json');
};

/**
 * 小说类型关键词映射
 */
const GENRE_KEYWORDS = {
  '玄幻': ['玄幻', '修仙', '修真', '仙侠', '灵气', '境界', '丹药', '法宝', '宗门', '渡劫'],
  '奇幻': ['奇幻', '魔法', '异世界', '精灵', '龙族', '恶魔', '天使', '神话', '西幻'],
  '都市': ['都市', '现代', '商业', '职场', '都市生活', '都市异能', '都市修仙'],
  '历史': ['历史', '穿越', '古代', '朝代', '皇帝', '将军', '战争', '谋略'],
  '科幻': ['科幻', '未来', '宇宙', '星际', '机甲', 'AI', '人工智能', '赛博'],
  '游戏': ['游戏', '网游', '电竞', '副本', '玩家', '公会', 'BOSS'],
  '无限流': ['无限流', '主神', '轮回', '副本', '任务', '积分', '兑换'],
  '悬疑': ['悬疑', '推理', '侦探', '破案', '谜题', '真相'],
  '灵异': ['灵异', '鬼怪', '恐怖', '阴阳', '风水', '僵尸'],
  '武侠': ['武侠', '江湖', '武功', '门派', '侠客', '内功'],
  '军事': ['军事', '战争', '士兵', '将军', '战场'],
  '二次元': ['二次元', '动漫', '轻小说', '日式'],
};

/**
 * 读取分类索引
 * @returns {Promise<Object>}
 */
export const readCategoryIndex = async () => {
  const indexPath = getIndexFilePath();
  const index = await readJson(indexPath);
  return index || { novels: {}, lastUpdated: null };
};

/**
 * 保存分类索引
 * @param {Object} index
 */
export const saveCategoryIndex = async (index) => {
  const indexPath = getIndexFilePath();
  await ensureDir(config.classicNovels.dir);
  await writeJson(indexPath, {
    ...index,
    lastUpdated: new Date().toISOString(),
  });
};

/**
 * 使用LLM分析小说类型
 * @param {Object} novelInfo - 小说信息
 * @returns {Promise<Object>}
 */
export const analyzeNovelCategory = async (novelInfo) => {
  const llm = getGLMClient();

  const prompt = `请分析以下小说的类型和标签。

**小说信息**:
- 书名: ${novelInfo.title}
- 作者: ${novelInfo.author}
- 字数: ${novelInfo.wordCount || '未知'}

请用JSON格式回复，包含以下字段：
{
  "mainGenre": "主类型（如：玄幻、都市、奇幻等）",
  "subGenres": ["子类型1", "子类型2"],
  "tags": ["标签1", "标签2", "标签3"],
  "themes": ["主题1", "主题2"],
  "writingStyle": "写作风格描述",
  "summary": "一句话简介"
}`;

  try {
    const result = await llm.sendMessage(
      '你是一位专业的小说分类专家，擅长分析小说的类型、标签和风格。',
      prompt
    );

    if (result.success) {
      try {
        let jsonStr = result.content;
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        }
        return JSON.parse(jsonStr);
      } catch {
        return {
          mainGenre: '其他',
          subGenres: [],
          tags: [],
          themes: [],
          writingStyle: '',
          summary: '',
        };
      }
    }

    return null;
  } catch (error) {
    logger.error(`分析小说类型失败: ${error.message}`);
    return null;
  }
};

/**
 * 构建分类索引
 * @param {boolean} forceRebuild - 是否强制重建
 * @returns {Promise<Object>}
 */
export const buildCategoryIndex = async (forceRebuild = false) => {
  logger.info('开始构建分类索引...');

  const novels = await listClassicNovels();
  const existingIndex = await readCategoryIndex();

  const newIndex = { novels: {}, lastUpdated: null };

  for (const novel of novels) {
    const title = novel.title;

    // 如果已有索引且不强制重建，跳过
    if (!forceRebuild && existingIndex.novels[title]) {
      newIndex.novels[title] = existingIndex.novels[title];
      continue;
    }

    logger.info(`分析小说类型: ${title}`);

    // 分析小说类型
    const categoryInfo = await analyzeNovelCategory(novel);

    if (categoryInfo) {
      newIndex.novels[title] = {
        title,
        author: novel.author,
        mainGenre: categoryInfo.mainGenre,
        subGenres: categoryInfo.subGenres || [],
        tags: categoryInfo.tags || [],
        themes: categoryInfo.themes || [],
        writingStyle: categoryInfo.writingStyle || '',
        summary: categoryInfo.summary || '',
        filePath: novel.title ? `${novel.title}.txt` : null,
      };
    }
  }

  await saveCategoryIndex(newIndex);
  logger.info(`分类索引构建完成，共 ${Object.keys(newIndex.novels).length} 本小说`);

  return newIndex;
};

/**
 * 根据描述匹配参考小说
 * @param {string} description - 用户描述
 * @param {number} topK - 返回数量
 * @returns {Promise<Array>}
 */
export const matchReferenceNovels = async (description, topK = 3) => {
  const llm = getGLMClient();
  const index = await readCategoryIndex();

  if (Object.keys(index.novels).length === 0) {
    // 尝试构建索引
    await buildCategoryIndex();
    const newIndex = await readCategoryIndex();
    if (Object.keys(newIndex.novels).length === 0) {
      return [];
    }
  }

  // 将索引中的小说信息整理成列表
  const novelList = Object.values(index.novels).map(n =>
    `- 《${n.title}》: ${n.mainGenre} | ${n.subGenres?.join('/')} | ${n.tags?.slice(0, 3).join(', ')}`
  ).join('\n');

  const prompt = `用户想要创作小说，描述如下：
"${description}"

以下是已有的经典小说库：
${novelList}

请分析用户描述，从小说库中选择最适合作为参考的小说。
用JSON格式回复：
{
  "analyzedGenre": "分析出的类型",
  "analyzedThemes": ["分析出的主题"],
  "suggestedKeywords": ["建议搜索的关键词"],
  "recommendations": [
    {
      "title": "小说名",
      "reason": "推荐理由"
    }
  ]
}

推荐最多${topK}本最相关的小说。如果小说库中没有合适的，recommendations可以为空数组，并在suggestedKeywords中给出搜索建议。`;

  try {
    const result = await llm.sendMessage(
      '你是一位专业的小说推荐专家，擅长根据用户需求匹配最适合的参考小说。',
      prompt
    );

    if (result.success) {
      try {
        let jsonStr = result.content;
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        }
        const analysis = JSON.parse(jsonStr);

        // 根据推荐找到完整的小说信息
        const recommendations = [];
        for (const rec of (analysis.recommendations || [])) {
          const novelInfo = index.novels[rec.title];
          if (novelInfo) {
            recommendations.push({
              ...novelInfo,
              reason: rec.reason,
            });
          }
        }

        return {
          analyzedGenre: analysis.analyzedGenre,
          analyzedThemes: analysis.analyzedThemes || [],
          suggestedKeywords: analysis.suggestedKeywords || [],
          recommendations,
        };
      } catch (e) {
        logger.error(`解析匹配结果失败: ${e.message}`);
        return { recommendations: [], suggestedKeywords: [] };
      }
    }
  } catch (error) {
    logger.error(`匹配参考小说失败: ${error.message}`);
  }

  return { recommendations: [], suggestedKeywords: [] };
};

/**
 * 从描述中提取搜索关键词
 * @param {string} description - 用户描述
 * @returns {Promise<Array>}
 */
export const extractSearchKeywords = async (description) => {
  const llm = getGLMClient();

  const prompt = `用户想要创作小说，描述如下：
"${description}"

请分析这段描述，提取出可以用来在小说网站搜索经典小说的关键词。
返回JSON格式：
{
  "mainKeyword": "最主要的关键词（通常是小说名或类型）",
  "searchKeywords": ["关键词1", "关键词2", "关键词3"],
  "genre": "类型"
}

关键词应该是一些经典小说可能包含的书名或类型词。`;

  try {
    const result = await llm.sendMessage(
      '你是一位小说搜索专家，擅长从用户描述中提取搜索关键词。',
      prompt
    );

    if (result.success) {
      try {
        let jsonStr = result.content;
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        }
        return JSON.parse(jsonStr);
      } catch {
        return { mainKeyword: '', searchKeywords: [], genre: '' };
      }
    }
  } catch (error) {
    logger.error(`提取搜索关键词失败: ${error.message}`);
  }

  return { mainKeyword: '', searchKeywords: [], genre: '' };
};

export default {
  readCategoryIndex,
  saveCategoryIndex,
  buildCategoryIndex,
  analyzeNovelCategory,
  matchReferenceNovels,
  extractSearchKeywords,
  GENRE_KEYWORDS,
};
