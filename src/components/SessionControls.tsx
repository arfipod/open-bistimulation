import { useEffect, useId, useState } from 'react';
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
  panelCollapsible?: boolean;
  defaultPanelCollapsed?: boolean;
  autoCollapse?: boolean;
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
  safetyBusy?: boolean;
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
  panelCollapsible = false,
  defaultPanelCollapsed = false,
  autoCollapse = false,
}: SessionControlsProps) {
  const { t } = useI18n();
  const panelBodyId = useId();
  const [durationDraft, setDurationDraft] = useState(() => formatRoundDuration(roundDurationMs, t('controls.free')));
  const [panelCollapsed, setPanelCollapsed] = useState(Boolean(panelCollapsible && (defaultPanelCollapsed || autoCollapse)));
  useTicker(250);
  const controlsDisabled = busy || state.status === 'stopping';
  const elapsedMs = getElapsedMs(state, getServerNowMs(serverTimeOffsetMs));
  const remainingMs = roundDurationMs === null ? null : Math.max(0, roundDurationMs - elapsedMs);

  useEffect(() => {
    setDurationDraft(formatRoundDuration(roundDurationMs, t('controls.free')));
  }, [roundDurationMs, t]);

  useEffect(() => {
    if (panelCollapsible) {
      setPanelCollapsed(Boolean(defaultPanelCollapsed || autoCollapse));
    }
  }, [autoCollapse, defaultPanelCollapsed, panelCollapsible]);

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
    <section className={`session-controls panel ${panelCollapsed ? 'is-collapsed' : ''}`}>
      <header className="panel-header">
        <h2>{t('controls.roundDuration')}</h2>
        {panelCollapsible ? (
          <button
            className="collapse-toggle-button"
            type="button"
            aria-expanded={!panelCollapsed}
            aria-controls={panelBodyId}
            aria-label={panelCollapsed ? t('common.expandPanel') : t('common.collapsePanel')}
            onClick={() => setPanelCollapsed((collapsed) => !collapsed)}
          >
            <CollapseGlyph collapsed={panelCollapsed} />
          </button>
        ) : null}
      </header>
      {!panelCollapsed ? (
      <div id={panelBodyId} className="round-timer">
        <div className="round-timer-display">
          <span>{t('controls.roundDuration')}</span>
          <input
            aria-label={t('controls.durationInput')}
            inputMode="numeric"
            disabled={controlsDisabled}
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
        <div className="round-timer-actions" role="group" aria-label={t('controls.presets')}>
          <button
            className={`secondary-button compact-button ${roundDurationMs === null ? 'is-selected' : ''}`}
            type="button"
            aria-pressed={roundDurationMs === null}
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
              aria-pressed={roundDurationMs === presetMs}
              disabled={controlsDisabled}
              onClick={() => setDuration(presetMs)}
            >
              {formatElapsedTime(presetMs)}
            </button>
          ))}
        </div>
      </div>
      ) : null}
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
  safetyBusy = false,
}: SessionControlActionsProps) {
  const { t } = useI18n();
  const isRunning = state.status === 'running';
  const isPaused = state.status === 'paused';
  const isStopping = state.status === 'stopping';
  const controlsDisabled = busy || safetyBusy || isStopping;

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
        <button className="danger-button" type="button" disabled={safetyBusy} onClick={onStop}>
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

  if (!normalized) {
    return null;
  }

  if (normalized === freeLabel.toLowerCase() || normalized === 'free' || normalized === 'libre') {
    return 'free';
  }

  if (!normalized.includes(':')) {
    const seconds = Number(normalized);
    return /^\d+$/.test(normalized) && Number.isFinite(seconds) ? seconds * 1000 : null;
  }

  const parts = normalized.split(':');

  if (parts.length !== 2) {
    return null;
  }

  const [minutesText, secondsText] = parts;

  if (!/^\d+$/.test(minutesText) || !/^\d{1,2}$/.test(secondsText)) {
    return null;
  }

  const minutes = Number(minutesText);
  const seconds = Number(secondsText);

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) {
    return null;
  }

  return (minutes * 60 + seconds) * 1000;
}

function CollapseGlyph({ collapsed }: { collapsed: boolean }) {
  return (
    <span className={`collapse-glyph ${collapsed ? 'is-collapsed' : ''}`} aria-hidden="true">
      {collapsed ? '+' : '-'}
    </span>
  );
}
