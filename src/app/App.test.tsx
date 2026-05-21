import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';
import App from './App';

vi.mock('../pages/LandingPage', () => ({
  LandingPage: () => <main>landing page</main>,
}));

vi.mock('../pages/TherapistSessionPage', () => ({
  TherapistSessionPage: ({ sessionId, token }: { sessionId: string; token?: string }) => (
    <main>
      therapist page {sessionId} {token}
    </main>
  ),
}));

vi.mock('../pages/ClientSessionPage', () => ({
  ClientSessionPage: ({ sessionId, token }: { sessionId: string; token?: string }) => (
    <main>
      client page {sessionId} {token}
    </main>
  ),
}));

describe('App routing', () => {
  it('renders the landing page with support widget at the root route', () => {
    window.history.replaceState({}, '', '/');

    renderWithI18n(<App />);

    expect(screen.getByText('landing page')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Leave an optional tip to support independent development' })).toBeInTheDocument();
  });

  it('renders therapist and client routes from the current URL', () => {
    window.history.replaceState({}, '', '/session/s1/therapist?t=tt');
    const { unmount } = renderWithI18n(<App />);
    expect(screen.getByText('therapist page s1 tt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Leave an optional tip to support independent development' })).toBeInTheDocument();
    unmount();

    window.history.replaceState({}, '', '/session/s2/client?t=ct');
    const client = renderWithI18n(<App />);
    expect(screen.getByText('client page s2 ct')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Leave an optional tip to support independent development' })).not.toBeInTheDocument();
    client.unmount();

    window.history.replaceState({}, '', '/session/s3/tactile/right?t=ct');
    renderWithI18n(<App />);
    expect(screen.getByText('Route not found')).toBeInTheDocument();
  });

  it('renders not found routes and updates on popstate', () => {
    window.history.replaceState({}, '', '/missing');
    renderWithI18n(<App />);

    expect(screen.getByText('Route not found')).toBeInTheDocument();

    act(() => {
      window.history.pushState({}, '', '/session/s4/client?t=ct');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByText('client page s4 ct')).toBeInTheDocument();
  });
});
