"use client";

import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
} from "react";

export type CrystalVisualizationMode = "corona" | "ripples" | "pulse";

export interface CrystalAudioLevels {
  bass: number;
  mids: number;
  highs: number;
  accent: number;
}

interface CrystalAudioVisualizerProps {
  audioRef: RefObject<HTMLAudioElement | null>;
  active: boolean;
  children: ReactNode;
  mode: CrystalVisualizationMode;
  onLevels?: (levels: CrystalAudioLevels) => void;
}

interface ImpactRing {
  bornAt: number;
  strength: number;
}

const TAU = Math.PI * 2;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function averageBand(
  data: Uint8Array,
  sampleRate: number,
  fftSize: number,
  minFrequency: number,
  maxFrequency: number
): number {
  const binWidth = sampleRate / fftSize;
  const start = Math.max(0, Math.floor(minFrequency / binWidth));
  const end = Math.min(data.length - 1, Math.ceil(maxFrequency / binWidth));
  if (end < start) return 0;
  let sum = 0;
  for (let index = start; index <= end; index += 1) sum += data[index];
  return clamp(sum / Math.max(1, end - start + 1) / 255);
}

function sampleLogFrequency(
  data: Uint8Array,
  sampleRate: number,
  fftSize: number,
  position: number,
  minFrequency = 45,
  maxFrequency = 7200
): number {
  const frequency = minFrequency * Math.pow(maxFrequency / minFrequency, position);
  const index = clamp(Math.round(frequency / (sampleRate / fftSize)), 0, data.length - 1);
  return clamp(data[index] / 255);
}

function warmGradient(context: CanvasRenderingContext2D, radius: number) {
  const gradient = context.createLinearGradient(-radius, -radius, radius, radius);
  gradient.addColorStop(0, "rgba(255, 241, 184, 0.92)");
  gradient.addColorStop(0.42, "rgba(255, 190, 91, 0.82)");
  gradient.addColorStop(1, "rgba(211, 92, 61, 0.58)");
  return gradient;
}

function mutedPulseGradient(context: CanvasRenderingContext2D, radius: number) {
  const gradient = context.createLinearGradient(-radius, -radius, radius, radius);
  gradient.addColorStop(0, "rgba(211, 161, 94, 0.68)");
  gradient.addColorStop(0.48, "rgba(177, 105, 53, 0.58)");
  gradient.addColorStop(1, "rgba(119, 62, 44, 0.42)");
  return gradient;
}

function drawImpactRings(
  context: CanvasRenderingContext2D,
  rings: ImpactRing[],
  now: number,
  baseRadius: number,
  reducedMotion: boolean
) {
  for (const ring of rings) {
    const progress = clamp((now - ring.bornAt) / (reducedMotion ? 1300 : 900));
    const radius = baseRadius + progress * (reducedMotion ? 34 : 86);
    context.beginPath();
    context.arc(0, 0, radius, 0, TAU);
    context.strokeStyle = `rgba(255, 210, 126, ${(1 - progress) * ring.strength * 0.48})`;
    context.lineWidth = 1.5 + (1 - progress) * 2;
    context.shadowBlur = 14;
    context.shadowColor = "rgba(255, 182, 86, 0.7)";
    context.stroke();
  }
}

function drawCorona(
  context: CanvasRenderingContext2D,
  data: Uint8Array,
  sampleRate: number,
  fftSize: number,
  radius: number,
  bass: number,
  mids: number,
  reducedMotion: boolean
) {
  const points = reducedMotion ? 42 : 68;
  const amplitude = reducedMotion ? 12 : 28;
  context.beginPath();
  for (let index = 0; index <= points; index += 1) {
    const normalized = (index % points) / Math.max(1, points - 1);
    const level = Math.pow(sampleLogFrequency(data, sampleRate, fftSize, normalized), 0.72);
    const angle = (index / points) * TAU - Math.PI / 2;
    const pointRadius = radius + level * amplitude + mids * 7;
    const x = Math.cos(angle) * pointRadius;
    const y = Math.sin(angle) * pointRadius;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.strokeStyle = warmGradient(context, radius);
  context.lineWidth = 2.4;
  context.shadowBlur = 22 + bass * 22;
  context.shadowColor = "rgba(255, 178, 74, 0.72)";
  context.stroke();

  const rays = reducedMotion ? 24 : 44;
  context.lineCap = "round";
  context.lineWidth = 1.35;
  for (let index = 0; index < rays; index += 1) {
    const level = Math.pow(sampleLogFrequency(data, sampleRate, fftSize, index / (rays - 1)), 0.82);
    const angle = (index / rays) * TAU - Math.PI / 2;
    const innerRadius = radius + 8;
    const outerRadius = innerRadius + 6 + level * (reducedMotion ? 18 : 52);
    context.beginPath();
    context.moveTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
    context.lineTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius);
    context.strokeStyle = `rgba(255, 205, 116, ${0.12 + level * 0.62})`;
    context.stroke();
  }
}

function drawRipples(
  context: CanvasRenderingContext2D,
  radius: number,
  bass: number,
  mids: number,
  highs: number,
  now: number,
  reducedMotion: boolean
) {
  const count = reducedMotion ? 3 : 6;
  for (let index = 0; index < count; index += 1) {
    const phase = ((now / (reducedMotion ? 2400 : 1500)) + index / count) % 1;
    const energy = index % 2 === 0 ? bass : mids;
    const ringRadius = radius + 10 + phase * (reducedMotion ? 54 : 104) + energy * 20;
    context.beginPath();
    context.arc(0, 0, ringRadius, 0, TAU);
    context.strokeStyle = `rgba(255, ${190 + Math.round(highs * 35)}, 112, ${(1 - phase) * (0.08 + energy * 0.42)})`;
    context.lineWidth = 1 + energy * 2.2;
    context.shadowBlur = 12;
    context.shadowColor = "rgba(255, 176, 70, 0.55)";
    context.stroke();
  }
}

function drawPulse(
  context: CanvasRenderingContext2D,
  data: Uint8Array,
  sampleRate: number,
  fftSize: number,
  radius: number,
  bass: number,
  reducedMotion: boolean
) {
  const bars = reducedMotion ? 30 : 56;
  const gradient = mutedPulseGradient(context, radius);
  const beatPush = clamp((bass - 0.08) * 2.5);
  context.save();
  context.globalCompositeOperation = "source-over";
  context.strokeStyle = gradient;
  context.lineCap = "round";
  for (let index = 0; index < bars; index += 1) {
    const mirroredPosition = index <= bars / 2
      ? index / (bars / 2)
      : (bars - index) / (bars / 2);
    const rawLevel = sampleLogFrequency(data, sampleRate, fftSize, mirroredPosition);
    const level = Math.pow(clamp((rawLevel - 0.1) * 2.15), 1.1);
    const angle = (index / bars) * TAU - Math.PI / 2;
    const innerRadius = radius - 3 + beatPush * radius * 0.04;
    const travel = radius * (reducedMotion ? 0.56 : 1.24);
    const outerRadius = innerRadius + 1 + level * travel + beatPush * radius * 0.1;
    context.beginPath();
    context.moveTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
    context.lineTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius);
    context.globalAlpha = 0.07 + level * 0.5;
    context.lineWidth = 0.9 + level * 1.8;
    context.shadowBlur = 2 + level * 10;
    context.shadowColor = "rgba(170, 91, 43, 0.5)";
    context.stroke();
  }
  context.restore();
}

export default function CrystalAudioVisualizer({
  audioRef,
  active,
  children,
  mode,
  onLevels,
}: CrystalAudioVisualizerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const crystalRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef(active);
  const modeRef = useRef(mode);
  const onLevelsRef = useRef(onLevels);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    onLevelsRef.current = onLevels;
  }, [onLevels]);

  useEffect(() => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!audio || !canvas || !container) return;

    const context2d = canvas.getContext("2d");
    if (!context2d) return;

    let audioContext: AudioContext | null = null;
    let source: MediaElementAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let frequencyData = new Uint8Array(256);
    let frameId = 0;
    let disposed = false;
    let width = 1;
    let height = 1;
    let previousFrameAt = 0;
    let lastMetricsAt = 0;
    let bassLevel = 0;
    let midLevel = 0;
    let highLevel = 0;
    let bassBaseline = 0.08;
    let lastAccentAt = 0;
    let accentLevel = 0;
    let impactRings: ImpactRing[] = [];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context2d.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const ensureAudioGraph = async () => {
      if (disposed) return;
      if (!audioContext) {
        audioContext = new AudioContext();
        source = audioContext.createMediaElementSource(audio);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.56;
        frequencyData = new Uint8Array(analyser.frequencyBinCount);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
      }
      if (audioContext.state === "suspended") await audioContext.resume();
    };

    const handlePlay = () => {
      void ensureAudioGraph().catch((error) => {
        console.warn("Crystal visualizer could not connect to audio:", error);
      });
    };
    audio.addEventListener("play", handlePlay);
    if (!audio.paused) handlePlay();

    const draw = (now: number) => {
      if (disposed) return;
      frameId = window.requestAnimationFrame(draw);
      if (now - previousFrameAt < 1000 / 45) return;
      previousFrameAt = now;

      if (analyser && activeRef.current) {
        analyser.getByteFrequencyData(frequencyData);
        const nextBass = averageBand(frequencyData, audioContext!.sampleRate, analyser.fftSize, 35, 220);
        const nextMids = averageBand(frequencyData, audioContext!.sampleRate, analyser.fftSize, 220, 2200);
        const nextHighs = averageBand(frequencyData, audioContext!.sampleRate, analyser.fftSize, 2200, 8500);
        bassLevel += (nextBass - bassLevel) * 0.34;
        midLevel += (nextMids - midLevel) * 0.28;
        highLevel += (nextHighs - highLevel) * 0.24;
        bassBaseline = bassBaseline * 0.972 + nextBass * 0.028;
        const accentThreshold = Math.max(0.16, bassBaseline * 1.42);
        if (!reducedMotion && nextBass > accentThreshold && now - lastAccentAt > 240) {
          accentLevel = clamp((nextBass - accentThreshold) * 4.5 + 0.32);
          impactRings.push({ bornAt: now, strength: accentLevel });
          lastAccentAt = now;
        } else {
          accentLevel *= 0.9;
        }
      } else {
        bassLevel *= 0.9;
        midLevel *= 0.9;
        highLevel *= 0.9;
        accentLevel *= 0.84;
      }

      impactRings = impactRings.filter((ring) => now - ring.bornAt < (reducedMotion ? 1300 : 900));
      context2d.clearRect(0, 0, width, height);
      context2d.save();
      context2d.translate(width / 2, height / 2);
      context2d.globalCompositeOperation = "lighter";
      const radius = Math.min(width, height) * 0.235;

      const pulseMode = modeRef.current === "pulse";
      const ambientGlow = context2d.createRadialGradient(0, 0, radius * 0.45, 0, 0, radius * 1.75);
      ambientGlow.addColorStop(0, pulseMode
        ? `rgba(188, 123, 65, ${0.02 + bassLevel * 0.08})`
        : `rgba(255, 212, 126, ${0.04 + bassLevel * 0.16})`);
      ambientGlow.addColorStop(0.55, pulseMode
        ? `rgba(142, 75, 43, ${0.012 + bassLevel * 0.045})`
        : `rgba(255, 166, 67, ${0.025 + bassLevel * 0.1})`);
      ambientGlow.addColorStop(1, "rgba(255, 142, 55, 0)");
      context2d.fillStyle = ambientGlow;
      context2d.beginPath();
      context2d.arc(0, 0, radius * 1.8, 0, TAU);
      context2d.fill();

      if (modeRef.current === "corona") {
        drawCorona(context2d, frequencyData, audioContext?.sampleRate || 44100, analyser?.fftSize || 512, radius, bassLevel, midLevel, reducedMotion);
        drawImpactRings(context2d, impactRings, now, radius + 5, reducedMotion);
      } else if (modeRef.current === "ripples") {
        drawRipples(context2d, radius, bassLevel, midLevel, highLevel, now, reducedMotion);
        drawImpactRings(context2d, impactRings, now, radius, reducedMotion);
      } else {
        drawPulse(context2d, frequencyData, audioContext?.sampleRate || 44100, analyser?.fftSize || 512, radius * 0.9, bassLevel, reducedMotion);
        context2d.globalAlpha = 0.42;
        drawImpactRings(context2d, impactRings, now, radius + 4, reducedMotion);
        context2d.globalAlpha = 1;
      }
      context2d.restore();

      if (crystalRef.current) {
        const movement = reducedMotion ? bassLevel * 0.012 : bassLevel * 0.045 + accentLevel * 0.018;
        crystalRef.current.style.transform = `scale(${1 + movement})`;
        crystalRef.current.style.filter = pulseMode
          ? `brightness(${1.01 + bassLevel * 0.14}) drop-shadow(0 0 ${18 + bassLevel * 28}px rgba(190, 124, 62, ${0.25 + bassLevel * 0.22}))`
          : `brightness(${1.02 + bassLevel * 0.25}) drop-shadow(0 0 ${24 + bassLevel * 42}px rgba(255, 194, 92, ${0.36 + bassLevel * 0.34}))`;
      }

      if (now - lastMetricsAt > 100) {
        lastMetricsAt = now;
        onLevelsRef.current?.({ bass: bassLevel, mids: midLevel, highs: highLevel, accent: accentLevel });
      }
    };
    frameId = window.requestAnimationFrame(draw);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      audio.removeEventListener("play", handlePlay);
      source?.disconnect();
      analyser?.disconnect();
      if (audioContext && audioContext.state !== "closed") void audioContext.close();
    };
  }, [audioRef]);

  return (
    <div ref={containerRef} className="relative flex h-full w-full items-center justify-center">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
      <div
        ref={crystalRef}
        className="relative z-10 flex items-center justify-center transition-[filter] duration-200"
      >
        {children}
      </div>
    </div>
  );
}
