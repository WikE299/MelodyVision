/**
 * Audio analysis stub.
 * In production, this would call a MIR model to extract music features.
 * For now, returns mock data for development.
 */

export interface AudioAnalysis {
  key: string;
  tempo: string;
  mood: string;
  instruments: string[];
  energy: string;
  genre: string;
  description: string;
}

const mockAnalyses: AudioAnalysis[] = [
  {
    key: "D 大调",
    tempo: "中速 (Andante)",
    mood: "宁静、优美",
    instruments: ["古筝", "二胡", "竹笛"],
    energy: "舒缓",
    genre: "中国传统民乐",
    description: "旋律流畅优美，具有典型的江南水乡韵味",
  },
  {
    key: "C 小调",
    tempo: "慢速 (Adagio)",
    mood: "忧伤、深沉",
    instruments: ["古琴"],
    energy: "内敛",
    genre: "古琴独奏",
    description: "古琴独奏，音色苍凉，意境深远",
  },
  {
    key: "G 大调",
    tempo: "快速 (Allegro)",
    mood: "激昂、豪迈",
    instruments: ["琵琶", "二胡", "鼓"],
    energy: "强烈",
    genre: "中国民乐合奏",
    description: "节奏明快，充满力量感",
  },
  {
    key: "A 小调",
    tempo: "中慢速",
    mood: "苍凉、悲壮",
    instruments: ["二胡"],
    energy: "深沉",
    genre: "二胡独奏",
    description: "二胡独奏，如泣如诉，情感深沉",
  },
];

/**
 * Analyze uploaded audio and return music features.
 * TODO: Replace with actual MIR model API call.
 */
export async function analyzeAudio(
  _audioBuffer: Buffer
): Promise<AudioAnalysis> {
  void _audioBuffer;

  // Mock: simulate analysis delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Return a random mock analysis
  const index = Math.floor(Math.random() * mockAnalyses.length);
  return mockAnalyses[index];
}

/**
 * Analyze audio from a URL (e.g., preset audio).
 */
export async function analyzeAudioUrl(_url: string): Promise<AudioAnalysis> {
  void _url;

  await new Promise((resolve) => setTimeout(resolve, 500));
  const index = Math.floor(Math.random() * mockAnalyses.length);
  return mockAnalyses[index];
}
