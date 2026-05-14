"use client";

import Image from "next/image";

interface CommentBubbleProps {
  characterId: string;
  characterName: string;
  focusKeyword: string;
  text: string;
  visible: boolean;
}

export default function CommentBubble({
  characterId,
  characterName,
  focusKeyword,
  text,
  visible,
}: CommentBubbleProps) {
  if (!visible) return null;

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 relative">
          <Image
            src={`/characters/${characterId}-2.png`}
            alt={characterName}
            fill
            className="object-cover"
            sizes="40px"
          />
        </div>

        {/* Bubble */}
        <div className="flex-1 bg-white rounded-2xl rounded-tl-sm p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-800">{characterName}</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">
              关注「{focusKeyword}」
            </span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
}
