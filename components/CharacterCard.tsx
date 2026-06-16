"use client";

import { useState } from "react";
import { Character } from "@/lib/characters";
import Image from "next/image";

interface CharacterCardProps {
  character: Character;
  selected: boolean;
  commented: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const cultureColors: Record<string, { bg: string; text: string; border: string }> = {
  chinese: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  western: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
};

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

function AvatarFallback({ name, id }: { name: string; id: string }) {
  const color = fallbackColors[id] || "#6B7280";
  return (
    <div
      className="w-full h-full flex items-center justify-center text-white font-bold text-lg"
      style={{ backgroundColor: color }}
    >
      {name.charAt(0)}
    </div>
  );
}

export default function CharacterCard({
  character,
  selected,
  commented,
  onClick,
  disabled,
}: CharacterCardProps) {
  const [imgError, setImgError] = useState(false);
  const imageSrc = selected
    ? `/characters/${character.id}-2.png`
    : `/characters/${character.id}-1.png`;

  const culture = cultureColors[character.culture] || cultureColors.chinese;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative flex flex-col items-center p-4 rounded-2xl border-2 transition-all duration-200
        ${
          selected
            ? "border-blue-500 bg-blue-50 shadow-md scale-[1.02]"
            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      {/* Avatar */}
      <div className="w-16 h-16 rounded-full overflow-hidden mb-2 relative">
        {imgError ? (
          <AvatarFallback name={character.name} id={character.id} />
        ) : (
          <Image
            src={imageSrc}
            alt={character.name}
            fill
            className="object-cover"
            sizes="64px"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* Name + era */}
      <span className="text-sm font-medium text-gray-800">{character.name}</span>
      <span className="text-xs text-gray-400">{character.era}</span>

      {/* Focus keyword badge */}
      <span
        className={`
          mt-2 px-2 py-0.5 rounded-full text-xs
          ${selected ? "bg-blue-200 text-blue-700" : "bg-gray-100 text-gray-500"}
        `}
      >
        关注「{character.focusKeyword}」
      </span>

      {/* Commented indicator */}
      {commented && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Tags */}
      <div className="flex flex-wrap justify-center gap-1 mt-2">
        {character.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}
