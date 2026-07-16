"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export type Language = "zh" | "en";

const STORAGE_KEY = "melodyvisionLanguage";
const CHANGE_EVENT = "melodyvision-language-change";

function readLanguage(): Language {
  if (typeof window === "undefined") return "zh";
  return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "zh";
}

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>("zh");

  useEffect(() => {
    const handleChange = () => setLanguageState(readLanguage());
    handleChange();
    window.addEventListener("storage", handleChange);
    window.addEventListener(CHANGE_EVENT, handleChange);
    return () => {
      window.removeEventListener("storage", handleChange);
      window.removeEventListener(CHANGE_EVENT, handleChange);
    };
  }, []);

  const setLanguage = useCallback((nextLanguage: Language) => {
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    setLanguageState(nextLanguage);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(readLanguage() === "zh" ? "en" : "zh");
  }, [setLanguage]);

  return { language, setLanguage, toggleLanguage };
}

export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export const characterUi = {
  zh: {
    boya: { name: "伯牙", era: "春秋 · 琴师", focus: "意" },
    jikang: { name: "嵇康", era: "魏晋 · 玄学家", focus: "和" },
    caiwenji: { name: "蔡文姬", era: "东汉 · 诗人与琴家", focus: "真" },
    abing: { name: "阿炳", era: "近代 · 民间音乐家", focus: "苦" },
    tandun: { name: "谭盾", era: "当代 · 作曲家", focus: "界" },
    bach: { name: "巴赫", era: "巴洛克 · 作曲家", focus: "序" },
    mozart: { name: "莫扎特", era: "古典主义 · 作曲家", focus: "灵" },
    beethoven: { name: "贝多芬", era: "古典主义 · 作曲家", focus: "力" },
    armstrong: { name: "阿姆斯特朗", era: "爵士 · 小号手", focus: "活" },
    lennon: { name: "列侬", era: "摇滚 · 创作人", focus: "众" },
  },
  en: {
    boya: { name: "Boya", era: "Spring-Autumn · Qin Master", focus: "Meaning" },
    jikang: { name: "Ji Kang", era: "Wei-Jin · Philosopher", focus: "Harmony" },
    caiwenji: { name: "Cai Wenji", era: "Eastern Han · Poet", focus: "Truth" },
    abing: { name: "A Bing", era: "Modern · Folk Musician", focus: "Sorrow" },
    tandun: { name: "Tan Dun", era: "Contemporary · Composer", focus: "Boundary" },
    bach: { name: "Bach", era: "Baroque · Composer", focus: "Order" },
    mozart: { name: "Mozart", era: "Classical · Composer", focus: "Spirit" },
    beethoven: { name: "Beethoven", era: "Classical · Composer", focus: "Will" },
    armstrong: { name: "Armstrong", era: "Jazz · Trumpeter", focus: "Swing" },
    lennon: { name: "Lennon", era: "Rock · Songwriter", focus: "People" },
  },
} as const;

export const presetUi = {
  zh: {
    labels: {
      style: "视觉风格",
      mood: "情绪基调",
      tone: "色彩与光",
    },
    selectOne: "请选择一项",
    values: {
      自动: { label: "自动", hint: "根据内容自动判断" },
      水墨: { label: "水墨", hint: "墨色、留白、渗化" },
      工笔: { label: "工笔", hint: "精细线条与层染" },
      油画: { label: "油画", hint: "厚涂、肌理、光影" },
      印象派: { label: "印象派", hint: "光色、笔触、空气感" },
      抽象: { label: "抽象", hint: "形状、节奏、张力" },
      写实: { label: "写实", hint: "真实材质与空间" },
      宁静: { label: "宁静", hint: "稳定、克制、留白" },
      激昂: { label: "激昂", hint: "推进、冲撞、高张力" },
      忧伤: { label: "忧伤", hint: "距离、脆弱、消散" },
      欢快: { label: "欢快", hint: "轻盈、明亮、跳动" },
      暖色: { label: "暖色", hint: "琥珀、赭石、金色" },
      冷色: { label: "冷色", hint: "蓝、青、银色" },
      淡雅: { label: "淡雅", hint: "低饱和、轻对比" },
      浓烈: { label: "浓烈", hint: "高饱和、强对比" },
    },
  },
  en: {
    labels: {
      style: "Visual Style",
      mood: "Emotional Tone",
      tone: "Color & Light",
    },
    selectOne: "Choose one",
    values: {
      自动: { label: "Auto", hint: "Adapt to the music" },
      水墨: { label: "Ink Wash", hint: "Ink, blank space, diffusion" },
      工笔: { label: "Fine-line", hint: "Precise lines and layered color" },
      油画: { label: "Oil Painting", hint: "Texture, impasto, light" },
      印象派: { label: "Impressionist", hint: "Light, brushwork, air" },
      抽象: { label: "Abstract", hint: "Shape, rhythm, tension" },
      写实: { label: "Realistic", hint: "Material and spatial depth" },
      宁静: { label: "Serene", hint: "Stillness, restraint, space" },
      激昂: { label: "Intense", hint: "Drive, impact, high tension" },
      忧伤: { label: "Melancholic", hint: "Distance, fragility, fading" },
      欢快: { label: "Joyful", hint: "Light, bright, lively" },
      暖色: { label: "Warm", hint: "Amber, ochre, gold" },
      冷色: { label: "Cool", hint: "Blue, cyan, silver" },
      淡雅: { label: "Soft", hint: "Low saturation, gentle contrast" },
      浓烈: { label: "Vivid", hint: "High saturation, strong contrast" },
    },
  },
} as const;
