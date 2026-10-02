"""Command line: ``python -m netsense <command>``."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .dataset import APP_DATA_DIR, RESULTS_DIR, check_app_data, write_app_data
from .evaluation import build_results, write_results
from .pipeline import run_engine
from .seed import load_seed, validate_seed


def _print_summary(results: dict[str, dict]) -> None:
    drift = results["drift_profile_eval.json"]
    s = drift["summary"]
    print("Rule-based detection agreement on designed profiles (not model accuracy)")
    print(f"  {'profile':17} {'link':26} {'expected':10} {'score':>6} {'health':>7} {'state':10} agreement")
    for r in drift["rows"]:
        expected = r["expectedState"] or "— (unresolvable)"
        print(
            f"  {r['profile']:17} {r['linkName']:26} {expected:10} {r['anomalyScore']:>6} "
            f"{r['healthScore']:>7} {r['state']:10} {r['agreement']}"
        )
    print(f"  => {s['agreement']} resolvable profiles matched ({s['unresolvable']} unresolvable, reported separately)")
    for r in drift["rows"]:
        if "diagnostic" in r:
            d = r["diagnostic"]
            print(
                f"  oscillation diagnostic ({d['window']}): {d['flaggedSamples']}/{d['samples']} samples "
                f"would be flagged by the same single-sample rule; max single-sample score {d['maxSingleSampleScore']} "
                f"(unrounded {d['maxSingleSampleScoreUnrounded']}, {d['thresholdMarginAtMax']} below the threshold); "
                f"score at now {d['scoreAtNow']}"
            )
    audit = results["consistency_audit.json"]["summary"]
    print("\nAuthored-vs-computed consistency audit (separate measurement)")
    print(
        f"  {audit['records']} records ({audit['predictions']} predictions + {audit['incidents']} incidents): "
        f"{audit['consistent']} consistent, {audit['review']} flagged for review, {audit['notComparable']} not comparable"
    )
    for r in results["consistency_audit.json"]["rows"]:
        if r["result"] == "review":
            print(f"  REVIEW {r['record']} ({r['linkName']}): {r['interpretation']}")


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # link names contain en dashes; Windows consoles default to cp1252
    parser = argparse.ArgumentParser(prog="netsense", description="NetSense rule-based engine")
    sub = parser.add_subparsers(dest="command", required=True)

    ev = sub.add_parser("evaluate", help="run the evaluation and write docs/results/*.json")
    ev.add_argument("--out", type=Path, default=RESULTS_DIR)
    ev.add_argument("--no-write", action="store_true", help="print only; do not write result files")

    bd = sub.add_parser("build-data", help="regenerate app/src/data/generated from the engine")
    bd.add_argument("--out", type=Path, default=APP_DATA_DIR)

    sub.add_parser("check", help="fail if committed generated data or results drift from the engine")
    sub.add_parser("validate-seed", help="check referential integrity of the authored seed data")

    args = parser.parse_args(argv)

    if args.command == "validate-seed":
        errors, notes = validate_seed(load_seed())
        for e in errors:
            print("ERROR", e)
        for n in notes:
            print("note ", n)
        print("seed is valid" if not errors else f"{len(errors)} error(s)")
        return 1 if errors else 0

    run = run_engine()

    if args.command == "evaluate":
        results = build_results(run) if args.no_write else write_results(run, args.out)
        _print_summary(results)
        if not args.no_write:
            print(f"\nwrote {', '.join(results)} to {args.out}")
        return 0

    if args.command == "build-data":
        written = write_app_data(run, args.out)
        print(f"wrote {len(written)} files to {args.out}")
        return 0

    if args.command == "check":
        problems = check_app_data(run)
        results = build_results(run)
        for name, payload in results.items():
            path = RESULTS_DIR / name
            if not path.exists():
                problems.append(f"docs/results/{name}: missing")
            elif json.loads(path.read_text(encoding="utf-8")) != payload:
                problems.append(f"docs/results/{name}: differs from what the engine produces")
        for p in problems:
            print("DRIFT", p)
        print("generated data and results are up to date" if not problems else f"{len(problems)} problem(s)")
        return 1 if problems else 0

    return 2


if __name__ == "__main__":
    sys.exit(main())
