export interface AudioCatalogItem {
  id: string;
  name: string;
  artist: string;
  description: string;
  tags: string[];
  file: string;
  originalFile: string;
  durationSeconds: number;
  originalDurationSeconds: number;
  isClipped: boolean;
  clipStartSeconds: number;
  clipEndSeconds: number;
  source: string;
  sourceUrl: string;
  creator: string;
  license: string;
  licenseName: string;
  licenseUrl: string;
  requiresAttribution: boolean;
  attributionText: string;
  publicUseStatus: "cleared" | "needs-review";
  rightsNote: string;
}

export const audioCatalog: AudioCatalogItem[] = [
  {
    id: "molihua-piano",
    name: "茉莉花",
    artist: "中国民歌 · 钢琴改编",
    description: "熟悉的民歌旋律被放在钢琴音色里，轻柔、明亮，适合生成清澈温婉的画面。",
    tags: ["民歌", "钢琴", "宁静", "清亮", "东方"],
    file: "/preset-audio/clips/molihua-piano-clip.mp3",
    originalFile: "/preset-audio/茉莉花 (钢琴版纯音乐)-纯音乐.mp3",
    durationSeconds: 45,
    originalDurationSeconds: 165,
    isClipped: true,
    clipStartSeconds: 24,
    clipEndSeconds: 69,
    source: "Source not confirmed",
    sourceUrl: "https://www.itingwa.com/listen/33015",
    creator: "Unknown recording / piano arrangement",
    license: "Authorization unverified",
    licenseName: "Authorization unverified",
    licenseUrl: "",
    requiresAttribution: true,
    attributionText: "茉莉花（钢琴版），录音来源与授权待确认，仅建议内部原型使用。",
    publicUseStatus: "needs-review",
    rightsNote: "Traditional melody does not make this specific recording public domain. Replace or confirm authorization before broad public use.",
  },
  {
    id: "yangguan-sandie-guqin",
    name: "阳关三叠",
    artist: "戴晓莲",
    description: "古琴的留白与散音带出送别意味，气息缓慢，空间感强。",
    tags: ["古琴", "留白", "离别", "缓慢", "中国传统"],
    file: "/preset-audio/clips/yangguan-sandie-guqin-clip.mp3",
    originalFile: "/preset-audio/阳关三叠 (古琴版)-戴晓莲.mp3",
    durationSeconds: 45,
    originalDurationSeconds: 357,
    isClipped: true,
    clipStartSeconds: 68,
    clipEndSeconds: 113,
    source: "Source not confirmed",
    sourceUrl: "https://www.bilibili.com/video/BV12L4y1z7um/",
    creator: "戴晓莲",
    license: "Authorization unverified",
    licenseName: "Authorization unverified",
    licenseUrl: "",
    requiresAttribution: true,
    attributionText: "阳关三叠（古琴版），戴晓莲，录音来源与授权待确认，仅建议内部原型使用。",
    publicUseStatus: "needs-review",
    rightsNote: "Reference page does not establish redistribution rights for this local MP3.",
  },
  {
    id: "erquan-yingyue",
    name: "二泉映月",
    artist: "阿炳",
    description: "二胡线条深沉婉转，情绪浓度高，适合观察音乐家评论如何捕捉悲悯与韧性。",
    tags: ["二胡", "苍凉", "深沉", "独奏", "民乐"],
    file: "/preset-audio/clips/erquan-yingyue-clip.mp3",
    originalFile: "/preset-audio/阿炳 - 二泉映月.mp3",
    durationSeconds: 45,
    originalDurationSeconds: 313,
    isClipped: true,
    clipStartSeconds: 42,
    clipEndSeconds: 87,
    source: "Source not confirmed",
    sourceUrl: "https://www.itingwa.com/listen/1565",
    creator: "阿炳 / recording source unknown",
    license: "Authorization unverified",
    licenseName: "Authorization unverified",
    licenseUrl: "",
    requiresAttribution: true,
    attributionText: "二泉映月，阿炳，具体录音来源与授权待确认，仅建议内部原型使用。",
    publicUseStatus: "needs-review",
    rightsNote: "Composition and historical recording status do not confirm rights for this local MP3 transfer.",
  },
  {
    id: "bach-cello-prelude",
    name: "Cello Suite No.1 Prelude",
    artist: "Johann Sebastian Bach",
    description: "连续分解和弦像水流一样推进，稳定、克制，也带着温暖的建筑感。",
    tags: ["大提琴", "巴赫", "巴洛克", "流动", "克制"],
    file: "/preset-audio/clips/bach-cello-prelude-clip.mp3",
    originalFile: "/preset-audio/Cello Suite no. 1 - Prelude in G, BWV 1007.mp3",
    durationSeconds: 45,
    originalDurationSeconds: 150,
    isClipped: true,
    clipStartSeconds: 0,
    clipEndSeconds: 45,
    source: "Classicals.de",
    sourceUrl: "https://www.classicals.de/bach-cello-suites",
    creator: "Valery Avsaragov / Accou",
    license: "CC BY 4.0",
    licenseName: "Creative Commons Attribution 4.0 International",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    requiresAttribution: true,
    attributionText: "Cello Suite No.1 Prelude by J.S. Bach, performed by Valery Avsaragov / Accou, via Classicals.de, CC BY 4.0. Clipped to 45 seconds.",
    publicUseStatus: "cleared",
    rightsNote: "Use with attribution and indicate clipping/transcoding.",
  },
  {
    id: "beethoven-symphony-5",
    name: "Symphony No.5 I. Allegro con brio",
    artist: "Ludwig van Beethoven",
    description: "强烈的命运动机反复推进，能量集中，适合测试激烈音乐到视觉结构的转换。",
    tags: ["交响", "贝多芬", "激烈", "戏剧性", "高能量"],
    file: "/preset-audio/clips/beethoven-symphony-5-clip.mp3",
    originalFile: "/preset-audio/Symphony no. 5 in Cm, Op. 67 - I. Allegro con brio.mp3",
    durationSeconds: 45,
    originalDurationSeconds: 474,
    isClipped: true,
    clipStartSeconds: 0,
    clipEndSeconds: 45,
    source: "Classicals.de",
    sourceUrl: "https://www.classicals.de/beethoven-symphony-no5",
    creator: "The Fulda Symphonic Orchestra",
    license: "CC BY-SA 4.0",
    licenseName: "Creative Commons Attribution-ShareAlike 4.0 International",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    requiresAttribution: true,
    attributionText: "Symphony No.5 I. Allegro con brio by Ludwig van Beethoven, performed by The Fulda Symphonic Orchestra, via Classicals.de, CC BY-SA 4.0. Clipped to 45 seconds.",
    publicUseStatus: "cleared",
    rightsNote: "Use with attribution, ShareAlike notice, and indicate clipping/transcoding. Local MP3 metadata should be checked against this source before broad use.",
  },
  {
    id: "mozart-eine-kleine-nachtmusik",
    name: "Eine kleine Nachtmusik I. Allegro",
    artist: "Wolfgang Amadeus Mozart",
    description: "轻快明亮的弦乐合奏，旋律轮廓清晰，带有古典时期的秩序与愉悦。",
    tags: ["弦乐", "莫扎特", "轻快", "古典", "明亮"],
    file: "/preset-audio/clips/mozart-eine-kleine-nachtmusik-clip.mp3",
    originalFile: "/preset-audio/Mozart_-_Eine_kleine_Nachtmusik_-_1._Allegro.ogg",
    durationSeconds: 45,
    originalDurationSeconds: 355,
    isClipped: true,
    clipStartSeconds: 0,
    clipEndSeconds: 45,
    source: "Wikimedia Commons",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Mozart_-_Eine_kleine_Nachtmusik_-_1._Allegro.ogg",
    creator: "Advent Chamber Orchestra",
    license: "CC BY-SA 2.0",
    licenseName: "Creative Commons Attribution-ShareAlike 2.0 Generic",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    requiresAttribution: true,
    attributionText: "Eine kleine Nachtmusik I. Allegro by Wolfgang Amadeus Mozart, performed by Advent Chamber Orchestra, via Wikimedia Commons, CC BY-SA 2.0. Clipped/transcoded to 45 seconds.",
    publicUseStatus: "cleared",
    rightsNote: "Use with attribution, ShareAlike notice, and indicate clipping/transcoding.",
  },
  {
    id: "westend-blues",
    name: "West End Blues",
    artist: "Louis Armstrong",
    description: "小号开场明亮而自由，摇摆感鲜明，适合带出爵士的即兴和城市夜色。",
    tags: ["爵士", "小号", "摇摆", "即兴", "蓝调"],
    file: "/preset-audio/clips/westend-blues-clip.mp3",
    originalFile: "/preset-audio/Westend Blues (Hot Five).mp3",
    durationSeconds: 45,
    originalDurationSeconds: 203,
    isClipped: true,
    clipStartSeconds: 0,
    clipEndSeconds: 45,
    source: "Internet Archive",
    sourceUrl: "https://archive.org/details/westend-blues-hot-five",
    creator: "Louis Armstrong and his Hot Five",
    license: "Public Domain Mark 1.0",
    licenseName: "Public Domain Mark 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    requiresAttribution: false,
    attributionText: "West End Blues by Louis Armstrong and his Hot Five, 1928-06-11, via Internet Archive, Public Domain Mark 1.0. Clipped to 45 seconds.",
    publicUseStatus: "cleared",
    rightsNote: "Attribution is not required by the Public Domain Mark, but source is retained for provenance.",
  },
  {
    id: "amoeba-someday",
    name: "someday i will be like noraus.",
    artist: "Amœba",
    description: "带有电子与环境质感的实验曲目，颗粒、漂浮与不稳定感更明显。",
    tags: ["电子", "实验", "环境", "漂浮", "颗粒感"],
    file: "/preset-audio/clips/amoeba-someday-clip.mp3",
    originalFile: "/preset-audio/Amœba_-_someday_i_will_be_like_noraus..ogg",
    durationSeconds: 45,
    originalDurationSeconds: 438,
    isClipped: true,
    clipStartSeconds: 60,
    clipEndSeconds: 105,
    source: "Wikimedia Commons / Audiotool",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Am%C5%93ba_-_someday_i_will_be_like_noraus..ogg",
    creator: "amœba",
    license: "CC BY-SA 3.0",
    licenseName: "Creative Commons Attribution-ShareAlike 3.0 Unported",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    requiresAttribution: true,
    attributionText: "someday i will be like noraus. by amœba, via Wikimedia Commons / Audiotool, CC BY-SA 3.0. Clipped/transcoded to 45 seconds.",
    publicUseStatus: "cleared",
    rightsNote: "Use with attribution, ShareAlike notice, and indicate clipping/transcoding.",
  },
];

export function searchAudioCatalog(query: string): AudioCatalogItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return audioCatalog;

  return audioCatalog.filter((item) => {
    const haystack = [
      item.name,
      item.artist,
      item.description,
      item.source,
      item.sourceUrl,
      item.creator,
      item.license,
      item.licenseName,
      item.attributionText,
      item.rightsNote,
      item.publicUseStatus,
      ...item.tags,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
