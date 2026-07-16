"use client";

import { useCallback, useState, useRef } from "react";

interface AudioUploaderProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  language?: "zh" | "en";
}

const COPY = {
  zh: {
    formatError: "支持格式：MP3 / WAV / FLAC / OGG",
    sizeError: "文件大小不能超过 20MB",
    title: "拖拽音频到这里",
    meta: "MP3 · WAV · FLAC · OGG · 最大 20MB",
  },
  en: {
    formatError: "Supported formats: MP3 / WAV / FLAC / OGG",
    sizeError: "File size must be under 20MB",
    title: "Drop audio here",
    meta: "MP3 · WAV · FLAC · OGG · Max 20MB",
  },
};

export default function AudioUploader({ onFileSelect, disabled, language = "zh" }: AudioUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const copy = COPY[language];

  const validateFile = useCallback((file: File): boolean => {
    setError(null);

    const allowedExts = [".mp3", ".wav", ".flac", ".ogg"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedExts.includes(ext)) {
      setError(copy.formatError);
      return false;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError(copy.sizeError);
      return false;
    }

    return true;
  }, [copy.formatError, copy.sizeError]);

  const handleFile = useCallback(
    (file: File) => {
      if (validateFile(file)) {
        onFileSelect(file);
      }
    },
    [validateFile, onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [disabled, handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          group relative flex flex-col items-center justify-center
          h-52 w-full overflow-hidden rounded-[28px] border border-dashed
          cursor-pointer transition-all duration-300
          ${
            disabled
              ? "cursor-not-allowed border-[#d8b27a]/35 bg-[#caa27e]/25 opacity-70"
              : dragActive
              ? "scale-[1.02] border-[#ffe0a6] bg-[#d6b08b]/35 shadow-[0_0_60px_rgba(255,198,112,0.32)]"
              : "border-[#ffe0a6]/70 bg-[#c9a184]/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_70px_rgba(18,12,20,0.35)] hover:border-[#ffe8bf] hover:bg-[#d0aa8c]/45"
          }
        `}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,244,216,0.36),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.18),rgba(97,61,59,0.08))]" />
        <div className="absolute inset-x-5 top-4 border-t border-dashed border-white/45" />
        <div className="absolute inset-x-5 bottom-4 border-t border-dashed border-white/25" />
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.wav,.flac,.ogg,audio/mpeg,audio/wav,audio/flac,audio/ogg,application/ogg"
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />

        <div className="relative flex flex-col items-center gap-4 px-4 text-center text-[#fff0d2]">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-white/16 shadow-[0_0_34px_rgba(255,223,175,0.28)] backdrop-blur">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19V5m0 0-5 5m5-5 5 5" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-medium tracking-wide">
              {copy.title}
            </p>
            <p className="mt-3 text-base text-white/80">
              {copy.meta}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-center text-sm text-[#ffd2c7]">{error}</p>
      )}
    </div>
  );
}
