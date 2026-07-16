"use client";

import { useState } from "react";
import Image from "next/image";

interface CommentBubbleProps {
  characterId: string;
  characterName: string;
  text: string;
  visible: boolean;
}

const fallbackColors: Record<string, string> = {
  boya: "#6B7280",
  jikang: "#4B5563",
  caiwenji: "#9F7AEA",
  abing: "#6B7280",
  tandun: "#2563EB",
  bach: "#92400E",
  mozart: "#D97706",
  beethoven: "#DC2626",
  armstrong: "#059669",
  lennon: "#7C3AED",
};

export default function CommentBubble({
  characterId,
  characterName,
  text,
  visible,
}: CommentBubbleProps) {
  const [imgError, setImgError] = useState(false);

  if (!visible) return null;

  const color = fallbackColors[characterId] || "#6B7280";

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 relative">
          {imgError ? (
            <div
              className="w-full h-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: color }}
            >
              {characterName.charAt(0)}
            </div>
          ) : (
            <Image
              src={`/characters/${characterId}-2.png`}
              alt={characterName}
              fill
              className="object-cover"
              sizes="40px"
              onError={() => setImgError(true)}
            />
          )}
        </div>

        {/* Bubble */}
        <div className="flex-1 bg-white rounded-2xl rounded-tl-sm p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-800">{characterName}</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
}
