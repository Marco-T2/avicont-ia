/**
 * Split text into overlapping chunks of approximately `size` tokens.
 * Uses a simple word-based approximation (1 token ≈ 1 word for Spanish).
 */
export function chunkText(
  text: string,
  size = 500,
  overlap = 50,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length <= size) {
    return [words.join(" ")];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + size, words.length);
    chunks.push(words.slice(start, end).join(" "));

    if (end >= words.length) break;
    start += size - overlap;
  }

  return chunks;
}
