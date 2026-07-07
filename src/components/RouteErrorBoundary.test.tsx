import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouteErrorBoundary } from './RouteErrorBoundary';

function Boom(): never {
  throw new Error('chunk load failed');
}

describe('RouteErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders children when they do not throw', () => {
    render(
      <RouteErrorBoundary>
        <div>Profile content</div>
      </RouteErrorBoundary>,
    );
    expect(screen.getByText('Profile content')).toBeInTheDocument();
  });

  it('shows a recoverable fallback instead of a blank screen when a child throws', () => {
    // Silence React's expected error logging for this render.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <RouteErrorBoundary>
        <Boom />
      </RouteErrorBoundary>,
    );
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });
});
