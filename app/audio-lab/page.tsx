import { notFound } from "next/navigation";
import { isAudioLabEnabled } from "@/lib/audio-lab/access";
import SeedAudioLabClient from "../seed-audio-lab/SeedAudioLabClient";

export const metadata = {
  title: "Audio Lab | MelodyVision",
  description: "Generate and retain music from MelodyVision research artworks.",
};

export const dynamic = "force-dynamic";

export default function AudioLabPage() {
  if (!isAudioLabEnabled()) notFound();
  return <SeedAudioLabClient />;
}
