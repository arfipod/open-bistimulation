import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useJoyConBridge } from './useJoyConBridge';

const mocks = vi.hoisted(() => ({
  getJoyConBridgeStatus: vi.fn(),
  listJoyConDevices: vi.fn(),
  pulseJoyCon: vi.fn(),
  neutralJoyCon: vi.fn(),
}));

vi.mock('../lib/joyconBridgeClient', () => ({
  getJoyConBridgeStatus: mocks.getJoyConBridgeStatus,
  listJoyConDevices: mocks.listJoyConDevices,
  pulseJoyCon: mocks.pulseJoyCon,
  neutralJoyCon: mocks.neutralJoyCon,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe('useJoyConBridge', () => {
  beforeEach(() => {
    mocks.getJoyConBridgeStatus.mockReset().mockResolvedValue({ ok: true });
    mocks.listJoyConDevices.mockReset().mockResolvedValue([]);
    mocks.pulseJoyCon.mockReset().mockResolvedValue({ ok: true, events: [] });
    mocks.neutralJoyCon.mockReset().mockResolvedValue({ ok: true, events: [] });
  });

  it('polls status and devices and exposes left/right connection state', async () => {
    mocks.listJoyConDevices.mockResolvedValueOnce([
      { side: 'left', product: 'Joy-Con (L)' },
      { side: 'right', product: 'Joy-Con (R)' },
    ]);

    const { result } = renderHook(() => useJoyConBridge({ baseUrl: 'http://127.0.0.1:5174' }));

    await waitFor(() => expect(result.current.bridgeOnline).toBe(true));
    expect(result.current.leftConnected).toBe(true);
    expect(result.current.rightConnected).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('keeps bridge status online when only device listing fails', async () => {
    mocks.listJoyConDevices.mockRejectedValueOnce(new Error('No Nintendo HID devices are visible.'));

    const { result } = renderHook(() => useJoyConBridge({ baseUrl: 'http://127.0.0.1:5174' }));

    await waitFor(() => expect(result.current.bridgeOnline).toBe(true));
    expect(result.current.devices).toEqual([]);
    expect(result.current.error).toBe('No Nintendo HID devices are visible.');
  });

  it('does not start overlapping polls', async () => {
    vi.useFakeTimers();
    const status = deferred<{ ok: true }>();
    mocks.getJoyConBridgeStatus.mockReturnValue(status.promise);

    renderHook(() => useJoyConBridge({ baseUrl: 'http://127.0.0.1:5174', pollIntervalMs: 3000 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });

    expect(mocks.getJoyConBridgeStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      status.resolve({ ok: true });
    });
  });

  it('sends test pulses and neutral commands through the bridge client', async () => {
    const { result } = renderHook(() => useJoyConBridge({ baseUrl: 'http://127.0.0.1:5174' }));
    await waitFor(() => expect(result.current.bridgeOnline).toBe(true));

    await act(async () => {
      await result.current.testPulse({ side: 'left', intensity: 'medium', duration: 120 });
      await result.current.neutral({ side: 'both' });
    });

    expect(mocks.pulseJoyCon).toHaveBeenCalledWith('http://127.0.0.1:5174', {
      side: 'left',
      intensity: 'medium',
      duration: 120,
      repeats: 1,
    });
    expect(mocks.neutralJoyCon).toHaveBeenCalledWith('http://127.0.0.1:5174', { side: 'both' });
  });
});
