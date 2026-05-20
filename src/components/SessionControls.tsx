import type { SessionState } from '../domain/sessionTypes';
import { SessionStats } from './SessionStats';

interface SessionControlsProps {
  state: SessionState;
  serverTimeOffsetMs: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReset: () => void;
  onSavePreferences: () => void;
  busy?: boolean;
}

export function SessionControls({
  state,
  serverTimeOffsetMs,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
  onSavePreferences,
  busy = false,
}: SessionControlsProps) {
  const isRunning = state.status === 'running';
  const isPaused = state.status === 'paused';

  return (
    <section className="session-controls panel">
      <SessionStats state={state} serverTimeOffsetMs={serverTimeOffsetMs} />
      <div className="control-actions">
        {!isRunning && !isPaused ? (
          <button className="primary-button" type="button" disabled={busy} onClick={onStart}>
            ▶ Iniciar BLS
          </button>
        ) : null}
        {isRunning ? (
          <button className="secondary-button" type="button" disabled={busy} onClick={onPause}>
            ⏸ Pausar
          </button>
        ) : null}
        {isPaused ? (
          <button className="primary-button" type="button" disabled={busy} onClick={onResume}>
            ▶ Reanudar
          </button>
        ) : null}
        {(isRunning || isPaused) ? (
          <button className="danger-button" type="button" disabled={busy} onClick={onStop}>
            ■ Stop
          </button>
        ) : null}
        <button className="secondary-button" type="button" disabled={busy} onClick={onReset}>
          Reset
        </button>
        <button className="secondary-button" type="button" disabled={busy} onClick={onSavePreferences}>
          Guardar preferencias
        </button>
      </div>
    </section>
  );
}
