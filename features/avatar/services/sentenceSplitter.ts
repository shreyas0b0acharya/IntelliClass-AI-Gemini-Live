/**
 * Splits text into natural speakable phrase chunks (~60 chars max)
 * ensuring every chunk contains speakable text to avoid HeadTTS silent audio generation.
 */
export function splitIntoSmallChunks(text: string, maxCharsPerChunk = 60): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Split on sentence and clause boundaries (. ! ? ; : \n , - —) keeping punctuation attached
  const rawSegments = trimmed.match(/[^.!?;:\n,\-—]+[.!?;:\n,\-—]*/g) || [trimmed];

  const chunks: string[] = [];
  let buffer = "";

  for (const rawSeg of rawSegments) {
    const seg = rawSeg.trim();
    // Skip empty or non-alphanumeric segments (e.g. pure punctuation like "." or ",")
    if (!/[a-zA-Z0-9]/.test(seg)) continue;

    if (!buffer) {
      buffer = seg;
    } else if ((buffer + " " + seg).length <= maxCharsPerChunk) {
      buffer += " " + seg;
    } else {
      chunks.push(buffer);
      buffer = seg;
    }
  }

  if (buffer && /[a-zA-Z0-9]/.test(buffer)) {
    chunks.push(buffer);
  }

  return chunks.length > 0 ? chunks : [trimmed];
}

/**
 * Backward compatibility alias
 */
export const splitIntoSentences = splitIntoSmallChunks;
