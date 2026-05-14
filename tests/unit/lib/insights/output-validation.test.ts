import { describe, it, expect } from 'vitest';
import { validateInsightsOutput } from '@/app/lib/insights/output-validation';

const completeHtml = `
<!DOCTYPE html>
<html><body>
<h1>Claude Code Insights</h1>
<h2>Big Wins</h2><ul><li>...</li></ul>
<h2>Horizon</h2><p>...</p>
<h2>Friction</h2><p>...</p>
<h2>Suggested CLAUDE.md Additions</h2><pre>...</pre>
</body></html>
`;

describe('validateInsightsOutput (AIB-791)', () => {
  it('accepts a complete report with all required markers', () => {
    expect(validateInsightsOutput(completeHtml)).toEqual({ ok: true });
  });

  it('rejects empty input', () => {
    const result = validateInsightsOutput('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/empty/i);
  });

  it('rejects non-HTML input', () => {
    const result = validateInsightsOutput('big wins horizon friction Suggested CLAUDE.md Additions');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not html/i);
  });

  it('rejects when "Suggested CLAUDE.md Additions" is missing', () => {
    const html = completeHtml.replace('Suggested CLAUDE.md Additions', 'Other section');
    const result = validateInsightsOutput(html);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Suggested CLAUDE.md Additions');
  });

  it('rejects when "Big Wins" is missing', () => {
    const html = completeHtml.replace('Big Wins', 'Wins');
    const result = validateInsightsOutput(html);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Big Wins');
  });

  it('rejects when "Horizon" is missing', () => {
    const html = completeHtml.replace('Horizon', 'Future');
    const result = validateInsightsOutput(html);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Horizon');
  });

  it('rejects when no friction-section header is present', () => {
    const html = completeHtml.replace('Friction', 'Misc');
    const result = validateInsightsOutput(html);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/friction/i);
  });

  it('accepts alternate friction header phrasing', () => {
    const html = completeHtml.replace('Friction', 'Pain points');
    expect(validateInsightsOutput(html)).toEqual({ ok: true });
  });
});
