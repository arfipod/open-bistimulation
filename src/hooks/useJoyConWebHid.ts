import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JoyConDeviceSummary, JoyConIntensity, JoyConSide } from '../lib/joyconTypes';
import { disconnectJoyConDevices, isJoyConWebHidSupported, listJoyConDevices, neutralJoyCon, pulseJoyCon, requestJoyConDevices } from '../lib/joyconWebHidClient';

interface TestPulseOptions {
  side: JoyConSide;
  intensity: JoyConIntensity;
  duration: number;
  repeats?: number;
}

interface NeutralOptions {
  side?: JoyConSide;
}

export interface UseJoyConWebHidResult {
  supported: boolean;
  requesting: boolean;
  devices: JoyConDeviceSummary[];
  leftConnected: boolean;
  rightConnected: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  requestDevices: () => Promise<void>;
  disconnectDevices: () => Promise<void>;
  testPulse: (options: TestPulseOptions) => Promise<void>;
  neutral: (options?: NeutralOptions) => Promise<void>;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : 'Joy-Con WebHID request failed.';
}

function hasSide(devices: JoyConDeviceSummary[], side: 'left' | 'right'): boolean {
  return devices.some((device) => device.side === side);
}

export function useJoyConWebHid(): UseJoyConWebHidResult {
  const supported = isJoyConWebHidSupported();
  const [requesting, setRequesting] = useState(false);
  const [devices, setDevices] = useState<JoyConDeviceSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const request = (async () => {
      if (!supported) {
        if (mountedRef.current) {
          setDevices([]);
          setError(null);
        }
        return;
      }

      try {
        const nextDevices = await listJoyConDevices();

        if (mountedRef.current) {
          setDevices(nextDevices);
          setError(null);
        }
      } catch (refreshError) {
        if (mountedRef.current) {
          setDevices([]);
          setError(messageFromError(refreshError));
        }
      }
    })();

    refreshPromiseRef.current = request;

    try {
      await request;
    } finally {
      if (refreshPromiseRef.current === request) {
        refreshPromiseRef.current = null;
      }
    }
  }, [supported]);

  const requestDevices = useCallback(async () => {
    if (!supported) {
      setError('This browser does not support WebHID. Use Google Chrome or Microsoft Edge over HTTPS or localhost.');
      return;
    }

    setRequesting(true);

    try {
      const nextDevices = await requestJoyConDevices();

      if (mountedRef.current) {
        setDevices(nextDevices);
        setError(null);
      }
    } catch (requestError) {
      if (mountedRef.current) {
        setError(messageFromError(requestError));
      }
    } finally {
      if (mountedRef.current) {
        setRequesting(false);
      }
    }
  }, [supported]);

  const disconnectDevices = useCallback(async () => {
    if (!supported) {
      setDevices([]);
      setError(null);
      return;
    }

    try {
      await disconnectJoyConDevices();

      if (mountedRef.current) {
        setDevices([]);
        setError(null);
      }
    } catch (disconnectError) {
      if (mountedRef.current) {
        setError(messageFromError(disconnectError));
      }
    }
  }, [supported]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    if (!supported || !navigator.hid) {
      return () => {
        mountedRef.current = false;
      };
    }

    const handleConnectionChange = () => {
      void refresh();
    };

    navigator.hid.addEventListener('connect', handleConnectionChange);
    navigator.hid.addEventListener('disconnect', handleConnectionChange);

    return () => {
      mountedRef.current = false;
      navigator.hid?.removeEventListener('connect', handleConnectionChange);
      navigator.hid?.removeEventListener('disconnect', handleConnectionChange);
    };
  }, [refresh, supported]);

  const testPulse = useCallback(
    async ({ side, intensity, duration, repeats = 1 }: TestPulseOptions) => {
      try {
        await pulseJoyCon({ side, intensity, duration, repeats });

        if (mountedRef.current) {
          setError(null);
        }

        void refresh();
      } catch (pulseError) {
        if (mountedRef.current) {
          setError(messageFromError(pulseError));
        }
      }
    },
    [refresh],
  );

  const neutral = useCallback(
    async ({ side = 'both' }: NeutralOptions = {}) => {
      try {
        await neutralJoyCon({ side });

        if (mountedRef.current) {
          setError(null);
        }

        void refresh();
      } catch (neutralError) {
        if (mountedRef.current) {
          setError(messageFromError(neutralError));
        }
      }
    },
    [refresh],
  );

  return useMemo(
    () => ({
      supported,
      requesting,
      devices,
      leftConnected: hasSide(devices, 'left'),
      rightConnected: hasSide(devices, 'right'),
      error,
      refresh,
      requestDevices,
      disconnectDevices,
      testPulse,
      neutral,
    }),
    [devices, disconnectDevices, error, neutral, refresh, requesting, requestDevices, supported, testPulse],
  );
}
