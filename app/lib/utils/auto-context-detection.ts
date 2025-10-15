/**
 * AUTO Policy Context Detection
 * Analyzes feature descriptions to determine appropriate clarification policy
 */

export interface ContextSignal {
  bucket: 'SENSITIVE' | 'INTERNAL' | 'SCALABILITY';
  weight: number;
  keywords: string[];
}

export interface DetectionResult {
  selectedPolicy: 'CONSERVATIVE' | 'PRAGMATIC';
  confidence: number;
  detectedKeywords: { bucket: string; keyword: string }[];
  fallbackTriggered: boolean;
  reason?: string;
}

/**
 * Signal definitions for AUTO policy context detection
 * Weights determine how strongly each signal influences the decision
 */
export const SIGNAL_DEFINITIONS: ContextSignal[] = [
  {
    bucket: 'SENSITIVE',
    weight: 3,
    keywords: [
      // Security
      'payment', 'financial', 'bank', 'transaction', 'credit card', 'stripe',
      'auth', 'login', 'password', 'security', 'encryption',
      // Data privacy
      'personal data', 'pii', 'sensitive', 'gdpr', 'hipaa',
      // Compliance
      'pci-dss', 'soc2', 'audit', 'compliance', 'regulatory',
    ],
  },
  {
    bucket: 'INTERNAL',
    weight: -2,
    keywords: [
      'admin', 'internal', 'tool', 'debug', 'logging',
      'prototype', 'mvp', 'exploratory', 'temporary',
    ],
  },
  {
    bucket: 'SCALABILITY',
    weight: 2,
    keywords: [
      'millions of users', 'high traffic', 'mission critical',
      'sla', 'uptime', 'availability',
    ],
  },
];

/**
 * Detect appropriate policy for AUTO mode based on feature description
 * Uses keyword matching, confidence scoring, and fallback logic
 *
 * @param featureDescription - Feature description to analyze
 * @returns Detection result with selected policy and confidence
 */
export function detectAutoPolicy(featureDescription: string): DetectionResult {
  const lowerDesc = featureDescription.toLowerCase();
  const detectedKeywords: { bucket: string; keyword: string }[] = [];
  let netScore = 0;
  const activeBuckets = new Set<string>();

  // Scan for keywords across all signal definitions
  for (const signal of SIGNAL_DEFINITIONS) {
    for (const keyword of signal.keywords) {
      if (lowerDesc.includes(keyword.toLowerCase())) {
        detectedKeywords.push({ bucket: signal.bucket, keyword });
        netScore += signal.weight;
        activeBuckets.add(signal.bucket);
      }
    }
  }

  // Compute confidence based on absolute score and bucket purity
  const absScore = Math.abs(netScore);
  const bucketCount = activeBuckets.size;
  let confidence: number;

  if (absScore >= 5 && bucketCount <= 1) {
    confidence = 0.9; // High confidence, single clear signal
  } else if (absScore >= 3 && bucketCount <= 2) {
    confidence = 0.6; // Medium confidence
  } else {
    confidence = 0.3; // Low confidence
  }

  // Apply fallback logic for low confidence or conflicting signals
  let fallbackTriggered = false;
  let reason: string | undefined;

  // Fallback: Conflicting signals (SENSITIVE + INTERNAL) - Check first for explicit conflicts
  if (bucketCount >= 2 && activeBuckets.has('SENSITIVE') && activeBuckets.has('INTERNAL')) {
    fallbackTriggered = true;
    reason = 'Conflicting signals (SENSITIVE + INTERNAL)';
    return {
      selectedPolicy: 'CONSERVATIVE',
      confidence,
      detectedKeywords,
      fallbackTriggered,
      reason,
    };
  }

  // Fallback: Low confidence
  if (confidence < 0.5) {
    fallbackTriggered = true;
    reason = 'Low confidence score';
    return {
      selectedPolicy: 'CONSERVATIVE',
      confidence,
      detectedKeywords,
      fallbackTriggered,
      reason,
    };
  }

  // Select policy based on net score (positive = CONSERVATIVE, negative = PRAGMATIC)
  const selectedPolicy = netScore >= 0 ? 'CONSERVATIVE' : 'PRAGMATIC';

  return {
    selectedPolicy,
    confidence,
    detectedKeywords,
    fallbackTriggered,
  };
}

/**
 * Get human-readable explanation of detection result
 * Useful for logging and Auto-Resolved Decisions section
 *
 * @param result - Detection result
 * @returns Explanation string
 */
export function explainDetectionResult(result: DetectionResult): string {
  const { selectedPolicy, confidence, detectedKeywords, fallbackTriggered, reason } = result;

  let explanation = `Selected policy: ${selectedPolicy}\n`;
  explanation += `Confidence: ${(confidence * 100).toFixed(0)}%\n`;

  if (detectedKeywords.length > 0) {
    explanation += `Detected keywords:\n`;
    const byBucket = detectedKeywords.reduce((acc, kw) => {
      if (!acc[kw.bucket]) acc[kw.bucket] = [];
      acc[kw.bucket]!.push(kw.keyword);
      return acc;
    }, {} as Record<string, string[]>);

    for (const [bucket, keywords] of Object.entries(byBucket)) {
      explanation += `  ${bucket}: ${keywords.join(', ')}\n`;
    }
  } else {
    explanation += `No keywords detected (neutral context)\n`;
  }

  if (fallbackTriggered) {
    explanation += `Fallback triggered: ${reason}\n`;
  }

  return explanation;
}
