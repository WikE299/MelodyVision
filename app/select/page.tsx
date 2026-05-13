"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { characters } from "@/lib/characters";
import CharacterCard from "@/components/CharacterCard";

export default function SelectPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const toggleCharacter = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((c) => c !== id);
      }
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const handleContinue = () => {
    if (selected.length === 0) return;
    sessionStorage.setItem("selectedCharacters", JSON.stringify(selected));
    router.push("/listen");
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-8">
      <div className="w-full max-w-lg flex flex-col items-center gap-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">选择音乐家</h2>
          <p className="text-sm text-gray-500 mt-1">选择 1-4 位音乐家为你点评</p>
        </div>

        {/* Character grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
          {characters.map((char) => (
            <CharacterCard
              key={char.id}
              character={char}
              selected={selected.includes(char.id)}
              commented={false}
              onClick={() => toggleCharacter(char.id)}
            />
          ))}
        </div>

        {/* Selection count */}
        <p className="text-xs text-gray-400">
          已选择 {selected.length} / 4 位
        </p>

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={selected.length === 0}
          className={`
            w-full py-3 rounded-xl text-sm font-medium transition-all
            ${
              selected.length > 0
                ? "bg-gray-900 text-white hover:bg-gray-800"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }
          `}
        >
          {selected.length === 0 ? "请选择至少一位音乐家" : "开始聆听"}
        </button>
      </div>
    </div>
  );
}
