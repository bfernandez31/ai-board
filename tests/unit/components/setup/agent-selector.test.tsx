import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentSelector } from '@/components/setup/agent-selector';

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: { alt: string; [key: string]: unknown }) => {
    const { alt, ...rest } = props;
    return <img alt={alt} {...rest} />;
  },
}));

describe('AgentSelector', () => {
  it('renders both agent options', () => {
    render(<AgentSelector value="CLAUDE" onChange={vi.fn()} />);

    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByText('Codex')).toBeInTheDocument();
  });

  it('shows Claude Code selected by default', () => {
    render(<AgentSelector value="CLAUDE" onChange={vi.fn()} />);

    const claudeRadio = screen.getByRole('radio', { name: /Claude Code/i });
    expect(claudeRadio).toBeChecked();
  });

  it('calls onChange when selection changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AgentSelector value="CLAUDE" onChange={onChange} />);

    const codexRadio = screen.getByRole('radio', { name: /Codex/i });
    await user.click(codexRadio);

    expect(onChange).toHaveBeenCalledWith('CODEX');
  });

  it('disables radio buttons when disabled prop is true', () => {
    render(<AgentSelector value="CLAUDE" onChange={vi.fn()} disabled />);

    const radios = screen.getAllByRole('radio');
    radios.forEach((radio) => {
      expect(radio).toBeDisabled();
    });
  });
});
