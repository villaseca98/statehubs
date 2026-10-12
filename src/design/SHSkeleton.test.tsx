import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SHSkeleton } from './SHSkeleton';
describe('SHSkeleton', () => {
  it('is decorative and respects size and shape', () => {
    const { container } = render(<SHSkeleton data-testid="skeleton" width={160} height={24} rounded="full" />);
    const element = screen.getByTestId('skeleton');
    expect(element).toHaveAttribute('aria-hidden', 'true');
    expect(element).toHaveClass('sh-skeleton', 'rounded-full');
    expect(element).toHaveStyle({ width: '160px', height: '24px' });
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
  });
});
