/**
 * Similarity Algorithms
 *
 * Pure TypeScript implementations of similarity metrics for feature alignment.
 * No external dependencies - all algorithms implemented from scratch.
 */

/**
 * Calculate Levenshtein distance between two strings
 *
 * Measures the minimum number of single-character edits (insertions, deletions,
 * or substitutions) required to change one string into another.
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance (0 = identical, higher = more different)
 *
 * @example
 * levenshtein("kitten", "sitting") // 3
 * levenshtein("hello", "hello") // 0
 */
export function levenshtein(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Early exit for empty strings
  if (m === 0) return n;
  if (n === 0) return m;

  // Create distance matrix
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  // Initialize first column
  for (let i = 0; i <= m; i++) {
    dp[i]![0] = i;
  }

  // Initialize first row
  for (let j = 0; j <= n; j++) {
    dp[0]![j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1, // deletion
        dp[i]![j - 1]! + 1, // insertion
        dp[i - 1]![j - 1]! + cost // substitution
      );
    }
  }

  return dp[m]![n]!;
}

/**
 * Calculate normalized Levenshtein similarity (0-1 scale)
 *
 * Converts edit distance to a similarity score where 1 = identical
 * and 0 = completely different.
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score (0-1)
 *
 * @example
 * levenshteinSimilarity("kitten", "sitting") // ~0.57
 * levenshteinSimilarity("hello", "hello") // 1.0
 */
export function levenshteinSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1; // Both empty strings are identical

  const distance = levenshtein(str1, str2);
  return 1 - distance / maxLen;
}

/**
 * Calculate Jaccard Index between two sets
 *
 * Measures similarity as the size of intersection divided by size of union.
 * Also known as Jaccard Similarity Coefficient.
 *
 * @param set1 - First set of items
 * @param set2 - Second set of items
 * @returns Jaccard index (0-1)
 *
 * @example
 * jaccard(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd'])) // 0.5
 * jaccard(new Set(['a', 'b']), new Set(['a', 'b'])) // 1.0
 */
export function jaccard<T>(set1: Set<T>, set2: Set<T>): number {
  if (set1.size === 0 && set2.size === 0) return 1; // Both empty sets are identical

  // Calculate intersection
  const intersection = new Set([...set1].filter((x) => set2.has(x)));

  // Calculate union
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Calculate Jaccard Index for arrays (converts to sets)
 *
 * @param arr1 - First array
 * @param arr2 - Second array
 * @returns Jaccard index (0-1)
 */
export function jaccardFromArrays<T>(arr1: T[], arr2: T[]): number {
  return jaccard(new Set(arr1), new Set(arr2));
}

/**
 * Term Frequency (TF) for a document
 *
 * Calculates how frequently each term appears in a document.
 *
 * @param terms - Array of terms in the document
 * @returns Map of term to frequency
 */
export function termFrequency(terms: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  const totalTerms = terms.length;

  if (totalTerms === 0) return tf;

  for (const term of terms) {
    const lowerTerm = term.toLowerCase();
    tf.set(lowerTerm, (tf.get(lowerTerm) || 0) + 1);
  }

  // Normalize by total terms
  for (const [term, count] of tf) {
    tf.set(term, count / totalTerms);
  }

  return tf;
}

/**
 * Inverse Document Frequency (IDF) for a corpus
 *
 * Calculates how rare a term is across documents.
 * Terms appearing in many documents have low IDF.
 *
 * @param documents - Array of documents (each document is array of terms)
 * @returns Map of term to IDF score
 */
export function inverseDocumentFrequency(
  documents: string[][]
): Map<string, number> {
  const idf = new Map<string, number>();
  const numDocs = documents.length;

  if (numDocs === 0) return idf;

  // Count documents containing each term
  const docCounts = new Map<string, number>();

  for (const doc of documents) {
    const uniqueTerms = new Set(doc.map((t) => t.toLowerCase()));
    for (const term of uniqueTerms) {
      docCounts.set(term, (docCounts.get(term) || 0) + 1);
    }
  }

  // Calculate IDF: log(N / df) + 1 (smoothed)
  for (const [term, count] of docCounts) {
    idf.set(term, Math.log(numDocs / count) + 1);
  }

  return idf;
}

/**
 * TF-IDF Vector
 *
 * Represents a document as a vector of TF-IDF weights.
 */
export interface TfIdfVector {
  terms: Map<string, number>;
  magnitude: number;
}

/**
 * Calculate TF-IDF vector for a document
 *
 * @param document - Array of terms in the document
 * @param idf - Pre-calculated IDF values
 * @returns TF-IDF vector
 */
export function tfidfVector(
  document: string[],
  idf: Map<string, number>
): TfIdfVector {
  const tf = termFrequency(document);
  const terms = new Map<string, number>();

  let magnitudeSquared = 0;

  for (const [term, tfValue] of tf) {
    const idfValue = idf.get(term) || 1; // Default IDF of 1 for unseen terms
    const tfidf = tfValue * idfValue;
    terms.set(term, tfidf);
    magnitudeSquared += tfidf * tfidf;
  }

  return {
    terms,
    magnitude: Math.sqrt(magnitudeSquared),
  };
}

/**
 * Calculate cosine similarity between two TF-IDF vectors
 *
 * @param vec1 - First vector
 * @param vec2 - Second vector
 * @returns Cosine similarity (0-1)
 */
export function cosineSimilarity(vec1: TfIdfVector, vec2: TfIdfVector): number {
  if (vec1.magnitude === 0 || vec2.magnitude === 0) return 0;

  let dotProduct = 0;

  // Only iterate over shared terms (others contribute 0 to dot product)
  for (const [term, weight1] of vec1.terms) {
    const weight2 = vec2.terms.get(term);
    if (weight2 !== undefined) {
      dotProduct += weight1 * weight2;
    }
  }

  return dotProduct / (vec1.magnitude * vec2.magnitude);
}

/**
 * Calculate TF-IDF similarity between two documents
 *
 * This is a convenience function that:
 * 1. Creates a mini-corpus from the two documents
 * 2. Calculates IDF for the corpus
 * 3. Generates TF-IDF vectors for both documents
 * 4. Returns cosine similarity
 *
 * @param doc1 - First document (array of terms)
 * @param doc2 - Second document (array of terms)
 * @returns Similarity score (0-1)
 */
export function tfidfSimilarity(doc1: string[], doc2: string[]): number {
  if (doc1.length === 0 && doc2.length === 0) return 1;
  if (doc1.length === 0 || doc2.length === 0) return 0;

  const corpus = [doc1, doc2];
  const idf = inverseDocumentFrequency(corpus);

  const vec1 = tfidfVector(doc1, idf);
  const vec2 = tfidfVector(doc2, idf);

  return cosineSimilarity(vec1, vec2);
}

/**
 * Tokenize text into terms
 *
 * Splits text into lowercase words, removing punctuation and short words.
 *
 * @param text - Text to tokenize
 * @param minLength - Minimum word length (default: 2)
 * @returns Array of tokens
 */
export function tokenize(text: string, minLength = 2): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ') // Replace punctuation with space
    .split(/\s+/) // Split on whitespace
    .filter((word) => word.length >= minLength); // Filter short words
}

/**
 * Extract n-grams from tokens
 *
 * @param tokens - Array of tokens
 * @param n - N-gram size (default: 2 for bigrams)
 * @returns Array of n-grams
 */
export function extractNgrams(tokens: string[], n = 2): string[] {
  if (tokens.length < n) return [];

  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }
  return ngrams;
}

/**
 * Combined similarity score using multiple metrics
 *
 * Weights different similarity metrics for a more robust comparison.
 *
 * @param text1 - First text
 * @param text2 - Second text
 * @param weights - Optional weights for each metric
 * @returns Combined similarity score (0-1)
 */
export function combinedSimilarity(
  text1: string,
  text2: string,
  weights: { jaccard?: number; tfidf?: number; levenshtein?: number } = {}
): number {
  const { jaccard: jaccardWeight = 0.4, tfidf: tfidfWeight = 0.4, levenshtein: levenshteinWeight = 0.2 } = weights;

  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  // Jaccard on tokens
  const jaccardScore = jaccardFromArrays(tokens1, tokens2);

  // TF-IDF similarity
  const tfidfScore = tfidfSimilarity(tokens1, tokens2);

  // Levenshtein on original text (for structure)
  const levenshteinScore = levenshteinSimilarity(text1, text2);

  return (
    jaccardWeight * jaccardScore +
    tfidfWeight * tfidfScore +
    levenshteinWeight * levenshteinScore
  );
}

/**
 * Find matching items between two arrays using fuzzy matching
 *
 * @param arr1 - First array of items
 * @param arr2 - Second array of items
 * @param threshold - Minimum similarity to consider a match (default: 0.7)
 * @returns Array of matching pairs with similarity scores
 */
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

  // Sort by similarity (highest first)
  return matches.sort((a, b) => b.similarity - a.similarity);
}
