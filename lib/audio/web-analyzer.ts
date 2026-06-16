export interface AudioFeatures {
  bpm: number;
  energy: "舒缓" | "中等" | "强烈" | "极强";
  brightness: "暗沉" | "柔和" | "明亮" | "尖锐";
  dynamicRange: "平稳" | "有起伏" | "大起大落";
  spectralCentroid: number;
  rmsEnergy: number;
  zeroCrossingRate: number;
  durationSeconds: number;
  tempo: string;
  mood: string;
  description: string;
}

export async function analyzeAudioFile(file: File): Promise<AudioFeatures> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;

  const rms = calcRMS(channelData);
  const zcr = calcZeroCrossingRate(channelData);
  const centroid = calcSpectralCentroid(channelData, sampleRate);
  const bpm = estimateBPM(channelData, sampleRate);
  const dynamicRange = calcDynamicRange(channelData, sampleRate);

  const energy = classifyEnergy(rms);
  const brightness = classifyBrightness(centroid, sampleRate);
  const tempo = classifyTempo(bpm);
  const mood = inferMood(energy, brightness, bpm);
  const description = buildDescription(energy, brightness, tempo, bpm, dynamicRange, duration);

  audioCtx.close();

  return {
    bpm: Math.round(bpm),
    energy,
    brightness,
    dynamicRange,
    spectralCentroid: Math.round(centroid),
    rmsEnergy: Math.round(rms * 10000) / 10000,
    zeroCrossingRate: Math.round(zcr),
    durationSeconds: Math.round(duration),
    tempo,
    mood,
    description,
  };
}

function calcRMS(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
  }
  return Math.sqrt(sum / data.length);
}

function calcZeroCrossingRate(data: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < data.length; i++) {
    if ((data[i] >= 0 && data[i - 1] < 0) || (data[i] < 0 && data[i - 1] >= 0)) {
      crossings++;
    }
  }
  return crossings / (data.length / 44100);
}

function calcSpectralCentroid(data: Float32Array, sampleRate: number): number {
  const fftSize = 4096;
  const numFrames = Math.floor(data.length / fftSize);
  if (numFrames === 0) return 0;

  let totalCentroid = 0;
  const real = new Float64Array(fftSize);
  const imag = new Float64Array(fftSize);

  const framesToSample = Math.min(numFrames, 50);
  const step = Math.max(1, Math.floor(numFrames / framesToSample));

  let sampledCount = 0;
  for (let f = 0; f < numFrames; f += step) {
    const offset = f * fftSize;
    for (let i = 0; i < fftSize; i++) {
      real[i] = data[offset + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1)));
      imag[i] = 0;
    }

    simpleDFT(real, imag, fftSize);

    let weightedSum = 0;
    let magnitudeSum = 0;
    const halfSize = fftSize / 2;
    for (let i = 0; i < halfSize; i++) {
      const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
      const freq = (i * sampleRate) / fftSize;
      weightedSum += freq * mag;
      magnitudeSum += mag;
    }

    if (magnitudeSum > 0) {
      totalCentroid += weightedSum / magnitudeSum;
    }
    sampledCount++;
  }

  return totalCentroid / sampledCount;
}

function simpleDFT(real: Float64Array, imag: Float64Array, n: number) {
  const halfN = n / 2;
  const outReal = new Float64Array(halfN);
  const outImag = new Float64Array(halfN);

  for (let k = 0; k < halfN; k++) {
    let sumReal = 0;
    let sumImag = 0;
    const step = Math.max(1, Math.floor(n / 512));
    for (let t = 0; t < n; t += step) {
      const angle = (2 * Math.PI * k * t) / n;
      sumReal += real[t] * Math.cos(angle) + imag[t] * Math.sin(angle);
      sumImag += -real[t] * Math.sin(angle) + imag[t] * Math.cos(angle);
    }
    outReal[k] = sumReal;
    outImag[k] = sumImag;
  }

  for (let k = 0; k < halfN; k++) {
    real[k] = outReal[k];
    imag[k] = outImag[k];
  }
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

function calcDynamicRange(data: Float32Array, sampleRate: number): "平稳" | "有起伏" | "大起大落" {
  const windowSize = Math.floor(sampleRate * 0.5);
  const step = Math.floor(windowSize / 2);
  const rmsValues: number[] = [];

  for (let i = 0; i + windowSize <= data.length; i += step) {
    let sum = 0;
    for (let j = i; j < i + windowSize; j++) {
      sum += data[j] * data[j];
    }
    rmsValues.push(Math.sqrt(sum / windowSize));
  }

  if (rmsValues.length < 2) return "平稳";

  const mean = rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length;
  const variance = rmsValues.reduce((a, b) => a + (b - mean) ** 2, 0) / rmsValues.length;
  const cv = Math.sqrt(variance) / (mean || 1);

  if (cv < 0.3) return "平稳";
  if (cv < 0.6) return "有起伏";
  return "大起大落";
}

function classifyEnergy(rms: number): AudioFeatures["energy"] {
  if (rms < 0.02) return "舒缓";
  if (rms < 0.06) return "中等";
  if (rms < 0.12) return "强烈";
  return "极强";
}

function classifyBrightness(centroid: number, _sampleRate: number): AudioFeatures["brightness"] {
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

function inferMood(energy: string, brightness: string, bpm: number): string {
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

  return moods.length > 0 ? moods.slice(0, 3).join("、") : "平和";
}

function buildDescription(
  energy: string,
  brightness: string,
  tempo: string,
  bpm: number,
  dynamicRange: string,
  duration: number
): string {
  const parts: string[] = [];
  parts.push(`这是一段${Math.round(duration)}秒的音频`);
  parts.push(`节奏${bpm < 90 ? "舒缓" : bpm < 130 ? "适中" : "紧凑"}（约${Math.round(bpm)} BPM）`);
  parts.push(`整体能量${energy}`);
  parts.push(`音色${brightness}`);
  parts.push(`动态${dynamicRange}`);
  return parts.join("，");
}
