"use client";

import {
  VISUAL_PRESET_OPTIONS,
  type VisualPresets,
} from "@/lib/prompts/visual-presets";

export type Presets = VisualPresets;

interface PresetSelectorProps {
  value: Presets;
  onChange: (presets: Presets) => void;
  disabled?: boolean;
}

const styleOptions = VISUAL_PRESET_OPTIONS.style.map((option) => option.label);
const moodOptions = VISUAL_PRESET_OPTIONS.mood.map((option) => option.label);
const toneOptions = VISUAL_PRESET_OPTIONS.tone.map((option) => option.label);

function PresetGroup({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex flex-wrap justify-center gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            disabled={disabled}
            className={`
              px-3 py-1.5 rounded-full text-sm transition-all
              ${
                value === opt
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PresetSelector({ value, onChange, disabled }: PresetSelectorProps) {
  return (
    <div className="flex flex-col gap-4 items-center">
      <PresetGroup
        label="风格"
        options={styleOptions}
        value={value.style}
        onChange={(v) => onChange({ ...value, style: v })}
        disabled={disabled}
      />
      <PresetGroup
        label="情绪"
        options={moodOptions}
        value={value.mood}
        onChange={(v) => onChange({ ...value, mood: v })}
        disabled={disabled}
      />
      <PresetGroup
        label="色调"
        options={toneOptions}
        value={value.tone}
        onChange={(v) => onChange({ ...value, tone: v })}
        disabled={disabled}
      />
    </div>
  );
}
