"use client";

import { useCallback, useState, useRef } from "react";

interface AudioUploaderProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export default function AudioUploader({ onFileSelect, disabled }: AudioUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): boolean => {
    setError(null);

    const allowedExts = [".mp3", ".wav", ".flac"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedExts.includes(ext)) {
      setError("支持格式：MP3 / WAV / FLAC");
      return false;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("文件大小不能超过 20MB");
      return false;
    }

    return true;
  }, []);

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
          relative flex flex-col items-center justify-center
          w-full h-48 rounded-2xl border-2 border-dashed
          cursor-pointer transition-all duration-200
          ${
            disabled
              ? "opacity-50 cursor-not-allowed border-gray-300 bg-gray-50"
              : dragActive
              ? "border-blue-500 bg-blue-50 scale-[1.02]"
              : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50"
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.wav,.flac,audio/mpeg,audio/wav,audio/flac"
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />

        <div className="flex flex-col items-center gap-3 text-center px-4">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">
              拖拽音频到这里，或点击选择
            </p>
            <p className="text-xs text-gray-400 mt-1">
              支持 MP3 / WAV / FLAC，最大 20MB
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  );
}
