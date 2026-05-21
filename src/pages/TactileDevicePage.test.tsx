import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionBroadcastMessage } from '../domain/sessionTypes';
import { renderWithI18n } from '../test/render';
import { TactileDevicePage } from './TactileDevicePage';

const mocks = vi.hoisted(() => ({
  getBlsSession: vi.fn(),
  upsertTactileDevice: vi.fn(),
  send: vi.fn(),
  onMessage: null as ((message: SessionBroadcastMessage) => void) | null,
}));

vi.mock('../lib/sessionApi', () => ({
  getBlsSession: mocks.getBlsSession,
  upsertTactileDevice: mocks.upsertTactileDevice,
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

function installVibrate(result = true) {
  const vibrate = vi.fn(() => result);
  Object.defineProperty(navigator, 'vibrate', {
    configurable: true,
    value: vibrate,
  });
  return vibrate;
}

function removeVibrate() {
  delete (navigator as Partial<Navigator>).vibrate;
}

describe('TactileDevicePage', () => {
  beforeEach(() => {
    localStorage.clear();
    removeVibrate();
    mocks.getBlsSession.mockReset().mockResolvedValue({});
    mocks.upsertTactileDevice.mockReset().mockResolvedValue(undefined);
    mocks.send.mockReset().mockResolvedValue(undefined);
    mocks.onMessage = null;
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');
  });

  it('shows an error when the client token is missing', () => {
    renderWithI18n(<TactileDevicePage sessionId="session-id" side="left" />);

    expect(screen.getByText('Missing participant token in the URL.')).toBeInTheDocument();
  });

  it('loads, registers, announces, enables vibration, and counts matching pulses', async () => {
    const vibrate = installVibrate();

    renderWithI18n(<TactileDevicePage sessionId="session-id" token="client-token" side="left" />);

    expect(await screen.findByRole('heading', { name: 'Left device' })).toBeInTheDocument();
    expect(mocks.upsertTactileDevice).toHaveBeenCalledWith(
      'session-id',
      'client-token',
      'left',
      '00000000-0000-4000-8000-000000000000',
      'Left device',
      true,
    );
    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith({
        kind: 'TACTILE_DEVICE_READY',
        side: 'left',
        deviceId: '00000000-0000-4000-8000-000000000000',
        label: 'Left device',
        emittedAtMs: expect.any(Number),
        supported: true,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Enable vibration' }));
    expect(vibrate).toHaveBeenCalledWith([80, 40, 80]);
    expect(screen.getAllByText('Vibration enabled')).toHaveLength(2);

    act(() => {
      mocks.onMessage?.({ kind: 'TACTILE_PULSE', side: 'left', durationMs: 90, sequence: 1, emittedAtMs: 1 });
    });

    expect(vibrate).toHaveBeenLastCalledWith(90);
    expect(screen.getByText('Pulses received')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    act(() => {
      mocks.onMessage?.({ kind: 'TACTILE_PULSE', side: 'right', durationMs: 90, sequence: 2, emittedAtMs: 2 });
    });

    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it('reports unsupported vibration browsers and disables activation', async () => {
    removeVibrate();

    renderWithI18n(<TactileDevicePage sessionId="session-id" token="client-token" side="right" />);

    expect(await screen.findByRole('heading', { name: 'Right device' })).toBeInTheDocument();
    expect(screen.getByText(/does not support the Vibration API/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable vibration' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Test vibration' })).toBeDisabled();
    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'TACTILE_DEVICE_READY',
          supported: false,
          side: 'right',
        }),
      ),
    );
  });

  it('shows a warning when vibration activation is rejected', async () => {
    installVibrate(false);

    renderWithI18n(<TactileDevicePage sessionId="session-id" token="client-token" side="left" />);

    expect(await screen.findByRole('heading', { name: 'Left device' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enable vibration' }));

    expect(screen.getByText(/The browser rejected vibration/)).toBeInTheDocument();
  });

  it('shows ended-session and loading-error views', async () => {
    const { unmount } = renderWithI18n(<TactileDevicePage sessionId="session-id" token="client-token" side="left" />);
    expect(await screen.findByRole('heading', { name: 'Left device' })).toBeInTheDocument();

    act(() => {
      mocks.onMessage?.({ kind: 'SESSION_ENDED', emittedAtMs: 1 });
    });
    expect(screen.getByText('Session ended')).toBeInTheDocument();
    unmount();

    mocks.getBlsSession.mockRejectedValueOnce(new Error('not allowed'));
    renderWithI18n(<TactileDevicePage sessionId="session-id" token="client-token" side="left" />);

    expect(await screen.findByText('not allowed')).toBeInTheDocument();
  });
});
