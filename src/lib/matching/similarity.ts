/**
 * Fuzzy string matching for entity resolution (Company/JobTitle/Location dedup).
 * Normalizes diacritics/casing/punctuation, then scores via Levenshtein ratio
 * so near-duplicates like "kloeckner.i" vs "Klöckner i" are caught even
 * though they share no exact substring.
 */

export const normalizeForMatch = (str: string): string =>
  str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  let currRow = new Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    currRow[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1,
        prevRow[j] + 1,
        prevRow[j - 1] + cost,
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[b.length];
};

/**
 * Similarity ratio in [0, 1], 1 meaning identical after normalization.
 */
export const similarityRatio = (a: string, b: string): number => {
  const normA = normalizeForMatch(a);
  const normB = normalizeForMatch(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const distance = levenshteinDistance(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  return 1 - distance / maxLen;
};

export interface MatchCandidate<T> {
  item: T;
  score: number;
}

/**
 * Ranks `items` by similarity to `query`, keeping only matches at or above
 * `threshold`, best first.
 */
export const findBestMatches = <T>(
  query: string,
  items: T[],
  getLabel: (item: T) => string,
  options?: { threshold?: number; limit?: number },
): MatchCandidate<T>[] => {
  const threshold = options?.threshold ?? 0.55;
  const limit = options?.limit ?? 3;

  return items
    .map((item) => ({ item, score: similarityRatio(query, getLabel(item)) }))
    .filter((match) => match.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};
