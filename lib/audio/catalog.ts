export interface AudioCatalogItem {
  id: string;
  name: string;
  description: string;
  tags: string[];
  file: string;
  durationSeconds: number;
  source: string;
  license: string;
}

export const audioCatalog: AudioCatalogItem[] = [
  {
    id: "music2image-demo",
    name: "Music2Image Demo",
    description: "一段用于快速体验完整流程的测试音频，适合观察节奏、能量与画面生成之间的关系。",
    tags: ["示例", "测试", "综合", "快速体验"],
    file: "/preset-audio/music2image.mp3",
    durationSeconds: 30,
    source: "Project local demo asset",
    license: "Internal prototype use",
  },
];

export function searchAudioCatalog(query: string): AudioCatalogItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return audioCatalog;

  return audioCatalog.filter((item) => {
    const haystack = [
      item.name,
      item.description,
      item.source,
      item.license,
      ...item.tags,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
