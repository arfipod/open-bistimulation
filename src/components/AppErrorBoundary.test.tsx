import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';
import { AppErrorBoundary } from './AppErrorBoundary';

function BrokenView(): never {
  throw new Error('render failed');
}

describe('AppErrorBoundary', () => {
  it('replaces a crashed route with a safe recovery view', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderWithI18n(
      <AppErrorBoundary>
        <BrokenView />
      </AppErrorBoundary>,
    );

    expect(screen.getByText('The app hit an unexpected problem')).toBeInTheDocument();
    expect(screen.getByText('Output has been stopped. Return home and open the session link again.')).toBeInTheDocument();
  });
});
