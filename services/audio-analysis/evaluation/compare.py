from __future__ import annotations

import argparse
import json
import statistics
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.analyzer import MusicAnalyzer


EVALUATION_DIR = Path(__file__).resolve().parent
REPO_ROOT = EVALUATION_DIR.parents[2]
SEMANTIC_GROUPS = ("moods", "genres", "instruments", "textures", "motions", "spaces")
MEYDA_MOOD_MAP = {
    "宁静": {"serene"},
    "柔和": {"warm"},
    "激昂": {"aggressive"},
    "轻快": {"joyful"},
    "深沉": {"solemn", "melancholic"},
    "温暖": {"warm"},
    "清亮": {"hopeful", "joyful"},
    "热烈": {"aggressive", "joyful"},
    "忧郁": {"melancholic"},
    "噪感": {"tense"},
    "纯净": {"serene"},
}


def _round_ms(value: float) -> float:
    return round(value * 1000, 2)


def _median(values: list[float]) -> float | None:
    return round(statistics.median(values), 2) if values else None


def _semantic_labels(profile: dict[str, Any], group: str) -> list[str]:
    return [str(item["label"]) for item in profile["semantics"].get(group, [])]


def _meyda_moods(value: str) -> list[str]:
    labels: set[str] = set()
    for token in value.split("、"):
        labels.update(MEYDA_MOOD_MAP.get(token, set()))
    return sorted(labels)


def _label_evaluation(expected: list[str], produced: list[str]) -> dict[str, Any]:
    hits = sorted(set(expected).intersection(produced))
    return {
        "expected": expected,
        "produced": produced,
        "hits": hits,
        "anyHit": bool(hits),
        "top1Hit": bool(produced and produced[0] in expected),
    }


def _summarize_meyda(item: dict[str, Any]) -> dict[str, Any]:
    analysis = item["analysis"]
    return {
        "timing": item["timing"],
        "bpm": analysis["bpm"],
        "energy": analysis["energy"],
        "brightness": analysis["brightness"],
        "dynamicRange": analysis["dynamicRange"],
        "mood": analysis["mood"],
        "mappedMoodLabels": _meyda_moods(analysis["mood"]),
        "sectionBoundariesSeconds": [
            [segment["start"], segment["end"]] for segment in analysis["segments"]
        ],
        "sectionMotions": [segment["motion"] for segment in analysis["segments"]],
        "sectionTextures": [segment["texture"] for segment in analysis["segments"]],
    }


def _summarize_rich(profile: dict[str, Any], elapsed_ms: float) -> dict[str, Any]:
    return {
        "timingMs": elapsed_ms,
        "bpm": profile["rhythm"]["bpm"],
        "key": profile["tonality"]["key"],
        "mode": profile["tonality"]["mode"],
        "averageEnergy": profile["dynamics"]["averageEnergy"],
        "dynamicComplexity": profile["dynamics"]["dynamicComplexity"],
        "sectionBoundariesSeconds": [
            [section["startSeconds"], section["endSeconds"]] for section in profile["sections"]
        ],
        "sectionPhases": [section["phase"] for section in profile["sections"]],
        "semantics": {
            group: [
                {"label": item["label"], "score": item["score"]}
                for item in profile["semantics"].get(group, [])
            ]
            for group in SEMANTIC_GROUPS
        },
        "warnings": [warning["code"] for warning in profile["warnings"]],
    }


def _rate(items: list[dict[str, Any]], path: tuple[str, ...]) -> float:
    values: list[bool] = []
    for item in items:
        value: Any = item
        for key in path:
            value = value[key]
        values.append(bool(value))
    return round(sum(values) / len(values), 3)


def evaluate(args: argparse.Namespace) -> dict[str, Any]:
    reference = json.loads(args.reference.read_text(encoding="utf-8"))
    meyda_report = json.loads(args.meyda.read_text(encoding="utf-8"))
    meyda_by_id = {item["id"]: item for item in meyda_report["items"]}
    analyzer = MusicAnalyzer()
    results: list[dict[str, Any]] = []

    for reference_item in reference["items"]:
        item_id = reference_item["id"]
        audio_path = args.audio_dir / reference_item["file"]
        started_at = time.perf_counter()
        profile = analyzer.analyze_file(
            audio_path,
            session_id="v2-03-evaluation",
            source_kind="preset",
            original_name=reference_item["file"],
        )
        rich_elapsed_ms = _round_ms(time.perf_counter() - started_at)
        meyda = _summarize_meyda(meyda_by_id[item_id])
        rich = _summarize_rich(profile, rich_elapsed_ms)
        semantic_evaluation = {
            group: _label_evaluation(
                reference_item["semantics"][group],
                _semantic_labels(profile, group),
            )
            for group in SEMANTIC_GROUPS
        }
        tonality_reference = reference_item.get("tonality")
        tonality_evaluation = None
        if tonality_reference:
            tonality_evaluation = {
                "expected": tonality_reference,
                "produced": {
                    "key": profile["tonality"]["key"]["value"],
                    "mode": profile["tonality"]["mode"]["value"],
                },
            }
            tonality_evaluation["exactMatch"] = (
                tonality_evaluation["expected"] == tonality_evaluation["produced"]
            )

        results.append(
            {
                "id": item_id,
                "file": reference_item["file"],
                "meyda": meyda,
                "rich": rich,
                "evaluation": {
                    "meydaMood": _label_evaluation(
                        reference_item["semantics"]["moods"],
                        meyda["mappedMoodLabels"],
                    ),
                    "richSemantics": semantic_evaluation,
                    "richTonality": tonality_evaluation,
                },
            }
        )
        print(f"{item_id}: Meyda {meyda['timing']['totalMs']} ms, rich {rich_elapsed_ms} ms")

    tonality_results = [
        item["evaluation"]["richTonality"]
        for item in results
        if item["evaluation"]["richTonality"] is not None
    ]
    rich_times = [float(item["rich"]["timingMs"]) for item in results]
    report = {
        "schemaVersion": "v2-03-comparison-1",
        "generatedAt": datetime.now(UTC).isoformat(),
        "reference": {
            "schemaVersion": reference["schemaVersion"],
            "status": reference["status"],
            "notes": reference["notes"],
        },
        "summary": {
            "tracks": len(results),
            "timingMs": {
                "meydaMedianTotal": _median(
                    [float(item["meyda"]["timing"]["totalMs"]) for item in results]
                ),
                "richColdFirstRequest": rich_times[0] if rich_times else None,
                "richWarmMedian": _median(rich_times[1:]),
            },
            "meydaMoodAnyHitRate": _rate(results, ("evaluation", "meydaMood", "anyHit")),
            "richSemanticAnyHitRate": {
                group: _rate(
                    results,
                    ("evaluation", "richSemantics", group, "anyHit"),
                )
                for group in SEMANTIC_GROUPS
            },
            "richSemanticTop1HitRate": {
                group: _rate(
                    results,
                    ("evaluation", "richSemantics", group, "top1Hit"),
                )
                for group in SEMANTIC_GROUPS
            },
            "richTonalityExactMatchRate": (
                round(
                    sum(bool(item["exactMatch"]) for item in tonality_results)
                    / len(tonality_results),
                    3,
                )
                if tonality_results
                else None
            ),
            "fieldCoverage": {
                "meyda": [
                    "bpm-without-confidence",
                    "global-energy",
                    "global-brightness",
                    "dynamic-range",
                    "fixed-duration-segments",
                    "rule-derived-mood",
                    "spectral-summary",
                ],
                "rich": [
                    "bpm-with-confidence-and-ambiguity-warning",
                    "beats-and-onsets",
                    "key-and-mode-with-confidence",
                    "dynamics-curves",
                    "data-derived-sections",
                    "timbre-with-evidence",
                    "semantic-candidates-with-warning",
                    "analyzer-versions-and-evidence",
                ],
            },
        },
        "items": results,
    }
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare Meyda and Version 2 audio analysis")
    parser.add_argument(
        "--reference",
        type=Path,
        default=EVALUATION_DIR / "reference-labels.json",
    )
    parser.add_argument(
        "--audio-dir",
        type=Path,
        default=REPO_ROOT / "public" / "preset-audio" / "clips",
    )
    parser.add_argument("--meyda", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = evaluate(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(args.output)


if __name__ == "__main__":
    main()
