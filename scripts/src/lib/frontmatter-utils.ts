export type FrontmatterBlock =
  | { ok: true; frontmatter: string; endIndex: number }
  | { ok: false; error: string };

export type FrontmatterDocument =
  | { ok: true; frontmatter: string; body: string; endIndex: number }
  | { ok: false; error: string };

function normalizeNewlines(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

function countLeadingSpaces(line: string): number {
  const match = line.match(/^ */);
  return match ? match[0].length : 0;
}

function indentPrefix(indent: number): string {
  return ' '.repeat(Math.max(0, indent));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseFrontmatterBlock(md: string): FrontmatterBlock {
  const normalized = normalizeNewlines(md);
  if (!normalized.startsWith('---')) {
    return { ok: false, error: 'missing YAML frontmatter (must start with ---)' };
  }

  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { ok: false, error: 'YAML frontmatter is not closed (missing ending ---)' };
  }

  return { ok: true, frontmatter: match[1], endIndex: match[0].length };
}

export function splitFrontmatterDocument(md: string): FrontmatterDocument {
  const normalized = normalizeNewlines(md);
  const parsed = parseFrontmatterBlock(normalized);
  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true,
    frontmatter: parsed.frontmatter,
    body: normalized.slice(parsed.endIndex),
    endIndex: parsed.endIndex,
  };
}

export function extractYamlScalar(frontmatter: string, key: string): string | undefined {
  const normalized = normalizeNewlines(frontmatter);
  const pattern = new RegExp(`^${escapeRegex(key)}:\\s*(.+)$`, 'm');
  const match = normalized.match(pattern);
  if (!match) return undefined;
  return stripWrappingQuotes(match[1]);
}

export function listYamlKeys(yaml: string, indent = 0): string[] {
  const normalized = normalizeNewlines(yaml);
  const prefix = indentPrefix(indent);
  const keys: string[] = [];

  for (const line of normalized.split('\n')) {
    const match = line.match(new RegExp(`^${escapeRegex(prefix)}([A-Za-z0-9_-]+):(?:\\s+.*)?$`));
    if (match) keys.push(match[1]);
  }

  return keys;
}

export function extractYamlSection(frontmatter: string, key: string, indent = 0): string | null {
  const normalized = normalizeNewlines(frontmatter);
  const lines = normalized.split('\n');
  const prefix = indentPrefix(indent);
  const startPattern = new RegExp(`^${escapeRegex(prefix)}${escapeRegex(key)}:\\s*$`);

  for (let i = 0; i < lines.length; i++) {
    if (!startPattern.test(lines[i])) continue;

    const collected: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim()) {
        collected.push(line);
        continue;
      }

      if (countLeadingSpaces(line) <= indent) break;
      collected.push(line);
    }

    return collected.join('\n');
  }

  return null;
}

export function extractYamlBlockScalar(frontmatter: string, key: string, indent = 0): string | undefined {
  const normalized = normalizeNewlines(frontmatter);
  const lines = normalized.split('\n');
  const prefix = indentPrefix(indent);
  const startPattern = new RegExp(`^${escapeRegex(prefix)}${escapeRegex(key)}:\\s*[>|][+-]?\\s*$`);

  for (let i = 0; i < lines.length; i++) {
    if (!startPattern.test(lines[i])) continue;

    const collected: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim()) {
        collected.push('');
        continue;
      }

      if (countLeadingSpaces(line) <= indent) break;
      collected.push(line);
    }

    const nonEmptyLines = collected.filter(line => line.trim());
    if (nonEmptyLines.length === 0) return '';

    const contentIndent = Math.min(...nonEmptyLines.map(countLeadingSpaces));
    return collected
      .map(line => (line.trim() ? line.slice(contentIndent) : ''))
      .join('\n')
      .trim();
  }

  return undefined;
}

export function parseYamlList(frontmatter: string, key: string, indent = 0): string[] {
  const normalized = normalizeNewlines(frontmatter);
  const lines = normalized.split('\n');
  const prefix = indentPrefix(indent);
  const itemPrefix = indentPrefix(indent + 2);
  const startPattern = new RegExp(`^${escapeRegex(prefix)}${escapeRegex(key)}:\\s*$`);
  const itemPattern = new RegExp(`^${escapeRegex(itemPrefix)}-\\s*(.+?)\\s*$`);
  const values: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!startPattern.test(lines[i])) continue;

    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim()) continue;

      const currentIndent = countLeadingSpaces(line);
      if (currentIndent <= indent) break;

      const itemMatch = line.match(itemPattern);
      if (itemMatch) values.push(stripWrappingQuotes(itemMatch[1]));
    }
    break;
  }

  return values;
}
