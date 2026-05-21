import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useServerClock } from './useServerClock';

const mocks = vi.hoisted(() => ({
  getServerTimeMs: vi.fn(),
}));

vi.mock('../lib/sessionApi', () => ({
  getServerTimeMs: mocks.getServerTimeMs,
}));

describe('useServerClock', () => {
  beforeEach(() => {
    mocks.getServerTimeMs.mockReset();
  });

  it('estimates server offset using half of the request latency', async () => {
    mocks.getServerTimeMs.mockResolvedValue(5_000);
    vi.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(1_100);

    const { result } = renderHook(() => useServerClock());

    await waitFor(() => expect(result.current.isSynced).toBe(true));

    expect(result.current.offsetMs).toBe(3_950);
    expect(result.current.error).toBeNull();
  });

  it('exposes sync errors and can recover on a manual sync', async () => {
    mocks.getServerTimeMs.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(2_000);
    vi.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(1_100).mockReturnValueOnce(1_200);

    const { result } = renderHook(() => useServerClock());

    await waitFor(() => expect(result.current.error).toBe('offline'));

    await act(async () => {
      await result.current.sync();
    });

    expect(result.current.isSynced).toBe(true);
    expect(result.current.offsetMs).toBe(850);
    expect(result.current.error).toBeNull();
  });
});
