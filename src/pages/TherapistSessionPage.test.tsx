import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SESSION_STATE } from '../domain/defaults';
import type { AudioSettings, SessionBroadcastMessage, SessionState, TactileSettings, VisualSettings } from '../domain/sessionTypes';
import { renderWithI18n } from '../test/render';
import { TherapistSessionPage } from './TherapistSessionPage';

const mocks = vi.hoisted(() => ({
  getBlsSession: vi.fn(),
  getServerTimeMs: vi.fn(),
  saveTherapistState: vi.fn(),
  saveTherapistPreferences: vi.fn(),
  stopTherapistSession: vi.fn(),
  heartbeatTherapistSession: vi.fn(),
  endBlsSession: vi.fn(),
  saveLocalPreferences: vi.fn(),
  requestJoyConDevices: vi.fn(),
  refreshJoyConDevices: vi.fn(),
  testJoyConPulse: vi.fn(),
  neutralJoyCon: vi.fn(),
  send: vi.fn(),
  onMessage: null as ((message: SessionBroadcastMessage) => void) | null,
}));

vi.mock('../lib/sessionApi', () => ({
  getBlsSession: mocks.getBlsSession,
  getServerTimeMs: mocks.getServerTimeMs,
  saveTherapistState: mocks.saveTherapistState,
  saveTherapistPreferences: mocks.saveTherapistPreferences,
  stopTherapistSession: mocks.stopTherapistSession,
  heartbeatTherapistSession: mocks.heartbeatTherapistSession,
  endBlsSession: mocks.endBlsSession,
}));

vi.mock('../lib/localStorage', () => ({
  saveLocalPreferences: mocks.saveLocalPreferences,
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

vi.mock('../hooks/useJoyConTactileOutput', () => ({
  useJoyConTactileOutput: () => ({
    lastPulseSide: null,
    lastPulseAt: null,
    pulseCount: 0,
    lastError: null,
    skippedPulseCount: 0,
  }),
}));

vi.mock('../hooks/useAudioBls', () => ({
  useAudioBls: vi.fn(() => ({
    error: null,
    isUnlocked: false,
    unlock: vi.fn().mockResolvedValue(true),
  })),
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

vi.mock('../hooks/useTicker', () => ({
  useTicker: () => 0,
}));

vi.mock('../components/InviteClient', () => ({
  InviteClient: ({ sessionId, clientToken }: { sessionId: string; clientToken: string }) => (
    <div>
      invite {sessionId} {clientToken}
    </div>
  ),
}));

vi.mock('../components/VisualPanel', () => ({
  VisualPanel: ({ visual, onChange }: { visual: VisualSettings; onChange: (visual: VisualSettings) => void }) => (
    <button type="button" onClick={() => onChange({ ...visual, speed: 10, color: '#ffffff' })}>
      change visual
    </button>
  ),
}));

vi.mock('../components/AuditoryPanel', () => ({
  AuditoryPanel: ({ audio, onChange }: { audio: AudioSettings; onChange: (audio: AudioSettings) => void }) => (
    <button type="button" onClick={() => onChange({ ...audio, enabled: true })}>
      change audio
    </button>
  ),
}));

vi.mock('../components/TactilePanel', () => ({
  TactilePanel: ({ tactile, onChange }: { tactile: TactileSettings; onChange: (tactile: TactileSettings) => void }) => (
    <button type="button" onClick={() => onChange({ ...tactile, enabled: true })}>
      change tactile
    </button>
  ),
}));

vi.mock('../components/ClientPreview', () => ({
  ClientPreview: ({ state }: { state: SessionState }) => (
    <div>
      client preview {state.version} {state.status}
    </div>
  ),
}));

vi.mock('../components/SessionStats', () => ({
  SessionStats: () => <div>stats</div>,
}));

vi.mock('../components/SessionControls', () => ({
  SessionControlActions: ({
    onStart,
    onPause,
    onResume,
    onStop,
    onReset,
    onSavePreferences,
    busy,
    safetyBusy,
  }: {
    onStart: () => void;
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
    onReset: () => void;
    onSavePreferences: () => void;
    busy?: boolean;
    safetyBusy?: boolean;
  }) => (
    <div>
      <button type="button" disabled={busy || safetyBusy} onClick={onStart}>
        start-action
      </button>
      <button type="button" disabled={busy || safetyBusy} onClick={onPause}>
        pause-action
      </button>
      <button type="button" disabled={busy || safetyBusy} onClick={onResume}>
        resume-action
      </button>
      <button type="button" disabled={safetyBusy} onClick={onStop}>
        stop-action
      </button>
      <button type="button" disabled={busy || safetyBusy} onClick={onReset}>
        reset-action
      </button>
      <button type="button" disabled={busy || safetyBusy} onClick={onSavePreferences}>
        save-preferences-action
      </button>
    </div>
  ),
  SessionControls: ({ onRoundDurationChange }: { onRoundDurationChange: (durationMs: number | null) => void }) => (
    <button type="button" onClick={() => onRoundDurationChange(60_000)}>
      set-duration
    </button>
  ),
}));

function makeState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    ...DEFAULT_SESSION_STATE,
    version: 1,
    visual: { ...DEFAULT_SESSION_STATE.visual },
    audio: { ...DEFAULT_SESSION_STATE.audio },
    tactile: { ...DEFAULT_SESSION_STATE.tactile },
    ...overrides,
  };
}

describe('TherapistSessionPage', () => {
  beforeEach(() => {
    mocks.getBlsSession.mockReset();
    mocks.getServerTimeMs.mockReset().mockResolvedValue(1_000);
    mocks.saveTherapistState.mockReset().mockResolvedValue(undefined);
    mocks.saveTherapistPreferences.mockReset().mockResolvedValue(undefined);
    mocks.stopTherapistSession.mockReset().mockResolvedValue(
      makeState({ version: 2, status: 'stopped' }),
    );
    mocks.heartbeatTherapistSession.mockReset().mockResolvedValue(undefined);
    mocks.endBlsSession.mockReset().mockResolvedValue(undefined);
    mocks.saveLocalPreferences.mockReset();
    mocks.requestJoyConDevices.mockReset().mockResolvedValue(undefined);
    mocks.refreshJoyConDevices.mockReset().mockResolvedValue(undefined);
    mocks.testJoyConPulse.mockReset().mockResolvedValue(undefined);
    mocks.neutralJoyCon.mockReset().mockResolvedValue(undefined);
    mocks.send.mockReset().mockResolvedValue(undefined);
    mocks.onMessage = null;
    vi.spyOn(Date, 'now').mockReturnValue(0);
  });

  it('shows token and role errors before rendering controller controls', async () => {
    renderWithI18n(<TherapistSessionPage sessionId="session-id" />);
    expect(screen.getByText('Missing controller token in the URL.')).toBeInTheDocument();

    mocks.getBlsSession.mockResolvedValueOnce({ role: 'client', state: makeState(), clientToken: undefined });
    const { unmount } = renderWithI18n(<TherapistSessionPage sessionId="session-id" token="client-token" />);
    expect(await screen.findByText('This link does not have controller permissions.')).toBeInTheDocument();
    unmount();
  });

  it('loads therapist sessions and runs start, pause, resume, stop, and reset transitions', async () => {
    mocks.getBlsSession.mockResolvedValue({
      role: 'therapist',
      state: makeState(),
      clientToken: 'client-token',
    });

    renderWithI18n(<TherapistSessionPage sessionId="session-id" token="therapist-token" />);

    expect(await screen.findByText('invite session-id client-token')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'set-duration' }));
    await waitFor(() =>
      expect(mocks.saveTherapistState).toHaveBeenLastCalledWith(
        'session-id',
        'therapist-token',
        expect.objectContaining({ status: 'idle', roundDurationMs: 60_000 }),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'start-action' }));
    await waitFor(() =>
      expect(mocks.saveTherapistState).toHaveBeenLastCalledWith(
        'session-id',
        'therapist-token',
        expect.objectContaining({
          status: 'running',
          roundDurationMs: 60_000,
          startedAtMs: 1_300,
          motionStartedAtMs: 1_300,
        }),
      ),
    );
    expect(mocks.send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: 'STATE_UPDATED',
        state: expect.objectContaining({ status: 'running' }),
      }),
    );

    mocks.getServerTimeMs.mockResolvedValueOnce(2_000);
    fireEvent.click(screen.getByRole('button', { name: 'pause-action' }));
    await waitFor(() =>
      expect(mocks.saveTherapistState).toHaveBeenLastCalledWith(
        'session-id',
        'therapist-token',
        expect.objectContaining({ status: 'paused', elapsedBeforePauseMs: 700 }),
      ),
    );

    mocks.getServerTimeMs.mockResolvedValueOnce(3_000);
    fireEvent.click(screen.getByRole('button', { name: 'resume-action' }));
    await waitFor(() =>
      expect(mocks.saveTherapistState).toHaveBeenLastCalledWith(
        'session-id',
        'therapist-token',
        expect.objectContaining({ status: 'running', startedAtMs: 3_300 }),
      ),
    );

    mocks.stopTherapistSession.mockResolvedValueOnce(
      makeState({
        version: 6,
        status: 'stopped',
        roundDurationMs: 60_000,
        elapsedBeforePauseMs: 1_400,
        setsCompleted: 1,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'stop-action' }));
    await waitFor(() =>
      expect(mocks.stopTherapistSession).toHaveBeenCalledWith(
        'session-id',
        'therapist-token',
      ),
    );
    expect(await screen.findByText('client preview 6 stopped')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'reset-action' }));
    await waitFor(() =>
      expect(mocks.saveTherapistState).toHaveBeenLastCalledWith(
        'session-id',
        'therapist-token',
        expect.objectContaining({ status: 'idle', setsCompleted: 0 }),
      ),
    );
  });

  it('patches visual, audio, tactile preferences and saves preferences', async () => {
    mocks.getBlsSession.mockResolvedValue({
      role: 'therapist',
      state: makeState(),
      clientToken: 'client-token',
    });

    renderWithI18n(<TherapistSessionPage sessionId="session-id" token="therapist-token" />);
    expect(await screen.findByText('invite session-id client-token')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'change visual' }));
    await waitFor(() =>
      expect(mocks.saveTherapistState).toHaveBeenLastCalledWith(
        'session-id',
        'therapist-token',
        expect.objectContaining({ visual: expect.objectContaining({ speed: 10, color: '#ffffff' }) }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'change audio' }));
    await waitFor(() =>
      expect(mocks.saveTherapistState).toHaveBeenLastCalledWith(
        'session-id',
        'therapist-token',
        expect.objectContaining({ audio: expect.objectContaining({ enabled: true }) }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'change tactile' }));
    await waitFor(() =>
      expect(mocks.saveTherapistState).toHaveBeenLastCalledWith(
        'session-id',
        'therapist-token',
        expect.objectContaining({ tactile: expect.objectContaining({ enabled: true }) }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'save-preferences-action' }));
    await waitFor(() => expect(mocks.saveTherapistPreferences).toHaveBeenCalledWith('session-id', 'therapist-token', expect.any(Object)));
    expect(mocks.saveLocalPreferences).toHaveBeenCalledWith(expect.any(Object));
    expect(await screen.findByText('Preferences saved locally and in Supabase for this session.')).toBeInTheDocument();
  });

  it('updates client presence from realtime messages and completes invalid stopping states', async () => {
    mocks.getBlsSession.mockResolvedValue({
      role: 'therapist',
      state: makeState({ status: 'stopping', motionStartedAtMs: null }),
      clientToken: 'client-token',
    });

    renderWithI18n(<TherapistSessionPage sessionId="session-id" token="therapist-token" />);

    expect(await screen.findByText('invite session-id client-token')).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.saveTherapistState).toHaveBeenCalledWith(
        'session-id',
        'therapist-token',
        expect.objectContaining({ status: 'stopped', motionElapsedBeforePauseMs: 0 }),
      ),
    );
  });

  it('requires explicit confirmation before ending a session', async () => {
    mocks.getBlsSession.mockResolvedValue({
      role: 'therapist',
      state: makeState({ status: 'running' }),
      clientToken: 'client-token',
    });

    renderWithI18n(<TherapistSessionPage sessionId="session-id" token="therapist-token" />);
    expect(await screen.findByText('invite session-id client-token')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'End session' }));

    expect(screen.getByRole('alertdialog', { name: 'End this session?' })).toBeInTheDocument();
    expect(
      screen.getByText('All participant output will stop and this invitation link will no longer work.'),
    ).toBeInTheDocument();
    expect(mocks.endBlsSession).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('finalizes ending in the database even when the Realtime notification fails', async () => {
    mocks.getBlsSession.mockResolvedValue({
      role: 'therapist',
      state: makeState({ status: 'running' }),
      clientToken: 'client-token',
      endedAt: null,
    });
    mocks.send.mockRejectedValueOnce(new Error('broadcast offline'));

    renderWithI18n(<TherapistSessionPage sessionId="session-id" token="therapist-token" />);
    expect(await screen.findByText('invite session-id client-token')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'End session' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'End session' }));

    await waitFor(() =>
      expect(mocks.endBlsSession).toHaveBeenCalledWith('session-id', 'therapist-token'),
    );
    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'SESSION_ENDED' })));
    expect(mocks.endBlsSession.mock.invocationCallOrder[0]).toBeLessThan(mocks.send.mock.invocationCallOrder[0]);
    expect(mocks.saveTherapistState).not.toHaveBeenCalled();
  });

  it('drops queued stale mutations and restores server authority after a version conflict', async () => {
    let rejectFirstSave: ((error: Error) => void) | undefined;
    const initialSession = {
      role: 'therapist' as const,
      state: makeState({ version: 1, status: 'idle' }),
      clientToken: 'client-token',
    };
    let resolveRecovery: ((session: typeof initialSession) => void) | undefined;
    mocks.getBlsSession.mockResolvedValue(initialSession);
    mocks.saveTherapistState.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectFirstSave = reject;
        }),
    );

    renderWithI18n(<TherapistSessionPage sessionId="session-id" token="therapist-token" />);
    expect(await screen.findByText('client preview 1 idle')).toBeInTheDocument();
    await waitFor(() => expect(mocks.getBlsSession).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'change visual' }));
    await waitFor(() => expect(mocks.saveTherapistState).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'change audio' }));

    const authoritativeSession = {
      ...initialSession,
      state: makeState({ version: 2, status: 'stopped' }),
    };
    mocks.getBlsSession.mockImplementationOnce(
      () =>
        new Promise<typeof initialSession>((resolve) => {
          resolveRecovery = resolve;
        }),
    );
    rejectFirstSave?.(new Error('version conflict'));
    await waitFor(() => expect(mocks.getBlsSession).toHaveBeenCalledTimes(3));

    fireEvent.click(screen.getByRole('button', { name: 'change tactile' }));
    resolveRecovery?.(authoritativeSession);

    expect(await screen.findByText('client preview 2 stopped')).toBeInTheDocument();
    await waitFor(() => expect(mocks.saveTherapistState).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(
        'This session changed in another controller. The latest saved state has been restored; review it before trying again.',
      ),
    ).toBeInTheDocument();
  });

  it('does not let an older conflict-recovery read overwrite a newer authoritative reconcile', async () => {
    let rejectSave: ((error: Error) => void) | undefined;
    let resolveRecovery: ((session: {
      role: 'therapist';
      state: SessionState;
      clientToken: string;
      endedAt: null;
    }) => void) | undefined;
    const initialSession = {
      role: 'therapist' as const,
      state: makeState({ version: 1, status: 'idle' }),
      clientToken: 'client-token',
      endedAt: null,
    };
    mocks.getBlsSession.mockResolvedValue(initialSession);
    mocks.saveTherapistState.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSave = reject;
        }),
    );

    renderWithI18n(<TherapistSessionPage sessionId="session-id" token="therapist-token" />);
    expect(await screen.findByText('client preview 1 idle')).toBeInTheDocument();
    await waitFor(() => expect(mocks.getBlsSession).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'change visual' }));
    await waitFor(() => expect(mocks.saveTherapistState).toHaveBeenCalledTimes(1));

    mocks.getBlsSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRecovery = resolve;
        }),
    );
    rejectSave?.(new Error('version conflict'));
    await waitFor(() => expect(mocks.getBlsSession).toHaveBeenCalledTimes(3));

    mocks.getBlsSession.mockResolvedValue({
      ...initialSession,
      state: makeState({ version: 3, status: 'stopped' }),
    });
    act(() => {
      mocks.onMessage?.({
        kind: 'STATE_UPDATED',
        state: makeState({ version: 999, status: 'running' }),
        emittedAtMs: 1,
      });
    });
    expect(await screen.findByText('client preview 3 stopped')).toBeInTheDocument();

    resolveRecovery?.({
      ...initialSession,
      state: makeState({ version: 2, status: 'running' }),
    });
    await waitFor(() => {
      expect(screen.getByText('client preview 3 stopped')).toBeInTheDocument();
    });
    expect(screen.queryByText('client preview 2 running')).not.toBeInTheDocument();
  });

  it('lets the atomic stop preempt a pending low-priority settings save', async () => {
    let resolveSettingsSave: (() => void) | undefined;
    const initialSession = {
      role: 'therapist' as const,
      state: makeState({ version: 1, status: 'running', startedAtMs: 100, motionStartedAtMs: 100 }),
      clientToken: 'client-token',
      endedAt: null,
    };
    mocks.getBlsSession.mockResolvedValue(initialSession);
    mocks.saveTherapistState.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSettingsSave = resolve;
        }),
    );
    mocks.stopTherapistSession.mockResolvedValueOnce(
      makeState({ version: 3, status: 'stopped', setsCompleted: 1 }),
    );

    renderWithI18n(<TherapistSessionPage sessionId="session-id" token="therapist-token" />);
    expect(await screen.findByText('client preview 1 running')).toBeInTheDocument();
    await waitFor(() => expect(mocks.getBlsSession).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'change visual' }));
    await waitFor(() => expect(mocks.saveTherapistState).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'stop-action' }));

    await waitFor(() =>
      expect(mocks.stopTherapistSession).toHaveBeenCalledWith('session-id', 'therapist-token'),
    );
    expect(await screen.findByText('client preview 3 stopped')).toBeInTheDocument();

    resolveSettingsSave?.();
    await waitFor(() => expect(screen.getByText('client preview 3 stopped')).toBeInTheDocument());
  });

  it('keeps Stop and End available while saving preferences is hung', async () => {
    let resolvePreferencesSave: (() => void) | undefined;
    mocks.getBlsSession.mockResolvedValue({
      role: 'therapist',
      state: makeState({
        version: 1,
        status: 'running',
        startedAtMs: 100,
        motionStartedAtMs: 100,
      }),
      clientToken: 'client-token',
      endedAt: null,
    });
    mocks.saveTherapistPreferences.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolvePreferencesSave = resolve;
        }),
    );
    mocks.stopTherapistSession.mockResolvedValueOnce(
      makeState({ version: 2, status: 'stopped', setsCompleted: 1 }),
    );

    renderWithI18n(<TherapistSessionPage sessionId="session-id" token="therapist-token" />);
    expect(await screen.findByText('client preview 1 running')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'save-preferences-action' }));
    await waitFor(() => expect(mocks.saveTherapistPreferences).toHaveBeenCalledTimes(1));

    expect(screen.getByRole('button', { name: 'stop-action' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'End session' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'End session' }));
    expect(screen.getByRole('alertdialog', { name: 'End this session?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'stop-action' }));
    await waitFor(() =>
      expect(mocks.stopTherapistSession).toHaveBeenCalledWith('session-id', 'therapist-token'),
    );
    expect(await screen.findByText('client preview 2 stopped')).toBeInTheDocument();

    resolvePreferencesSave?.();
    await waitFor(() => expect(screen.getByText('client preview 2 stopped')).toBeInTheDocument());
    expect(screen.queryByText('Preferences saved locally and to this session.')).not.toBeInTheDocument();
  });

  it('reconciles database authority when another controller changes or ends the session', async () => {
    const initialSession = {
      role: 'therapist' as const,
      state: makeState({ version: 1, status: 'idle' }),
      clientToken: 'client-token',
      endedAt: null,
    };
    mocks.getBlsSession.mockResolvedValue(initialSession);

    renderWithI18n(<TherapistSessionPage sessionId="session-id" token="therapist-token" />);
    expect(await screen.findByText('client preview 1 idle')).toBeInTheDocument();
    await waitFor(() => expect(mocks.getBlsSession).toHaveBeenCalledTimes(2));

    mocks.getBlsSession.mockResolvedValue({
      ...initialSession,
      state: makeState({ version: 2, status: 'paused' }),
    });
    act(() => {
      mocks.onMessage?.({
        kind: 'STATE_UPDATED',
        state: makeState({ version: 999, status: 'running' }),
        emittedAtMs: 1,
      });
    });
    expect(await screen.findByText('client preview 2 paused')).toBeInTheDocument();

    mocks.getBlsSession.mockResolvedValue({
      ...initialSession,
      state: makeState({ version: 3, status: 'ended' }),
      endedAt: '2026-07-26T00:00:00.000Z',
    });
    act(() => {
      mocks.onMessage?.({ kind: 'SESSION_ENDED', emittedAtMs: 2 });
    });

    expect(await screen.findByText('Session ended')).toBeInTheDocument();
    expect(screen.getByText('This session was ended from another controller.')).toBeInTheDocument();
  });

  it('stops through the atomic server operation without depending on clock sync', async () => {
    mocks.getBlsSession.mockResolvedValue({
      role: 'therapist',
      state: makeState({ status: 'running', startedAtMs: 100, motionStartedAtMs: 100 }),
      clientToken: 'client-token',
      endedAt: null,
    });
    mocks.getServerTimeMs.mockRejectedValueOnce(new Error('offline'));
    mocks.stopTherapistSession.mockResolvedValueOnce(
      makeState({
        version: 2,
        status: 'stopped',
        startedAtMs: null,
        motionStartedAtMs: null,
        setsCompleted: 1,
      }),
    );

    renderWithI18n(<TherapistSessionPage sessionId="session-id" token="therapist-token" />);
    expect(await screen.findByText('client preview 1 running')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'stop-action' }));

    await waitFor(() =>
      expect(mocks.stopTherapistSession).toHaveBeenCalledWith(
        'session-id',
        'therapist-token',
      ),
    );
    expect(mocks.getServerTimeMs).not.toHaveBeenCalled();
    expect(await screen.findByText('client preview 2 stopped')).toBeInTheDocument();
  });
});
