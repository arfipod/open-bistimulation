import { useEffect, useState } from 'react';

export function useTicker(intervalMs = 250): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick((current) => current + 1);
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [intervalMs]);

  return tick;
}
