"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { chineseCharacters, westernCharacters } from "@/lib/characters";
import CharacterCard from "@/components/CharacterCard";

const DEFAULT_COMBO = ["boya", "beethoven", "abing", "armstrong"];

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

  const applyDefaultCombo = () => {
    setSelected(DEFAULT_COMBO);
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
          <p className="text-sm text-gray-500 mt-1">选择 1-4 位音乐家陪你一起听</p>
        </div>

        {/* Quick combo */}
        <button
          onClick={applyDefaultCombo}
          className="px-4 py-1.5 rounded-full text-xs border border-blue-200 text-blue-600 hover:bg-blue-50 transition-all"
        >
          推荐组合：伯牙 + 贝多芬 + 阿炳 + 阿姆斯特朗
        </button>

        {/* Chinese group */}
        <div className="w-full">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">中</span>
            <span className="text-xs text-gray-400">中国音乐家</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {chineseCharacters.map((char) => (
              <CharacterCard
                key={char.id}
                character={char}
                selected={selected.includes(char.id)}
                commented={false}
                onClick={() => toggleCharacter(char.id)}
              />
            ))}
          </div>
        </div>

        {/* Western group */}
        <div className="w-full">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">西</span>
            <span className="text-xs text-gray-400">西方音乐家</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {westernCharacters.map((char) => (
              <CharacterCard
                key={char.id}
                character={char}
                selected={selected.includes(char.id)}
                commented={false}
                onClick={() => toggleCharacter(char.id)}
              />
            ))}
          </div>
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
