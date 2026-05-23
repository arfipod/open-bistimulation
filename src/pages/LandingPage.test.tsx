import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES, DEFAULT_SESSION_STATE } from '../domain/defaults';
import { renderWithI18n } from '../test/render';
import { LandingPage } from './LandingPage';

const mocks = vi.hoisted(() => ({
  configured: true,
  createBlsSession: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  get isSupabaseConfigured() {
    return mocks.configured;
  },
}));

vi.mock('../lib/sessionApi', () => ({
  createBlsSession: mocks.createBlsSession,
}));

describe('LandingPage', () => {
  beforeEach(() => {
    mocks.configured = true;
    mocks.createBlsSession.mockReset();
  });

  it('disables session creation and explains missing Supabase configuration', () => {
    mocks.configured = false;

    renderWithI18n(<LandingPage />);

    expect(screen.getByText(/Supabase environment variables are missing/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create BLS session' })).toBeDisabled();
  });


  it('renders visible public product and legal clarification content', () => {
    renderWithI18n(<LandingPage />);

    expect(screen.getByRole('heading', { name: 'What this tool provides' })).toBeInTheDocument();
    expect(screen.getByText(/Open Bistimulation is free independent software for browser-based bilateral sensory cues/)).toBeInTheDocument();
    expect(screen.getByText(/It is supplied without professional services, medical services, warranties, or outcome guarantees/)).toBeInTheDocument();
  });

  it('creates sessions from local/default preferences and shows backend errors', async () => {
    mocks.createBlsSession.mockRejectedValue(new Error('backend offline'));

    renderWithI18n(<LandingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Create BLS session' }));

    await waitFor(() => expect(screen.getByText('backend offline')).toBeInTheDocument());
    expect(mocks.createBlsSession).toHaveBeenCalledWith(
      {
        ...DEFAULT_SESSION_STATE,
        visual: DEFAULT_PREFERENCES.visual,
        audio: DEFAULT_PREFERENCES.audio,
        tactile: DEFAULT_PREFERENCES.tactile,
      },
      DEFAULT_PREFERENCES,
    );
    expect(screen.getByRole('button', { name: 'Create BLS session' })).toBeEnabled();
  });

  it('surfaces a clear error when the backend omits the controller token', async () => {
    mocks.createBlsSession.mockResolvedValue({
      id: 'session-id',
      role: 'therapist',
      clientToken: 'client-token',
      state: DEFAULT_SESSION_STATE,
      preferences: DEFAULT_PREFERENCES,
      expiresAt: null,
      endedAt: null,
    });

    renderWithI18n(<LandingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Create BLS session' }));

    await waitFor(() => expect(screen.getByText('The backend did not return a controller token.')).toBeInTheDocument());
  });
});
