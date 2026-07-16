export interface VisualPresets {
  style: string;
  mood: string;
  tone: string;
}

interface VisualPresetOption {
  label: string;
  prompt: string;
}

export const VISUAL_PRESET_OPTIONS: {
  style: VisualPresetOption[];
  mood: VisualPresetOption[];
  tone: VisualPresetOption[];
} = {
  style: [
    {
      label: "自动",
      prompt:
        "Choose the visual medium that best expresses this specific concept. Deliberately avoid defaulting to Chinese ink wash or a landscape unless the source material clearly calls for it.",
    },
    {
      label: "水墨",
      prompt:
        "Use Chinese ink wash on xuan paper, expressive brush pressure, layered ink values, bleeding edges, and purposeful negative space.",
    },
    {
      label: "工笔",
      prompt:
        "Use meticulous gongbi painting, precise controlled outlines, layered mineral pigments, fine ornamental detail, and a carefully balanced composition.",
    },
    {
      label: "油画",
      prompt:
        "Use expressive oil painting, visible impasto brushwork, rich material texture, deep tonal modeling, and painterly color transitions.",
    },
    {
      label: "印象派",
      prompt:
        "Use an Impressionist approach with broken color, lively visible strokes, atmospheric light, optical color mixing, and fleeting sensory detail.",
    },
    {
      label: "抽象",
      prompt:
        "Use non-figurative abstraction driven by shape, rhythm, texture, spatial tension, and layered fields of color rather than literal scenery.",
    },
    {
      label: "写实",
      prompt:
        "Use cinematic realism with physically convincing materials, natural depth, precise environmental detail, believable lighting, and photographic clarity.",
    },
  ],
  mood: [
    {
      label: "自动",
      prompt:
        "Derive a distinctive emotional register from the source material, including tension or contradiction when present; do not default to serenity.",
    },
    {
      label: "宁静",
      prompt:
        "Create a serene, spacious emotional register through restrained motion, visual breathing room, soft transitions, and stable balance.",
    },
    {
      label: "激昂",
      prompt:
        "Create forceful momentum through dynamic diagonals, compressed energy, bold scale changes, sharp accents, and dramatic visual tension.",
    },
    {
      label: "忧伤",
      prompt:
        "Create restrained melancholy through quiet distance, fragile details, fading edges, suspended motion, and a palpable sense of absence.",
    },
    {
      label: "欢快",
      prompt:
        "Create buoyant joy through playful rhythm, open movement, lively spacing, crisp accents, and an uplifting sense of discovery.",
    },
  ],
  tone: [
    {
      label: "自动",
      prompt:
        "Choose a specific color system from the emotional and visual concept; avoid repeatedly using muted gray-green palettes.",
    },
    {
      label: "暖色",
      prompt:
        "Use a warm palette led by amber, ochre, coral, vermilion, and sunlit gold, with cooler notes only for controlled contrast.",
    },
    {
      label: "冷色",
      prompt:
        "Use a cool palette led by cobalt, cyan, indigo, silver, and blue-violet, with sparse warm accents for focal contrast.",
    },
    {
      label: "淡雅",
      prompt:
        "Use a restrained low-saturation palette, delicate value shifts, subtle color relationships, and generous tonal breathing room.",
    },
    {
      label: "浓烈",
      prompt:
        "Use saturated high-impact color, strong warm-cool contrast, deep darks, luminous highlights, and decisive chromatic accents.",
    },
  ],
};

export interface VisualPresetPrompt {
  style: string;
  mood: string;
  tone: string;
  stylePrompt: string;
  moodPrompt: string;
  tonePrompt: string;
  combinedPrompt: string;
}

function findPrompt(group: keyof typeof VISUAL_PRESET_OPTIONS, label: string): string {
  const options = VISUAL_PRESET_OPTIONS[group];
  return (
    options.find((option) => option.label === label)?.prompt ||
    options.find((option) => option.label === "自动")?.prompt ||
    ""
  );
}

export function buildVisualPresetPrompt(presets: Partial<VisualPresets>): VisualPresetPrompt {
  const style = presets.style || "自动";
  const mood = presets.mood || "自动";
  const tone = presets.tone || "自动";
  const stylePrompt = findPrompt("style", style);
  const moodPrompt = findPrompt("mood", mood);
  const tonePrompt = findPrompt("tone", tone);

  return {
    style,
    mood,
    tone,
    stylePrompt,
    moodPrompt,
    tonePrompt,
    combinedPrompt: [stylePrompt, moodPrompt, tonePrompt].filter(Boolean).join(" "),
  };
}
