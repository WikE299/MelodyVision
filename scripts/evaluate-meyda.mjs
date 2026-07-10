import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

import { analyzeDecodedAudio } from "../lib/audio/web-analyzer.ts";
import { audioCatalog } from "../lib/audio/catalog.ts";

const execFileAsync = promisify(execFile);
const sampleRate = 44_100;

function readOutputArgument() {
  const index = process.argv.indexOf("--output");
  if (index === -1 || !process.argv[index + 1]) {
    throw new Error("Usage: npm run audio:evaluate:meyda -- --output <path>");
  }
  return resolve(process.argv[index + 1]);
}

async function decodeAudio(path) {
  if (!ffmpegPath) throw new Error("ffmpeg-static did not provide an executable path");
  const startedAt = performance.now();
  const { stdout } = await execFileAsync(
    ffmpegPath,
    ["-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", String(sampleRate), "pipe:1"],
    { encoding: "buffer", maxBuffer: 32 * 1024 * 1024 }
  );
  const bytes = stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + stdout.byteLength);
  return {
    samples: new Float32Array(bytes),
    elapsedMs: performance.now() - startedAt,
  };
}

async function main() {
  const outputPath = readOutputArgument();
  const items = [];

  for (const item of audioCatalog) {
    const audioPath = join(process.cwd(), "public", item.file.replace(/^\//, ""));
    const decoded = await decodeAudio(audioPath);
    const analysisStartedAt = performance.now();
    const analysis = analyzeDecodedAudio(
      decoded.samples,
      sampleRate,
      decoded.samples.length / sampleRate
    );
    const analysisMs = performance.now() - analysisStartedAt;
    items.push({
      id: item.id,
      file: basename(audioPath),
      timing: {
        decodeMs: Math.round(decoded.elapsedMs * 100) / 100,
        analysisMs: Math.round(analysisMs * 100) / 100,
        totalMs: Math.round((decoded.elapsedMs + analysisMs) * 100) / 100,
      },
      analysis,
    });
    process.stdout.write(`${item.id}: ${Math.round(decoded.elapsedMs + analysisMs)} ms\n`);
  }

  await writeFile(
    outputPath,
    `${JSON.stringify({ schemaVersion: "v2-03-meyda-1", items }, null, 2)}\n`,
    "utf8"
  );
  process.stdout.write(`${outputPath}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
