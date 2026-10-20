export const SEED_AUDIO_MODEL = "seed-audio-1.0";
export const SEED_AUDIO_ENDPOINT = "https://openspeech.bytedance.com/api/v3/tts/create";

export const SEED_AUDIO_LIMITS = {
  maxPromptCharacters: 3000,
  maxImageBytes: 10 * 1024 * 1024,
} as const;

export interface SeedAudioRequestBody {
  model: typeof SEED_AUDIO_MODEL;
  text_prompt: string;
  audio_config: {
    format: "mp3";
    sample_rate: 48000;
    pitch_rate: 0;
    speech_rate: 0;
    loudness_rate: 0;
  };
  watermark: Record<string, never>;
}

export function parseImageDataUrl(value: unknown): {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
  byteLength: number;
} {
  if (typeof value !== "string") {
    throw new Error("请选择一张图片后再生成");
  }

  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    throw new Error("图片格式不受支持，请使用 JPEG、PNG 或 WebP");
  }

  const base64 = match[2].replace(/\s/g, "");
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const byteLength = Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  if (byteLength === 0) throw new Error("图片内容为空");
  if (byteLength > SEED_AUDIO_LIMITS.maxImageBytes) {
    throw new Error("图片处理后仍超过 10MB，请换一张较小的图片");
  }

  return {
    mimeType: match[1] as "image/jpeg" | "image/png" | "image/webp",
    base64,
    byteLength,
  };
}

export function normalizeSeedAudioPrompt(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("请输入生成提示词");
  }
  const prompt = value.trim();
  if (prompt.length > SEED_AUDIO_LIMITS.maxPromptCharacters) {
    throw new Error(`提示词不能超过 ${SEED_AUDIO_LIMITS.maxPromptCharacters} 个字符`);
  }
  return prompt;
}

export function buildSeedAudioRequest(
  prompt: string
): SeedAudioRequestBody {
  return {
    model: SEED_AUDIO_MODEL,
    text_prompt: prompt,
    audio_config: {
      format: "mp3",
      sample_rate: 48000,
      pitch_rate: 0,
      speech_rate: 0,
      loudness_rate: 0,
    },
    watermark: {},
  };
}
