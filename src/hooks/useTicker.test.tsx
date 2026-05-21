import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTicker } from './useTicker';

describe('useTicker', () => {
  it('increments on the configured interval and clears it on unmount', () => {
    vi.useFakeTimers();

    const { result, unmount } = renderHook(() => useTicker(100));

    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(result.current).toBe(3);

    unmount();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe(3);
  });
});
