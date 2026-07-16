import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

const CLIP_DIR = path.join(process.cwd(), "public", "preset-audio", "clips");

const clips = [
  {
    id: "molihua-piano",
    input: "茉莉花 (钢琴版纯音乐)-纯音乐.mp3",
    output: "molihua-piano-clip.mp3",
    start: 24,
    duration: 45,
  },
  {
    id: "yangguan-sandie-guqin",
    input: "阳关三叠 (古琴版)-戴晓莲.mp3",
    output: "yangguan-sandie-guqin-clip.mp3",
    start: 68,
    duration: 45,
  },
  {
    id: "erquan-yingyue",
    input: "阿炳 - 二泉映月.mp3",
    output: "erquan-yingyue-clip.mp3",
    start: 42,
    duration: 45,
  },
  {
    id: "bach-cello-prelude",
    input: "Cello Suite no. 1 - Prelude in G, BWV 1007.mp3",
    output: "bach-cello-prelude-clip.mp3",
    start: 0,
    duration: 45,
  },
  {
    id: "beethoven-symphony-5",
    input: "Symphony no. 5 in Cm, Op. 67 - I. Allegro con brio.mp3",
    output: "beethoven-symphony-5-clip.mp3",
    start: 0,
    duration: 45,
  },
  {
    id: "mozart-eine-kleine-nachtmusik",
    input: "Mozart_-_Eine_kleine_Nachtmusik_-_1._Allegro.ogg",
    output: "mozart-eine-kleine-nachtmusik-clip.mp3",
    start: 0,
    duration: 45,
  },
  {
    id: "westend-blues",
    input: "Westend Blues (Hot Five).mp3",
    output: "westend-blues-clip.mp3",
    start: 0,
    duration: 45,
  },
  {
    id: "amoeba-someday",
    input: "Amœba_-_someday_i_will_be_like_noraus..ogg",
    output: "amoeba-someday-clip.mp3",
    start: 60,
    duration: 45,
  },
];

if (!ffmpegPath) {
  throw new Error("ffmpeg-static did not provide an ffmpeg binary path.");
}

mkdirSync(CLIP_DIR, { recursive: true });

for (const clip of clips) {
  const input = path.join(process.cwd(), "public", "preset-audio", clip.input);
  const output = path.join(CLIP_DIR, clip.output);
  const result = spawnSync(
    ffmpegPath,
    [
      "-y",
      "-ss",
      String(clip.start),
      "-t",
      String(clip.duration),
      "-i",
      input,
      "-vn",
      "-acodec",
      "libmp3lame",
      "-b:a",
      "160k",
      "-ar",
      "44100",
      "-ac",
      "2",
      output,
    ],
    { stdio: "inherit" }
  );

  if (result.status !== 0) {
    throw new Error(`Failed to create clip for ${clip.id}`);
  }

  console.log(`Created ${path.relative(process.cwd(), output)} (${clip.start}s-${clip.start + clip.duration}s)`);
}
