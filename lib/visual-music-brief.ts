import OpenAI from "openai";
import {
  VISUAL_MUSIC_MODES,
  type VisualMusicMode,
} from "./visual-music-modes";

export type { VisualMusicMode } from "./visual-music-modes";

export interface VisualMusicBrief {
  visualSummary: string;
  musicPrompt: string;
  model: string;
}

interface RawVisualMusicBrief {
  visualSummary?: unknown;
  musicPrompt?: unknown;
}

function modelName(): string {
  return process.env.VISUAL_MUSIC_MODEL?.trim() || "qwen3.8-flash";
}

function parseJsonObject(value: string): RawVisualMusicBrief {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("视觉模型没有返回有效的音乐简报");
  }
  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as RawVisualMusicBrief;
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`视觉音乐简报缺少 ${field}`);
  }
  return value.trim().slice(0, maxLength);
}

export async function createVisualMusicBrief(input: {
  imageDataUrl: string;
  direction: string;
  mode: VisualMusicMode;
  signal?: AbortSignal;
}): Promise<VisualMusicBrief> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) throw new Error("服务端尚未配置 DASHSCOPE_API_KEY，无法理解图片");

  const model = modelName();
  const client = new OpenAI({
    apiKey,
    baseURL:
      process.env.DASHSCOPE_COMPATIBLE_BASE_URL?.trim() ||
      "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });

  const response = await client.chat.completions.create(
    {
      model,
      temperature: 0.35,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You translate one artwork into a production-ready prompt for an audio-generation model.

Return one JSON object with exactly these string fields:
- visualSummary: a concise Chinese description of visible color, composition, light, texture, depth, motion, and emotional tension. Do not invent objects that are not visible.
- musicPrompt: an English production brief of 90-150 words.

The musicPrompt must:
- start with "INSTRUMENTAL MUSIC ONLY. NO VOICE. NO SPEECH. NO NARRATION. NO LYRICS."
- describe duration, tempo range, tonal center or harmonic character, meter, instrumentation, timbre, density, dynamics, spatial character, and a beginning-development-ending structure;
- translate only visible evidence into musical decisions;
- contain no quoted dialogue, prose narration, instructions to describe the image, or mention of an image;
- end with "End on a deliberate musical cadence with no spoken words."

Mode rule: ${VISUAL_MUSIC_MODES[input.mode].modelRule}`,
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: input.imageDataUrl } },
            {
              type: "text",
              text: `Create the visual music brief. Additional direction from the tester:\n${input.direction}`,
            },
          ],
        },
      ],
    },
    input.signal ? { signal: input.signal } : undefined
  );

  const raw = parseJsonObject(response.choices[0]?.message.content || "");
  const visualSummary = requiredText(raw.visualSummary, "visualSummary", 700);
  let musicPrompt = requiredText(raw.musicPrompt, "musicPrompt", 1800);
  if (!/^INSTRUMENTAL MUSIC ONLY\./i.test(musicPrompt)) {
    musicPrompt = `INSTRUMENTAL MUSIC ONLY. NO VOICE. NO SPEECH. NO NARRATION. NO LYRICS. ${musicPrompt}`;
  }
  if (!/no spoken words\.$/i.test(musicPrompt)) {
    musicPrompt = `${musicPrompt} End on a deliberate musical cadence with no spoken words.`;
  }

  return { visualSummary, musicPrompt, model: response.model || model };
}
