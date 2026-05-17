/**
 * Section-aware chunker (REQ-33/34).
 *
 * Returns an array of `{ content, sectionPath }`. `sectionPath` is `null`
 * when no section detector fired for the chunk (e.g. fully unstructured text
 * → fallback word-split). Detector cascade and sectionPath population are
 * wired in subsequent cycles; this commit flips the return shape only.
 */

export interface Chunk {
  content: string;
  sectionPath: string | null;
}

/**
 * Split text into overlapping chunks of approximately `size` tokens.
 * Uses a simple word-based approximation (1 token ≈ 1 word for Spanish).
 */
export function chunkText(
  text: string,
  size = 500,
  overlap = 50,
): Chunk[] {
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length <= size) {
    return [{ content: words.join(" "), sectionPath: null }];
  }

  const chunks: Chunk[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + size, words.length);
    chunks.push({ content: words.slice(start, end).join(" "), sectionPath: null });

    if (end >= words.length) break;
    start += size - overlap;
  }

  return chunks;
}
