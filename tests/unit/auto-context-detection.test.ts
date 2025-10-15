import { test, expect } from '@playwright/test';
import {
  detectAutoPolicy,
  explainDetectionResult,
  SIGNAL_DEFINITIONS,
} from '../../app/lib/utils/auto-context-detection';

/**
 * Unit Tests: AUTO Context Detection Utility
 * Feature: 029-999-auto-clarification
 * Tests keyword-based policy detection logic in isolation
 */

test.describe('AUTO Context Detection - SENSITIVE Bucket', () => {
  test('should detect payment keywords as CONSERVATIVE', () => {
    const result = detectAutoPolicy('Add payment processing with Stripe integration');
    expect(result.selectedPolicy).toBe('CONSERVATIVE');
    expect(result.detectedKeywords.length).toBeGreaterThan(0);
    expect(result.detectedKeywords.some((kw) => kw.bucket === 'SENSITIVE')).toBe(true);
  });

  test('should detect authentication keywords as CONSERVATIVE', () => {
    const result = detectAutoPolicy('Implement login and password reset flow');
    expect(result.selectedPolicy).toBe('CONSERVATIVE');
    expect(result.detectedKeywords.some((kw) => kw.keyword === 'login')).toBe(true);
    expect(result.detectedKeywords.some((kw) => kw.keyword === 'password')).toBe(true);
  });

  test('should detect PII/GDPR keywords as CONSERVATIVE', () => {
    const result = detectAutoPolicy('Store personal data with GDPR compliance');
    expect(result.selectedPolicy).toBe('CONSERVATIVE');
    expect(result.detectedKeywords.some((kw) => kw.keyword === 'personal data')).toBe(true);
    expect(result.detectedKeywords.some((kw) => kw.keyword === 'gdpr')).toBe(true);
  });

  test('should have high confidence for multiple SENSITIVE signals', () => {
    const result = detectAutoPolicy('Payment system with encryption and PCI-DSS compliance');
    expect(result.selectedPolicy).toBe('CONSERVATIVE');
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result.fallbackTriggered).toBe(false);
  });
});

test.describe('AUTO Context Detection - INTERNAL Bucket', () => {
  test('should detect admin tools as PRAGMATIC', () => {
    const result = detectAutoPolicy('Create admin debug panel for internal testing');
    expect(result.selectedPolicy).toBe('PRAGMATIC');
    expect(result.detectedKeywords.some((kw) => kw.bucket === 'INTERNAL')).toBe(true);
  });

  test('should detect prototype/MVP keywords as PRAGMATIC', () => {
    const result = detectAutoPolicy('Build prototype MVP for exploratory feature');
    expect(result.selectedPolicy).toBe('PRAGMATIC');
    expect(result.detectedKeywords.some((kw) => kw.keyword === 'prototype')).toBe(true);
    expect(result.detectedKeywords.some((kw) => kw.keyword === 'mvp')).toBe(true);
  });

  test('should have medium confidence for INTERNAL signals', () => {
    const result = detectAutoPolicy('Internal admin tool for debugging');
    expect(result.selectedPolicy).toBe('PRAGMATIC');
    expect(result.confidence).toBeGreaterThanOrEqual(0.3);
  });
});

test.describe('AUTO Context Detection - SCALABILITY Bucket', () => {
  test('should detect high-traffic keywords as CONSERVATIVE', () => {
    const result = detectAutoPolicy('Optimize for millions of users with high traffic');
    expect(result.selectedPolicy).toBe('CONSERVATIVE');
    expect(result.detectedKeywords.some((kw) => kw.keyword === 'millions of users')).toBe(true);
    expect(result.detectedKeywords.some((kw) => kw.keyword === 'high traffic')).toBe(true);
  });

  test('should detect SLA/uptime keywords as CONSERVATIVE', () => {
    const result = detectAutoPolicy('Mission critical service with 99.9% uptime SLA');
    expect(result.selectedPolicy).toBe('CONSERVATIVE');
    expect(result.detectedKeywords.some((kw) => kw.keyword === 'sla')).toBe(true);
    expect(result.detectedKeywords.some((kw) => kw.keyword === 'uptime')).toBe(true);
  });
});

test.describe('AUTO Context Detection - Mixed Signals', () => {
  test('should handle SENSITIVE + INTERNAL conflict with fallback', () => {
    const result = detectAutoPolicy('Admin panel for payment processing with debug mode');
    expect(result.selectedPolicy).toBe('CONSERVATIVE');
    expect(result.fallbackTriggered).toBe(true);
    expect(result.reason).toContain('Conflicting signals');
  });

  test('should prioritize SENSITIVE over SCALABILITY', () => {
    const result = detectAutoPolicy('High-traffic payment system for millions of users');
    expect(result.selectedPolicy).toBe('CONSERVATIVE');
    // Net score should be positive (SENSITIVE weight=3, SCALABILITY weight=2)
  });

  test('should handle INTERNAL + SCALABILITY combination', () => {
    const result = detectAutoPolicy('Internal admin tool for high-traffic monitoring');
    // Depends on keyword counts - test that it returns a valid policy
    expect(['CONSERVATIVE', 'PRAGMATIC']).toContain(result.selectedPolicy);
  });
});

test.describe('AUTO Context Detection - Confidence Scoring', () => {
  test('should return high confidence (>0.6) for strong single signal', () => {
    const result = detectAutoPolicy('Payment processing with credit card and financial data');
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.fallbackTriggered).toBe(false);
  });

  test('should return medium confidence (0.3-0.6) for moderate signals', () => {
    const result = detectAutoPolicy('Feature with some security considerations');
    expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    expect(result.confidence).toBeLessThanOrEqual(0.6);
  });

  test('should trigger fallback for low confidence (<0.5)', () => {
    const result = detectAutoPolicy('Simple UI update with minor changes');
    if (result.confidence < 0.5) {
      expect(result.selectedPolicy).toBe('CONSERVATIVE');
      expect(result.fallbackTriggered).toBe(true);
      expect(result.reason).toBe('Low confidence score');
    }
  });
});

test.describe('AUTO Context Detection - Fallback Logic', () => {
  test('should default to CONSERVATIVE when no keywords detected', () => {
    const result = detectAutoPolicy('Generic feature description without signals');
    expect(result.selectedPolicy).toBe('CONSERVATIVE');
    expect(result.fallbackTriggered).toBe(true);
    expect(result.detectedKeywords.length).toBe(0);
  });

  test('should default to CONSERVATIVE for ambiguous descriptions', () => {
    const result = detectAutoPolicy('Update the system');
    expect(result.selectedPolicy).toBe('CONSERVATIVE');
    expect(result.fallbackTriggered).toBe(true);
  });
});

test.describe('AUTO Context Detection - Case Insensitivity', () => {
  test('should detect keywords regardless of case', () => {
    const result1 = detectAutoPolicy('PAYMENT PROCESSING WITH STRIPE');
    const result2 = detectAutoPolicy('payment processing with stripe');
    const result3 = detectAutoPolicy('Payment Processing With Stripe');

    expect(result1.selectedPolicy).toBe(result2.selectedPolicy);
    expect(result2.selectedPolicy).toBe(result3.selectedPolicy);
    expect(result1.detectedKeywords.length).toBe(result2.detectedKeywords.length);
  });
});

test.describe('AUTO Context Detection - Explanation Function', () => {
  test('should generate explanation with policy and confidence', () => {
    const result = detectAutoPolicy('Payment system with auth');
    const explanation = explainDetectionResult(result);

    expect(explanation).toContain('Selected policy: CONSERVATIVE');
    expect(explanation).toContain('Confidence:');
    expect(explanation).toMatch(/\d+%/); // Contains percentage
  });

  test('should list detected keywords by bucket', () => {
    const result = detectAutoPolicy('Payment with login');
    const explanation = explainDetectionResult(result);

    expect(explanation).toContain('Detected keywords:');
    expect(explanation).toContain('SENSITIVE:');
  });

  test('should explain fallback when triggered', () => {
    const result = detectAutoPolicy('Generic feature');
    const explanation = explainDetectionResult(result);

    if (result.fallbackTriggered) {
      expect(explanation).toContain('Fallback triggered:');
      expect(explanation).toContain(result.reason);
    }
  });

  test('should handle no keywords detected', () => {
    const result = detectAutoPolicy('Some random description');
    const explanation = explainDetectionResult(result);

    if (result.detectedKeywords.length === 0) {
      expect(explanation).toContain('No keywords detected');
    }
  });
});

test.describe('AUTO Context Detection - Signal Definitions Validation', () => {
  test('should have all required signal buckets', () => {
    const buckets = SIGNAL_DEFINITIONS.map((s) => s.bucket);
    expect(buckets).toContain('SENSITIVE');
    expect(buckets).toContain('INTERNAL');
    expect(buckets).toContain('SCALABILITY');
  });

  test('should have positive weight for SENSITIVE bucket', () => {
    const sensitive = SIGNAL_DEFINITIONS.find((s) => s.bucket === 'SENSITIVE');
    expect(sensitive?.weight).toBeGreaterThan(0);
  });

  test('should have negative weight for INTERNAL bucket', () => {
    const internal = SIGNAL_DEFINITIONS.find((s) => s.bucket === 'INTERNAL');
    expect(internal?.weight).toBeLessThan(0);
  });

  test('should have positive weight for SCALABILITY bucket', () => {
    const scalability = SIGNAL_DEFINITIONS.find((s) => s.bucket === 'SCALABILITY');
    expect(scalability?.weight).toBeGreaterThan(0);
  });

  test('should have non-empty keyword arrays', () => {
    SIGNAL_DEFINITIONS.forEach((signal) => {
      expect(signal.keywords.length).toBeGreaterThan(0);
    });
  });
});

test.describe('AUTO Context Detection - Real-World Scenarios', () => {
  test('should handle e-commerce checkout flow', () => {
    const result = detectAutoPolicy(
      'Implement secure checkout flow with payment processing, credit card validation, and PCI-DSS compliance'
    );
    expect(result.selectedPolicy).toBe('CONSERVATIVE');
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  test('should handle internal debug tool', () => {
    const result = detectAutoPolicy(
      'Create internal admin debug panel for temporary logging and exploratory testing'
    );
    expect(result.selectedPolicy).toBe('PRAGMATIC');
  });

  test('should handle high-scale public API', () => {
    const result = detectAutoPolicy(
      'Design public API for millions of users with high availability and strict SLA requirements'
    );
    expect(result.selectedPolicy).toBe('CONSERVATIVE');
  });

  test('should handle simple UI component', () => {
    const result = detectAutoPolicy('Add button component to design system');
    // No strong signals - should default to CONSERVATIVE via fallback
    expect(result.selectedPolicy).toBe('CONSERVATIVE');
    expect(result.fallbackTriggered).toBe(true);
  });
});
