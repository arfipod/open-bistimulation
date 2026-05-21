import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JoyConDeviceSummary, JoyConIntensity, JoyConSide } from '../lib/joyconBridgeClient';
import { getJoyConBridgeStatus, listJoyConDevices, neutralJoyCon, pulseJoyCon } from '../lib/joyconBridgeClient';
import { isValidJoyConBridgeUrl } from '../lib/localStorage';

interface UseJoyConBridgeOptions {
  baseUrl: string;
  pollIntervalMs?: number;
}

interface TestPulseOptions {
  side: JoyConSide;
  intensity: JoyConIntensity;
  duration: number;
  repeats?: number;
}

interface NeutralOptions {
  side?: JoyConSide;
}

export interface UseJoyConBridgeResult {
  bridgeOnline: boolean;
  devices: JoyConDeviceSummary[];
  leftConnected: boolean;
  rightConnected: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  testPulse: (options: TestPulseOptions) => Promise<void>;
  neutral: (options?: NeutralOptions) => Promise<void>;
}

const DEFAULT_POLL_INTERVAL_MS = 3000;

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : 'Joy-Con bridge request failed.';
}

function hasSide(devices: JoyConDeviceSummary[], side: 'left' | 'right'): boolean {
  return devices.some((device) => device.side === side);
}

export function useJoyConBridge({ baseUrl, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS }: UseJoyConBridgeOptions): UseJoyConBridgeResult {
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [devices, setDevices] = useState<JoyConDeviceSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const request = (async () => {
      if (!isValidJoyConBridgeUrl(baseUrl)) {
        if (mountedRef.current) {
          setBridgeOnline(false);
          setDevices([]);
          setError('Joy-Con bridge URL is not valid.');
        }
        return;
      }

      try {
        await getJoyConBridgeStatus(baseUrl);

        let nextDevices: JoyConDeviceSummary[] = [];
        let nextError: string | null = null;

        try {
          nextDevices = await listJoyConDevices(baseUrl);
        } catch (deviceError) {
          nextError = messageFromError(deviceError);
        }

        if (mountedRef.current) {
          setBridgeOnline(true);
          setDevices(nextDevices);
          setError(nextError);
        }
      } catch (statusError) {
        if (mountedRef.current) {
          setBridgeOnline(false);
          setDevices([]);
          setError(messageFromError(statusError));
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
  }, [baseUrl]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, pollIntervalMs);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [pollIntervalMs, refresh]);

  const testPulse = useCallback(
    async ({ side, intensity, duration, repeats = 1 }: TestPulseOptions) => {
      try {
        await pulseJoyCon(baseUrl, { side, intensity, duration, repeats });

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
    [baseUrl, refresh],
  );

  const neutral = useCallback(
    async ({ side = 'both' }: NeutralOptions = {}) => {
      try {
        await neutralJoyCon(baseUrl, { side });

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
    [baseUrl, refresh],
  );

  return useMemo(
    () => ({
      bridgeOnline,
      devices,
      leftConnected: hasSide(devices, 'left'),
      rightConnected: hasSide(devices, 'right'),
      error,
      refresh,
      testPulse,
      neutral,
    }),
    [bridgeOnline, devices, error, neutral, refresh, testPulse],
  );
}
