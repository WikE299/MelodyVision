import type { Metadata } from "next";
import FormativeStudyClient from "@/components/FormativeStudyClient";

export const metadata: Metadata = {
  title: "共鸣：从音乐到脑海中的画面 | MelodyVision",
  description: "MelodyVision 的研究初衷、视听结合案例与多音乐家共同聆听概念。",
  robots: {
    index: false,
    follow: false,
  },
};

export default function FormativeStudyPage() {
  return <FormativeStudyClient />;
}
