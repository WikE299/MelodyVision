from __future__ import annotations

import os
import threading
from dataclasses import dataclass

import librosa
import numpy as np


CLAP_SAMPLE_RATE = 48_000
CLAP_WINDOW_SECONDS = 10
DEFAULT_CLAP_MODEL = "laion/clap-htsat-fused"


LABEL_GROUPS: dict[str, tuple[tuple[str, str], ...]] = {
    "moods": (
        ("serene", "serene and calm music"),
        ("melancholic", "melancholic and sorrowful music"),
        ("joyful", "joyful and playful music"),
        ("tense", "tense and anxious music"),
        ("solemn", "solemn and dignified music"),
        ("warm", "warm and tender music"),
        ("aggressive", "aggressive and forceful music"),
        ("mysterious", "mysterious and uncanny music"),
        ("nostalgic", "nostalgic and reflective music"),
        ("hopeful", "hopeful and uplifting music"),
    ),
    "genres": (
        ("classical", "classical music"),
        ("baroque", "baroque music"),
        ("romantic", "romantic era orchestral music"),
        ("jazz", "jazz music"),
        ("blues", "blues music"),
        ("rock", "rock music"),
        ("electronic", "electronic music"),
        ("ambient", "ambient music"),
        ("folk", "folk music"),
        ("traditional-chinese", "traditional Chinese instrumental music"),
        ("experimental", "experimental music"),
    ),
    "instruments": (
        ("piano", "music led by piano"),
        ("strings", "music led by a string ensemble"),
        ("violin", "music led by violin"),
        ("cello", "music led by cello"),
        ("plucked-strings", "music led by plucked strings"),
        ("bowed-strings", "music led by bowed strings"),
        ("acoustic-guitar", "music led by acoustic guitar"),
        ("brass", "music led by brass instruments"),
        ("trumpet", "music led by trumpet"),
        ("woodwind", "music led by woodwind instruments"),
        ("percussion", "music led by percussion"),
        ("drums", "music led by drums"),
        ("synthesizer", "music led by synthesizer"),
        ("human-voice", "music with a prominent human voice"),
    ),
    "textures": (
        ("smooth", "music with a smooth texture"),
        ("rough", "music with a rough texture"),
        ("airy", "music with an airy transparent texture"),
        ("dense", "music with a dense layered texture"),
        ("sparse", "music with a sparse minimal texture"),
        ("granular", "music with a granular noisy texture"),
        ("percussive", "music with a percussive texture"),
        ("sustained", "music with a sustained continuous texture"),
    ),
    "motions": (
        ("still", "music that feels still and suspended"),
        ("flowing", "music that feels flowing"),
        ("swaying", "music that feels swaying"),
        ("driving", "music that feels driving and propulsive"),
        ("rising", "music that feels gradually rising"),
        ("falling", "music that feels gradually falling"),
        ("pulsing", "music that feels rhythmically pulsing"),
        ("explosive", "music that feels explosive"),
    ),
    "spaces": (
        ("intimate", "music that evokes an intimate close space"),
        ("enclosed", "music that evokes an enclosed space"),
        ("spacious", "music that evokes a spacious open environment"),
        ("distant", "music that evokes a distant environment"),
        ("reverberant", "music that evokes a reverberant hall"),
        ("open-air", "music that evokes an open-air environment"),
    ),
}


@dataclass(frozen=True)
class SectionWindow:
    section_id: str
    start_seconds: float
    end_seconds: float


class SemanticAnalysisUnavailable(RuntimeError):
    pass


class ClapSemanticAnalyzer:
    def __init__(self, model_name: str | None = None, enabled: bool = True) -> None:
        self.model_name = model_name or os.environ.get("CLAP_MODEL", DEFAULT_CLAP_MODEL)
        self.enabled = enabled and os.environ.get("CLAP_DISABLED") != "1"
        self._processor = None
        self._model = None
        self._device = "cpu"
        self._lock = threading.Lock()

    @property
    def loaded(self) -> bool:
        return self._model is not None

    @property
    def device(self) -> str:
        return self._device

    def warmup(self) -> None:
        if not self.enabled:
            raise SemanticAnalysisUnavailable("CLAP semantic analysis is disabled")
        self._ensure_loaded()

    def analyze(
        self,
        audio: np.ndarray,
        sample_rate: int,
        sections: list[SectionWindow],
    ) -> tuple[dict[str, list[dict[str, object]]], dict[str, dict[str, list[dict[str, object]]]]]:
        if not self.enabled:
            raise SemanticAnalysisUnavailable("CLAP semantic analysis is disabled")

        self._ensure_loaded()
        clap_audio = librosa.resample(audio, orig_sr=sample_rate, target_sr=CLAP_SAMPLE_RATE)
        global_windows = self._global_windows(clap_audio)
        section_chunks = [self._section_chunk(clap_audio, section) for section in sections]
        all_chunks = global_windows + section_chunks

        labels: list[tuple[str, str, str]] = []
        for group, entries in LABEL_GROUPS.items():
            labels.extend((group, label, prompt) for label, prompt in entries)

        prompts = [prompt for _, _, prompt in labels]
        logits = self._infer(all_chunks, prompts)
        global_logits = logits[: len(global_windows)].mean(axis=0)
        section_logits = logits[len(global_windows) :]

        global_scores = self._scores_by_group(global_logits, labels, top_k=3)
        section_scores = {
            section.section_id: self._scores_by_group(section_logits[index], labels, top_k=2)
            for index, section in enumerate(sections)
        }
        return global_scores, section_scores

    def _ensure_loaded(self) -> None:
        if self.loaded:
            return

        with self._lock:
            if self.loaded:
                return

            import torch
            from transformers import AutoProcessor, ClapModel

            requested_device = os.environ.get("CLAP_DEVICE", "auto")
            if requested_device == "auto":
                self._device = "cuda" if torch.cuda.is_available() else "cpu"
            else:
                self._device = requested_device

            self._processor = AutoProcessor.from_pretrained(self.model_name)
            self._model = ClapModel.from_pretrained(self.model_name).to(self._device).eval()

    def _infer(self, audio_chunks: list[np.ndarray], prompts: list[str]) -> np.ndarray:
        import torch

        assert self._processor is not None
        assert self._model is not None

        inputs = self._processor(
            text=prompts,
            audio=audio_chunks,
            sampling_rate=CLAP_SAMPLE_RATE,
            return_tensors="pt",
            padding=True,
        )
        inputs = {
            key: value.to(self._device) if hasattr(value, "to") else value
            for key, value in inputs.items()
        }

        with self._lock, torch.inference_mode():
            logits = self._model(**inputs).logits_per_audio
        return logits.detach().cpu().numpy()

    def _global_windows(self, audio: np.ndarray) -> list[np.ndarray]:
        window_samples = CLAP_WINDOW_SECONDS * CLAP_SAMPLE_RATE
        if len(audio) <= window_samples:
            return [audio]
        return [
            audio[start : start + window_samples]
            for start in range(0, len(audio), window_samples)
            if len(audio[start : start + window_samples]) >= CLAP_SAMPLE_RATE
        ]

    def _section_chunk(self, audio: np.ndarray, section: SectionWindow) -> np.ndarray:
        start = max(0, round(section.start_seconds * CLAP_SAMPLE_RATE))
        end = min(len(audio), round(section.end_seconds * CLAP_SAMPLE_RATE))
        chunk = audio[start:end]
        window_samples = CLAP_WINDOW_SECONDS * CLAP_SAMPLE_RATE
        if len(chunk) <= window_samples:
            return chunk
        center = len(chunk) // 2
        half_window = window_samples // 2
        return chunk[center - half_window : center + half_window]

    @staticmethod
    def _scores_by_group(
        logits: np.ndarray,
        labels: list[tuple[str, str, str]],
        top_k: int,
    ) -> dict[str, list[dict[str, object]]]:
        result: dict[str, list[dict[str, object]]] = {}
        offset = 0
        for group, entries in LABEL_GROUPS.items():
            count = len(entries)
            group_logits = logits[offset : offset + count]
            group_logits = group_logits - np.max(group_logits)
            probabilities = np.exp(group_logits) / np.exp(group_logits).sum()
            ranked = np.argsort(probabilities)[::-1][:top_k]
            result[group] = [
                {
                    "label": labels[offset + int(index)][1],
                    "score": round(float(probabilities[index]), 4),
                    "evidenceIds": [],
                }
                for index in ranked
            ]
            offset += count
        return result
