import { useEffect, useState } from 'react';
import { formatElapsedTime, getElapsedMs, getServerNowMs } from '../domain/motion';
import type { SessionState } from '../domain/sessionTypes';
import { useTicker } from '../hooks/useTicker';
import { useI18n } from '../lib/i18n';

interface SessionControlsProps {
  state: SessionState;
  serverTimeOffsetMs: number;
  roundDurationMs: number | null;
  onRoundDurationChange: (durationMs: number | null) => void;
  busy?: boolean;
}

interface SessionControlActionsProps {
  state: SessionState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReset: () => void;
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
  onRoundDurationChange,
  busy = false,
}: SessionControlsProps) {
  const { t } = useI18n();
  const [durationDraft, setDurationDraft] = useState(() => formatRoundDuration(roundDurationMs, t('controls.free')));
  useTicker(250);
  const controlsDisabled = busy || state.status === 'stopping';
  const elapsedMs = getElapsedMs(state, getServerNowMs(serverTimeOffsetMs));
  const remainingMs = roundDurationMs === null ? null : Math.max(0, roundDurationMs - elapsedMs);

  useEffect(() => {
    setDurationDraft(formatRoundDuration(roundDurationMs, t('controls.free')));
  }, [roundDurationMs, t]);

  const setDuration = (durationMs: number) => {
    const nextDuration = Math.min(MAX_ROUND_DURATION_MS, Math.max(MIN_ROUND_DURATION_MS, durationMs));
    onRoundDurationChange(nextDuration);
    setDurationDraft(formatElapsedTime(nextDuration));
  };

  const setFreeDuration = () => {
    onRoundDurationChange(null);
    setDurationDraft(t('controls.free'));
  };

  const handleDurationBlur = () => {
    const parsedDuration = parseDurationInput(durationDraft, t('controls.free'));
    if (parsedDuration === 'free') {
      setFreeDuration();
      return;
    }

    if (parsedDuration === null) {
      setDurationDraft(formatRoundDuration(roundDurationMs, t('controls.free')));
      return;
    }

    setDuration(parsedDuration);
  };

  return (
    <section className="session-controls panel">
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
          <strong>{remainingMs === null ? t('controls.free') : formatElapsedTime(remainingMs)}</strong>
        </div>
        <div className="round-timer-actions" aria-label={t('controls.presets')}>
          <button
            className={`secondary-button compact-button ${roundDurationMs === null ? 'is-selected' : ''}`}
            type="button"
            disabled={controlsDisabled}
            onClick={setFreeDuration}
          >
            {t('controls.free')}
          </button>
          <button
            className="secondary-button compact-button"
            type="button"
            disabled={controlsDisabled || roundDurationMs === null}
            onClick={() => {
              if (roundDurationMs !== null) {
                setDuration(roundDurationMs - ROUND_DURATION_STEP_MS);
              }
            }}
          >
            {t('controls.minusTen')}
          </button>
          <button
            className="secondary-button compact-button"
            type="button"
            disabled={controlsDisabled || roundDurationMs === null}
            onClick={() => {
              if (roundDurationMs !== null) {
                setDuration(roundDurationMs + ROUND_DURATION_STEP_MS);
              }
            }}
          >
            {t('controls.plusTen')}
          </button>
          {ROUND_PRESETS_MS.map((presetMs) => (
            <button
              key={presetMs}
              className={`secondary-button compact-button ${roundDurationMs === presetMs ? 'is-selected' : ''}`}
              type="button"
              disabled={controlsDisabled}
              onClick={() => setDuration(presetMs)}
            >
              {formatElapsedTime(presetMs)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SessionControlActions({
  state,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
  onSavePreferences,
  busy = false,
}: SessionControlActionsProps) {
  const { t } = useI18n();
  const isRunning = state.status === 'running';
  const isPaused = state.status === 'paused';
  const isStopping = state.status === 'stopping';
  const controlsDisabled = busy || isStopping;

  return (
    <div className="control-actions">
      {!isRunning && !isPaused && !isStopping ? (
        <button className="primary-button" type="button" disabled={controlsDisabled} onClick={onStart}>
          {t('controls.start')}
        </button>
      ) : null}
      {isRunning ? (
        <button className="secondary-button" type="button" disabled={controlsDisabled} onClick={onPause}>
          {t('controls.pause')}
        </button>
      ) : null}
      {isPaused ? (
        <button className="primary-button" type="button" disabled={controlsDisabled} onClick={onResume}>
          {t('controls.resume')}
        </button>
      ) : null}
      {isRunning || isPaused ? (
        <button className="danger-button" type="button" disabled={controlsDisabled} onClick={onStop}>
          {t('controls.stop')}
        </button>
      ) : null}
      {isStopping ? (
        <button className="danger-button" type="button" disabled>
          {t('controls.stopping')}
        </button>
      ) : null}
      <button className="secondary-button" type="button" disabled={controlsDisabled} onClick={onReset}>
        {t('controls.reset')}
      </button>
      <button className="secondary-button" type="button" disabled={controlsDisabled} onClick={onSavePreferences}>
        {t('controls.savePreferences')}
      </button>
    </div>
  );
}

function formatRoundDuration(durationMs: number | null, freeLabel: string): string {
  return durationMs === null ? freeLabel : formatElapsedTime(durationMs);
}

function parseDurationInput(value: string, freeLabel: string): number | 'free' | null {
  const normalized = value.trim().toLowerCase();

  if (!normalized || normalized === freeLabel.toLowerCase() || normalized === 'free' || normalized === 'libre') {
    return 'free';
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
