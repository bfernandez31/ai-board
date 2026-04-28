import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { AnchorCitationList } from '@/components/ticket/anchor-citation-list';

describe('AnchorCitationList', () => {
  it('renders an empty state when there are no anchors', () => {
    renderWithProviders(<AnchorCitationList projectId={1} anchors={[]} />);
    expect(screen.getByTestId('anchor-list-empty')).toBeInTheDocument();
  });

  it('renders a clickable link to the past ticket within current project', () => {
    renderWithProviders(
      <AnchorCitationList
        projectId={7}
        anchors={[
          { ticketId: 100, ticketKey: 'AIB-100', frictionFree: true, qualityScore: 88, overlapStrength: 2, tombstoned: false },
        ]}
      />
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/projects/7/tickets/AIB-100');
  });

  it('shows a "no score" placeholder for null qualityScore', () => {
    renderWithProviders(
      <AnchorCitationList
        projectId={7}
        anchors={[
          { ticketId: 101, ticketKey: 'AIB-101', frictionFree: false, qualityScore: null, overlapStrength: 1, tombstoned: false },
        ]}
      />
    );
    expect(screen.getByText('no score')).toBeInTheDocument();
  });

  it('renders tombstoned anchors as a degraded entry', () => {
    renderWithProviders(
      <AnchorCitationList
        projectId={7}
        anchors={[
          { ticketId: 102, ticketKey: 'AIB-102', frictionFree: false, qualityScore: 50, overlapStrength: 1, tombstoned: true },
        ]}
      />
    );
    const item = screen.getByTestId('anchor-AIB-102');
    expect(item).toHaveAttribute('data-tombstoned', 'true');
    expect(screen.getByText(/ticket no longer available/i)).toBeInTheDocument();
  });

  it('aria-label encodes ticketKey, friction status, and score', () => {
    renderWithProviders(
      <AnchorCitationList
        projectId={7}
        anchors={[
          { ticketId: 103, ticketKey: 'AIB-103', frictionFree: true, qualityScore: 92, overlapStrength: 3, tombstoned: false },
        ]}
      />
    );
    const link = screen.getByRole('link');
    const label = link.getAttribute('aria-label') ?? '';
    expect(label).toContain('AIB-103');
    expect(label).toContain('friction-free');
    expect(label).toContain('92');
  });
});
