"use client";

interface PresetAudio {
  name: string;
  description: string;
  file: string;
}

const presets: PresetAudio[] = [
  { name: "Music2Image", description: "测试曲目·真实音频", file: "/preset-audio/music2image.mp3" },
  { name: "茉莉花", description: "江苏民歌，优美宁静", file: "/preset-audio/molihua.mp3" },
  { name: "高山流水", description: "古琴名曲，意境深远", file: "/preset-audio/gaoshanliushui.mp3" },
  { name: "二泉映月", description: "二胡独奏，如泣如诉", file: "/preset-audio/erquanyinyue.mp3" },
  { name: "欢乐颂", description: "贝多芬·第九交响曲", file: "/preset-audio/ode-to-joy.mp3" },
  { name: "G弦上的咏叹调", description: "巴赫·管弦乐组曲", file: "/preset-audio/air-on-g-string.mp3" },
  { name: "What a Wonderful World", description: "阿姆斯特朗·爵士经典", file: "/preset-audio/wonderful-world.mp3" },
];

interface PresetAudiosProps {
  onSelect: (file: File) => void;
  disabled?: boolean;
}

export default function PresetAudios({ onSelect, disabled }: PresetAudiosProps) {
  const handleSelect = async (preset: PresetAudio) => {
    if (disabled) return;

    sessionStorage.setItem("audioSrc", preset.file);
    try {
      const res = await fetch(preset.file);
      const blob = await res.blob();
      const file = new File([blob], `${preset.name}.mp3`, { type: "audio/mpeg" });
      onSelect(file);
    } catch {
      const fallback = new File([""], `${preset.name}.mp3`, { type: "audio/mpeg" });
      onSelect(fallback);
    }
  };

  return (
    <div className="w-full">
      <p className="text-sm text-gray-500 mb-3 text-center">或选择预置曲目</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {presets.map((preset) => (
          <button
            key={preset.name}
            onClick={() => handleSelect(preset)}
            disabled={disabled}
            className={`
              flex flex-col items-center p-3 rounded-xl border transition-all
              ${
                disabled
                  ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50"
                  : "border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
              }
            `}
          >
            <span className="text-sm font-medium text-gray-800">{preset.name}</span>
            <span className="text-xs text-gray-400 mt-0.5">{preset.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
