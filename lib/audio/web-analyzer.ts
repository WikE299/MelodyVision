import Meyda from "meyda";

export interface AudioFeatures {
  bpm: number;
  energy: "舒缓" | "中等" | "强烈" | "极强";
  brightness: "暗沉" | "柔和" | "明亮" | "尖锐";
  dynamicRange: "平稳" | "有起伏" | "大起大落";
  spectralCentroid: number;
  rmsEnergy: number;
  zeroCrossingRate: number;
  spectralFlatness: number;
  spectralRolloff: number;
  mfcc: number[];
  durationSeconds: number;
  tempo: string;
  mood: string;
  description: string;
}

const BUFFER_SIZE = 2048;

export async function analyzeAudioFile(file: File): Promise<AudioFeatures> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;

  const frameFeatures = extractFrameFeatures(channelData, sampleRate);
  const bpm = estimateBPM(channelData, sampleRate);
  const dynamicRange = calcDynamicRange(frameFeatures.rmsValues);

  const avgRms = mean(frameFeatures.rmsValues);
  const avgCentroid = mean(frameFeatures.centroidValues);
  const avgZcr = mean(frameFeatures.zcrValues);
  const avgFlatness = mean(frameFeatures.flatnessValues);
  const avgRolloff = mean(frameFeatures.rolloffValues);
  const avgMfcc = averageMfcc(frameFeatures.mfccValues);

  const energy = classifyEnergy(avgRms);
  const brightness = classifyBrightness(avgCentroid);
  const tempo = classifyTempo(bpm);
  const mood = inferMood(energy, brightness, bpm, avgFlatness);
  const description = buildDescription(energy, brightness, tempo, bpm, dynamicRange, duration, avgFlatness);

  audioCtx.close();

  return {
    bpm: Math.round(bpm),
    energy,
    brightness,
    dynamicRange,
    spectralCentroid: Math.round(avgCentroid),
    rmsEnergy: Math.round(avgRms * 10000) / 10000,
    zeroCrossingRate: Math.round(avgZcr),
    spectralFlatness: Math.round(avgFlatness * 10000) / 10000,
    spectralRolloff: Math.round(avgRolloff),
    mfcc: avgMfcc.map((v) => Math.round(v * 100) / 100),
    durationSeconds: Math.round(duration),
    tempo,
    mood,
    description,
  };
}

interface FrameFeatures {
  rmsValues: number[];
  centroidValues: number[];
  zcrValues: number[];
  flatnessValues: number[];
  rolloffValues: number[];
  mfccValues: number[][];
}

function extractFrameFeatures(channelData: Float32Array, sampleRate: number): FrameFeatures {
  const result: FrameFeatures = {
    rmsValues: [],
    centroidValues: [],
    zcrValues: [],
    flatnessValues: [],
    rolloffValues: [],
    mfccValues: [],
  };

  const previousConfig = {
    bufferSize: Meyda.bufferSize,
    sampleRate: Meyda.sampleRate,
    numberOfMFCCCoefficients: Meyda.numberOfMFCCCoefficients,
  };

  Meyda.bufferSize = BUFFER_SIZE;
  Meyda.sampleRate = sampleRate;
  Meyda.numberOfMFCCCoefficients = 13;

  const hopSize = BUFFER_SIZE / 2;
  const totalFrames = Math.floor((channelData.length - BUFFER_SIZE) / hopSize);

  try {
    for (let i = 0; i < totalFrames; i++) {
      const start = i * hopSize;
      const frame = channelData.slice(start, start + BUFFER_SIZE);

      const features = Meyda.extract(
        ["rms", "spectralCentroid", "zcr", "spectralFlatness", "spectralRolloff", "mfcc"],
        frame
      );

      if (features) {
        if (typeof features.rms === "number") result.rmsValues.push(features.rms);
        if (typeof features.spectralCentroid === "number") {
          result.centroidValues.push(features.spectralCentroid * (sampleRate / 2) / (BUFFER_SIZE / 2));
        }
        if (typeof features.zcr === "number") result.zcrValues.push(features.zcr);
        if (typeof features.spectralFlatness === "number") result.flatnessValues.push(features.spectralFlatness);
        if (typeof features.spectralRolloff === "number") result.rolloffValues.push(features.spectralRolloff);
        if (Array.isArray(features.mfcc)) result.mfccValues.push(features.mfcc);
      }
    }
  } finally {
    Meyda.bufferSize = previousConfig.bufferSize;
    Meyda.sampleRate = previousConfig.sampleRate;
    Meyda.numberOfMFCCCoefficients = previousConfig.numberOfMFCCCoefficients;
  }

  return result;
}

function estimateBPM(data: Float32Array, sampleRate: number): number {
  const hopSize = 512;
  const frameCount = Math.floor(data.length / hopSize) - 1;
  if (frameCount < 2) return 120;

  const onsetEnvelope = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    let energy = 0;
    const start = i * hopSize;
    for (let j = start; j < start + hopSize && j < data.length; j++) {
      energy += data[j] * data[j];
    }
    onsetEnvelope[i] = Math.sqrt(energy / hopSize);
  }

  const diff = new Float32Array(frameCount - 1);
  for (let i = 1; i < frameCount; i++) {
    diff[i - 1] = Math.max(0, onsetEnvelope[i] - onsetEnvelope[i - 1]);
  }

  const minBPM = 60;
  const maxBPM = 200;
  const minLag = Math.floor((60 / maxBPM) * sampleRate / hopSize);
  const maxLag = Math.floor((60 / minBPM) * sampleRate / hopSize);

  let bestLag = minLag;
  let bestCorr = -1;

  for (let lag = minLag; lag <= Math.min(maxLag, diff.length - 1); lag++) {
    let corr = 0;
    const len = Math.min(diff.length - lag, 500);
    for (let i = 0; i < len; i++) {
      corr += diff[i] * diff[i + lag];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  return (60 * sampleRate) / (bestLag * hopSize);
}

function calcDynamicRange(rmsValues: number[]): "平稳" | "有起伏" | "大起大落" {
  if (rmsValues.length < 2) return "平稳";
  const avg = mean(rmsValues);
  const variance = rmsValues.reduce((a, b) => a + (b - avg) ** 2, 0) / rmsValues.length;
  const cv = Math.sqrt(variance) / (avg || 1);
  if (cv < 0.3) return "平稳";
  if (cv < 0.6) return "有起伏";
  return "大起大落";
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function averageMfcc(mfccFrames: number[][]): number[] {
  if (mfccFrames.length === 0) return new Array(13).fill(0);
  const dim = mfccFrames[0].length;
  const avg = new Array(dim).fill(0);
  for (const frame of mfccFrames) {
    for (let i = 0; i < dim; i++) {
      avg[i] += frame[i];
    }
  }
  return avg.map((v) => v / mfccFrames.length);
}

function classifyEnergy(rms: number): AudioFeatures["energy"] {
  if (rms < 0.02) return "舒缓";
  if (rms < 0.06) return "中等";
  if (rms < 0.12) return "强烈";
  return "极强";
}

function classifyBrightness(centroid: number): AudioFeatures["brightness"] {
  if (centroid < 800) return "暗沉";
  if (centroid < 2000) return "柔和";
  if (centroid < 4000) return "明亮";
  return "尖锐";
}

function classifyTempo(bpm: number): string {
  if (bpm < 70) return `慢速 (Adagio, ~${Math.round(bpm)} BPM)`;
  if (bpm < 100) return `中慢速 (Andante, ~${Math.round(bpm)} BPM)`;
  if (bpm < 130) return `中速 (Moderato, ~${Math.round(bpm)} BPM)`;
  if (bpm < 160) return `快速 (Allegro, ~${Math.round(bpm)} BPM)`;
  return `急速 (Presto, ~${Math.round(bpm)} BPM)`;
}

function inferMood(energy: string, brightness: string, bpm: number, flatness: number): string {
  const moods: string[] = [];

  if (energy === "舒缓" && bpm < 100) moods.push("宁静");
  if (energy === "舒缓") moods.push("柔和");
  if (energy === "强烈" || energy === "极强") moods.push("激昂");
  if (energy === "中等" && bpm >= 100) moods.push("轻快");

  if (brightness === "暗沉") moods.push("深沉");
  if (brightness === "柔和") moods.push("温暖");
  if (brightness === "明亮") moods.push("清亮");

  if (bpm > 140) moods.push("热烈");
  if (bpm < 80 && brightness === "暗沉") moods.push("忧郁");

  if (flatness > 0.1) moods.push("噪感");
  if (flatness < 0.01) moods.push("纯净");

  return moods.length > 0 ? moods.slice(0, 3).join("、") : "平和";
}

function buildDescription(
  energy: string,
  brightness: string,
  tempo: string,
  bpm: number,
  dynamicRange: string,
  duration: number,
  flatness: number
): string {
  const parts: string[] = [];
  parts.push(`这是一段${Math.round(duration)}秒的音频`);
  parts.push(`节奏${bpm < 90 ? "舒缓" : bpm < 130 ? "适中" : "紧凑"}（约${Math.round(bpm)} BPM）`);
  parts.push(`整体能量${energy}`);
  parts.push(`音色${brightness}`);
  parts.push(`动态${dynamicRange}`);
  if (flatness < 0.01) parts.push("音色纯净有调性");
  else if (flatness > 0.1) parts.push("包含较多噪声或打击乐成分");
  return parts.join("，");
}
