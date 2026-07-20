/**
 * Section-aware chunker (REQ-33, REQ-34).
 *
 * Cascade ordering (first-match-wins per line):
 *   1. Markdown header  (`^#+\s+...`)              → push/replace stack at level
 *   2. Numbered code    (`^\d+(\.\d+)*\s+[A-Z…]`)  → currentLeaf
 *   3. All-caps short   (≤60 chars, ≥3 uppers)     → currentLeaf
 *   4. Fallback         → accumulate into current buffer
 *
 * When ANY detector fires across the input, body lines between detector
 * markers form chunks tagged with the active sectionPath. When NO detector
 * fires across the whole input, the chunker falls back to the legacy
 * word-based 500/50 splitter with `sectionPath: null` on every chunk
 * (SCN-33.4).
 *
 * sectionPath clipping (RESOLVED-4) and the regex literals live in
 * `chunking-detectors.ts` so they can be locked by unit tests independently.
 */

import {
  MD_HEADER_REGEX,
  NUMBERED_CODE_REGEX,
  buildSectionPath,
  detectAllCaps,
} from "./chunking-detectors";

export interface Chunk {
  content: string;
  sectionPath: string | null;
}

const DEFAULT_SIZE = 500;
const DEFAULT_OVERLAP = 50;

/**
 * Split text into chunks tagged with hierarchical section context.
 *
 * @param text   Raw document text.
 * @param size   Word-count target for fallback word-split (default 500).
 * @param overlap Word overlap for fallback word-split (default 50).
 */
export function chunkText(
  text: string,
  size = DEFAULT_SIZE,
  overlap = DEFAULT_OVERLAP,
): Chunk[] {
  const lines = text.split(/\r?\n/);

  // First pass: detect whether ANY detector fires. If not, fallback path.
  let anyDetectorFired = false;
  for (const line of lines) {
    if (
      MD_HEADER_REGEX.test(line) ||
      NUMBERED_CODE_REGEX.test(line) ||
      detectAllCaps(line) !== null
    ) {
      anyDetectorFired = true;
      break;
    }
  }

  if (!anyDetectorFired) {
    return wordSplit(text, size, overlap).map((content) => ({
      content,
      sectionPath: null,
    }));
  }

  // Cascade pass.
  const out: Chunk[] = [];
  const stack: string[] = [];
  let leaf: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const content = buffer.join("\n").trim();
    buffer = [];
    if (content.length === 0) return;
    const sectionPath = buildSectionPath(stack, leaf);
    out.push({ content, sectionPath });
  };

  for (const rawLine of lines) {
    const line = rawLine;

    // 1. Markdown header (wins over numbered when both could match).
    const mdMatch = MD_HEADER_REGEX.exec(line);
    if (mdMatch) {
      flush();
      const level = mdMatch[1].length;
      const title = mdMatch[2].trim();
      // Truncate stack to (level - 1) entries, then push.
      stack.length = Math.max(0, level - 1);
      stack.push(title);
      leaf = null;
      continue;
    }

    // 2. Numbered code.
    if (NUMBERED_CODE_REGEX.test(line)) {
      flush();
      leaf = line.trim();
      continue;
    }

    // 3. All-caps short line.
    const capsTitle = detectAllCaps(line);
    if (capsTitle !== null) {
      flush();
      leaf = capsTitle;
      continue;
    }

    // 4. Body line.
    if (line.trim().length > 0) buffer.push(line);
  }

  flush();

  // If structured pass produced nothing usable, degrade to fallback.
  if (out.length === 0) {
    return wordSplit(text, size, overlap).map((content) => ({
      content,
      sectionPath: null,
    }));
  }

  return out;
}

/** Word-based 500/50 splitter — preserved from the original implementation. */
function wordSplit(text: string, size: number, overlap: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= size) return [words.join(" ")];

  const out: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + size, words.length);
    out.push(words.slice(start, end).join(" "));
    if (end >= words.length) break;
    start += size - overlap;
  }
  return out;
}
