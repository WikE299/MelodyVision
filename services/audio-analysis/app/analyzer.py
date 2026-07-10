from __future__ import annotations

import hashlib
import math
import uuid
from datetime import UTC, datetime
from pathlib import Path

import librosa
import numpy as np
from scipy.signal import find_peaks

from .semantic import ClapSemanticAnalyzer, SectionWindow, SemanticAnalysisUnavailable


SCHEMA_VERSION = "2.0.0"
SIGNAL_ANALYZER_VERSION = "0.1.0"
ANALYSIS_SAMPLE_RATE = 22_050
MAX_AUDIO_SECONDS = 60
HOP_LENGTH = 512
CURVE_POINTS = 24

KEY_NAMES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def _clip01(value: float) -> float:
    return round(float(np.clip(value, 0.0, 1.0)), 4)


def _analyzed(value: object, confidence: float, evidence_id: str) -> dict[str, object]:
    return {
        "value": value,
        "confidence": _clip01(confidence),
        "evidenceIds": [evidence_id],
    }


def _normalized(values: np.ndarray) -> np.ndarray:
    values = np.nan_to_num(np.asarray(values, dtype=float), nan=0.0, posinf=0.0, neginf=0.0)
    if values.size == 0:
        return values
    low, high = np.percentile(values, [5, 95])
    if math.isclose(float(low), float(high)):
        return np.full(values.shape, 0.5)
    return np.clip((values - low) / (high - low), 0.0, 1.0)


def _curve(
    values: np.ndarray,
    duration: float,
    points: int = CURVE_POINTS,
    *,
    normalize: bool = True,
) -> list[dict[str, float]]:
    values = np.asarray(values, dtype=float)
    if normalize:
        values = _normalized(values)
    if values.size == 0:
        return []
    buckets = np.array_split(values, min(points, len(values)))
    return [
        {
            "atSeconds": round(duration * index / max(1, len(buckets) - 1), 3),
            "value": round(float(np.mean(bucket)), 4),
        }
        for index, bucket in enumerate(buckets)
    ]


def _safe_correlation(left: np.ndarray, right: np.ndarray) -> float:
    if np.std(left) == 0 or np.std(right) == 0:
        return 0.0
    return float(np.corrcoef(left, right)[0, 1])


class MusicAnalyzer:
    def __init__(self, semantic_analyzer: ClapSemanticAnalyzer | None = None) -> None:
        self.semantic_analyzer = semantic_analyzer or ClapSemanticAnalyzer()

    def analyze_file(
        self,
        path: str | Path,
        *,
        session_id: str,
        source_kind: str,
        original_name: str | None = None,
        mime_type: str | None = None,
        catalog_item_id: str | None = None,
    ) -> dict[str, object]:
        audio_path = Path(path)
        content_hash = hashlib.sha256(audio_path.read_bytes()).hexdigest()
        audio, sample_rate = librosa.load(audio_path, sr=ANALYSIS_SAMPLE_RATE, mono=True)
        full_duration = librosa.get_duration(y=audio, sr=sample_rate)
        warnings: list[dict[str, str]] = []

        if full_duration > MAX_AUDIO_SECONDS:
            audio = audio[: MAX_AUDIO_SECONDS * sample_rate]
            warnings.append(
                {
                    "code": "audio_truncated",
                    "message": f"Prototype analysis is limited to the first {MAX_AUDIO_SECONDS} seconds.",
                    "severity": "warning",
                    "analyzer": "librosa",
                }
            )

        duration = librosa.get_duration(y=audio, sr=sample_rate)
        if duration < 1:
            raise ValueError("Audio must contain at least one second of decodable sound")

        signal = self._signal_features(audio, sample_rate, duration)
        sections = signal.pop("sections")
        evidence = signal.pop("evidence")
        warnings.extend(self._tempo_warnings(signal["rhythm"]["bpm"]["value"]))

        semantics = {group: [] for group in ("moods", "genres", "instruments", "textures", "motions", "spaces")}
        analyzers = [
            {
                "name": "librosa",
                "version": librosa.__version__,
                "role": "signal",
            },
            {
                "name": "melodyvision-derived",
                "version": SIGNAL_ANALYZER_VERSION,
                "role": "derived",
            },
        ]

        try:
            section_windows = [
                SectionWindow(
                    section_id=str(section["id"]),
                    start_seconds=float(section["startSeconds"]),
                    end_seconds=float(section["endSeconds"]),
                )
                for section in sections
            ]
            semantics, section_semantics = self.semantic_analyzer.analyze(audio, sample_rate, section_windows)
            self._attach_semantic_evidence(semantics, sections, section_semantics, evidence)
            analyzers.append(
                {
                    "name": "CLAP",
                    "version": "laion-clap",
                    "model": self.semantic_analyzer.model_name,
                    "role": "semantic",
                }
            )
            warnings.append(
                {
                    "code": "semantic_scores_relative",
                    "message": (
                        "CLAP scores rank labels within MelodyVision's controlled candidate sets. "
                        "They are hypotheses for V2-03 evaluation, not verified classifications."
                    ),
                    "severity": "info",
                    "analyzer": "CLAP",
                }
            )
        except (SemanticAnalysisUnavailable, ImportError, OSError, RuntimeError, ValueError) as error:
            warnings.append(
                {
                    "code": "semantic_analysis_unavailable",
                    "message": str(error),
                    "severity": "warning",
                    "analyzer": "CLAP",
                }
            )

        warnings.append(
            {
                "code": "roughness_proxy",
                "message": "Roughness is a spectral-flux proxy in V2-02 and is not a psychoacoustic roughness measure.",
                "severity": "info",
                "analyzer": "melodyvision-derived",
            }
        )

        audio_reference = {
            "name": original_name or audio_path.name,
            "sourceKind": source_kind,
            "durationSeconds": round(duration, 3),
            "contentHash": content_hash,
        }
        if mime_type:
            audio_reference["mimeType"] = mime_type
        if catalog_item_id:
            audio_reference["catalogItemId"] = catalog_item_id

        profile = {
            "schemaVersion": SCHEMA_VERSION,
            "id": str(uuid.uuid4()),
            "sessionId": session_id,
            "audio": audio_reference,
            "analyzers": analyzers,
            "rhythm": signal["rhythm"],
            "tonality": signal["tonality"],
            "dynamics": signal["dynamics"],
            "timbre": signal["timbre"],
            "sections": sections,
            "semantics": semantics,
            "evidence": evidence,
            "warnings": warnings,
            "createdAt": datetime.now(UTC).isoformat(),
        }
        self._validate_profile(profile)
        return profile

    def _signal_features(self, audio: np.ndarray, sample_rate: int, duration: float) -> dict[str, object]:
        onset_envelope = librosa.onset.onset_strength(y=audio, sr=sample_rate, hop_length=HOP_LENGTH)
        tempo, beat_frames = librosa.beat.beat_track(
            onset_envelope=onset_envelope,
            sr=sample_rate,
            hop_length=HOP_LENGTH,
        )
        bpm = float(np.asarray(tempo).reshape(-1)[0]) if np.asarray(tempo).size else 0.0
        beat_times = librosa.frames_to_time(beat_frames, sr=sample_rate, hop_length=HOP_LENGTH)
        onset_frames = librosa.onset.onset_detect(
            onset_envelope=onset_envelope,
            sr=sample_rate,
            hop_length=HOP_LENGTH,
        )

        rms = librosa.feature.rms(y=audio, frame_length=2048, hop_length=HOP_LENGTH)[0]
        stft = np.abs(librosa.stft(audio, n_fft=2048, hop_length=HOP_LENGTH))
        power = stft**2
        centroid = librosa.feature.spectral_centroid(S=stft, sr=sample_rate)[0]
        flatness = librosa.feature.spectral_flatness(S=stft)[0]
        chroma = librosa.feature.chroma_cqt(y=audio, sr=sample_rate, hop_length=HOP_LENGTH)
        harmonic_change = np.linalg.norm(np.diff(chroma, axis=1), axis=0)
        spectral_flux = np.linalg.norm(np.diff(librosa.util.normalize(stft, axis=0), axis=1), axis=0)

        evidence = [
            {
                "id": "signal-rhythm",
                "analyzer": "librosa",
                "method": "onset envelope and beat tracking",
                "description": "Beat positions, tempo regularity, beat strength, and onset density.",
            },
            {
                "id": "signal-tonality",
                "analyzer": "librosa",
                "method": "constant-Q chroma and key-profile correlation",
                "description": "Global pitch-class profile, key hypothesis, and harmonic change.",
            },
            {
                "id": "signal-dynamics",
                "analyzer": "librosa",
                "method": "RMS energy",
                "description": "Normalized energy and loudness evolution.",
            },
            {
                "id": "signal-timbre",
                "analyzer": "librosa",
                "method": "spectral centroid, flatness, flux, and band energy",
                "description": "Brightness, warmth, noisiness, and a roughness proxy.",
            },
            {
                "id": "signal-structure",
                "analyzer": "melodyvision-derived",
                "method": "multi-feature novelty peaks",
                "description": "Data-derived section boundaries from chroma, MFCC, and onset changes.",
            },
        ]

        key, mode, key_confidence = self._estimate_key(chroma)
        beat_confidence = self._beat_confidence(beat_times)
        beat_strength = self._beat_strength(onset_envelope, beat_frames)
        onset_rate = len(onset_frames) / max(duration, 1)
        onset_density, onset_confidence = self._onset_density(onset_rate)

        rms_db = librosa.amplitude_to_db(np.maximum(rms, 1e-8), ref=1.0)
        energy_normalized = _normalized(rms_db)
        average_energy = _clip01((float(np.mean(rms_db)) + 60) / 60)
        dynamic_complexity = _clip01(float(np.std(rms_db)) / 18)

        brightness = _clip01(float(np.mean(centroid)) / (sample_rate / 2))
        noisiness = _clip01(math.sqrt(max(0.0, float(np.mean(flatness)))))
        roughness = _clip01(float(np.mean(_normalized(spectral_flux))))
        frequencies = librosa.fft_frequencies(sr=sample_rate, n_fft=2048)
        low_energy = float(power[frequencies <= 700].sum())
        total_energy = float(power.sum()) or 1.0
        warmth = _clip01(low_energy / total_energy)

        sections = self._sections(
            audio=audio,
            sample_rate=sample_rate,
            duration=duration,
            rms=rms,
            centroid=centroid,
            onset_envelope=onset_envelope,
            chroma=chroma,
        )

        return {
            "rhythm": {
                "bpm": _analyzed(round(bpm, 2) if bpm > 0 else None, beat_confidence, "signal-rhythm"),
                "beatStrength": _analyzed(beat_strength, min(1.0, beat_confidence + 0.1), "signal-rhythm"),
                "onsetDensity": _analyzed(onset_density, onset_confidence, "signal-rhythm"),
                "beatsSeconds": [round(float(value), 3) for value in beat_times],
                "tempoCurve": _curve(
                    librosa.feature.tempo(
                        onset_envelope=onset_envelope,
                        sr=sample_rate,
                        hop_length=HOP_LENGTH,
                        aggregate=None,
                    ),
                    duration,
                    normalize=False,
                ),
                "onsetDensityCurve": _curve(onset_envelope, duration),
            },
            "tonality": {
                "key": _analyzed(key, key_confidence, "signal-tonality"),
                "mode": _analyzed(mode, key_confidence, "signal-tonality"),
                "chromaProfile": [round(float(value), 4) for value in np.mean(chroma, axis=1)],
                "harmonicChangeCurve": _curve(harmonic_change, duration),
                "harmonicStability": _analyzed(1 - float(np.mean(_normalized(harmonic_change))), 0.65, "signal-tonality"),
            },
            "dynamics": {
                "averageEnergy": _analyzed(average_energy, 0.9, "signal-dynamics"),
                "dynamicComplexity": _analyzed(dynamic_complexity, 0.85, "signal-dynamics"),
                "energyCurve": _curve(energy_normalized, duration),
                "loudnessCurve": _curve(rms_db, duration),
            },
            "timbre": {
                "brightness": _analyzed(brightness, 0.8, "signal-timbre"),
                "warmth": _analyzed(warmth, 0.7, "signal-timbre"),
                "roughness": _analyzed(roughness, 0.45, "signal-timbre"),
                "noisiness": _analyzed(noisiness, 0.7, "signal-timbre"),
            },
            "sections": sections,
            "evidence": evidence,
        }

    def _sections(
        self,
        *,
        audio: np.ndarray,
        sample_rate: int,
        duration: float,
        rms: np.ndarray,
        centroid: np.ndarray,
        onset_envelope: np.ndarray,
        chroma: np.ndarray,
    ) -> list[dict[str, object]]:
        mfcc = librosa.feature.mfcc(y=audio, sr=sample_rate, n_mfcc=13, hop_length=HOP_LENGTH)
        feature_frames = min(chroma.shape[1], mfcc.shape[1], len(onset_envelope))
        feature_matrix = np.vstack(
            [
                librosa.util.normalize(chroma[:, :feature_frames], axis=1),
                librosa.util.normalize(mfcc[:8, :feature_frames], axis=1),
                _normalized(onset_envelope[:feature_frames])[np.newaxis, :],
            ]
        )
        novelty = np.linalg.norm(np.diff(feature_matrix, axis=1), axis=0)
        if novelty.size >= 5:
            novelty = np.convolve(novelty, np.ones(5) / 5, mode="same")

        frames_per_second = sample_rate / HOP_LENGTH
        min_distance = max(1, round(5 * frames_per_second))
        prominence = max(float(np.std(novelty)) * 0.65, 1e-6)
        peaks, properties = find_peaks(novelty, distance=min_distance, prominence=prominence)
        peak_prominences = properties.get("prominences", np.zeros(len(peaks)))
        candidates = [
            (int(peak), float(peak_prominences[index]))
            for index, peak in enumerate(peaks)
            if 4 <= librosa.frames_to_time(peak, sr=sample_rate, hop_length=HOP_LENGTH) <= duration - 4
        ]
        max_internal_boundaries = max(1, min(5, round(duration / 10) - 1))
        candidates = sorted(candidates, key=lambda item: item[1], reverse=True)[:max_internal_boundaries]

        if not candidates and duration >= 20 and novelty.size:
            interior_start = min(len(novelty) - 1, round(6 * frames_per_second))
            interior_end = max(interior_start + 1, len(novelty) - round(6 * frames_per_second))
            interior = novelty[interior_start:interior_end]
            if interior.size:
                peak = interior_start + int(np.argmax(interior))
                candidates = [(peak, float(novelty[peak]))]

        candidates.sort(key=lambda item: item[0])
        boundary_times = [0.0] + [
            float(librosa.frames_to_time(peak, sr=sample_rate, hop_length=HOP_LENGTH))
            for peak, _ in candidates
        ] + [duration]
        max_prominence = max([value for _, value in candidates], default=1.0) or 1.0
        boundary_confidences = [1.0] + [value / max_prominence for _, value in candidates]

        frame_times = librosa.frames_to_time(np.arange(len(rms)), sr=sample_rate, hop_length=HOP_LENGTH)
        centroid_normalized = np.clip(centroid / (sample_rate / 2), 0.0, 1.0)
        rms_normalized = _normalized(rms)
        onset_normalized = _normalized(onset_envelope)
        sections: list[dict[str, object]] = []

        for index, (start, end) in enumerate(zip(boundary_times[:-1], boundary_times[1:])):
            frame_mask = (frame_times >= start) & (frame_times < end)
            energy = float(np.mean(rms_normalized[frame_mask])) if frame_mask.any() else 0.0
            brightness = float(np.mean(centroid_normalized[frame_mask])) if frame_mask.any() else 0.0
            onset_mask = (librosa.frames_to_time(np.arange(len(onset_normalized)), sr=sample_rate, hop_length=HOP_LENGTH) >= start) & (
                librosa.frames_to_time(np.arange(len(onset_normalized)), sr=sample_rate, hop_length=HOP_LENGTH) < end
            )
            onset_density = float(np.mean(onset_normalized[onset_mask])) if onset_mask.any() else 0.0
            trend = self._dynamic_trend(rms_normalized[frame_mask])
            sections.append(
                {
                    "id": f"section-{index + 1}",
                    "order": index,
                    "startSeconds": round(start, 3),
                    "endSeconds": round(end, 3),
                    "phase": "unknown",
                    "boundaryConfidence": _clip01(boundary_confidences[index]),
                    "energy": _clip01(energy),
                    "brightness": _clip01(brightness),
                    "onsetDensity": _clip01(onset_density),
                    "dynamicTrend": trend,
                    "moods": [],
                    "instruments": [],
                    "textures": [],
                    "motions": [],
                }
            )

        self._assign_section_phases(sections)
        return sections

    @staticmethod
    def _estimate_key(chroma: np.ndarray) -> tuple[str | None, str, float]:
        profile = np.mean(chroma, axis=1)
        if not np.any(profile):
            return None, "unknown", 0.0

        candidates: list[tuple[float, str, str]] = []
        for root, name in enumerate(KEY_NAMES):
            candidates.append((_safe_correlation(profile, np.roll(MAJOR_PROFILE, root)), name, "major"))
            candidates.append((_safe_correlation(profile, np.roll(MINOR_PROFILE, root)), name, "minor"))
        candidates.sort(reverse=True)
        best, second = candidates[0], candidates[1]
        confidence = _clip01(max(0.0, best[0] - second[0]) * 2.5)
        return best[1], best[2], confidence

    @staticmethod
    def _beat_confidence(beat_times: np.ndarray) -> float:
        if len(beat_times) < 4:
            return 0.2
        intervals = np.diff(beat_times)
        coefficient_of_variation = float(np.std(intervals) / max(np.mean(intervals), 1e-8))
        return _clip01(1 - coefficient_of_variation)

    @staticmethod
    def _beat_strength(onset_envelope: np.ndarray, beat_frames: np.ndarray) -> float:
        valid_frames = beat_frames[beat_frames < len(onset_envelope)]
        if len(valid_frames) == 0:
            return 0.0
        reference = float(np.percentile(onset_envelope, 95)) or 1.0
        return _clip01(float(np.mean(onset_envelope[valid_frames])) / reference)

    @staticmethod
    def _onset_density(onsets_per_second: float) -> tuple[str, float]:
        if onsets_per_second < 1:
            return "sparse", _clip01(0.65 + abs(onsets_per_second - 1) * 0.2)
        if onsets_per_second < 3:
            distance = min(onsets_per_second - 1, 3 - onsets_per_second)
            return "medium", _clip01(0.65 + distance * 0.15)
        return "dense", _clip01(0.65 + min(1.0, onsets_per_second - 3) * 0.2)

    @staticmethod
    def _dynamic_trend(values: np.ndarray) -> str:
        if len(values) < 3:
            return "stable"
        x_axis = np.linspace(0, 1, len(values))
        slope = float(np.polyfit(x_axis, values, 1)[0])
        if float(np.std(values)) > 0.28:
            return "fluctuating"
        if slope > 0.18:
            return "rising"
        if slope < -0.18:
            return "falling"
        return "stable"

    @staticmethod
    def _assign_section_phases(sections: list[dict[str, object]]) -> None:
        if len(sections) == 1:
            sections[0]["phase"] = "unknown"
            return
        sections[0]["phase"] = "opening"
        sections[-1]["phase"] = "ending"
        if len(sections) == 2:
            return

        interior = list(range(1, len(sections) - 1))
        energies = [float(section["energy"]) for section in sections]
        local_peaks = [
            index
            for index in interior
            if energies[index] >= energies[index - 1]
            and energies[index] >= energies[index + 1]
            and energies[index] >= max(energies) * 0.9
        ]
        pivot_index = max(local_peaks or interior, key=lambda index: energies[index])
        has_climax = bool(local_peaks)
        sections[pivot_index]["phase"] = "climax" if has_climax else "turning-point"
        for index in interior:
            if index == pivot_index:
                continue
            if index < pivot_index:
                sections[index]["phase"] = "development"
            else:
                sections[index]["phase"] = "release"

    @staticmethod
    def _tempo_warnings(bpm: float | None) -> list[dict[str, str]]:
        if bpm is None or bpm < 135:
            return []
        return [
            {
                "code": "tempo_octave_ambiguity",
                "message": (
                    f"The beat tracker returned {bpm:.2f} BPM; a {bpm / 2:.2f} BPM pulse may also be "
                    "musically plausible. Tempo confidence measures regularity, not octave correctness."
                ),
                "severity": "info",
                "analyzer": "librosa",
            }
        ]

    @staticmethod
    def _attach_semantic_evidence(
        semantics: dict[str, list[dict[str, object]]],
        sections: list[dict[str, object]],
        section_semantics: dict[str, dict[str, list[dict[str, object]]]],
        evidence: list[dict[str, object]],
    ) -> None:
        for group, labels in semantics.items():
            evidence_id = f"clap-global-{group}"
            for label in labels:
                label["evidenceIds"] = [evidence_id]
            evidence.append(
                {
                    "id": evidence_id,
                    "analyzer": "CLAP",
                    "method": f"zero-shot {group} similarity",
                    "description": f"Relative scores within the controlled {group} label set.",
                }
            )

        for section in sections:
            section_id = str(section["id"])
            groups = section_semantics.get(section_id, {})
            for group in ("moods", "instruments", "textures", "motions"):
                evidence_id = f"clap-{section_id}-{group}"
                labels = groups.get(group, [])
                for label in labels:
                    label["evidenceIds"] = [evidence_id]
                section[group] = labels
                evidence.append(
                    {
                        "id": evidence_id,
                        "analyzer": "CLAP",
                        "method": f"section-level zero-shot {group} similarity",
                        "description": f"Relative {group} scores for {section_id}.",
                        "sectionId": section_id,
                        "startSeconds": section["startSeconds"],
                        "endSeconds": section["endSeconds"],
                    }
                )

    @staticmethod
    def _validate_profile(profile: dict[str, object]) -> None:
        required = {
            "schemaVersion",
            "id",
            "sessionId",
            "audio",
            "analyzers",
            "rhythm",
            "tonality",
            "dynamics",
            "timbre",
            "sections",
            "semantics",
            "evidence",
            "warnings",
            "createdAt",
        }
        missing = required.difference(profile)
        if missing:
            raise ValueError(f"MusicProfile is missing fields: {', '.join(sorted(missing))}")
        if "visualHints" in profile:
            raise ValueError("MusicProfile must not contain visualHints")
