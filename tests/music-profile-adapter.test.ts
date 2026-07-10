import assert from "node:assert/strict";
import test from "node:test";

import {
  meydaToDegradedAnalysis,
  profileToCompatibleAnalysis,
} from "../lib/audio/music-profile-adapter.ts";
import type { MusicProfile } from "../lib/contracts/music-profile.ts";
import type { AudioFeatures } from "../lib/audio/web-analyzer.ts";
import { formatMusicContext } from "../lib/prompts/system.ts";

const analyzed = <T>(value: T, confidence = 0.8) => ({
  value,
  confidence,
  evidenceIds: ["signal"],
});

function profileFixture(): MusicProfile {
  return {
    schemaVersion: "2.0.0",
    id: "profile-1",
    sessionId: "session-1",
    audio: { name: "fixture.mp3", sourceKind: "preset", durationSeconds: 45 },
    analyzers: [],
    rhythm: {
      bpm: analyzed(120),
      beatStrength: analyzed(0.7),
      onsetDensity: analyzed("medium"),
      beatsSeconds: [],
      tempoCurve: [],
      onsetDensityCurve: [],
    },
    tonality: {
      key: analyzed("G", 0.4),
      mode: analyzed("major", 0.4),
      chromaProfile: [],
      harmonicChangeCurve: [],
      harmonicStability: analyzed(0.6),
    },
    dynamics: {
      averageEnergy: analyzed(0.55),
      dynamicComplexity: analyzed(0.4),
      energyCurve: [{ atSeconds: 0, value: 0.4 }],
      loudnessCurve: [],
    },
    timbre: {
      brightness: analyzed(0.35),
      warmth: analyzed(0.7),
      roughness: analyzed(0.2),
      noisiness: analyzed(0.1),
    },
    sections: [
      {
        id: "section-1",
        order: 0,
        startSeconds: 0,
        endSeconds: 45,
        phase: "unknown",
        boundaryConfidence: 1,
        energy: 0.55,
        brightness: 0.35,
        onsetDensity: 0.5,
        dynamicTrend: "stable",
        moods: [],
        instruments: [],
        textures: [{ label: "smooth", score: 0.7, evidenceIds: ["clap-texture"] }],
        motions: [{ label: "flowing", score: 0.6, evidenceIds: ["clap-motion"] }],
      },
    ],
    semantics: {
      moods: [{ label: "serene", score: 0.6, evidenceIds: ["clap-mood"] }],
      genres: [{ label: "traditional-chinese", score: 0.8, evidenceIds: ["clap-genre"] }],
      instruments: [{ label: "acoustic-guitar", score: 0.9, evidenceIds: ["clap-instrument"] }],
      textures: [{ label: "smooth", score: 0.7, evidenceIds: ["clap-texture"] }],
      motions: [{ label: "flowing", score: 0.6, evidenceIds: ["clap-motion"] }],
      spaces: [{ label: "intimate", score: 0.5, evidenceIds: ["clap-space"] }],
    },
    evidence: [],
    warnings: [],
    createdAt: "2026-07-11T00:00:00Z",
  };
}

test("rich compatibility uses known instrument metadata and suppresses CLAP instrument claims", () => {
  const analysis = profileToCompatibleAnalysis(profileFixture(), {
    title: "Cello fixture",
    tags: ["大提琴", "巴洛克"],
  });

  assert.deepEqual(analysis.instruments, ["大提琴"]);
  assert.equal(analysis.analysisEngine, "rich");
  assert.equal(analysis.degraded, false);
  assert.deepEqual(analysis.visualMappingHints, []);
  assert.ok(analysis.analysisWarnings.includes("clap_genre_instrument_suppressed"));
  assert.equal("genres" in analysis.semanticCandidates, false);
  assert.equal("instruments" in analysis.semanticCandidates, false);
});

test("Meyda fallback is explicit and strips visual mapping hints", () => {
  const features = {
    bpm: 120,
    energy: "中等",
    brightness: "柔和",
    dynamicRange: "平稳",
    segments: [],
    salientMoments: [],
    curves: { energy: [], brightness: [], texture: [] },
    visualMappingHints: ["不应进入下游"],
    spectralCentroid: 1200,
    rmsEnergy: 0.2,
    zeroCrossingRate: 10,
    spectralFlatness: 0.01,
    spectralRolloff: 3000,
    mfcc: [],
    durationSeconds: 45,
    tempo: "中速",
    mood: "平和",
    description: "降级分析",
  } satisfies AudioFeatures;

  const analysis = meydaToDegradedAnalysis(features);

  assert.equal(analysis.analysisEngine, "meyda-degraded");
  assert.equal(analysis.degraded, true);
  assert.deepEqual(analysis.visualMappingHints, []);
  assert.ok(analysis.analysisWarnings.includes("rich_analysis_unavailable"));
});

test("musician context preserves source facts and labels model semantics as candidates", () => {
  const analysis = profileToCompatibleAnalysis(profileFixture(), {
    title: "Cello fixture",
    artist: "Known performer",
    tags: ["大提琴", "巴洛克"],
  });
  const context = formatMusicContext(analysis);

  assert.match(context, /已知曲目信息：Cello fixture，Known performer/);
  assert.match(context, /候选情绪（低权重）：宁静/);
  assert.match(context, /模型候选（低权重、允许忽略）/);
  assert.doesNotMatch(context, /acoustic-guitar/);
  assert.doesNotMatch(context, /traditional-chinese/);
});
