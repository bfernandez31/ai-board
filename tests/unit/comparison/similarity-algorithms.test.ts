/**
 * Unit Tests: Similarity Algorithms
 *
 * Tests the similarity calculation algorithms for the comparison feature.
 */

import { describe, it, expect } from 'vitest';
import {
  levenshtein,
  levenshteinSimilarity,
  jaccard,
  jaccardFromArrays,
  termFrequency,
  inverseDocumentFrequency,
  tfidfVector,
  cosineSimilarity,
  tfidfSimilarity,
  tokenize,
  extractNgrams,
  combinedSimilarity,
  findFuzzyMatches,
} from '@/lib/comparison/similarity-algorithms';

describe('levenshtein', () => {
  it('should return 0 for identical strings', () => {
    expect(levenshtein('hello', 'hello')).toBe(0);
  });

  it('should return length of string for empty comparison', () => {
    expect(levenshtein('hello', '')).toBe(5);
    expect(levenshtein('', 'world')).toBe(5);
  });

  it('should return 0 for two empty strings', () => {
    expect(levenshtein('', '')).toBe(0);
  });

  it('should calculate correct distance for single edit', () => {
    expect(levenshtein('cat', 'hat')).toBe(1); // substitution
    expect(levenshtein('cat', 'cats')).toBe(1); // insertion
    expect(levenshtein('cats', 'cat')).toBe(1); // deletion
  });

  it('should calculate correct distance for multiple edits', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });

  it('should be symmetric', () => {
    expect(levenshtein('abc', 'def')).toBe(levenshtein('def', 'abc'));
  });
});

describe('levenshteinSimilarity', () => {
  it('should return 1 for identical strings', () => {
    expect(levenshteinSimilarity('hello', 'hello')).toBe(1);
  });

  it('should return 1 for two empty strings', () => {
    expect(levenshteinSimilarity('', '')).toBe(1);
  });

  it('should return 0 for completely different strings of same length', () => {
    expect(levenshteinSimilarity('abc', 'xyz')).toBe(0);
  });

  it('should return value between 0 and 1', () => {
    const similarity = levenshteinSimilarity('kitten', 'sitting');
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(1);
  });

  it('should normalize by max length', () => {
    // "cat" -> "cats" is 1 edit, max length is 4
    // similarity = 1 - (1/4) = 0.75
    expect(levenshteinSimilarity('cat', 'cats')).toBe(0.75);
  });
});

describe('jaccard', () => {
  it('should return 1 for identical sets', () => {
    const set = new Set(['a', 'b', 'c']);
    expect(jaccard(set, set)).toBe(1);
  });

  it('should return 0 for completely disjoint sets', () => {
    const set1 = new Set(['a', 'b']);
    const set2 = new Set(['c', 'd']);
    expect(jaccard(set1, set2)).toBe(0);
  });

  it('should return 1 for two empty sets', () => {
    expect(jaccard(new Set(), new Set())).toBe(1);
  });

  it('should calculate correct overlap', () => {
    const set1 = new Set(['a', 'b', 'c']);
    const set2 = new Set(['b', 'c', 'd']);
    // intersection = {b, c} = 2
    // union = {a, b, c, d} = 4
    // jaccard = 2/4 = 0.5
    expect(jaccard(set1, set2)).toBe(0.5);
  });

  it('should handle subset relationship', () => {
    const set1 = new Set(['a', 'b']);
    const set2 = new Set(['a', 'b', 'c']);
    // intersection = 2, union = 3
    expect(jaccard(set1, set2)).toBeCloseTo(0.667, 2);
  });
});

describe('jaccardFromArrays', () => {
  it('should work with arrays', () => {
    const arr1 = ['a', 'b', 'c'];
    const arr2 = ['b', 'c', 'd'];
    expect(jaccardFromArrays(arr1, arr2)).toBe(0.5);
  });

  it('should handle duplicates in arrays', () => {
    const arr1 = ['a', 'a', 'b'];
    const arr2 = ['b', 'b', 'c'];
    // As sets: {a, b} and {b, c}
    // intersection = {b} = 1
    // union = {a, b, c} = 3
    expect(jaccardFromArrays(arr1, arr2)).toBeCloseTo(0.333, 2);
  });
});

describe('termFrequency', () => {
  it('should calculate normalized term frequency', () => {
    const tf = termFrequency(['hello', 'world', 'hello']);
    expect(tf.get('hello')).toBeCloseTo(0.667, 2);
    expect(tf.get('world')).toBeCloseTo(0.333, 2);
  });

  it('should convert to lowercase', () => {
    const tf = termFrequency(['Hello', 'HELLO']);
    expect(tf.has('hello')).toBe(true);
    expect(tf.get('hello')).toBe(1);
  });

  it('should handle empty array', () => {
    const tf = termFrequency([]);
    expect(tf.size).toBe(0);
  });

  it('should normalize by total terms', () => {
    const tf = termFrequency(['a', 'b', 'c', 'd']);
    expect(tf.get('a')).toBe(0.25);
    expect(tf.get('b')).toBe(0.25);
  });
});

describe('inverseDocumentFrequency', () => {
  it('should calculate IDF for corpus', () => {
    const docs = [
      ['hello', 'world'],
      ['hello', 'there'],
      ['goodbye', 'world'],
    ];
    const idf = inverseDocumentFrequency(docs);

    // "hello" appears in 2/3 docs: log(3/2) + 1 ≈ 1.405
    // "goodbye" appears in 1/3 docs: log(3/1) + 1 ≈ 2.099
    expect(idf.get('hello')).toBeLessThan(idf.get('goodbye')!);
  });

  it('should return higher IDF for rare terms', () => {
    const docs = [
      ['common', 'rare'],
      ['common', 'other'],
      ['common', 'another'],
    ];
    const idf = inverseDocumentFrequency(docs);

    expect(idf.get('rare')!).toBeGreaterThan(idf.get('common')!);
  });

  it('should handle empty corpus', () => {
    const idf = inverseDocumentFrequency([]);
    expect(idf.size).toBe(0);
  });
});

describe('tfidfVector', () => {
  it('should create vector with magnitude', () => {
    const idf = new Map([
      ['hello', 1.5],
      ['world', 2.0],
    ]);
    const vec = tfidfVector(['hello', 'world'], idf);

    expect(vec.terms.has('hello')).toBe(true);
    expect(vec.terms.has('world')).toBe(true);
    expect(vec.magnitude).toBeGreaterThan(0);
  });

  it('should use default IDF for unknown terms', () => {
    const idf = new Map<string, number>();
    const vec = tfidfVector(['unknown'], idf);

    // Default IDF is 1, TF is 1, so weight = 1
    expect(vec.terms.get('unknown')).toBe(1);
  });
});

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const vec = {
      terms: new Map([
        ['a', 1],
        ['b', 2],
      ]),
      magnitude: Math.sqrt(5),
    };
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1, 5);
  });

  it('should return 0 for orthogonal vectors', () => {
    const vec1 = { terms: new Map([['a', 1]]), magnitude: 1 };
    const vec2 = { terms: new Map([['b', 1]]), magnitude: 1 };
    expect(cosineSimilarity(vec1, vec2)).toBe(0);
  });

  it('should return 0 for zero-magnitude vectors', () => {
    const zeroVec = { terms: new Map<string, number>(), magnitude: 0 };
    const normalVec = { terms: new Map([['a', 1]]), magnitude: 1 };
    expect(cosineSimilarity(zeroVec, normalVec)).toBe(0);
  });
});

describe('tfidfSimilarity', () => {
  it('should return 1 for identical documents', () => {
    const doc = ['hello', 'world', 'test'];
    expect(tfidfSimilarity(doc, doc)).toBeCloseTo(1, 5);
  });

  it('should return 1 for two empty documents', () => {
    expect(tfidfSimilarity([], [])).toBe(1);
  });

  it('should return 0 for completely different documents', () => {
    const doc1 = ['aaa', 'bbb', 'ccc'];
    const doc2 = ['xxx', 'yyy', 'zzz'];
    expect(tfidfSimilarity(doc1, doc2)).toBe(0);
  });

  it('should return value between 0 and 1 for partial overlap', () => {
    const doc1 = ['hello', 'world'];
    const doc2 = ['hello', 'there'];
    const similarity = tfidfSimilarity(doc1, doc2);
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(1);
  });

  it('should return 0 when one document is empty', () => {
    expect(tfidfSimilarity(['hello'], [])).toBe(0);
    expect(tfidfSimilarity([], ['hello'])).toBe(0);
  });
});

describe('tokenize', () => {
  it('should split on whitespace', () => {
    expect(tokenize('hello world')).toEqual(['hello', 'world']);
  });

  it('should convert to lowercase', () => {
    expect(tokenize('Hello WORLD')).toEqual(['hello', 'world']);
  });

  it('should remove punctuation', () => {
    expect(tokenize('hello, world!')).toEqual(['hello', 'world']);
  });

  it('should filter short words', () => {
    expect(tokenize('a bc def', 2)).toEqual(['bc', 'def']);
    expect(tokenize('a bc def', 3)).toEqual(['def']);
  });

  it('should handle multiple spaces', () => {
    expect(tokenize('hello    world')).toEqual(['hello', 'world']);
  });

  it('should preserve hyphenated words', () => {
    expect(tokenize('well-known fact')).toEqual(['well-known', 'fact']);
  });
});

describe('extractNgrams', () => {
  it('should extract bigrams by default', () => {
    const tokens = ['hello', 'world', 'test'];
    expect(extractNgrams(tokens)).toEqual(['hello world', 'world test']);
  });

  it('should extract trigrams', () => {
    const tokens = ['a', 'b', 'c', 'd'];
    expect(extractNgrams(tokens, 3)).toEqual(['a b c', 'b c d']);
  });

  it('should return empty for insufficient tokens', () => {
    expect(extractNgrams(['hello'], 2)).toEqual([]);
    expect(extractNgrams([], 2)).toEqual([]);
  });

  it('should handle exact n tokens', () => {
    expect(extractNgrams(['a', 'b'], 2)).toEqual(['a b']);
  });
});

describe('combinedSimilarity', () => {
  it('should return 1 for identical texts', () => {
    const text = 'hello world test';
    expect(combinedSimilarity(text, text)).toBeCloseTo(1, 5);
  });

  it('should return value between 0 and 1', () => {
    const text1 = 'hello world';
    const text2 = 'hello there';
    const similarity = combinedSimilarity(text1, text2);
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(1);
  });

  it('should use custom weights', () => {
    const text1 = 'hello world';
    const text2 = 'hello there';

    const defaultSim = combinedSimilarity(text1, text2);
    const jaccardHeavy = combinedSimilarity(text1, text2, {
      jaccard: 1,
      tfidf: 0,
      levenshtein: 0,
    });

    // Different weights should give different results
    expect(jaccardHeavy).not.toBeCloseTo(defaultSim, 5);
  });
});

describe('findFuzzyMatches', () => {
  it('should find exact matches', () => {
    const matches = findFuzzyMatches(['hello', 'world'], ['hello', 'there']);
    expect(matches.some((m) => m.item1 === 'hello' && m.item2 === 'hello')).toBe(
      true
    );
  });

  it('should find similar strings above threshold', () => {
    const matches = findFuzzyMatches(['kitten'], ['sitting'], 0.5);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.similarity).toBeGreaterThanOrEqual(0.5);
  });

  it('should respect threshold', () => {
    const lowThreshold = findFuzzyMatches(['abc'], ['xyz'], 0.1);
    const highThreshold = findFuzzyMatches(['abc'], ['xyz'], 0.9);

    // Low threshold might match, high threshold won't
    expect(highThreshold.length).toBe(0);
  });

  it('should sort by similarity descending', () => {
    const matches = findFuzzyMatches(
      ['cat', 'hat', 'bat'],
      ['cat', 'rat'],
      0.5
    );
    for (let i = 0; i < matches.length - 1; i++) {
      expect(matches[i]!.similarity).toBeGreaterThanOrEqual(
        matches[i + 1]!.similarity
      );
    }
  });

  it('should be case insensitive', () => {
    const matches = findFuzzyMatches(['HELLO'], ['hello']);
    expect(matches[0]?.similarity).toBe(1);
  });

  it('should handle empty arrays', () => {
    expect(findFuzzyMatches([], ['hello'])).toEqual([]);
    expect(findFuzzyMatches(['hello'], [])).toEqual([]);
  });
});
