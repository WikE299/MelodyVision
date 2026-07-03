import Meyda from "meyda";

export interface AudioFeatures {
  bpm: number;
  energy: "舒缓" | "中等" | "强烈" | "极强";
  brightness: "暗沉" | "柔和" | "明亮" | "尖锐";
  dynamicRange: "平稳" | "有起伏" | "大起大落";
  segments: AudioSegment[];
  salientMoments: AudioMoment[];
  curves: AudioCurves;
  visualMappingHints: string[];
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

export interface AudioSegment {
  start: number;
  end: number;
  energy: AudioFeatures["energy"];
  brightness: AudioFeatures["brightness"];
  motion: "静止" | "流动" | "推进" | "爆发";
  texture: "纯净旋律" | "混合层次" | "颗粒噪感" | "打击感";
  dynamic: "平稳" | "渐强" | "渐弱" | "起伏";
  description: string;
}

export interface AudioMoment {
  time: number;
  type: "能量峰值" | "明亮峰值" | "纹理转折";
  intensity: number;
  description: string;
}

export interface AudioCurves {
  energy: number[];
  brightness: number[];
  texture: number[];
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
  const segments = buildSegments(frameFeatures, sampleRate, duration);
  const salientMoments = findSalientMoments(frameFeatures, sampleRate, duration);
  const curves = buildCurves(frameFeatures);
  const visualMappingHints = buildVisualMappingHints(segments, salientMoments, energy, brightness, dynamicRange);
  const description = buildDescription(energy, brightness, tempo, bpm, dynamicRange, duration, avgFlatness, segments);

  audioCtx.close();

  return {
    bpm: Math.round(bpm),
    energy,
    brightness,
    dynamicRange,
    segments,
    salientMoments,
    curves,
    visualMappingHints,
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

function buildSegments(frameFeatures: FrameFeatures, sampleRate: number, duration: number): AudioSegment[] {
  const frameCount = frameFeatures.rmsValues.length;
  if (frameCount === 0 || duration <= 0) return [];

  const segmentCount = Math.max(3, Math.min(6, Math.round(duration / 18)));
  const framesPerSegment = Math.max(1, Math.floor(frameCount / segmentCount));
  const segments: AudioSegment[] = [];

  for (let index = 0; index < segmentCount; index++) {
    const startFrame = index * framesPerSegment;
    const endFrame = index === segmentCount - 1 ? frameCount : Math.min(frameCount, startFrame + framesPerSegment);
    const rmsSlice = frameFeatures.rmsValues.slice(startFrame, endFrame);
    const centroidSlice = frameFeatures.centroidValues.slice(startFrame, endFrame);
    const flatnessSlice = frameFeatures.flatnessValues.slice(startFrame, endFrame);
    const zcrSlice = frameFeatures.zcrValues.slice(startFrame, endFrame);

    const avgRms = mean(rmsSlice);
    const avgCentroid = mean(centroidSlice);
    const avgFlatness = mean(flatnessSlice);
    const avgZcr = mean(zcrSlice);
    const segmentEnergy = classifyEnergy(avgRms);
    const segmentBrightness = classifyBrightness(avgCentroid);
    const dynamic = classifySegmentDynamic(rmsSlice);
    const texture = classifyTexture(avgFlatness, avgZcr);
    const motion = classifyMotion(segmentEnergy, dynamic);
    const start = frameToSeconds(startFrame, sampleRate);
    const end = index === segmentCount - 1 ? duration : frameToSeconds(endFrame, sampleRate);

    segments.push({
      start: Math.round(start),
      end: Math.round(end),
      energy: segmentEnergy,
      brightness: segmentBrightness,
      motion,
      texture,
      dynamic,
      description: buildSegmentDescription(index, start, end, segmentEnergy, segmentBrightness, motion, texture, dynamic),
    });
  }

  return segments;
}

function findSalientMoments(frameFeatures: FrameFeatures, sampleRate: number, duration: number): AudioMoment[] {
  const moments: AudioMoment[] = [];
  const rmsPeak = findPeak(frameFeatures.rmsValues);
  const centroidPeak = findPeak(frameFeatures.centroidValues);
  const textureShift = findLargestShift(frameFeatures.flatnessValues);

  if (rmsPeak) {
    moments.push({
      time: clampSecond(frameToSeconds(rmsPeak.index, sampleRate), duration),
      type: "能量峰值",
      intensity: rmsPeak.intensity,
      description: `${clampSecond(frameToSeconds(rmsPeak.index, sampleRate), duration)}秒附近能量最突出，可转化为画面焦点、强光或形体张力。`,
    });
  }

  if (centroidPeak) {
    moments.push({
      time: clampSecond(frameToSeconds(centroidPeak.index, sampleRate), duration),
      type: "明亮峰值",
      intensity: centroidPeak.intensity,
      description: `${clampSecond(frameToSeconds(centroidPeak.index, sampleRate), duration)}秒附近高频更亮，可转化为亮边、闪烁或清晰轮廓。`,
    });
  }

  if (textureShift) {
    moments.push({
      time: clampSecond(frameToSeconds(textureShift.index, sampleRate), duration),
      type: "纹理转折",
      intensity: textureShift.intensity,
      description: `${clampSecond(frameToSeconds(textureShift.index, sampleRate), duration)}秒附近纹理变化明显，可转化为材质切换或空间转场。`,
    });
  }

  return dedupeMoments(moments).slice(0, 3);
}

function buildCurves(frameFeatures: FrameFeatures): AudioCurves {
  return {
    energy: downsampleNormalized(frameFeatures.rmsValues, 12),
    brightness: downsampleNormalized(frameFeatures.centroidValues, 12),
    texture: downsampleNormalized(frameFeatures.flatnessValues, 12),
  };
}

function buildVisualMappingHints(
  segments: AudioSegment[],
  moments: AudioMoment[],
  energy: AudioFeatures["energy"],
  brightness: AudioFeatures["brightness"],
  dynamicRange: AudioFeatures["dynamicRange"]
): string[] {
  const hints: string[] = [
    `整体能量${energy}，画面密度和主体张力应与此匹配。`,
    `整体音色${brightness}，影响画面明暗、边缘清晰度和色温。`,
    `动态${dynamicRange}，决定构图是稳定、层层推进还是强烈对比。`,
  ];

  const strongest = segments.reduce<AudioSegment | null>((current, segment) => {
    if (!current) return segment;
    return energyRank(segment.energy) > energyRank(current.energy) ? segment : current;
  }, null);

  if (strongest) {
    hints.push(`${strongest.start}-${strongest.end}秒是主要视觉发力段：${strongest.description}`);
  }

  for (const moment of moments) {
    hints.push(moment.description);
  }

  return hints.slice(0, 6);
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

function classifySegmentDynamic(rmsValues: number[]): AudioSegment["dynamic"] {
  if (rmsValues.length < 3) return "平稳";
  const start = mean(rmsValues.slice(0, Math.max(1, Math.floor(rmsValues.length / 3))));
  const end = mean(rmsValues.slice(Math.max(0, rmsValues.length - Math.floor(rmsValues.length / 3))));
  const range = Math.max(...rmsValues) - Math.min(...rmsValues);
  const avg = mean(rmsValues) || 1;
  const slope = (end - start) / avg;

  if (range / avg > 0.9) return "起伏";
  if (slope > 0.18) return "渐强";
  if (slope < -0.18) return "渐弱";
  return "平稳";
}

function classifyTexture(flatness: number, zcr: number): AudioSegment["texture"] {
  if (flatness > 0.12 || zcr > 140) return "颗粒噪感";
  if (zcr > 80) return "打击感";
  if (flatness < 0.015) return "纯净旋律";
  return "混合层次";
}

function classifyMotion(energy: AudioFeatures["energy"], dynamic: AudioSegment["dynamic"]): AudioSegment["motion"] {
  if (energy === "极强" || dynamic === "起伏") return "爆发";
  if (energy === "强烈" || dynamic === "渐强") return "推进";
  if (energy === "中等" || dynamic === "渐弱") return "流动";
  return "静止";
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

function energyRank(energy: AudioFeatures["energy"]): number {
  return { "舒缓": 1, "中等": 2, "强烈": 3, "极强": 4 }[energy];
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
  flatness: number,
  segments: AudioSegment[]
): string {
  const parts: string[] = [];
  parts.push(`这是一段${Math.round(duration)}秒的音频`);
  parts.push(`节奏${bpm < 90 ? "舒缓" : bpm < 130 ? "适中" : "紧凑"}（约${Math.round(bpm)} BPM）`);
  parts.push(`整体能量${energy}`);
  parts.push(`音色${brightness}`);
  parts.push(`动态${dynamicRange}`);
  if (flatness < 0.01) parts.push("音色纯净有调性");
  else if (flatness > 0.1) parts.push("包含较多噪声或打击乐成分");
  if (segments.length > 0) {
    const contour = segments.map((segment) => `${segment.start}-${segment.end}秒${segment.motion}`).join("，");
    parts.push(`分段走势为${contour}`);
  }
  return parts.join("，");
}

function buildSegmentDescription(
  index: number,
  start: number,
  end: number,
  energy: AudioFeatures["energy"],
  brightness: AudioFeatures["brightness"],
  motion: AudioSegment["motion"],
  texture: AudioSegment["texture"],
  dynamic: AudioSegment["dynamic"]
): string {
  return `第${index + 1}段（${Math.round(start)}-${Math.round(end)}秒）能量${energy}、音色${brightness}、动势${motion}、质感${texture}、动态${dynamic}`;
}

function frameToSeconds(frameIndex: number, sampleRate: number): number {
  return (frameIndex * (BUFFER_SIZE / 2)) / sampleRate;
}

function clampSecond(value: number, duration: number): number {
  return Math.round(Math.max(0, Math.min(duration, value)));
}

function findPeak(values: number[]): { index: number; intensity: number } | null {
  if (values.length === 0) return null;
  const avg = mean(values);
  let peakIndex = 0;
  let peakValue = values[0];
  values.forEach((value, index) => {
    if (value > peakValue) {
      peakValue = value;
      peakIndex = index;
    }
  });
  const intensity = avg > 0 ? Math.min(1, peakValue / (avg * 2)) : 0;
  return { index: peakIndex, intensity: Math.round(intensity * 100) / 100 };
}

function findLargestShift(values: number[]): { index: number; intensity: number } | null {
  if (values.length < 2) return null;
  let shiftIndex = 1;
  let shiftValue = 0;
  for (let index = 1; index < values.length; index++) {
    const diff = Math.abs(values[index] - values[index - 1]);
    if (diff > shiftValue) {
      shiftValue = diff;
      shiftIndex = index;
    }
  }
  const maxValue = Math.max(...values) || 1;
  return { index: shiftIndex, intensity: Math.round(Math.min(1, shiftValue / maxValue) * 100) / 100 };
}

function dedupeMoments(moments: AudioMoment[]): AudioMoment[] {
  const sorted = [...moments].sort((a, b) => b.intensity - a.intensity);
  const result: AudioMoment[] = [];
  for (const moment of sorted) {
    if (result.every((item) => Math.abs(item.time - moment.time) > 2 || item.type === moment.type)) {
      result.push(moment);
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

function downsampleNormalized(values: number[], points: number): number[] {
  if (values.length === 0) return [];
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const bucketSize = Math.max(1, Math.floor(values.length / points));
  const buckets: number[] = [];

  for (let index = 0; index < points; index++) {
    const start = index * bucketSize;
    const end = index === points - 1 ? values.length : Math.min(values.length, start + bucketSize);
    const rawValue = mean(values.slice(start, end));
    const normalized = maxValue === minValue ? 0.5 : (rawValue - minValue) / (maxValue - minValue);
    buckets.push(Math.round(normalized * 100) / 100);
  }

  return buckets;
}
