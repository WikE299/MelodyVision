export type ResonanceCase = {
  id: string;
  label: string;
  title: string;
  description: string;
  relevance: string;
  image: {
    src: string;
    alt: string;
    width: number;
    height: number;
    creditLabel: string;
    creditUrl: string;
  };
  sourceLabel: string;
  sourceUrl: string;
  rights: string;
  experience?: {
    label: string;
    url: string;
  };
};

export type MusicianPerspective = {
  id: string;
  name: string;
  question: string;
  contribution: string;
};

export type ArticulationStep = {
  id: string;
  stage: string;
  example: string;
  insight: string;
};

export const RESONANCE_CASES: ResonanceCase[] = [
  {
    id: "kandinsky",
    label: "声音、颜色与形状",
    title: "Kandinsky：把听觉感受变成视觉语言",
    description:
      "Kandinsky 长期探索颜色、线条、形状与音乐感受之间的关系。Google Arts & Culture 后来以《Yellow-Red-Blue》为基础制作 Play a Kandinsky，让观众反向聆听一幅画可能具有的声音。",
    relevance:
      "它说明视听连接不一定是对现实场景的描摹，也可以是节奏、张力、色彩和运动感之间的个人对应。",
    image: {
      src: "/formative-study/kandinsky-composition-viii.jpg",
      alt: "Kandinsky 1923 年作品《Composition VIII》，由圆形、线条、弧线和色块构成",
      width: 1280,
      height: 896,
      creditLabel: "《Composition VIII》· Wikimedia Commons",
      creditUrl:
        "https://commons.wikimedia.org/wiki/File:Wassily_Kandinsky_Composition_VIII.jpg",
    },
    sourceLabel: "Google Arts & Culture · Sounds Like Kandinsky",
    sourceUrl: "https://artsandculture.google.com/project/kandinsky",
    rights: "Public Domain / PD-Art；互动体验仅提供官方外链。",
    experience: {
      label: "进入 Play a Kandinsky 互动体验",
      url: "https://artsandculture.google.com/experiment/play-a-kandinsky/sgF5ivv105ukhA?hl=en",
    },
  },
  {
    id: "ciurlionis",
    label: "作曲与绘画共用结构",
    title: "Čiurlionis：一位作曲家画出的“奏鸣曲”",
    description:
      "立陶宛作曲家兼画家 M. K. Čiurlionis 以 Allegro、Andante、Fugue、Sonata 等音乐术语命名绘画组作，并在画面中组织重复、层次与节奏。",
    relevance:
      "它提醒我们，音乐进入画面时不只留下颜色，还可能形成空间、叙事、重复结构和完整世界。",
    image: {
      src: "/formative-study/ciurlionis-stars.jpg",
      alt: "Čiurlionis 1908 年作品《Sonata of the Stars. Allegro》，金色星体与层叠空间形成宇宙景象",
      width: 576,
      height: 735,
      creditLabel: "《Sonata of the Stars. Allegro》· Wikimedia Commons",
      creditUrl:
        "https://commons.wikimedia.org/wiki/File:Zvaigzdziu_sonata.Allegro.jpg",
    },
    sourceLabel: "Wikimedia Commons · Sonata of the Stars",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Sonata_No._6_(Sonata_of_the_Stars)._Allegro.jpeg",
    rights: "Public Domain Mark；原作与忠实二维复制品为公版。",
  },
  {
    id: "nomad-flute",
    label: "音乐、记忆与文化叙事",
    title: "《胡笳十八拍图》：声音也会携带人物与故事",
    description:
      "《胡笳十八拍图》以连续画面呈现蔡文姬的生命故事，将诗歌、音乐题材、人物关系和历史记忆放在同一条视觉叙事中。",
    relevance:
      "它说明脑海中的音乐画面可能来自个人记忆和文化经验，不能被简化成固定的“某种乐器对应某种颜色”。",
    image: {
      src: "/formative-study/nomad-flute.webp",
      alt: "《胡笳十八拍图》局部，人物、马匹与建筑组成连续叙事",
      width: 1800,
      height: 868,
      creditLabel: "《胡笳十八拍图》· The Metropolitan Museum of Art",
      creditUrl: "https://www.metmuseum.org/art/collection/search/39569",
    },
    sourceLabel: "The Metropolitan Museum of Art Open Access",
    sourceUrl: "https://www.metmuseum.org/art/collection/search/39569",
    rights: "Public Domain / CC0 开放授权图像。",
  },
];

export const MUSICIAN_PERSPECTIVES: MusicianPerspective[] = [
  {
    id: "structure",
    name: "结构的耳朵",
    question: "音乐在哪里转折、停顿和积累张力？",
    contribution: "帮助用户发现画面中的方向、距离、节奏与构图。",
  },
  {
    id: "performance",
    name: "演奏的耳朵",
    question: "声音的呼吸、触感和力度像什么？",
    contribution: "帮助用户辨认材质、动作、光线和身体感。",
  },
  {
    id: "culture",
    name: "文化的耳朵",
    question: "哪些联想来自历史、地域和熟悉的叙事？",
    contribution: "补充语境，同时提醒系统避免把文化变成固定符号。",
  },
  {
    id: "imagery",
    name: "意象的耳朵",
    question: "这个画面正在发生什么，它带来什么感受？",
    contribution: "帮助模糊的内在画面获得人物、空间、情绪与故事。",
  },
];

export const ARTICULATION_STEPS: ArticulationStep[] = [
  {
    id: "feeling",
    stage: "先感到",
    example: "“它很开阔，像有什么正在向前推。”",
    insight: "情绪、力度与运动已经出现，但还不是一幅可以描绘的画面。",
  },
  {
    id: "glimpse",
    stage: "再看见",
    example: "“像一道光穿过很远的水面。”",
    insight: "场景开始浮现，但主体、空间关系和细节仍然模糊。",
  },
  {
    id: "describe",
    stage: "需要说清",
    example: "“光从哪里来？水面如何运动？画面里还有谁？”",
    insight: "要形成画面，需要把整体感受拆成多个彼此关联的视觉决定。",
  },
];

export const FORMATIVE_DISCUSSION_QUESTIONS = [
  "人在聆听音乐时，脑海中的画面通常由什么触发？",
  "人是否愿意把这种私人、模糊的画面表达或可视化出来？",
  "当一个人想把脑海中的音乐画面描绘成一幅作品时，主体、场景、构图、光色、材质、动作和叙事中，哪些元素不可缺少？",
  "当一个人难以独自说清画面时，哪些追问最有帮助？",
  "什么时候，多位音乐家的共同聆听会比单一视角更有帮助？",
  "怎样避免专业解释、文化标签或生成模型覆盖用户原本的感受？",
] as const;

export const IMAGINATION_EXAMPLES = [
  {
    src: "/formative-study/imagination-1.webp",
    alt: "山间湖面与木栈桥，水面形成层层波纹",
    caption: "有人先看见一个地点：水面、远山和可以走入的空间。",
  },
  {
    src: "/formative-study/imagination-2.webp",
    alt: "水墨竹林、山石和穿过画面的声音轨迹",
    caption: "有人先看见一种文化语境：笔触、留白和熟悉的视觉语言。",
  },
  {
    src: "/formative-study/imagination-3.webp",
    alt: "暮色湖面中央出现发光的金色涟漪",
    caption: "也有人只看见一个动作：光从水面扩散，空间随之改变。",
  },
] as const;
