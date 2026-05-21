import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SESSION_STATE } from '../domain/defaults';
import type { SessionBroadcastMessage, SessionState } from '../domain/sessionTypes';
import { renderWithI18n } from '../test/render';
import { ClientSessionPage } from './ClientSessionPage';

const mocks = vi.hoisted(() => ({
  getBlsSession: vi.fn(),
  send: vi.fn(),
  onMessage: null as ((message: SessionBroadcastMessage) => void) | null,
}));

vi.mock('../lib/sessionApi', () => ({
  getBlsSession: mocks.getBlsSession,
}));

vi.mock('../hooks/useServerClock', () => ({
  useServerClock: () => ({ offsetMs: 0, isSynced: true, error: null, sync: vi.fn() }),
}));

vi.mock('../hooks/useSessionRealtime', () => ({
  useSessionRealtime: ({ onMessage }: { onMessage: (message: SessionBroadcastMessage) => void }) => {
    mocks.onMessage = onMessage;
    return { status: 'connected', send: mocks.send };
  },
}));

vi.mock('../hooks/useAudioBls', () => ({
  useAudioBls: vi.fn(),
}));

vi.mock('../components/StimulusStage', () => ({
  StimulusStage: ({ state }: { state: SessionState }) => <div>stage {state.status}</div>,
}));

vi.mock('../components/QRCodeCard', () => ({
  QRCodeCard: ({ title, url, helper }: { title: string; url: string; helper: string }) => (
    <article>
      <h3>{title}</h3>
      <code>{url}</code>
      <p>{helper}</p>
    </article>
  ),
}));

function makeState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    ...DEFAULT_SESSION_STATE,
    visual: { ...DEFAULT_SESSION_STATE.visual },
    audio: { ...DEFAULT_SESSION_STATE.audio, enabled: true },
    tactile: { ...DEFAULT_SESSION_STATE.tactile },
    ...overrides,
  };
}

describe('ClientSessionPage', () => {
  beforeEach(() => {
    mocks.getBlsSession.mockReset();
    mocks.send.mockReset().mockResolvedValue(undefined);
    mocks.onMessage = null;
  });

  it('shows an error when the client token is missing', () => {
    renderWithI18n(<ClientSessionPage sessionId="session-id" />);

    expect(screen.getByText('Missing client token in the URL.')).toBeInTheDocument();
  });

  it('loads the session, announces client readiness, and handles state updates', async () => {
    mocks.getBlsSession.mockResolvedValue({ state: makeState({ status: 'idle' }) });

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);

    expect(await screen.findByText('stage idle')).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith({
        kind: 'CLIENT_READY',
        emittedAtMs: expect.any(Number),
      }),
    );

    act(() => {
      mocks.onMessage?.({ kind: 'STATE_UPDATED', state: makeState({ status: 'running' }), emittedAtMs: 1 });
    });

    expect(screen.getByText('stage running')).toBeInTheDocument();
  });

  it('unlocks audio and toggles tactile pairing QR links', async () => {
    mocks.getBlsSession.mockResolvedValue({ state: makeState() });

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client token" />);

    expect(await screen.findByRole('button', { name: 'Enable audio' })).toBeInTheDocument();
    expect(screen.getByText('The browser requires a user gesture to allow stereo audio.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enter and enable audio' }));
    expect(screen.getByRole('button', { name: 'Audio enabled' })).toBeInTheDocument();
    expect(screen.queryByText('The browser requires a user gesture to allow stereo audio.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tactile QR' }));

    expect(screen.getByText('Pair tactile phones')).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/session/session-id/tactile/left?t=client%20token`)).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/session/session-id/tactile/right?t=client%20token`)).toBeInTheDocument();
  });

  it('shows the ended-session view when the therapist broadcasts the end', async () => {
    mocks.getBlsSession.mockResolvedValue({ state: makeState() });

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);
    expect(await screen.findByText('stage idle')).toBeInTheDocument();

    act(() => {
      mocks.onMessage?.({ kind: 'SESSION_ENDED', emittedAtMs: 1 });
    });

    expect(screen.getByText('Session ended')).toBeInTheDocument();
    expect(screen.getByText('The therapist has ended this session.')).toBeInTheDocument();
  });

  it('surfaces session loading errors', async () => {
    mocks.getBlsSession.mockRejectedValue(new Error('bad token'));

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);

    expect(await screen.findByText('bad token')).toBeInTheDocument();
  });
});
