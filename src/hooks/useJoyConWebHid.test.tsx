import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useJoyConWebHid } from './useJoyConWebHid';

const mocks = vi.hoisted(() => ({
  supported: true,
  listJoyConDevices: vi.fn(),
  requestJoyConDevices: vi.fn(),
  pulseJoyCon: vi.fn(),
  neutralJoyCon: vi.fn(),
}));

vi.mock('../lib/joyconWebHidClient', () => ({
  isJoyConWebHidSupported: () => mocks.supported,
  listJoyConDevices: mocks.listJoyConDevices,
  requestJoyConDevices: mocks.requestJoyConDevices,
  pulseJoyCon: mocks.pulseJoyCon,
  neutralJoyCon: mocks.neutralJoyCon,
}));

describe('useJoyConWebHid', () => {
  beforeEach(() => {
    mocks.supported = true;
    mocks.listJoyConDevices.mockReset().mockResolvedValue([]);
    mocks.requestJoyConDevices.mockReset().mockResolvedValue([]);
    mocks.pulseJoyCon.mockReset().mockResolvedValue({ ok: true, events: [] });
    mocks.neutralJoyCon.mockReset().mockResolvedValue({ ok: true, events: [] });
  });

  it('loads granted Joy-Con devices and exposes side connection state', async () => {
    mocks.listJoyConDevices.mockResolvedValueOnce([
      { side: 'left', product: 'Joy-Con (L)' },
      { side: 'right', product: 'Joy-Con (R)' },
    ]);

    const { result } = renderHook(() => useJoyConWebHid());

    await waitFor(() => expect(result.current.leftConnected).toBe(true));
    expect(result.current.supported).toBe(true);
    expect(result.current.rightConnected).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('requests Joy-Con access from a user action and stores selected devices', async () => {
    mocks.requestJoyConDevices.mockResolvedValueOnce([{ side: 'left', product: 'Joy-Con (L)' }]);

    const { result } = renderHook(() => useJoyConWebHid());

    await act(async () => {
      await result.current.requestDevices();
    });

    expect(mocks.requestJoyConDevices).toHaveBeenCalledTimes(1);
    expect(result.current.leftConnected).toBe(true);
    expect(result.current.rightConnected).toBe(false);
  });

  it('sends test pulses and neutral commands through WebHID', async () => {
    const { result } = renderHook(() => useJoyConWebHid());

    await act(async () => {
      await result.current.testPulse({ side: 'left', intensity: 'medium', duration: 120 });
      await result.current.neutral({ side: 'both' });
    });

    expect(mocks.pulseJoyCon).toHaveBeenCalledWith({
      side: 'left',
      intensity: 'medium',
      duration: 120,
      repeats: 1,
    });
    expect(mocks.neutralJoyCon).toHaveBeenCalledWith({ side: 'both' });
  });

  it('does not list devices when WebHID is unavailable', () => {
    mocks.supported = false;

    const { result } = renderHook(() => useJoyConWebHid());

    expect(result.current.supported).toBe(false);
    expect(mocks.listJoyConDevices).not.toHaveBeenCalled();
  });
});
