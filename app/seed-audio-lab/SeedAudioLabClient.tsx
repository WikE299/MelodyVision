"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getStudyAudioFile } from "@/lib/audio/study-audio-store";
import {
  VISUAL_MUSIC_MODE_ORDER,
  VISUAL_MUSIC_MODES,
  type VisualMusicMode,
} from "@/lib/visual-music-modes";

type LabTab = "generate" | "assets";

interface LibraryImage {
  id: string;
  createdAt: string;
  musicTitle: string;
  role: string;
  imageSize: string;
  imageUrl: string;
  thumbnailUrl: string;
  dataOrigins: string[];
  artworkType: "co_created" | "direct_baseline";
  condition: "single_agent" | "multi_agent" | "unknown";
  sourceAudio: {
    title: string;
    artist: string;
    sourceKind: "preset" | "search" | "upload" | "unknown";
    source: string;
    tags: string[];
    durationSeconds: number | null;
    bpm: number | null;
    key: string;
    mode: string;
    playbackUrl: string;
    browserCacheKey: string;
    availability: "ready" | "browser_cache" | "unavailable";
  };
}

interface AudioAsset {
  id: string;
  createdAt: string;
  duration: number | null;
  bytes: number;
  mode: VisualMusicMode;
  userDirection: string;
  visualSummary: string;
  sourceRunId: string;
  sourceImageUrl: string;
  sourceThumbnailUrl: string;
  sourceMusicTitle: string;
  sourceRole: string;
  sourceOrigins: string[];
  audioUrl: string;
  downloadUrl: string;
}

interface GenerationResult {
  asset: AudioAsset;
  requestId: string;
  providerLogId: string | null;
  model: string;
  visualBrief: { visualSummary: string; musicPrompt: string; model: string };
}

function LabIcon({ type }: { type: "wave" | "library" }) {
  return type === "wave" ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 13v-2m4 6V7m5 13V4m5 13V7m4 6v-2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 4h14v16H5zM9 4v16M13 9.5l4-1v6.25a2 2 0 1 1-1-1.73V10l-3 .75z" strokeLinejoin="round" />
    </svg>
  );
}

function ToolbarIcon({ type }: { type: "collapse" | "expand" | "refresh" | "download" }) {
  if (type === "refresh") {
    return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M20 6v5h-5M4 18v-5h5" strokeLinecap="round" strokeLinejoin="round" /><path d="M6.1 9a7 7 0 0 1 11.7-2.2L20 11M4 13l2.2 4.2A7 7 0 0 0 17.9 15" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  if (type === "download") {
    return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  const collapsed = type === "expand";
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 5h14v14H5zM10 5v14" strokeLinejoin="round" /><path d={collapsed ? "m14 9 3 3-3 3" : "m17 9-3 3 3 3"} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function formatDuration(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "--:--";
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.round(value % 60)).padStart(2, "0")}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "未知时间" : date.toLocaleString("zh-CN", { hour12: false });
}

function formatBytes(value: number): string {
  return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(value / 1024)} KB`;
}

function originLabel(origins: string[]): string {
  if (origins.includes("online") || origins.includes("online_cache")) return "线上实验";
  if (origins.includes("local")) return "本地实验";
  return "导入快照";
}

function imageStyle(url: string) {
  return { backgroundImage: `url(${JSON.stringify(url)})` };
}

export default function SeedAudioLabClient() {
  const abortRef = useRef<AbortController | null>(null);
  const [activeTab, setActiveTab] = useState<LabTab>("generate");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [selectedImageId, setSelectedImageId] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [showAssetBasis, setShowAssetBasis] = useState(false);
  const [mode, setMode] = useState<VisualMusicMode>("instrumental");
  const [prompt, setPrompt] = useState(VISUAL_MUSIC_MODES.instrumental.defaultDirection);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loadingImages, setLoadingImages] = useState(true);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [cachedSourceAudio, setCachedSourceAudio] = useState<{
    key: string;
    url: string;
    missing: boolean;
  } | null>(null);

  const selectedImage = useMemo(
    () => images.find((image) => image.id === selectedImageId) || null,
    [images, selectedImageId]
  );
  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) || assets[0] || null,
    [assets, selectedAssetId]
  );

  const refreshAssets = useCallback(async () => {
    setLoadingAssets(true);
    try {
      const response = await fetch("/api/audio-lab/assets", { cache: "no-store" });
      const data = await response.json() as { assets?: AudioAsset[]; error?: string };
      if (!response.ok) throw new Error(data.error || "音乐资产区暂时无法读取");
      setAssets(data.assets || []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "音乐资产区暂时无法读取");
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/seed-audio", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/audio-lab/images", { cache: "no-store" }).then(async (response) => {
        const data = await response.json() as { images?: LibraryImage[]; error?: string };
        if (!response.ok) throw new Error(data.error || "实验图片库暂时无法读取");
        return data.images || [];
      }),
    ])
      .then(([service, nextImages]: [{ configured?: boolean }, LibraryImage[]]) => {
        setConfigured(Boolean(service.configured));
        setImages(nextImages);
        setSelectedImageId((current) => current || nextImages[0]?.id || "");
      })
      .catch((nextError) => {
        setConfigured(false);
        setError(nextError instanceof Error ? nextError.message : "Audio Lab 初始化失败");
      })
      .finally(() => setLoadingImages(false));
    fetch("/api/audio-lab/assets", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { assets?: AudioAsset[]; error?: string };
        if (!response.ok) throw new Error(data.error || "音乐资产区暂时无法读取");
        setAssets(data.assets || []);
      })
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : "音乐资产区暂时无法读取"))
      .finally(() => setLoadingAssets(false));
  }, [refreshAssets]);

  useEffect(() => {
    if (status !== "generating") return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (!showAssetBasis) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowAssetBasis(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showAssetBasis]);

  useEffect(() => {
    const cacheKey = selectedImage?.sourceAudio.browserCacheKey || "";
    if (!cacheKey) return;
    let active = true;
    let objectUrl = "";
    getStudyAudioFile(cacheKey)
      .then((file) => {
        if (!active) return;
        if (!file) {
          setCachedSourceAudio({ key: cacheKey, url: "", missing: true });
          return;
        }
        objectUrl = URL.createObjectURL(file);
        setCachedSourceAudio({ key: cacheKey, url: objectUrl, missing: false });
      })
      .catch(() => {
        if (active) setCachedSourceAudio({ key: cacheKey, url: "", missing: true });
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedImage?.sourceAudio.browserCacheKey]);

  const chooseMode = (nextMode: VisualMusicMode) => {
    setMode(nextMode);
    setPrompt(VISUAL_MUSIC_MODES[nextMode].defaultDirection);
  };

  const generate = async () => {
    if (!selectedImageId) {
      setError("请先从实验图片库选择一幅作品");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("generating");
    setElapsed(0);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/seed-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceImageId: selectedImageId, prompt, mode }),
        signal: controller.signal,
      });
      const data = await response.json() as GenerationResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "音频生成失败");
      setResult(data);
      setStatus("done");
      await refreshAssets();
    } catch (nextError) {
      if (nextError instanceof DOMException && nextError.name === "AbortError") {
        setStatus("idle");
        setError("已取消本次生成");
      } else {
        setStatus("error");
        setError(nextError instanceof Error ? nextError.message : "音频生成失败");
      }
    } finally {
      abortRef.current = null;
    }
  };

  const busy = status === "generating";
  const sourceAudioUrl = selectedImage?.sourceAudio.playbackUrl
    || (cachedSourceAudio?.key === selectedImage?.sourceAudio.browserCacheKey ? cachedSourceAudio?.url || "" : "");
  const sourceAudioMissing = selectedImage?.sourceAudio.availability === "unavailable"
    || (selectedImage?.sourceAudio.availability === "browser_cache"
      && cachedSourceAudio?.key === selectedImage.sourceAudio.browserCacheKey
      && cachedSourceAudio.missing);

  return (
    <main className="min-h-screen bg-[#ecebe7] text-[#202522]">
      <div className={`grid min-h-screen transition-[grid-template-columns] duration-200 ${sidebarCollapsed ? "lg:grid-cols-[76px_minmax(0,1fr)]" : "lg:grid-cols-[228px_minmax(0,1fr)]"}`}>
        <aside className="flex border-b border-[#343d38] bg-[#1d2421] text-white lg:min-h-screen lg:flex-col lg:border-b-0 lg:border-r">
          <div className={`flex items-center gap-3 border-r border-white/10 py-4 lg:min-h-[74px] lg:border-b lg:border-r-0 ${sidebarCollapsed ? "justify-center px-2" : "min-w-[228px] px-5"}`}>
            <Link href="/" className="flex h-9 w-9 items-center justify-center border border-white/25 text-lg transition hover:bg-white/10" aria-label="返回首页" title="返回首页">←</Link>
            {!sidebarCollapsed && <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase text-[#d5aa61]">MelodyVision</p>
              <h1 className="text-base font-semibold">Audio Lab</h1>
            </div>}
            {!sidebarCollapsed && <button type="button" onClick={() => setSidebarCollapsed(true)} className="hidden h-9 w-9 shrink-0 items-center justify-center text-white/55 transition hover:bg-white/10 hover:text-white lg:flex" aria-label="收起侧边导航" title="收起侧边导航"><ToolbarIcon type="collapse" /></button>}
          </div>
          <nav className="flex flex-1 gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible lg:p-3" aria-label="Audio Lab 功能">
            {sidebarCollapsed && <button type="button" onClick={() => setSidebarCollapsed(false)} className="hidden h-11 w-full items-center justify-center text-white/55 transition hover:bg-white/10 hover:text-white lg:flex" aria-label="展开侧边导航" title="展开侧边导航"><ToolbarIcon type="expand" /></button>}
            <button type="button" onClick={() => setActiveTab("generate")} className={`flex min-w-max items-center gap-3 px-4 py-3 text-left text-sm transition lg:w-full ${sidebarCollapsed ? "lg:justify-center lg:px-0" : ""} ${activeTab === "generate" ? "bg-[#d4a75d] text-[#1b211e]" : "text-white/70 hover:bg-white/8 hover:text-white"}`} title={sidebarCollapsed ? "Image-to-Audio" : undefined}>
              <LabIcon type="wave" /><span className={sidebarCollapsed ? "lg:hidden" : ""}>Image-to-Audio</span>
            </button>
            <button type="button" onClick={() => setActiveTab("assets")} className={`flex min-w-max items-center gap-3 px-4 py-3 text-left text-sm transition lg:w-full ${sidebarCollapsed ? "lg:justify-center lg:px-0" : ""} ${activeTab === "assets" ? "bg-[#d4a75d] text-[#1b211e]" : "text-white/70 hover:bg-white/8 hover:text-white"}`} title={sidebarCollapsed ? "音乐资产区" : undefined}>
              <LabIcon type="library" /><span className={sidebarCollapsed ? "lg:hidden" : ""}>音乐资产区</span>{!sidebarCollapsed && assets.length > 0 && <span className="ml-auto text-xs tabular-nums opacity-70">{assets.length}</span>}
            </button>
          </nav>
          {!sidebarCollapsed && <div className="hidden border-t border-white/10 p-5 text-xs leading-5 text-white/45 lg:block">独立测试工具<br />不写入正式实验流程</div>}
        </aside>

        <section className="min-w-0">
          <header className="flex min-h-[74px] items-center justify-between border-b border-[#bbb9b1] bg-[#f7f6f2] px-5 py-4 lg:px-8">
            <div>
              <p className="text-[10px] font-semibold uppercase text-[#8c6430]">Audio Lab / {activeTab === "generate" ? "Generate" : "Assets"}</p>
              <h2 className="mt-1 text-xl font-semibold">{activeTab === "generate" ? "从实验画作生成音乐" : "音乐资产区"}</h2>
            </div>
            {activeTab === "assets" ? (
              <div className="flex items-center gap-3 text-xs text-[#59615c]"><span className="tabular-nums">{assets.length} 条音乐资产</span><button type="button" onClick={() => void refreshAssets()} disabled={loadingAssets} className="flex h-9 w-9 items-center justify-center border border-[#9b9e99] transition hover:bg-white disabled:cursor-wait disabled:opacity-50" aria-label="刷新音乐资产" title="刷新音乐资产"><span className={loadingAssets ? "animate-spin" : ""}><ToolbarIcon type="refresh" /></span></button></div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#59615c]"><span className={`h-2 w-2 rounded-full ${configured ? "bg-[#4dac79]" : configured === false ? "bg-[#c75f4e]" : "bg-[#cba251]"}`} />{configured == null ? "检查服务" : configured ? "生成服务已连接" : "生成服务未配置"}</div>
            )}
          </header>

          {activeTab === "generate" ? (
            <div className="grid min-h-[calc(100vh-74px)] xl:grid-cols-[minmax(0,1.2fr)_420px]">
              <section className="min-w-0 border-b border-[#bbb9b1] p-5 xl:border-b-0 xl:border-r lg:p-7">
                <div className="flex items-end justify-between gap-4">
                  <div><p className="text-xs font-semibold text-[#93652f]">实验图片库</p><p className="mt-1 text-sm text-[#676d68]">选择一张已生成作品作为音乐起点</p></div>
                  <p className="text-xs tabular-nums text-[#777d78]">{images.length} 张作品</p>
                </div>
                {loadingImages ? (
                  <div className="mt-5 flex h-64 items-center justify-center border border-[#c8c6bf] bg-white text-sm text-[#737973]">正在读取实验图片库…</div>
                ) : images.length === 0 ? (
                  <div className="mt-5 flex h-64 items-center justify-center border border-[#c8c6bf] bg-white px-8 text-center text-sm text-[#737973]">研究后台中还没有可用的生成图片。</div>
                ) : (
                  <div className="mt-5 grid max-h-[calc(100vh-190px)] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 2xl:grid-cols-4">
                    {images.map((image) => {
                      const selected = selectedImageId === image.id;
                      return (
                        <button key={image.id} type="button" onClick={() => { setSelectedImageId(image.id); setResult(null); setError(""); }} className={`group min-w-0 border bg-white text-left transition ${selected ? "border-[#a16f31] shadow-[0_0_0_2px_rgba(161,111,49,0.22)]" : "border-[#c8c6bf] hover:border-[#7d817d]"}`} aria-pressed={selected}>
                          <span className="block aspect-video overflow-hidden bg-[#d9d8d2]"><span className="block h-full w-full bg-contain bg-center bg-no-repeat transition duration-300 group-hover:scale-[1.02]" style={imageStyle(image.thumbnailUrl)} /></span>
                          <span className="block px-3 py-2.5"><span className="block truncate text-sm font-semibold">{image.musicTitle}</span><span className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[#747a75]"><span>{image.role === "direct_baseline" ? "音乐直生" : "共创作品"}</span><span>{originLabel(image.dataOrigins)}</span></span></span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="flex min-w-0 flex-col bg-[#f7f6f2] p-5 lg:p-7">
                {selectedImage ? (
                  <div className="border-b border-[#cecbc3] pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-16 w-24 shrink-0 bg-[#ddd9d0] bg-contain bg-center bg-no-repeat" style={imageStyle(selectedImage.thumbnailUrl)} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{selectedImage.sourceAudio.title}</p>
                        <p className="mt-1 truncate text-xs text-[#727873]">{selectedImage.sourceAudio.artist || selectedImage.sourceAudio.source || "来源信息未记录"}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-[#6a5a43]">
                          <span className="border border-[#c9b48f] px-1.5 py-0.5">{selectedImage.artworkType === "direct_baseline" ? "音乐直生作品" : "人机共创作品"}</span>
                          {selectedImage.condition !== "unknown" && <span className="border border-[#c9b48f] px-1.5 py-0.5">{selectedImage.condition === "multi_agent" ? "路径 B" : "路径 A"}</span>}
                          <span className="border border-[#c9b48f] px-1.5 py-0.5">{originLabel(selectedImage.dataOrigins)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 border-l-2 border-[#a4773d] bg-[#ece8df] px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-[#674921]">生成该图片的原始音乐</p>
                        <p className="text-[10px] text-[#7b7f7a]">
                          {[selectedImage.sourceAudio.bpm ? `${Math.round(selectedImage.sourceAudio.bpm)} BPM` : "", selectedImage.sourceAudio.key ? `${selectedImage.sourceAudio.key} ${selectedImage.sourceAudio.mode}`.trim() : "", selectedImage.sourceAudio.durationSeconds ? `${Math.round(selectedImage.sourceAudio.durationSeconds)} 秒分析片段` : ""].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {sourceAudioUrl ? (
                        <audio key={sourceAudioUrl} controls src={sourceAudioUrl} className="mt-2 h-9 w-full" preload="metadata" />
                      ) : sourceAudioMissing ? (
                        <p className="mt-2 text-xs leading-5 text-[#8b4b3f]">这条历史记录没有可恢复的原始音频文件。</p>
                      ) : (
                        <p className="mt-2 text-xs text-[#737973]">正在从当前实验浏览器恢复上传音频…</p>
                      )}
                    </div>
                  </div>
                ) : <div className="border-b border-[#cecbc3] pb-4 text-sm text-[#727873]">尚未选择图片</div>}
                <div className="mt-5">
                  <p className="text-xs font-semibold text-[#93652f]">生成方向</p>
                  <div className="mt-2 grid grid-cols-3 border border-[#aaa79e] bg-white p-1">
                    {VISUAL_MUSIC_MODE_ORDER.map((modeId) => <button key={modeId} type="button" onClick={() => chooseMode(modeId)} disabled={busy} className={`min-h-10 px-2 text-xs font-semibold transition ${mode === modeId ? "bg-[#263b33] text-white" : "text-[#555c57] hover:bg-[#efede7]"}`} aria-pressed={mode === modeId} title={VISUAL_MUSIC_MODES[modeId].description}>{VISUAL_MUSIC_MODES[modeId].label}</button>)}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#727873]">{VISUAL_MUSIC_MODES[mode].listeningCue}</p>
                </div>
                <label className="mt-5 flex flex-1 flex-col"><span className="text-xs font-semibold text-[#93652f]">补充方向</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={busy} maxLength={3000} className="mt-2 min-h-[150px] flex-1 resize-none border border-[#aaa79e] bg-white p-3 text-sm leading-6 outline-none transition focus:border-[#93652f] disabled:opacity-60" /><span className="mt-1 text-right text-[10px] tabular-nums text-[#858a85]">{prompt.length} / 3000</span></label>
                {error && <p className="mt-3 border-l-2 border-[#ba4e3f] bg-[#fff0ec] px-3 py-2 text-xs leading-5 text-[#8b3329]">{error}</p>}
                {result && <div className="mt-4 border-t border-[#cecbc3] pt-4"><div className="flex items-center gap-3"><audio controls src={result.asset.audioUrl} className="h-10 min-w-0 flex-1" preload="metadata" /><a href={result.asset.downloadUrl} className="flex h-10 shrink-0 items-center border border-[#93652f] px-3 text-xs font-semibold text-[#744d23] transition hover:bg-[#eee4d3]" title="下载永久保存的 MP3">下载</a></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-[#6d746f]">{result.visualBrief.visualSummary}</p></div>}
                <div className="mt-4 flex gap-2"><button type="button" onClick={() => void generate()} disabled={busy || !selectedImage || configured === false} className="h-12 flex-1 bg-[#263b33] px-5 text-sm font-semibold text-white transition hover:bg-[#172a23] disabled:cursor-not-allowed disabled:bg-[#9ba19e]">{busy ? `正在生成并保存 ${elapsed}s` : "生成并保存音乐"}</button>{busy && <button type="button" onClick={() => abortRef.current?.abort()} className="h-12 border border-[#9d4035] px-4 text-sm text-[#87362d]">取消</button>}</div>
              </section>
            </div>
          ) : (
            <div className="min-h-[calc(100vh-74px)] lg:h-[calc(100vh-74px)]">
              {loadingAssets ? <div className="flex h-full min-h-64 items-center justify-center text-sm text-[#737973]">正在读取音乐资产…</div> : assets.length === 0 ? <div className="flex h-full min-h-64 flex-col items-center justify-center text-center text-sm text-[#737973]"><p>还没有保存的音乐。</p><button type="button" onClick={() => setActiveTab("generate")} className="mt-4 border-b border-[#815c2e] text-[#815c2e]">前往 Image-to-Audio</button></div> : selectedAsset && (
                <div className="grid min-h-[calc(100vh-74px)] lg:h-full lg:grid-cols-[124px_minmax(0,1fr)] lg:overflow-hidden">
                  <aside className="order-2 flex gap-2 overflow-x-auto border-t border-[#bbb9b1] bg-[#deddd8] p-3 lg:order-1 lg:block lg:overflow-x-hidden lg:overflow-y-auto lg:border-r lg:border-t-0">
                    {assets.map((asset) => {
                      const selected = selectedAsset.id === asset.id;
                      return <button key={asset.id} type="button" onClick={() => { setSelectedAssetId(asset.id); setShowAssetBasis(false); }} className={`group w-28 shrink-0 border bg-[#f5f4ef] p-1.5 text-left transition lg:mb-3 lg:w-full ${selected ? "border-[#a87838] shadow-[0_0_0_2px_rgba(168,120,56,0.28)]" : "border-[#aaa9a3] hover:border-[#625b50]"}`} aria-pressed={selected} title={`${asset.sourceMusicTitle} · ${formatDate(asset.createdAt)}`}>
                        <span className="block aspect-video overflow-hidden bg-[#c9c8c3]"><span className="block h-full w-full bg-cover bg-center transition duration-300 group-hover:scale-[1.03]" style={imageStyle(asset.sourceThumbnailUrl || asset.sourceImageUrl)} /></span>
                        <span className="mt-1.5 block truncate text-[10px] font-semibold text-[#383d3a]">{asset.sourceMusicTitle}</span>
                        <span className="mt-0.5 block truncate text-[9px] text-[#787d78]">{formatDuration(asset.duration)} · {VISUAL_MUSIC_MODES[asset.mode].label}</span>
                      </button>;
                    })}
                  </aside>

                  <section className="order-1 flex min-h-0 flex-col lg:order-2">
                    <div className="flex min-h-[440px] flex-1 items-center justify-center bg-[#151a18] p-5 lg:min-h-0 lg:p-7">
                      <div className="h-full w-full bg-contain bg-center bg-no-repeat" style={imageStyle(selectedAsset.sourceImageUrl || selectedAsset.sourceThumbnailUrl)} role="img" aria-label={`${selectedAsset.sourceMusicTitle} 的来源画作`} />
                    </div>
                    <div className="border-t border-[#aaa79e] bg-[#f7f6f2] px-5 py-4 lg:px-7">
                      <div className="grid items-center gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-base font-semibold">{selectedAsset.sourceMusicTitle}</h3><span className="border border-[#b69a70] px-2 py-0.5 text-[10px] text-[#77572d]">{VISUAL_MUSIC_MODES[selectedAsset.mode].label}</span><span className="text-[10px] text-[#858a85]">{selectedAsset.sourceRole === "direct_baseline" ? "音乐直生画作" : "共创画作"}</span></div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"><p className="text-[10px] text-[#8a8e8a]">{formatDate(selectedAsset.createdAt)} · {formatDuration(selectedAsset.duration)} · {formatBytes(selectedAsset.bytes)}</p><button type="button" onClick={() => setShowAssetBasis(true)} className="border-b border-[#8b6a3c] text-[10px] font-semibold text-[#745126] transition hover:text-[#4e3418]">查看生成依据</button></div>
                        </div>
                        <div className="flex min-w-0 items-center gap-3">
                          <audio key={selectedAsset.id} controls src={selectedAsset.audioUrl} className="h-10 min-w-0 flex-1" preload="metadata" />
                          <a href={selectedAsset.downloadUrl} className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#8b6a3c] text-[#745126] transition hover:bg-[#eee4d3]" title="下载 MP3" aria-label="下载 MP3"><ToolbarIcon type="download" /></a>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {showAssetBasis && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAssetBasis(false); }}>
          <section className="w-full max-w-2xl border border-[#8e806b] bg-[#f7f6f2] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="asset-basis-title">
            <header className="flex items-start justify-between gap-4 border-b border-[#c8c3b9] px-5 py-4">
              <div><p className="text-[10px] font-semibold uppercase text-[#8c6430]">Generation basis</p><h3 id="asset-basis-title" className="mt-1 text-lg font-semibold">{selectedAsset.sourceMusicTitle}</h3></div>
              <button type="button" onClick={() => setShowAssetBasis(false)} className="flex h-9 w-9 items-center justify-center border border-[#aaa299] text-lg text-[#5e625e] transition hover:bg-[#e8e4dc]" aria-label="关闭生成依据" title="关闭">×</button>
            </header>
            <div className="max-h-[65vh] overflow-y-auto px-5 py-5">
              <div><p className="text-xs font-semibold text-[#8c6430]">画面摘要</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#454b47]">{selectedAsset.visualSummary || "未记录画面摘要。"}</p></div>
              <div className="mt-5 border-t border-[#d4d0c7] pt-5"><p className="text-xs font-semibold text-[#8c6430]">音乐生成方向</p><p className="mt-2 text-sm font-semibold text-[#333936]">{VISUAL_MUSIC_MODES[selectedAsset.mode].label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-[#5d645f]">{selectedAsset.userDirection || VISUAL_MUSIC_MODES[selectedAsset.mode].description}</p></div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
