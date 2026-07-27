import type { Metadata } from "next";
import FormativeStudyClient from "@/components/FormativeStudyClient";

export const metadata: Metadata = {
  title: "共鸣：从音乐到脑海中的画面",
  description: "关于音乐想象、画面表达与多视角共同聆听的形成性研究材料。",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "共鸣：从音乐到脑海中的画面",
    description: "关于音乐想象、画面表达与多视角共同聆听的形成性研究材料。",
    images: [],
  },
  twitter: {
    title: "共鸣：从音乐到脑海中的画面",
    description: "关于音乐想象、画面表达与多视角共同聆听的形成性研究材料。",
    images: [],
  },
};

export default function FormativeStudyPage() {
  return <FormativeStudyClient />;
}
