#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    if not slug:
        raise ValueError("could not derive a slug from the provided value")
    return slug


def extract_json_summary(markdown: str) -> dict[str, Any] | None:
    blocks = re.findall(r"```json\s*(\{.*?\})\s*```", markdown, flags=re.DOTALL)
    for block in reversed(blocks):
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and "userStories" in data and "title" in data:
            return data
    return None


def extract_section(markdown: str, heading: str) -> str:
    pattern = re.compile(
        rf"^##\s+{re.escape(heading)}\s*$\n(?P<body>.*?)(?=^##\s+|\Z)",
        flags=re.MULTILINE | re.DOTALL,
    )
    match = pattern.search(markdown)
    return match.group("body").strip() if match else ""


def parse_story_blocks(markdown: str) -> list[dict[str, Any]]:
    section = extract_section(markdown, "User Stories")
    if not section:
        return []

    matches = list(re.finditer(r"^###\s+(?:(US-\d+):\s+)?(.+)$", section, flags=re.MULTILINE))
    stories: list[dict[str, Any]] = []

    for index, match in enumerate(matches, start=1):
        start = match.end()
        end = matches[index].start() if index < len(matches) else len(section)
        block = section[start:end].strip()

        title = match.group(2).strip()
        story_id = match.group(1) or f"US-{index:03d}"

        description_match = re.search(r"\*\*Description:\*\*\s*(.+)", block)
        if not description_match:
            raise ValueError(f"story {story_id} is missing a '**Description:**' line")
        description = description_match.group(1).strip()

        criteria_match = re.search(r"\*\*Acceptance Criteria:\*\*(?P<body>.*)", block, flags=re.DOTALL)
        if not criteria_match:
            raise ValueError(f"story {story_id} is missing an '**Acceptance Criteria:**' section")

        criteria: list[str] = []
        for line in criteria_match.group("body").splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith("### "):
                break
            if stripped.startswith("- [ ] "):
                criteria.append(stripped[6:].strip())
            elif stripped.startswith("- "):
                criteria.append(stripped[2:].strip())

        if not criteria:
            raise ValueError(f"story {story_id} does not have any list-form acceptance criteria")

        stories.append(
            {
                "id": story_id,
                "title": title,
                "description": description,
                "acceptanceCriteria": criteria,
            }
        )

    return stories


def parse_markdown_prd(path: Path) -> dict[str, Any]:
    markdown = path.read_text(encoding="utf-8-sig")
    summary = extract_json_summary(markdown)

    title_match = re.search(r"^#\s+(?:PRD:\s+)?(.+)$", markdown, flags=re.MULTILINE)
    if not title_match:
        raise ValueError("markdown PRD is missing a top-level title")
    title = title_match.group(1).strip()

    introduction = extract_section(markdown, "Introduction / Overview") or extract_section(markdown, "Introduction")

    if summary:
        user_stories = summary.get("userStories")
        if not isinstance(user_stories, list) or not user_stories:
            raise ValueError("JSON summary must include at least one user story")
        return {
            "title": summary.get("title", title),
            "description": introduction or title,
            "userStories": user_stories,
            "prdId": summary.get("prdId"),
        }

    stories = parse_story_blocks(markdown)
    if not stories:
        raise ValueError("markdown PRD does not contain any parsable user stories")

    return {
        "title": title,
        "description": introduction or title,
        "userStories": stories,
        "prdId": None,
    }


def normalize_story(raw_story: dict[str, Any], index: int) -> dict[str, Any]:
    title = raw_story.get("title")
    description = raw_story.get("description")
    criteria = raw_story.get("acceptanceCriteria") or raw_story.get("acceptance_criteria")

    if not isinstance(title, str) or not title.strip():
        raise ValueError(f"user story {index} is missing a title")
    if not isinstance(description, str) or not description.strip():
        raise ValueError(f"user story {index} is missing a description")
    if not isinstance(criteria, list) or not all(isinstance(item, str) and item.strip() for item in criteria):
        raise ValueError(f"user story {index} must define a non-empty acceptance criteria list")

    normalized_criteria = [item.strip() for item in criteria]
    if not any(item.lower() == "typecheck passes" for item in normalized_criteria):
        normalized_criteria.append("Typecheck passes")

    return {
        "id": f"US-{index:03d}",
        "title": title.strip(),
        "description": description.strip(),
        "acceptanceCriteria": normalized_criteria,
        "priority": index,
        "passes": False,
        "notes": "",
    }


def progress_has_meaningful_content(path: Path) -> bool:
    if not path.exists():
        return False

    content = path.read_text(encoding="utf-8-sig")
    meaningful_lines = []
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped == "# Ralph Progress Log":
            continue
        if stripped.startswith("Started:"):
            continue
        if stripped == "---":
            continue
        meaningful_lines.append(stripped)
    return bool(meaningful_lines)


def write_progress_header(path: Path) -> None:
    timestamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    path.write_text(f"# Ralph Progress Log\nStarted: {timestamp}\n---\n", encoding="utf-8")


def archive_existing_run(output_path: Path, progress_path: Path, new_branch: str) -> None:
    if not output_path.exists():
        return

    try:
        current_data = json.loads(output_path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"existing output is not valid JSON: {output_path}") from exc

    current_branch = current_data.get("branchName")
    if not isinstance(current_branch, str) or not current_branch.strip():
        return

    if current_branch == new_branch:
        return

    if not progress_has_meaningful_content(progress_path):
        return

    archive_name = f"{date.today().isoformat()}-{slugify(current_branch.replace('ralph/', ''))}"
    archive_dir = output_path.parent / "archive" / archive_name
    archive_dir.mkdir(parents=True, exist_ok=True)

    shutil.copy2(output_path, archive_dir / output_path.name)
    if progress_path.exists():
        shutil.copy2(progress_path, archive_dir / progress_path.name)

    write_progress_header(progress_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert a markdown PRD into Ralph's prd.json format.")
    parser.add_argument("prd_path", help="Path to the markdown PRD file.")
    parser.add_argument(
        "--project",
        help="Project name for the Ralph config. Defaults to the current working directory name.",
    )
    parser.add_argument(
        "--branch-name",
        help="Override the Ralph branch name. Defaults to ralph/<feature-name> derived from the PRD.",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="prd.json",
        help="Output path for prd.json. Defaults to ./prd.json.",
    )
    parser.add_argument(
        "--progress-file",
        help="Path to progress.txt. Defaults to <output directory>/progress.txt.",
    )
    parser.add_argument(
        "--archive-existing",
        action="store_true",
        help="Archive an existing prd.json when it belongs to a different branch and progress.txt has content.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    prd_path = Path(args.prd_path)
    output_path = Path(args.output)
    progress_path = Path(args.progress_file) if args.progress_file else output_path.with_name("progress.txt")

    try:
        parsed = parse_markdown_prd(prd_path)
        project = args.project or Path.cwd().name
        slug_source = (parsed.get("prdId") or parsed["title"]).removeprefix("prd-")
        branch_name = args.branch_name or f"ralph/{slugify(slug_source)}"
        stories = [normalize_story(raw_story, index) for index, raw_story in enumerate(parsed["userStories"], start=1)]

        if output_path.exists() and not args.archive_existing:
            try:
                current_data = json.loads(output_path.read_text(encoding="utf-8-sig"))
            except json.JSONDecodeError:
                current_data = {}
            current_branch = current_data.get("branchName")
            if isinstance(current_branch, str) and current_branch and current_branch != branch_name and progress_has_meaningful_content(progress_path):
                print(
                    "error: existing prd.json belongs to a different branch and progress.txt has content; "
                    "rerun with --archive-existing",
                    file=sys.stderr,
                )
                return 1

        if args.archive_existing:
            archive_existing_run(output_path, progress_path, branch_name)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        result = {
            "project": project,
            "branchName": branch_name,
            "description": parsed["description"],
            "userStories": stories,
        }
        output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        if not progress_path.exists():
            write_progress_header(progress_path)

        print(f"created {output_path}")
        return 0
    except (OSError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
