import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SESSION_STATE } from '../domain/defaults';
import type { SessionBroadcastMessage, SessionState } from '../domain/sessionTypes';
import { renderWithI18n } from '../test/render';
import { ClientSessionPage } from './ClientSessionPage';

const mocks = vi.hoisted(() => ({
  getBlsSession: vi.fn(),
  send: vi.fn(),
  requestJoyConDevices: vi.fn(),
  refreshJoyConDevices: vi.fn(),
  testJoyConPulse: vi.fn(),
  neutralJoyCon: vi.fn(),
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

vi.mock('../hooks/useJoyConTactileOutput', () => ({
  useJoyConTactileOutput: () => ({
    lastPulseSide: null,
    lastPulseAt: null,
    pulseCount: 0,
    lastError: null,
    skippedPulseCount: 0,
  }),
}));

vi.mock('../hooks/useJoyConWebHid', () => ({
  useJoyConWebHid: () => ({
    supported: true,
    requesting: false,
    devices: [{ side: 'left', product: 'Joy-Con (L)' }],
    leftConnected: true,
    rightConnected: false,
    error: null,
    requestDevices: mocks.requestJoyConDevices,
    refresh: mocks.refreshJoyConDevices,
    testPulse: mocks.testJoyConPulse,
    neutral: mocks.neutralJoyCon,
  }),
}));

vi.mock('../components/StimulusStage', () => ({
  StimulusStage: ({ state }: { state: SessionState }) => <div>stage {state.status}</div>,
}));

function setFullscreenElement(element: Element | null) {
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => element,
  });

  document.dispatchEvent(new Event('fullscreenchange'));
}

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
    mocks.requestJoyConDevices.mockReset().mockResolvedValue(undefined);
    mocks.refreshJoyConDevices.mockReset().mockResolvedValue(undefined);
    mocks.testJoyConPulse.mockReset().mockResolvedValue(undefined);
    mocks.neutralJoyCon.mockReset().mockResolvedValue(undefined);
    mocks.onMessage = null;
    setFullscreenElement(null);
  });

  it('shows an error when the client token is missing', () => {
    renderWithI18n(<ClientSessionPage sessionId="session-id" />);

    expect(screen.getByText('Missing participant token in the URL.')).toBeInTheDocument();
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
    expect(mocks.send).toHaveBeenCalledWith({
      kind: 'JOYCON_STATUS',
      status: expect.objectContaining({ leftConnected: true, rightConnected: false }),
      emittedAtMs: expect.any(Number),
    });

    act(() => {
      mocks.onMessage?.({ kind: 'STATE_UPDATED', state: makeState({ status: 'running' }), emittedAtMs: 1 });
    });

    expect(screen.getByText('stage running')).toBeInTheDocument();
  });

  it('unlocks audio without exposing tactile setup controls', async () => {
    mocks.getBlsSession.mockResolvedValue({ state: makeState() });

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client token" />);

    expect(await screen.findByRole('button', { name: 'Enable audio' })).toBeInTheDocument();
    expect(screen.getByText('The browser requires a user gesture to allow stereo audio.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enter and enable audio' }));
    expect(screen.getByRole('button', { name: 'Audio enabled' })).toBeInTheDocument();
    expect(screen.queryByText('The browser requires a user gesture to allow stereo audio.')).not.toBeInTheDocument();
    expect(screen.queryByText('/session/session-id/tactile/left')).not.toBeInTheDocument();
  });

  it('shows Joy-Con connection controls on the participant view when tactile output is enabled', async () => {
    mocks.getBlsSession.mockResolvedValue({ state: makeState({ tactile: { ...DEFAULT_SESSION_STATE.tactile, enabled: true } }) });

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Expand tactile panel' }));
    expect(screen.getByRole('button', { name: 'Add Joy-Cons' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Joy-Cons' }));

    expect(mocks.requestJoyConDevices).toHaveBeenCalledTimes(1);
  });

  it('shows only an exit control while the client view is fullscreen', async () => {
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreen,
    });
    mocks.getBlsSession.mockResolvedValue({ state: makeState() });

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);

    expect(await screen.findByText('stage idle')).toBeInTheDocument();

    act(() => {
      setFullscreenElement(document.documentElement);
    });

    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fullscreen' })).not.toBeInTheDocument();
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    expect(screen.queryByText('The browser requires a user gesture to allow stereo audio.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' }));

    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it('shows the ended-session view when the controller broadcasts the end', async () => {
    mocks.getBlsSession.mockResolvedValue({ state: makeState() });

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);
    expect(await screen.findByText('stage idle')).toBeInTheDocument();

    act(() => {
      mocks.onMessage?.({ kind: 'SESSION_ENDED', emittedAtMs: 1 });
    });

    expect(screen.getByText('Session ended')).toBeInTheDocument();
    expect(screen.getByText('The controller has ended this session.')).toBeInTheDocument();
  });

  it('surfaces session loading errors', async () => {
    mocks.getBlsSession.mockRejectedValue(new Error('bad token'));

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);

    expect(await screen.findByText('bad token')).toBeInTheDocument();
  });
});
