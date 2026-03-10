#!/usr/bin/env python3
"""
Quick validation script for skills - minimal version
"""

import sys
import os
import re
import yaml
from pathlib import Path


def strip_markdown_code(text):
    """Blank fenced/inline code so markdown link parsing ignores examples while keeping line numbers."""
    def blank(match):
        return re.sub(r"[^\n]", " ", match.group(0))

    text = re.sub(r"```[\s\S]*?```", blank, text)
    text = re.sub(r"~~~[\s\S]*?~~~", blank, text)
    text = re.sub(r"`[^`\n]*`", blank, text)
    return text


def split_markdown_destination(raw):
    """Extract link target and optional title from markdown destination."""
    value = raw.strip()
    if not value:
        return "", None

    if value.startswith("<"):
        closing = value.find(">")
        if closing > 0:
            target = value[1:closing].strip()
            title = value[closing + 1 :].strip() or None
            return target, title

    match = re.match(r'^(\S+)(?:\s+(?:"([^"]*)"|\'([^\']*)\'|\(([^)]*)\)))?$', value)
    if not match:
        return value, None

    target = (match.group(1) or "").strip()
    title = (match.group(2) or match.group(3) or match.group(4) or "").strip() or None
    return target, title


def normalize_local_target(target):
    """Strip fragment/query from a local markdown link target."""
    value = target.strip()
    hash_index = value.find("#")
    if hash_index >= 0:
        value = value[:hash_index]
    query_index = value.find("?")
    if query_index >= 0:
        value = value[:query_index]
    return value.strip()


def parse_markdown_links(text):
    """Return markdown links with text/target/title/line info."""
    sanitized = strip_markdown_code(text)
    link_re = re.compile(r'!?\[([^\]\n]*?)\]\(([^)\n]+)\)')
    links = []
    for match in link_re.finditer(sanitized):
        if match.group(0).startswith("!"):
            continue
        target, title = split_markdown_destination(match.group(2))
        if not target:
            continue
        line = sanitized.count("\n", 0, match.start()) + 1
        links.append({
            "text": (match.group(1) or "").strip(),
            "target": target,
            "title": title,
            "line": line,
        })
    return links


def format_link_label(link):
    """Prefer visible link text in diagnostics."""
    if link["text"]:
        return f'"{link["text"]}"'
    if link["title"]:
        return f'"{link["title"]}"'
    return link["target"]


def normalize_whitelist_entry(value):
    """Normalize whitelist entries to stable posix-like relative paths."""
    normalized = str(value).strip().replace("\\", "/")
    if normalized.startswith("./"):
        normalized = normalized[2:]
    return normalized


def is_skippable_link(target):
    """Skip external or same-file links."""
    if target.startswith("#"):
        return True
    if target.startswith("http://") or target.startswith("https://"):
        return True
    if target.startswith("mailto:"):
        return True
    if re.match(r"^[a-zA-Z]+://", target):
        return True
    return False


def is_path_whitelisted(relative_target, whitelist):
    """Match exact whitelist entries or prefix entries ending with slash."""
    normalized_target = normalize_whitelist_entry(relative_target)
    for rule in whitelist:
        normalized_rule = normalize_whitelist_entry(rule)
        if not normalized_rule:
            continue
        if normalized_rule.endswith("/"):
            prefix = normalized_rule[:-1]
            if normalized_target == prefix or normalized_target.startswith(normalized_rule):
                return True
            continue
        if normalized_target == normalized_rule:
            return True
    return False


def validate_skill(skill_path):
    """Basic validation of a skill"""
    skill_path = Path(skill_path)

    # Check SKILL.md exists
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return False, "SKILL.md not found"

    # Read and validate frontmatter
    content = skill_md.read_text(encoding="utf-8-sig")
    if not content.startswith("---"):
        return False, "No YAML frontmatter found"

    # Extract frontmatter
    match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return False, "Invalid frontmatter format"

    frontmatter_text = match.group(1)

    # Parse YAML frontmatter
    try:
        frontmatter = yaml.safe_load(frontmatter_text)
        if not isinstance(frontmatter, dict):
            return False, "Frontmatter must be a YAML dictionary"
    except yaml.YAMLError as e:
        return False, f"Invalid YAML in frontmatter: {e}"

    errors = []

    # Define allowed properties
    ALLOWED_PROPERTIES = {"name", "description", "license", "allowed-tools", "metadata", "triggers", "tools", "related"}

    # Check for unexpected properties (excluding nested keys under metadata)
    unexpected_keys = set(frontmatter.keys()) - ALLOWED_PROPERTIES
    if unexpected_keys:
        return False, (
            f"Unexpected key(s) in SKILL.md frontmatter: {', '.join(sorted(unexpected_keys))}. "
            f"Allowed properties are: {', '.join(sorted(ALLOWED_PROPERTIES))}"
        )

    # Check required fields
    if "name" not in frontmatter:
        return False, "Missing 'name' in frontmatter"
    if "description" not in frontmatter:
        return False, "Missing 'description' in frontmatter"

    metadata = frontmatter.get("metadata")
    link_whitelist = []
    if metadata is not None:
        if not isinstance(metadata, dict):
            return False, "metadata must be a mapping if provided"
        allowed_metadata_properties = {"triggers", "tools", "related", "languages", "frameworks", "roles", "scenarios", "workspace_scope", "link_whitelist"}
        unexpected_metadata_keys = set(metadata.keys()) - allowed_metadata_properties
        if unexpected_metadata_keys:
            return False, (
                f"Unexpected key(s) in metadata: {', '.join(sorted(unexpected_metadata_keys))}. "
                f"Allowed metadata keys are: {', '.join(sorted(allowed_metadata_properties))}"
            )
        raw_whitelist = metadata.get("link_whitelist", [])
        if raw_whitelist is None:
            raw_whitelist = []
        if not isinstance(raw_whitelist, list) or any(not isinstance(item, str) or not item.strip() for item in raw_whitelist):
            return False, "metadata.link_whitelist must be a list of non-empty strings"
        link_whitelist = [normalize_whitelist_entry(item) for item in raw_whitelist if normalize_whitelist_entry(item)]

    # Extract name for validation
    name = frontmatter.get("name", "")
    if not isinstance(name, str):
        return False, f"Name must be a string, got {type(name).__name__}"
    name = name.strip()
    if name:
        # Check naming convention (hyphen-case: lowercase with hyphens)
        if not re.match(r"^[a-z0-9-]+$", name):
            return False, f"Name '{name}' should be hyphen-case (lowercase letters, digits, and hyphens only)"
        if name.startswith("-") or name.endswith("-") or "--" in name:
            return False, f"Name '{name}' cannot start/end with hyphen or contain consecutive hyphens"
        # Check name length (max 64 characters per spec)
        if len(name) > 64:
            return False, f"Name is too long ({len(name)} characters). Maximum is 64 characters."

    # Extract and validate description
    description = frontmatter.get("description", "")
    if not isinstance(description, str):
        return False, f"Description must be a string, got {type(description).__name__}"
    description = description.strip()
    if description:
        # Check for angle brackets
        if "<" in description or ">" in description:
            return False, "Description cannot contain angle brackets (< or >)"
        # Check description length (max 1024 characters per spec)
        if len(description) > 1024:
            return False, f"Description is too long ({len(description)} characters). Maximum is 1024 characters."

    skill_root = skill_path.resolve()
    markdown_files = sorted(
        file_path
        for file_path in skill_root.rglob("*.md")
        if "__pycache__" not in file_path.parts
    )

    for markdown_file in markdown_files:
        rel_markdown = markdown_file.relative_to(skill_root).as_posix()
        content = markdown_file.read_text(encoding="utf-8-sig")

        if len(re.findall(r"^```", content, re.MULTILINE)) % 2 != 0:
            errors.append(f"{rel_markdown}: unclosed code fence detected (``` count is odd)")
        if len(re.findall(r"^~~~", content, re.MULTILINE)) % 2 != 0:
            errors.append(f"{rel_markdown}: unclosed code fence detected (~~~ count is odd)")

        for link in parse_markdown_links(content):
            local_target = normalize_local_target(link["target"])
            if not local_target or is_skippable_link(local_target):
                continue
            if local_target.startswith("/"):
                continue
            if os.path.isabs(local_target):
                continue

            resolved = (markdown_file.parent / local_target).resolve()
            if not resolved.exists():
                errors.append(
                    f'{rel_markdown}: line {link["line"]} link {format_link_label(link)} target not found: {local_target}'
                )
                continue

            if not (resolved == skill_root or skill_root in resolved.parents):
                escaped_relative = normalize_whitelist_entry(os.path.relpath(resolved, skill_root))
                if not is_path_whitelisted(escaped_relative, link_whitelist):
                    errors.append(
                        f'{rel_markdown}: line {link["line"]} link {format_link_label(link)} points outside skill root: '
                        f'{escaped_relative} (allow via metadata.link_whitelist if intentional)'
                    )

    if errors:
        preview = "\n".join(f"- {item}" for item in errors[:10])
        if len(errors) > 10:
            preview += f"\n- ... and {len(errors) - 10} more"
        return False, f"Skill validation failed:\n{preview}"

    return True, "Skill is valid!"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python quick_validate.py <skill_directory>")
        sys.exit(1)

    valid, message = validate_skill(sys.argv[1])
    print(message)
    sys.exit(0 if valid else 1)
