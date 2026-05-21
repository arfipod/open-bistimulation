import { formatElapsedTime, getElapsedMs, getMotionSnapshot, getServerNowMs } from '../domain/motion';
import type { SessionState } from '../domain/sessionTypes';
import { useTicker } from '../hooks/useTicker';
import { useI18n } from '../lib/i18n';

interface SessionStatsProps {
  state: SessionState;
  serverTimeOffsetMs: number;
}

export function SessionStats({ state, serverTimeOffsetMs }: SessionStatsProps) {
  useTicker(250);
  const { t } = useI18n();
  const nowMs = getServerNowMs(serverTimeOffsetMs);
  const elapsedMs = getElapsedMs(state, nowMs);
  const snapshot = getMotionSnapshot(state, nowMs);

  return (
    <div className="stats-card">
      <div>
        <span className="stats-label">{t('controls.time')}</span>
        <strong>{formatElapsedTime(elapsedMs)}</strong>
      </div>
      <div>
        <span className="stats-label">{t('controls.passes')}</span>
        <strong>{snapshot.passes}</strong>
      </div>
      <div>
        <span className="stats-label">{t('controls.sets')}</span>
        <strong>{state.setsCompleted}</strong>
      </div>
    </div>
  );
}
