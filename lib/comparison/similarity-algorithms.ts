/** Levenshtein distance (minimum single-character edits between two strings) */
export function levenshtein(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost
      );
    }
  }

  return dp[m]![n]!;
}

/** Normalized Levenshtein similarity (0 = different, 1 = identical) */
export function levenshteinSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;

  const distance = levenshtein(str1, str2);
  return 1 - distance / maxLen;
}

/** Jaccard index: intersection / union (0-1) */
export function jaccard<T>(set1: Set<T>, set2: Set<T>): number {
  if (set1.size === 0 && set2.size === 0) return 1;

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

export function jaccardFromArrays<T>(arr1: T[], arr2: T[]): number {
  return jaccard(new Set(arr1), new Set(arr2));
}

/** Term frequency: normalized count of each term in a document */
export function termFrequency(terms: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  const totalTerms = terms.length;

  if (totalTerms === 0) return tf;

  for (const term of terms) {
    const lowerTerm = term.toLowerCase();
    tf.set(lowerTerm, (tf.get(lowerTerm) || 0) + 1);
  }

  for (const [term, count] of tf) {
    tf.set(term, count / totalTerms);
  }

  return tf;
}

/** IDF: log(N/df)+1 for term rarity across a corpus */
export function inverseDocumentFrequency(
  documents: string[][]
): Map<string, number> {
  const idf = new Map<string, number>();
  const numDocs = documents.length;

  if (numDocs === 0) return idf;

  const docCounts = new Map<string, number>();

  for (const doc of documents) {
    const uniqueTerms = new Set(doc.map((t) => t.toLowerCase()));
    for (const term of uniqueTerms) {
      docCounts.set(term, (docCounts.get(term) || 0) + 1);
    }
  }

  for (const [term, count] of docCounts) {
    idf.set(term, Math.log(numDocs / count) + 1);
  }

  return idf;
}

/** Document represented as a vector of TF-IDF weights */
export interface TfIdfVector {
  terms: Map<string, number>;
  magnitude: number;
}

/** Calculate TF-IDF vector for a document given pre-calculated IDF values */
export function tfidfVector(
  document: string[],
  idf: Map<string, number>
): TfIdfVector {
  const tf = termFrequency(document);
  const terms = new Map<string, number>();

  let magnitudeSquared = 0;

  for (const [term, tfValue] of tf) {
    const idfValue = idf.get(term) || 1;
    const tfidf = tfValue * idfValue;
    terms.set(term, tfidf);
    magnitudeSquared += tfidf * tfidf;
  }

  return {
    terms,
    magnitude: Math.sqrt(magnitudeSquared),
  };
}

/** Cosine similarity between two TF-IDF vectors (0-1) */
export function cosineSimilarity(vec1: TfIdfVector, vec2: TfIdfVector): number {
  if (vec1.magnitude === 0 || vec2.magnitude === 0) return 0;

  let dotProduct = 0;

  for (const [term, weight1] of vec1.terms) {
    const weight2 = vec2.terms.get(term);
    if (weight2 !== undefined) {
      dotProduct += weight1 * weight2;
    }
  }

  return dotProduct / (vec1.magnitude * vec2.magnitude);
}

/** TF-IDF cosine similarity between two documents (0-1) */
export function tfidfSimilarity(doc1: string[], doc2: string[]): number {
  if (doc1.length === 0 && doc2.length === 0) return 1;
  if (doc1.length === 0 || doc2.length === 0) return 0;

  const corpus = [doc1, doc2];
  const idf = inverseDocumentFrequency(corpus);

  const vec1 = tfidfVector(doc1, idf);
  const vec2 = tfidfVector(doc2, idf);

  return cosineSimilarity(vec1, vec2);
}

/** Tokenize text into lowercase words, removing punctuation and short words */
export function tokenize(text: string, minLength = 2): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= minLength);
}

/** Extract n-grams from tokens (default: bigrams) */
export function extractNgrams(tokens: string[], n = 2): string[] {
  if (tokens.length < n) return [];

  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }
  return ngrams;
}

/** Combined similarity using weighted Jaccard, TF-IDF, and Levenshtein (0-1) */
export function combinedSimilarity(
  text1: string,
  text2: string,
  weights: { jaccard?: number; tfidf?: number; levenshtein?: number } = {}
): number {
  const { jaccard: jaccardWeight = 0.4, tfidf: tfidfWeight = 0.4, levenshtein: levenshteinWeight = 0.2 } = weights;

  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  const jaccardScore = jaccardFromArrays(tokens1, tokens2);
  const tfidfScore = tfidfSimilarity(tokens1, tokens2);
  const levenshteinScore = levenshteinSimilarity(text1, text2);

  return (
    jaccardWeight * jaccardScore +
    tfidfWeight * tfidfScore +
    levenshteinWeight * levenshteinScore
  );
}

/** Find fuzzy matches between two string arrays using Levenshtein similarity */
export function findFuzzyMatches(
  arr1: string[],
  arr2: string[],
  threshold = 0.7
): Array<{ item1: string; item2: string; similarity: number }> {
  const matches: Array<{ item1: string; item2: string; similarity: number }> =
    [];

  for (const item1 of arr1) {
    for (const item2 of arr2) {
      const similarity = levenshteinSimilarity(
        item1.toLowerCase(),
        item2.toLowerCase()
      );
      if (similarity >= threshold) {
        matches.push({ item1, item2, similarity });
      }
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}
