import type { TactileSettings } from '../domain/sessionTypes';
import { useI18n } from '../lib/i18n';

interface TactilePanelProps {
  tactile: TactileSettings;
  onChange: (next: TactileSettings) => void;
}

export function TactilePanel({ tactile, onChange }: TactilePanelProps) {
  const { t } = useI18n();

  return (
    <section className="control-panel">
      <header className="panel-header">
        <h2>{t('tactile.title')}</h2>
        <label className="switch">
          <input
            type="checkbox"
            checked={tactile.enabled}
            onChange={(event) => onChange({ ...tactile, enabled: event.target.checked })}
          />
          <span />
        </label>
      </header>

      <p className="panel-note">{t('tactile.bridgeNote')}</p>

      <div className="field-group">
        <label htmlFor="pulse-duration">{t('tactile.pulseDuration', { value: tactile.pulseDurationMs })}</label>
        <input
          id="pulse-duration"
          type="range"
          min="40"
          max="600"
          step="10"
          value={tactile.pulseDurationMs}
          onChange={(event) => onChange({ ...tactile, pulseDurationMs: Number(event.target.value) })}
        />
      </div>

      <div className="field-group">
        <label htmlFor="tactile-gap">{t('tactile.internalPause', { value: tactile.gapMs })}</label>
        <input
          id="tactile-gap"
          type="range"
          min="0"
          max="300"
          step="10"
          value={tactile.gapMs}
          onChange={(event) => onChange({ ...tactile, gapMs: Number(event.target.value) })}
        />
      </div>

      <p className="panel-note">{t('tactile.note')}</p>
    </section>
  );
}
