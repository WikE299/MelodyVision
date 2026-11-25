export type VisualMusicMode = "instrumental" | "interpretive" | "soundscape";

export interface VisualMusicModeDefinition {
  id: VisualMusicMode;
  label: string;
  description: string;
  listeningCue: string;
  soundMaterials: string;
  organization: string;
  defaultDirection: string;
  modelRule: string;
}

export const VISUAL_MUSIC_MODES: Record<VisualMusicMode, VisualMusicModeDefinition> = {
  instrumental: {
    id: "instrumental",
    label: "纯器乐",
    description: "把画面写成一首结构完整、可以作为乐曲独立聆听的器乐作品。",
    listeningCue: "可辨认乐器、旋律或节拍，并能听见明确的开端、发展与结尾。",
    soundMaterials: "仅器乐；排除人声、环境录音、拟音和具象音效",
    organization: "以旋律、和声、节奏和完整曲式组织",
    defaultDirection:
      "生成一段35秒的纯器乐音乐。仅根据画面中真实可见的色彩、构图、明暗、纹理、空间层次和运动感推导音乐，不添加画面之外的故事。作品需要有清晰的开端、发展与收束。",
    modelRule:
      "Produce a coherent instrumental composition only. No vocals, speech, narration, lyrics, spoken words, environmental recordings, Foley, or literal sound effects. Prioritize identifiable instrumentation, melody, harmony, rhythm, and a clear beginning-development-ending form.",
  },
  interpretive: {
    id: "interpretive",
    label: "音乐化诠释",
    description: "把色彩、纹理和构图关系转译为音色、密度、动态与运动变化。",
    listeningCue: "仍然是音乐，但可哼唱旋律较弱，冷暖、粗细、疏密等质感变化更突出。",
    soundMaterials: "器乐加抽象音色纹理；排除人声与具象环境音",
    organization: "按视觉冷暖、纹理、密度和运动关系组织变化",
    defaultDirection:
      "生成一段35秒的音乐化诠释。让色彩决定音色，让构图决定声部关系，让光影决定动态，让纹理决定节奏密度。音乐需要连贯、有层次并明确收束，可以保留少量抽象声音质感。",
    modelRule:
      "Produce a coherent instrumental interpretation. No vocals, speech, narration, lyrics, or spoken words. Subtle abstract sonic textures are allowed, but no literal Foley or scene narration. Prioritize mappings from color, texture, composition, light, and visual motion to timbre, density, dynamics, and musical movement.",
  },
  soundscape: {
    id: "soundscape",
    label: "声音景观",
    description: "把画面构造成一个可以进入的声音空间，强调氛围、远近和材质层次。",
    listeningCue: "旋律可能较弱，更容易听见前景与背景、回响、空间纵深和持续演化的氛围。",
    soundMaterials: "除了乐器，还可以加入风声般的铺底、回响和低频震动；但不会出现说话或唱歌",
    organization: "声音会像空间一样分层：近处细节清楚，中间是主要声音，远处用回声拉开距离，并从平静逐渐发展到高潮再结束",
    defaultDirection:
      "生成一段35秒的沉浸式音乐声音景观。根据画面的空间、材质和远近层次组织声音，让听者仿佛进入画面，同时保持完整的情绪发展和自然收束。",
    modelRule:
      "Produce a musical soundscape with a clear emotional arc. No vocals, speech, narration, lyrics, or spoken words. Abstract ambience and material textures are allowed. Prioritize foreground, middle distance, background depth, resonance, spatial perspective, and gradual atmospheric evolution over a prominent singable melody.",
  },
};

export const VISUAL_MUSIC_MODE_ORDER: VisualMusicMode[] = [
  "instrumental",
  "interpretive",
  "soundscape",
];
