import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import RollBubble from './RollBubble.svelte';

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    x: 100,
    y: 200,
    total: '17',
    detail: '',
    tone: 'normal' as const,
    badge: '',
    ...overrides
  };
}

describe('RollBubble', () => {
  test('renders the total in the status region', () => {
    render(RollBubble, { props: baseProps({ total: '22' }) });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('22');
  });

  test('uses aria-live=polite for screen-reader-friendly announcements', () => {
    render(RollBubble, { props: baseProps() });
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  test('positions itself using the x/y props as inline left/top pixels', () => {
    render(RollBubble, { props: baseProps({ x: 250, y: 80 }) });
    const status = screen.getByRole('status');
    expect(status.getAttribute('style')).toContain('left: 250px');
    expect(status.getAttribute('style')).toContain('top: 80px');
  });

  test('renders the detail text when provided', () => {
    render(RollBubble, { props: baseProps({ detail: '1d20+7=17' }) });
    expect(screen.getByText('1d20+7=17')).toBeInTheDocument();
  });

  test('omits the detail span when detail is empty', () => {
    const { container } = render(RollBubble, { props: baseProps({ detail: '' }) });
    expect(container.querySelector('.bubble__detail')).toBeNull();
  });

  test('renders the badge text when provided', () => {
    render(RollBubble, { props: baseProps({ badge: 'STRIKE' }) });
    expect(screen.getByText('STRIKE')).toBeInTheDocument();
  });

  test('omits the badge span when badge is empty', () => {
    const { container } = render(RollBubble, { props: baseProps({ badge: '' }) });
    expect(container.querySelector('.bubble__badge')).toBeNull();
  });

  test('applies a tone-specific modifier class', () => {
    const { container } = render(RollBubble, { props: baseProps({ tone: 'crit' }) });
    expect(container.querySelector('.bubble--crit')).not.toBeNull();
  });

  test('applies fumble tone class', () => {
    const { container } = render(RollBubble, { props: baseProps({ tone: 'fumble' }) });
    expect(container.querySelector('.bubble--fumble')).not.toBeNull();
  });

  test('applies damage tone class', () => {
    const { container } = render(RollBubble, { props: baseProps({ tone: 'damage' }) });
    expect(container.querySelector('.bubble--damage')).not.toBeNull();
  });
});
