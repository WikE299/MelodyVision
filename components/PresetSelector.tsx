"use client";

import { useState } from "react";

export interface Presets {
  style: string;
  mood: string;
  tone: string;
}

interface PresetSelectorProps {
  value: Presets;
  onChange: (presets: Presets) => void;
  disabled?: boolean;
}

const styleOptions = ["水墨", "油画", "抽象", "写实"];
const moodOptions = ["宁静", "激昂", "忧伤", "欢快"];
const toneOptions = ["暖色", "冷色", "淡雅", "浓烈"];

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
      <div className="flex gap-1.5">
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
