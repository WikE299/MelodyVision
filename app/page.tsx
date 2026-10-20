import HomePageClient from "@/components/HomePageClient";
import { isAudioLabEnabled } from "@/lib/audio-lab/access";

export default function Home() {
  return <HomePageClient audioLabEnabled={isAudioLabEnabled()} />;
}
