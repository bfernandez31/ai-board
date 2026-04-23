import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { LogPreview } from '@/components/logs/log-preview';

describe('LogPreview', () => {
  it('renders error summary for FAILED status', () => {
    renderWithProviders(
      <LogPreview logStatus="AVAILABLE" logSummary="Error: Type mismatch in src/index.ts" jobStatus="FAILED" />
    );

    const element = screen.getByText(/Error: Type mismatch/);
    expect(element).toBeDefined();
    expect(element.className).toContain('text-red-500');
  });

  it('renders milestone summary for COMPLETED status', () => {
    renderWithProviders(
      <LogPreview logStatus="AVAILABLE" logSummary="Completed: 5 tool invocations. All tests pass." jobStatus="COMPLETED" />
    );

    const element = screen.getByText(/5 tool invocations/);
    expect(element).toBeDefined();
    expect(element.className).toContain('text-muted-foreground');
  });

  it('renders "Logs expired" for PRUNED status', () => {
    renderWithProviders(
      <LogPreview logStatus="PRUNED" logSummary={null} jobStatus="FAILED" />
    );

    expect(screen.getByText(/Logs expired/)).toBeDefined();
  });

  it('renders nothing for NONE status', () => {
    const { container } = renderWithProviders(
      <LogPreview logStatus="NONE" logSummary={null} jobStatus="COMPLETED" />
    );

    expect(container.textContent).toBe('');
  });

  it('renders nothing when logSummary is null and status is AVAILABLE', () => {
    const { container } = renderWithProviders(
      <LogPreview logStatus="AVAILABLE" logSummary={null} jobStatus="COMPLETED" />
    );

    expect(container.textContent).toBe('');
  });
});
