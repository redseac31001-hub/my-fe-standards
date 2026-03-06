#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

TASK_TYPES = {
    "requirement",
    "prd",
    "analysis",
    "design",
    "test",
    "implement",
    "refactor",
    "review",
    "build-fix",
    "acceptance",
}


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    if not slug:
        raise ValueError("feature_name must contain at least one letter or digit")
    return slug


def normalize_text_list(data: Any, field_name: str) -> list[str]:
    if data is None:
        return []
    if not isinstance(data, list) or not all(isinstance(item, str) and item.strip() for item in data):
        raise ValueError(f"{field_name} must be a list of non-empty strings")
    return [item.strip() for item in data]


def load_spec(path: Path) -> dict[str, Any]:
    try:
        raw = path.read_text(encoding="utf-8-sig")
        data = json.loads(raw)
    except FileNotFoundError as exc:
        raise ValueError(f"spec file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"spec file is not valid JSON: {exc}") from exc

    if not isinstance(data, dict):
        raise ValueError("spec root must be a JSON object")

    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("title is required")

    feature_name = data.get("feature_name") or title
    if not isinstance(feature_name, str) or not feature_name.strip():
        raise ValueError("feature_name must be a non-empty string when provided")

    introduction = data.get("introduction") or data.get("overview") or ""
    if not isinstance(introduction, str):
        raise ValueError("introduction must be a string")

    user_stories = data.get("user_stories")
    if not isinstance(user_stories, list) or not user_stories:
        raise ValueError("user_stories must be a non-empty list")

    normalized_stories: list[dict[str, Any]] = []
    for index, story in enumerate(user_stories, start=1):
        if not isinstance(story, dict):
            raise ValueError(f"user_stories[{index}] must be an object")
        story_title = story.get("title")
        story_description = story.get("description")
        if not isinstance(story_title, str) or not story_title.strip():
            raise ValueError(f"user_stories[{index}].title is required")
        if not isinstance(story_description, str) or not story_description.strip():
            raise ValueError(f"user_stories[{index}].description is required")

        criteria = normalize_text_list(story.get("acceptance_criteria"), f"user_stories[{index}].acceptance_criteria")
        if not criteria:
            raise ValueError(f"user_stories[{index}].acceptance_criteria must contain at least one item")

        story_id = story.get("id")
        if story_id is None:
            story_id = f"US-{index:03d}"
        if not isinstance(story_id, str) or not story_id.strip():
            raise ValueError(f"user_stories[{index}].id must be a non-empty string when provided")

        suggested_task_type = story.get("suggested_task_type", "implement")
        if suggested_task_type not in TASK_TYPES:
            raise ValueError(
                f"user_stories[{index}].suggested_task_type must be one of: {', '.join(sorted(TASK_TYPES))}"
            )

        normalized_stories.append(
            {
                "id": story_id.strip(),
                "title": story_title.strip(),
                "description": story_description.strip(),
                "acceptanceCriteria": criteria,
                "suggestedTaskType": suggested_task_type,
            }
        )

    return {
        "feature_name": slugify(feature_name),
        "title": title.strip(),
        "introduction": introduction.strip(),
        "goals": normalize_text_list(data.get("goals"), "goals"),
        "user_stories": normalized_stories,
        "functional_requirements": normalize_text_list(data.get("functional_requirements"), "functional_requirements"),
        "non_goals": normalize_text_list(data.get("non_goals"), "non_goals"),
        "design_considerations": normalize_text_list(data.get("design_considerations"), "design_considerations"),
        "technical_considerations": normalize_text_list(data.get("technical_considerations"), "technical_considerations"),
        "success_metrics": normalize_text_list(data.get("success_metrics"), "success_metrics"),
        "open_questions": normalize_text_list(data.get("open_questions"), "open_questions"),
    }


def render_bullets(items: list[str], fallback: str = "_None specified._") -> str:
    if not items:
        return fallback
    return "\n".join(f"- {item}" for item in items)


def render_story(story: dict[str, Any]) -> str:
    criteria = "\n".join(f"- [ ] {item}" for item in story["acceptanceCriteria"])
    return (
        f"### {story['id']}: {story['title']}\n"
        f"**Description:** {story['description']}\n\n"
        f"**Acceptance Criteria:**\n"
        f"{criteria}\n"
    )


def build_summary(spec: dict[str, Any]) -> dict[str, Any]:
    return {
        "prdId": f"prd-{spec['feature_name']}",
        "title": spec["title"],
        "goals": spec["goals"],
        "userStories": spec["user_stories"],
        "functionalRequirements": spec["functional_requirements"],
        "nonGoals": spec["non_goals"],
        "technicalConsiderations": spec["technical_considerations"],
        "openQuestions": spec["open_questions"],
    }


def render_markdown(spec: dict[str, Any]) -> str:
    sections = [
        f"# PRD: {spec['title']}",
        "",
        "## Introduction / Overview",
        "",
        spec["introduction"] or "_TBD._",
        "",
        "## Goals",
        "",
        render_bullets(spec["goals"]),
        "",
        "## User Stories",
        "",
        "\n".join(render_story(story) for story in spec["user_stories"]).strip(),
        "",
        "## Functional Requirements",
        "",
        render_bullets(spec["functional_requirements"]),
        "",
        "## Non-Goals",
        "",
        render_bullets(spec["non_goals"]),
        "",
        "## Design Considerations",
        "",
        render_bullets(spec["design_considerations"]),
        "",
        "## Technical Considerations",
        "",
        render_bullets(spec["technical_considerations"]),
        "",
        "## Success Metrics",
        "",
        render_bullets(spec["success_metrics"]),
        "",
        "## Open Questions",
        "",
        render_bullets(spec["open_questions"]),
        "",
        "```json",
        json.dumps(build_summary(spec), ensure_ascii=False, indent=2),
        "```",
        "",
    ]
    return "\n".join(sections)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a PRD markdown file from structured JSON input.")
    parser.add_argument("spec", help="Path to the JSON input file.")
    parser.add_argument(
        "--output",
        "-o",
        help="Output markdown path. Defaults to tasks/prd-<feature-name>.md relative to the current directory.",
    )
    parser.add_argument("--overwrite", action="store_true", help="Overwrite the output file if it already exists.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    spec_path = Path(args.spec)

    try:
        spec = load_spec(spec_path)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if args.output:
        output_path = Path(args.output)
    else:
        output_path = Path("tasks") / f"prd-{spec['feature_name']}.md"

    if output_path.exists() and not args.overwrite:
        print(f"error: output file already exists: {output_path}", file=sys.stderr)
        print("rerun with --overwrite to replace it", file=sys.stderr)
        return 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(render_markdown(spec), encoding="utf-8")
    print(f"created {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
