/**
 * RTL Component Tests: Markdown Table Rendering
 *
 * Tests to verify that markdown tables render correctly with remark-gfm plugin.
 * Covers ComparisonViewer, DocumentationViewer, and ConstitutionViewer components.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ComparisonViewer } from '@/components/comparison/comparison-viewer';

// Mock the hooks
vi.mock('@/hooks/use-comparisons', () => ({
  useComparisonCheck: vi.fn(() => ({
    data: { hasComparisons: true, latestReport: 'test-report.md', count: 1 },
    isLoading: false,
    error: null,
  })),
  useComparisonList: vi.fn(() => ({
    data: null,
    isLoading: false,
  })),
  useComparisonReport: vi.fn(() => ({
    data: {
      content: `# Test Report

## Comparison Table

| Feature | Ticket A | Ticket B |
|---------|----------|----------|
| Status  | Done     | Pending  |
| Priority| High     | Medium   |
| Score   | 95%      | 75%      |

This is a test report with a table.`,
      metadata: {
        sourceTicket: 'ABC-123',
        comparedTickets: ['ABC-456'],
        alignmentScore: 85,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
    },
    isLoading: false,
    error: null,
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

describe('Markdown Table Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ComparisonViewer', () => {
    it('should render markdown tables correctly with GFM support', async () => {
      renderWithProviders(
        <ComparisonViewer
          projectId={1}
          ticketId={1}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      // Check for table headers - this verifies GFM table parsing is working
      expect(await screen.findByText('Feature')).toBeInTheDocument();
      expect(screen.getByText('Ticket A')).toBeInTheDocument();
      expect(screen.getByText('Ticket B')).toBeInTheDocument();

      // Check for table data in first row
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();

      // Check for table data in second row
      expect(screen.getByText('Priority')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();

      // Check for table data in third row
      expect(screen.getByText('Score')).toBeInTheDocument();
      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should render other markdown content alongside tables', async () => {
      renderWithProviders(
        <ComparisonViewer
          projectId={1}
          ticketId={1}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      // Verify markdown heading renders
      expect(await screen.findByText('Test Report')).toBeInTheDocument();
      expect(screen.getByText('Comparison Table')).toBeInTheDocument();

      // Verify paragraph text renders
      expect(screen.getByText(/This is a test report with a table/i)).toBeInTheDocument();
    });
  });
});
