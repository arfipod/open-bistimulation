import { useEffect, useState } from 'react';
import { formatElapsedTime, getElapsedMs, getServerNowMs } from '../domain/motion';
import type { SessionState } from '../domain/sessionTypes';
import { useTicker } from '../hooks/useTicker';
import { useI18n } from '../lib/i18n';
import { SessionStats } from './SessionStats';

interface SessionControlsProps {
  state: SessionState;
  serverTimeOffsetMs: number;
  roundDurationMs: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReset: () => void;
  onRoundDurationChange: (durationMs: number) => void;
  onSavePreferences: () => void;
  busy?: boolean;
}

const MIN_ROUND_DURATION_MS = 10_000;
const MAX_ROUND_DURATION_MS = 60 * 60_000;
const ROUND_DURATION_STEP_MS = 10_000;
const ROUND_PRESETS_MS = [60_000, 2 * 60_000, 5 * 60_000, 10 * 60_000];

export function SessionControls({
  state,
  serverTimeOffsetMs,
  roundDurationMs,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
  onRoundDurationChange,
  onSavePreferences,
  busy = false,
}: SessionControlsProps) {
  const { t } = useI18n();
  const [durationDraft, setDurationDraft] = useState(() => formatElapsedTime(roundDurationMs));
  useTicker(250);
  const isRunning = state.status === 'running';
  const isPaused = state.status === 'paused';
  const elapsedMs = getElapsedMs(state, getServerNowMs(serverTimeOffsetMs));
  const remainingMs = Math.max(0, roundDurationMs - elapsedMs);

  useEffect(() => {
    setDurationDraft(formatElapsedTime(roundDurationMs));
  }, [roundDurationMs]);

  const setDuration = (durationMs: number) => {
    const nextDuration = Math.min(MAX_ROUND_DURATION_MS, Math.max(MIN_ROUND_DURATION_MS, durationMs));
    onRoundDurationChange(nextDuration);
    setDurationDraft(formatElapsedTime(nextDuration));
  };

  const handleDurationBlur = () => {
    const parsedDuration = parseDurationInput(durationDraft);
    setDuration(parsedDuration ?? roundDurationMs);
  };

  return (
    <section className="session-controls panel">
      <SessionStats state={state} serverTimeOffsetMs={serverTimeOffsetMs} />
      <div className="round-timer">
        <div className="round-timer-display">
          <span>{t('controls.roundDuration')}</span>
          <input
            aria-label={t('controls.durationInput')}
            inputMode="numeric"
            value={durationDraft}
            onBlur={handleDurationBlur}
            onChange={(event) => setDurationDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
            }}
          />
        </div>
        <div className="round-timer-display">
          <span>{t('controls.remaining')}</span>
          <strong>{formatElapsedTime(remainingMs)}</strong>
        </div>
        <div className="round-timer-actions" aria-label={t('controls.presets')}>
          <button
            className="secondary-button compact-button"
            type="button"
            disabled={busy}
            onClick={() => setDuration(roundDurationMs - ROUND_DURATION_STEP_MS)}
          >
            {t('controls.minusTen')}
          </button>
          <button
            className="secondary-button compact-button"
            type="button"
            disabled={busy}
            onClick={() => setDuration(roundDurationMs + ROUND_DURATION_STEP_MS)}
          >
            {t('controls.plusTen')}
          </button>
          {ROUND_PRESETS_MS.map((presetMs) => (
            <button
              key={presetMs}
              className={`secondary-button compact-button ${roundDurationMs === presetMs ? 'is-selected' : ''}`}
              type="button"
              disabled={busy}
              onClick={() => setDuration(presetMs)}
            >
              {formatElapsedTime(presetMs)}
            </button>
          ))}
        </div>
      </div>
      <div className="control-actions">
        {!isRunning && !isPaused ? (
          <button className="primary-button" type="button" disabled={busy} onClick={onStart}>
            {t('controls.start')}
          </button>
        ) : null}
        {isRunning ? (
          <button className="secondary-button" type="button" disabled={busy} onClick={onPause}>
            {t('controls.pause')}
          </button>
        ) : null}
        {isPaused ? (
          <button className="primary-button" type="button" disabled={busy} onClick={onResume}>
            {t('controls.resume')}
          </button>
        ) : null}
        {(isRunning || isPaused) ? (
          <button className="danger-button" type="button" disabled={busy} onClick={onStop}>
            {t('controls.stop')}
          </button>
        ) : null}
        <button className="secondary-button" type="button" disabled={busy} onClick={onReset}>
          {t('controls.reset')}
        </button>
        <button className="secondary-button" type="button" disabled={busy} onClick={onSavePreferences}>
          {t('controls.savePreferences')}
        </button>
      </div>
    </section>
  );
}

function parseDurationInput(value: string): number | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (!normalized.includes(':')) {
    const seconds = Number(normalized);
    return Number.isFinite(seconds) ? seconds * 1000 : null;
  }

  const [minutesText, secondsText] = normalized.split(':');
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }

  return (minutes * 60 + seconds) * 1000;
}
