export interface Character {
  id: string;
  name: string;
  era: string;
  culture: "chinese" | "western";
  tags: string[];
  focusDescription: string;
}

export const characters: Character[] = [
  {
    id: "boya",
    name: "伯牙",
    era: "春秋",
    culture: "chinese",
    tags: ["知音", "古琴", "心声"],
    focusDescription: "倾听声音中的意图、呼吸与回应",
  },
  {
    id: "jikang",
    name: "嵇康",
    era: "三国魏",
    culture: "chinese",
    tags: ["竹林七贤", "声无哀乐", "自然之和"],
    focusDescription: "分辨声音本身与听者投射的情绪",
  },
  {
    id: "caiwenji",
    name: "蔡文姬",
    era: "东汉末",
    culture: "chinese",
    tags: ["诗与琴", "迁徙记忆", "胡汉之间"],
    focusDescription: "倾听记忆、距离与人的声音",
  },
  {
    id: "abing",
    name: "阿炳",
    era: "民国",
    culture: "chinese",
    tags: ["二胡", "民间音乐", "即兴"],
    focusDescription: "倾听身体重量、生活气息与韧性",
  },
  {
    id: "tandun",
    name: "谭盾",
    era: "当代",
    culture: "chinese",
    tags: ["有机音乐", "跨文化", "声音材料"],
    focusDescription: "倾听声音的材料、空间与转化可能",
  },
  {
    id: "bach",
    name: "巴赫",
    era: "巴洛克",
    culture: "western",
    tags: ["对位", "复调", "结构"],
    focusDescription: "倾听声部关系、比例与张力的去向",
  },
  {
    id: "mozart",
    name: "莫扎特",
    era: "古典主义",
    culture: "western",
    tags: ["旋律", "歌剧性", "清澈结构"],
    focusDescription: "倾听旋律的自然、对话与隐藏复杂度",
  },
  {
    id: "beethoven",
    name: "贝多芬",
    era: "古典—浪漫",
    culture: "western",
    tags: ["动机发展", "交响张力", "形式革新"],
    focusDescription: "倾听动机如何变化、受阻并重新获得方向",
  },
  {
    id: "armstrong",
    name: "阿姆斯特朗",
    era: "爵士时代",
    culture: "western",
    tags: ["小号", "即兴", "时间感"],
    focusDescription: "倾听呼吸、律动与声音之间的交谈",
  },
  {
    id: "lennon",
    name: "列侬",
    era: "摇滚时代",
    culture: "western",
    tags: ["歌曲写作", "录音实验", "公共表达"],
    focusDescription: "倾听私人感受如何变成可以共同传唱的表达",
  },
];

export function getCharacterById(id: string): Character | undefined {
  return characters.find((character) => character.id === id);
}

export function getCharactersByIds(ids: string[]): Character[] {
  return ids.map((id) => getCharacterById(id)).filter(Boolean) as Character[];
}

export const chineseCharacters = characters.filter((character) => character.culture === "chinese");
export const westernCharacters = characters.filter((character) => character.culture === "western");
