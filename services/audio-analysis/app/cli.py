from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from .analyzer import MusicAnalyzer
from .semantic import ClapSemanticAnalyzer


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze an audio file into a Version 2 MusicProfile")
    parser.add_argument("audio", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--session-id", default="prototype")
    parser.add_argument("--source-kind", choices=("upload", "preset", "search"), default="preset")
    parser.add_argument("--no-semantics", action="store_true")
    args = parser.parse_args()

    semantic_analyzer = ClapSemanticAnalyzer(enabled=not args.no_semantics)
    analyzer = MusicAnalyzer(semantic_analyzer=semantic_analyzer)
    profile = analyzer.analyze_file(
        args.audio,
        session_id=args.session_id,
        source_kind=args.source_kind,
        original_name=args.audio.name,
    )
    serialized = json.dumps(profile, ensure_ascii=False, indent=2)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized + "\n", encoding="utf-8")
        print(os.fspath(args.output))
    else:
        print(serialized)


if __name__ == "__main__":
    main()
