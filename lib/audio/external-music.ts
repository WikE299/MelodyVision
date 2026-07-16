export type ExternalMusicProvider = "jamendo";

export interface ExternalMusicResult {
  id: string;
  provider: ExternalMusicProvider;
  title: string;
  artist: string;
  album?: string;
  durationSeconds: number;
  tags: string[];
  license: string;
  licenseUrl?: string;
  sourceUrl: string;
  artworkUrl?: string;
  previewUrl: string;
  downloadable: boolean;
}

export interface MusicSearchTag {
  id: string;
  label: string;
  group: "mood" | "style" | "timbre" | "rhythm";
  jamendoTags?: string[];
  speed?: "verylow" | "low" | "medium" | "high" | "veryhigh";
  vocalinstrumental?: "vocal" | "instrumental";
}

export const MUSIC_SEARCH_TAGS: MusicSearchTag[] = [
  { id: "calm", label: "宁静", group: "mood", jamendoTags: ["relaxing", "calm"] },
  { id: "intense", label: "激烈", group: "mood", jamendoTags: ["energetic", "epic"] },
  { id: "sad", label: "悲伤", group: "mood", jamendoTags: ["sad", "melancholic"] },
  { id: "happy", label: "欢快", group: "mood", jamendoTags: ["happy", "fun"] },
  { id: "mysterious", label: "神秘", group: "mood", jamendoTags: ["mysterious", "dark"] },
  { id: "warm", label: "温暖", group: "mood", jamendoTags: ["warm", "soft"] },
  { id: "epic", label: "史诗感", group: "mood", jamendoTags: ["epic", "cinematic"] },
  { id: "classical", label: "古典", group: "style", jamendoTags: ["classical"] },
  { id: "jazz", label: "爵士", group: "style", jamendoTags: ["jazz"] },
  { id: "electronic", label: "电子", group: "style", jamendoTags: ["electronic"] },
  { id: "folk", label: "民谣", group: "style", jamendoTags: ["folk"] },
  { id: "world", label: "世界音乐", group: "style", jamendoTags: ["world"] },
  { id: "ambient", label: "氛围", group: "style", jamendoTags: ["ambient"] },
  { id: "cinematic", label: "电影感", group: "style", jamendoTags: ["soundtrack", "cinematic"] },
  { id: "instrumental", label: "器乐", group: "timbre", vocalinstrumental: "instrumental" },
  { id: "vocal", label: "人声", group: "timbre", vocalinstrumental: "vocal" },
  { id: "piano", label: "钢琴", group: "timbre", jamendoTags: ["piano"] },
  { id: "strings", label: "弦乐", group: "timbre", jamendoTags: ["strings"] },
  { id: "orchestral", label: "管弦", group: "timbre", jamendoTags: ["orchestral"] },
  { id: "percussion", label: "打击", group: "timbre", jamendoTags: ["percussion"] },
  { id: "slow", label: "慢速", group: "rhythm", speed: "low" },
  { id: "medium", label: "中速", group: "rhythm", speed: "medium" },
  { id: "fast", label: "快速", group: "rhythm", speed: "high" },
  { id: "groove", label: "律动明显", group: "rhythm", jamendoTags: ["groove"] },
  { id: "flowing", label: "平稳流动", group: "rhythm", jamendoTags: ["flowing", "smooth"] },
];

export const MUSIC_SEARCH_TAG_GROUPS: Array<{
  id: MusicSearchTag["group"];
  label: string;
}> = [
  { id: "mood", label: "情绪" },
  { id: "style", label: "风格" },
  { id: "timbre", label: "声音形态" },
  { id: "rhythm", label: "节奏" },
];

export function getMusicSearchTags(tagIds: string[]): MusicSearchTag[] {
  const selected = new Set(tagIds);
  return MUSIC_SEARCH_TAGS.filter((tag) => selected.has(tag.id));
}
