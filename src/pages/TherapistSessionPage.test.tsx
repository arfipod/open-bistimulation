import { fireEvent, screen, waitFor } from '@testing-library/react';
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
  useAudioBls: vi.fn(),
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
  ClientPreview: () => <div>client preview</div>,
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
  }: {
    onStart: () => void;
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
    onReset: () => void;
    onSavePreferences: () => void;
  }) => (
    <div>
      <button type="button" onClick={onStart}>
        start-action
      </button>
      <button type="button" onClick={onPause}>
        pause-action
      </button>
      <button type="button" onClick={onResume}>
        resume-action
      </button>
      <button type="button" onClick={onStop}>
        stop-action
      </button>
      <button type="button" onClick={onReset}>
        reset-action
      </button>
      <button type="button" onClick={onSavePreferences}>
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

    fireEvent.click(screen.getByRole('button', { name: 'start-action' }));
    await waitFor(() =>
      expect(mocks.saveTherapistState).toHaveBeenLastCalledWith(
        'session-id',
        'therapist-token',
        expect.objectContaining({ status: 'running', startedAtMs: 1_300, motionStartedAtMs: 1_300 }),
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

    vi.spyOn(Date, 'now').mockReturnValue(4_000);
    fireEvent.click(screen.getByRole('button', { name: 'stop-action' }));
    await waitFor(() =>
      expect(mocks.saveTherapistState).toHaveBeenLastCalledWith(
        'session-id',
        'therapist-token',
        expect.objectContaining({ status: 'stopping', setsCompleted: 1 }),
      ),
    );

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
});
