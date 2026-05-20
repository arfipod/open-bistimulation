import { useCallback, useEffect, useState } from 'react';
import { getServerTimeMs } from '../lib/sessionApi';

export function useServerClock() {
  const [offsetMs, setOffsetMs] = useState(0);
  const [isSynced, setIsSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    try {
      const before = Date.now();
      const serverMs = await getServerTimeMs();
      const after = Date.now();
      const estimatedLatencyMs = (after - before) / 2;
      setOffsetMs(serverMs + estimatedLatencyMs - after);
      setIsSynced(true);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not sync server clock.');
    }
  }, []);

  useEffect(() => {
    void sync();
    const interval = window.setInterval(() => {
      void sync();
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [sync]);

  return { offsetMs, isSynced, error, sync };
}
