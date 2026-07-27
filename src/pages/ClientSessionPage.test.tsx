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
  audioUnlocked: false,
  clockSynced: true,
  clockError: null as string | null,
  realtimeStatus: 'connected',
  connectionEpoch: 1,
  joyConLeftConnected: true,
  joyConRightConnected: false,
  outputStates: [] as SessionState[],
  tactileEnabledFlags: [] as boolean[],
  onMessage: null as ((message: SessionBroadcastMessage) => void) | null,
  onTherapistPresenceChange: null as ((connected: boolean) => void) | null,
}));

vi.mock('../lib/sessionApi', () => ({
  getBlsSession: mocks.getBlsSession,
}));

vi.mock('../hooks/useServerClock', () => ({
  useServerClock: () => ({
    offsetMs: 0,
    isSynced: mocks.clockSynced,
    error: mocks.clockError,
    sync: vi.fn(),
  }),
}));

vi.mock('../hooks/useSessionRealtime', () => ({
  useSessionRealtime: ({
    onMessage,
    onTherapistPresenceChange,
  }: {
    onMessage: (message: SessionBroadcastMessage) => void;
    onTherapistPresenceChange?: (connected: boolean) => void;
  }) => {
    mocks.onMessage = onMessage;
    mocks.onTherapistPresenceChange = onTherapistPresenceChange ?? null;
    return { status: mocks.realtimeStatus, connectionEpoch: mocks.connectionEpoch, send: mocks.send };
  },
}));

vi.mock('../hooks/useAudioBls', () => ({
  useAudioBls: vi.fn(() => ({
    error: null,
    isUnlocked: mocks.audioUnlocked,
    unlock: vi.fn().mockImplementation(async () => {
      mocks.audioUnlocked = true;
      return true;
    }),
  })),
}));

vi.mock('../hooks/useJoyConTactileOutput', () => ({
  useJoyConTactileOutput: ({ state, enabled }: { state: SessionState; enabled: boolean }) => {
    mocks.outputStates.push(state);
    mocks.tactileEnabledFlags.push(enabled);
    return {
      lastPulseSide: null,
      lastPulseAt: null,
      pulseCount: 0,
      lastError: null,
      skippedPulseCount: 0,
    };
  },
}));

vi.mock('../hooks/useJoyConWebHid', () => ({
  useJoyConWebHid: () => ({
    supported: true,
    requesting: false,
    devices: [{ side: 'left', product: 'Joy-Con (L)' }],
    leftConnected: mocks.joyConLeftConnected,
    rightConnected: mocks.joyConRightConnected,
    error: null,
    requestDevices: mocks.requestJoyConDevices,
    refresh: mocks.refreshJoyConDevices,
    testPulse: mocks.testJoyConPulse,
    neutral: mocks.neutralJoyCon,
  }),
}));

vi.mock('../components/StimulusStage', () => ({
  StimulusStage: ({ state }: { state: SessionState }) => (
    <div>
      <span>stage {state.status}</span>
      <span>visual {state.visual.enabled ? 'on' : 'off'}</span>
    </div>
  ),
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

function makeSession(
  state: SessionState,
  therapistHeartbeatAt = new Date(Date.now()).toISOString(),
) {
  return { role: 'client' as const, state, endedAt: null, therapistHeartbeatAt };
}

async function establishTherapistPresence() {
  await waitFor(() => expect(mocks.getBlsSession.mock.calls.length).toBeGreaterThanOrEqual(2));
  act(() => {
    mocks.onTherapistPresenceChange?.(true);
  });
}

function joyConStatusMessages() {
  return mocks.send.mock.calls.filter(([message]) => message.kind === 'JOYCON_STATUS');
}

describe('ClientSessionPage', () => {
  beforeEach(() => {
    mocks.getBlsSession.mockReset();
    mocks.send.mockReset().mockResolvedValue(undefined);
    mocks.requestJoyConDevices.mockReset().mockResolvedValue(undefined);
    mocks.refreshJoyConDevices.mockReset().mockResolvedValue(undefined);
    mocks.testJoyConPulse.mockReset().mockResolvedValue(undefined);
    mocks.neutralJoyCon.mockReset().mockResolvedValue(undefined);
    mocks.audioUnlocked = false;
    mocks.clockSynced = true;
    mocks.clockError = null;
    mocks.realtimeStatus = 'connected';
    mocks.connectionEpoch = 1;
    mocks.joyConLeftConnected = true;
    mocks.joyConRightConnected = false;
    mocks.outputStates = [];
    mocks.tactileEnabledFlags = [];
    mocks.onMessage = null;
    mocks.onTherapistPresenceChange = null;
    setFullscreenElement(null);
  });

  it('shows an error when the client token is missing', () => {
    renderWithI18n(<ClientSessionPage sessionId="session-id" />);

    expect(screen.getByText('Missing participant token in the URL.')).toBeInTheDocument();
  });

  it('loads the session, announces client readiness, and handles state updates', async () => {
    const audioDisabled = { ...DEFAULT_SESSION_STATE.audio, enabled: false };
    mocks.getBlsSession.mockResolvedValue(
      makeSession(makeState({ status: 'idle', audio: audioDisabled })),
    );

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);

    await establishTherapistPresence();
    expect(await screen.findByText('stage idle')).toBeInTheDocument();
    expect(screen.getByText('visual off')).toBeInTheDocument();
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

    mocks.getBlsSession.mockResolvedValue(
      makeSession(makeState({ status: 'running', audio: audioDisabled })),
    );
    act(() => {
      mocks.onMessage?.({
        kind: 'STATE_UPDATED',
        state: makeState({ status: 'running', audio: audioDisabled }),
        emittedAtMs: 1,
      });
    });

    expect(await screen.findByText('stage running')).toBeInTheDocument();
    expect(screen.getByText('visual on')).toBeInTheDocument();
  });

  it('shows participant visual output only while running or completing a graceful stop', async () => {
    const audioDisabled = { ...DEFAULT_SESSION_STATE.audio, enabled: false };
    mocks.getBlsSession.mockResolvedValue(
      makeSession(makeState({ status: 'running', audio: audioDisabled })),
    );

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);
    await establishTherapistPresence();
    expect(await screen.findByText('visual on')).toBeInTheDocument();

    mocks.getBlsSession.mockResolvedValue(
      makeSession(makeState({ status: 'paused', audio: audioDisabled })),
    );
    act(() => {
      mocks.onMessage?.({
        kind: 'STATE_UPDATED',
        state: makeState({ status: 'paused', audio: audioDisabled }),
        emittedAtMs: 1,
      });
    });
    expect(await screen.findByText('stage paused')).toBeInTheDocument();
    expect(screen.getByText('visual off')).toBeInTheDocument();

    mocks.getBlsSession.mockResolvedValue(
      makeSession(makeState({ status: 'stopped', audio: audioDisabled })),
    );
    act(() => {
      mocks.onMessage?.({
        kind: 'STATE_UPDATED',
        state: makeState({ status: 'stopped', audio: audioDisabled }),
        emittedAtMs: 2,
      });
    });
    expect(await screen.findByText('stage stopped')).toBeInTheDocument();
    expect(screen.getByText('visual off')).toBeInTheDocument();

    mocks.getBlsSession.mockResolvedValue(
      makeSession(makeState({ status: 'stopping', audio: audioDisabled })),
    );
    act(() => {
      mocks.onMessage?.({
        kind: 'STATE_UPDATED',
        state: makeState({ status: 'stopping', audio: audioDisabled }),
        emittedAtMs: 3,
      });
    });
    await waitFor(() => expect(screen.getByText('visual on')).toBeInTheDocument());
  });

  it('keeps the configured static cue visible in an idle controller preview', async () => {
    mocks.getBlsSession.mockResolvedValue(
      makeSession(
        makeState({
          status: 'idle',
          audio: { ...DEFAULT_SESSION_STATE.audio, enabled: false },
        }),
      ),
    );

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" preview />);

    expect(await screen.findByText('stage idle')).toBeInTheDocument();
    expect(await screen.findByText('visual on')).toBeInTheDocument();
  });

  it('broadcasts Joy-Con status once when the channel is ready without flooding on status rerenders', async () => {
    mocks.getBlsSession.mockResolvedValue(
      makeSession(makeState({ audio: { ...DEFAULT_SESSION_STATE.audio, enabled: false } })),
    );

    const view = renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);

    await establishTherapistPresence();
    await waitFor(() => expect(joyConStatusMessages()).toHaveLength(1));
    mocks.send.mockClear();

    view.rerender(<ClientSessionPage sessionId="session-id" token="client-token" />);
    view.rerender(<ClientSessionPage sessionId="session-id" token="client-token" />);
    view.rerender(<ClientSessionPage sessionId="session-id" token="client-token" />);

    expect(joyConStatusMessages()).toHaveLength(0);
  });

  it('unlocks audio without exposing tactile setup controls', async () => {
    mocks.getBlsSession.mockResolvedValue(makeSession(makeState()));

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client token" />);

    expect(await screen.findByRole('dialog', { name: 'Enable audio' })).toBeInTheDocument();
    expect(screen.getByText('The browser requires a user gesture to allow stereo audio.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enter and enable audio' }));
    expect(await screen.findByRole('button', { name: 'Audio enabled' })).toBeInTheDocument();
    expect(screen.queryByText('The browser requires a user gesture to allow stereo audio.')).not.toBeInTheDocument();
    expect(screen.queryByText('/session/session-id/tactile/left')).not.toBeInTheDocument();
  });

  it('suppresses every modality until audio is ready and after audio is re-locked', async () => {
    mocks.joyConLeftConnected = true;
    mocks.joyConRightConnected = true;
    mocks.getBlsSession.mockResolvedValue(
      makeSession(
        makeState({
          status: 'running',
          startedAtMs: Date.now(),
          tactile: { ...DEFAULT_SESSION_STATE.tactile, enabled: true },
        }),
      ),
    );

    const view = renderWithI18n(
      <ClientSessionPage sessionId="session-id" token="client-token" />,
    );

    await establishTherapistPresence();
    expect(await screen.findByRole('dialog', { name: 'Enable audio' })).toBeInTheDocument();
    expect(screen.getByText('stage stopped')).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.outputStates[mocks.outputStates.length - 1]).toEqual(
        expect.objectContaining({
          status: 'stopped',
          visual: expect.objectContaining({ enabled: false }),
          audio: expect.objectContaining({ enabled: false }),
          tactile: expect.objectContaining({ enabled: false }),
        }),
      ),
    );
    expect(mocks.tactileEnabledFlags[mocks.tactileEnabledFlags.length - 1]).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Enter and enable audio' }));

    expect(await screen.findByText('stage running')).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.outputStates[mocks.outputStates.length - 1]).toEqual(
        expect.objectContaining({
          status: 'running',
          visual: expect.objectContaining({ enabled: true }),
          audio: expect.objectContaining({ enabled: true }),
          tactile: expect.objectContaining({ enabled: true }),
        }),
      ),
    );

    mocks.audioUnlocked = false;
    view.rerender(<ClientSessionPage sessionId="session-id" token="client-token" />);

    expect(await screen.findByRole('dialog', { name: 'Enable audio' })).toBeInTheDocument();
    expect(screen.getByText('stage stopped')).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.outputStates[mocks.outputStates.length - 1]).toEqual(
        expect.objectContaining({
          status: 'stopped',
          visual: expect.objectContaining({ enabled: false }),
          audio: expect.objectContaining({ enabled: false }),
          tactile: expect.objectContaining({ enabled: false }),
        }),
      ),
    );
  });

  it('shows Joy-Con connection controls on the participant view when tactile output is enabled', async () => {
    mocks.getBlsSession.mockResolvedValue(
      makeSession(
        makeState({
          audio: { ...DEFAULT_SESSION_STATE.audio, enabled: false },
          tactile: { ...DEFAULT_SESSION_STATE.tactile, enabled: true },
        }),
      ),
    );

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);

    expect(await screen.findByRole('button', { name: 'Add Joy-Cons' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Joy-Cons' }));

    expect(mocks.requestJoyConDevices).toHaveBeenCalledTimes(1);
  });

  it('shows tactile setup immediately when the controller enables tactile output', async () => {
    const audioDisabled = { ...DEFAULT_SESSION_STATE.audio, enabled: false };
    mocks.getBlsSession.mockResolvedValue(
      makeSession(
        makeState({
          audio: audioDisabled,
          tactile: { ...DEFAULT_SESSION_STATE.tactile, enabled: false },
        }),
      ),
    );

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);

    await establishTherapistPresence();
    expect(await screen.findByText('stage idle')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Joy-Cons' })).not.toBeInTheDocument();

    mocks.getBlsSession.mockResolvedValue(
      makeSession(
        makeState({
          audio: { ...DEFAULT_SESSION_STATE.audio, enabled: false },
          tactile: { ...DEFAULT_SESSION_STATE.tactile, enabled: true },
        }),
      ),
    );
    act(() => {
      mocks.onMessage?.({
        kind: 'STATE_UPDATED',
        state: makeState({
          audio: { ...DEFAULT_SESSION_STATE.audio, enabled: false },
          tactile: { ...DEFAULT_SESSION_STATE.tactile, enabled: true },
        }),
        emittedAtMs: 1,
      });
    });

    expect(await screen.findByRole('button', { name: 'Add Joy-Cons' })).toBeInTheDocument();
  });

  it('removes manual Joy-Con test pulses while output is running or stopping', async () => {
    const tactileEnabled = { ...DEFAULT_SESSION_STATE.tactile, enabled: true };
    const audioDisabled = { ...DEFAULT_SESSION_STATE.audio, enabled: false };
    mocks.getBlsSession.mockResolvedValue(
      makeSession(makeState({ status: 'idle', audio: audioDisabled, tactile: tactileEnabled })),
    );

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);

    await establishTherapistPresence();
    const testLeft = await screen.findByRole('button', { name: 'Test left' });
    fireEvent.click(testLeft);
    expect(mocks.testJoyConPulse).toHaveBeenCalledTimes(1);

    mocks.getBlsSession.mockResolvedValue(
      makeSession(makeState({ status: 'running', audio: audioDisabled, tactile: tactileEnabled })),
    );
    act(() => {
      mocks.onMessage?.({
        kind: 'STATE_UPDATED',
        state: makeState({ status: 'running', audio: audioDisabled, tactile: tactileEnabled }),
        emittedAtMs: 1,
      });
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Test left' })).not.toBeInTheDocument());

    mocks.getBlsSession.mockResolvedValue(
      makeSession(makeState({ status: 'stopping', audio: audioDisabled, tactile: tactileEnabled })),
    );
    act(() => {
      mocks.onMessage?.({
        kind: 'STATE_UPDATED',
        state: makeState({ status: 'stopping', audio: audioDisabled, tactile: tactileEnabled }),
        emittedAtMs: 2,
      });
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Test left' })).not.toBeInTheDocument());
    expect(mocks.testJoyConPulse).toHaveBeenCalledTimes(1);
  });

  it('leaves fullscreen for the audio gate when the controller enables locked audio', async () => {
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreen,
    });
    mocks.joyConLeftConnected = true;
    mocks.joyConRightConnected = true;
    const audioDisabled = { ...DEFAULT_SESSION_STATE.audio, enabled: false };
    const tactileEnabled = { ...DEFAULT_SESSION_STATE.tactile, enabled: true };
    mocks.getBlsSession.mockResolvedValue(
      makeSession(
        makeState({
          status: 'running',
          audio: audioDisabled,
          tactile: tactileEnabled,
        }),
      ),
    );

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);

    await establishTherapistPresence();
    act(() => {
      setFullscreenElement(document.documentElement);
    });

    const audioEnabled = { ...DEFAULT_SESSION_STATE.audio, enabled: true };
    mocks.getBlsSession.mockResolvedValue(
      makeSession(
        makeState({
          status: 'running',
          audio: audioEnabled,
          tactile: tactileEnabled,
        }),
      ),
    );
    act(() => {
      mocks.onMessage?.({
        kind: 'STATE_UPDATED',
        state: makeState({
          status: 'running',
          audio: audioEnabled,
          tactile: tactileEnabled,
        }),
        emittedAtMs: 1,
      });
    });

    await waitFor(() => expect(exitFullscreen).toHaveBeenCalledTimes(1));
    expect(screen.getByText('stage stopped')).toBeInTheDocument();
    expect(mocks.outputStates[mocks.outputStates.length - 1]).toEqual(
      expect.objectContaining({
        status: 'stopped',
        visual: expect.objectContaining({ enabled: false }),
        audio: expect.objectContaining({ enabled: false }),
        tactile: expect.objectContaining({ enabled: false }),
      }),
    );
    expect(mocks.tactileEnabledFlags[mocks.tactileEnabledFlags.length - 1]).toBe(true);
    expect(
      screen.getByText('The controller enabled audio. Leaving fullscreen so you can enable it safely.'),
    ).toBeInTheDocument();

    act(() => {
      setFullscreenElement(null);
    });
    expect(await screen.findByRole('dialog', { name: 'Enable audio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter and enable audio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop output now' })).toBeInTheDocument();
  });

  it('keeps output stopped and exposes emergency actions when automatic fullscreen exit fails', async () => {
    const exitFullscreen = vi.fn().mockRejectedValue(new Error('exit blocked'));
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreen,
    });
    const audioDisabled = { ...DEFAULT_SESSION_STATE.audio, enabled: false };
    mocks.getBlsSession.mockResolvedValue(
      makeSession(makeState({ status: 'running', audio: audioDisabled })),
    );

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);
    await establishTherapistPresence();
    act(() => {
      setFullscreenElement(document.documentElement);
    });

    const audioEnabled = { ...DEFAULT_SESSION_STATE.audio, enabled: true };
    mocks.getBlsSession.mockResolvedValue(
      makeSession(makeState({ status: 'running', audio: audioEnabled })),
    );
    act(() => {
      mocks.onMessage?.({
        kind: 'STATE_UPDATED',
        state: makeState({ status: 'running', audio: audioEnabled }),
        emittedAtMs: 1,
      });
    });

    expect(
      await screen.findByText(
        'Audio was enabled, but fullscreen could not be closed. Use Exit fullscreen or Stop output now.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('stage stopped')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop output now' })).toBeInTheDocument();
  });

  it('shows only an exit control while the client view is fullscreen', async () => {
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreen,
    });
    mocks.getBlsSession.mockResolvedValue(
      makeSession(makeState({ audio: { ...DEFAULT_SESSION_STATE.audio, enabled: false } })),
    );

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);

    await establishTherapistPresence();
    expect(await screen.findByText('stage idle')).toBeInTheDocument();

    act(() => {
      setFullscreenElement(document.documentElement);
    });

    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop output now' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fullscreen' })).not.toBeInTheDocument();
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    expect(screen.queryByText('The browser requires a user gesture to allow stereo audio.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' }));

    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it('shows the ended-session view when the controller broadcasts the end', async () => {
    const audioDisabled = { ...DEFAULT_SESSION_STATE.audio, enabled: false };
    mocks.getBlsSession.mockResolvedValue(makeSession(makeState({ audio: audioDisabled })));

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);
    await establishTherapistPresence();
    expect(await screen.findByText('stage idle')).toBeInTheDocument();

    mocks.getBlsSession.mockResolvedValue(
      makeSession(makeState({ status: 'ended', audio: { ...DEFAULT_SESSION_STATE.audio, enabled: true } })),
    );
    act(() => {
      mocks.onMessage?.({ kind: 'SESSION_ENDED', emittedAtMs: 1 });
    });

    expect(await screen.findByText('Session ended')).toBeInTheDocument();
    expect(screen.getByText('The controller has ended this session.')).toBeInTheDocument();
  });

  it('surfaces session loading errors', async () => {
    mocks.getBlsSession.mockRejectedValue(new Error('bad token'));

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);

    expect(await screen.findByText('bad token')).toBeInTheDocument();
  });

  it('rejects a valid token for the wrong session role before joining output', async () => {
    mocks.getBlsSession.mockResolvedValue({ role: 'therapist', state: makeState(), endedAt: null });

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="therapist-token" />);

    expect(await screen.findByText('This link does not have participant permissions.')).toBeInTheDocument();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('treats realtime state payloads only as invalidations and keeps the RPC snapshot authoritative', async () => {
    const audioDisabled = { ...DEFAULT_SESSION_STATE.audio, enabled: false };
    mocks.getBlsSession.mockResolvedValue(
      makeSession(makeState({ version: 3, status: 'idle', audio: audioDisabled })),
    );
    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);
    await establishTherapistPresence();
    expect(await screen.findByText('stage idle')).toBeInTheDocument();

    act(() => {
      mocks.onMessage?.({
        kind: 'STATE_UPDATED',
        state: makeState({
          version: 999,
          status: 'running',
          startedAtMs: 0,
          audio: audioDisabled,
        }),
        emittedAtMs: 1,
      });
    });

    await waitFor(() => expect(mocks.getBlsSession).toHaveBeenCalledTimes(3));
    expect(screen.getByText('stage idle')).toBeInTheDocument();
    expect(screen.queryByText('stage running')).not.toBeInTheDocument();
  });

  it('fails safe when realtime disconnects and allows a local emergency stop', async () => {
    mocks.getBlsSession.mockResolvedValue(
      makeSession(
        makeState({
          status: 'running',
          startedAtMs: 0,
          audio: { ...DEFAULT_SESSION_STATE.audio, enabled: false },
        }),
      ),
    );
    const view = renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);

    await establishTherapistPresence();
    expect(await screen.findByText('stage running')).toBeInTheDocument();

    mocks.realtimeStatus = 'disconnected';
    view.rerender(<ClientSessionPage sessionId="session-id" token="client-token" />);
    expect(screen.getByText('stage stopped')).toBeInTheDocument();

    mocks.realtimeStatus = 'connected';
    mocks.connectionEpoch = 2;
    act(() => mocks.onTherapistPresenceChange?.(false));
    view.rerender(<ClientSessionPage sessionId="session-id" token="client-token" />);
    expect(screen.getByText('stage stopped')).toBeInTheDocument();
    await waitFor(() => expect(mocks.getBlsSession.mock.calls.length).toBeGreaterThanOrEqual(3));
    expect(screen.getByText('The controller is offline. Output is stopped until it reconnects.')).toBeInTheDocument();
    expect(screen.getByText('stage stopped')).toBeInTheDocument();
    act(() => mocks.onTherapistPresenceChange?.(true));
    expect(await screen.findByText('stage running')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Stop output now' }));
    expect(screen.getByText('stage stopped')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume output' })).toBeInTheDocument();
  });

  it('enforces the shared round deadline and neutralizes all output when the session ends', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(200);
    mocks.getBlsSession.mockResolvedValue(
      makeSession(makeState({ status: 'running', startedAtMs: 0, roundDurationMs: 100 })),
    );

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);

    expect(await screen.findByText('This timed round has finished. Output is stopped.')).toBeInTheDocument();
    expect(screen.getByText('stage stopped')).toBeInTheDocument();

    mocks.neutralJoyCon.mockClear();
    mocks.getBlsSession.mockResolvedValue(
      makeSession(makeState({ status: 'ended', startedAtMs: null, roundDurationMs: 100 })),
    );
    act(() => {
      mocks.onMessage?.({ kind: 'SESSION_ENDED', emittedAtMs: 201 });
    });

    expect(await screen.findByText('Session ended')).toBeInTheDocument();
    await waitFor(() => expect(mocks.neutralJoyCon).toHaveBeenCalled());
    expect(mocks.outputStates[mocks.outputStates.length - 1]).toEqual(
      expect.objectContaining({
        status: 'stopped',
        visual: expect.objectContaining({ enabled: false }),
        audio: expect.objectContaining({ enabled: false }),
        tactile: expect.objectContaining({ enabled: false }),
      }),
    );
  });

  it('keeps output stopped until server timing is verified', async () => {
    mocks.clockSynced = false;
    mocks.clockError = 'offline';
    mocks.getBlsSession.mockResolvedValue(
      makeSession(
        makeState({
          status: 'running',
          startedAtMs: 100,
          audio: { ...DEFAULT_SESSION_STATE.audio, enabled: false },
        }),
      ),
    );

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);
    await establishTherapistPresence();

    expect(screen.getByText('stage stopped')).toBeInTheDocument();
    expect(
      screen.getByText('Server timing could not be verified. Output is stopped until timing sync recovers.'),
    ).toBeInTheDocument();
  });

  it('does not trust Realtime presence without a fresh controller-token heartbeat', async () => {
    mocks.getBlsSession.mockResolvedValue(
      makeSession(
        makeState({
          status: 'running',
          startedAtMs: 100,
          audio: { ...DEFAULT_SESSION_STATE.audio, enabled: false },
        }),
        '1970-01-01T00:00:00.000Z',
      ),
    );

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);
    await establishTherapistPresence();

    expect(screen.getByText('stage stopped')).toBeInTheDocument();
    expect(screen.getByText('The controller is offline. Output is stopped until it reconnects.')).toBeInTheDocument();
  });

  it('lets the participant leave the audio gate by stopping locally', async () => {
    mocks.getBlsSession.mockResolvedValue(makeSession(makeState()));

    renderWithI18n(<ClientSessionPage sessionId="session-id" token="client-token" />);

    expect(await screen.findByRole('dialog', { name: 'Enable audio' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop output now' }));

    expect(screen.queryByRole('dialog', { name: 'Enable audio' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume output' })).toBeInTheDocument();
  });
});
