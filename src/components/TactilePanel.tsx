import type { TactileDeviceStatus, TactileSettings } from '../domain/sessionTypes';
import { useI18n } from '../lib/i18n';
import { ConnectionBadge } from './ConnectionBadge';

interface TactilePanelProps {
  tactile: TactileSettings;
  leftDevice: TactileDeviceStatus;
  rightDevice: TactileDeviceStatus;
  onChange: (next: TactileSettings) => void;
}

export function TactilePanel({ tactile, leftDevice, rightDevice, onChange }: TactilePanelProps) {
  const { t } = useI18n();
  const unsupportedSuffix = t('tactile.withoutVibration');

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

      <div className="device-status-grid">
        <ConnectionBadge
          connected={leftDevice.connected}
          label={t('tactile.leftPhone', { suffix: leftDevice.unsupported ? unsupportedSuffix : '' })}
        />
        <ConnectionBadge
          connected={rightDevice.connected}
          label={t('tactile.rightPhone', { suffix: rightDevice.unsupported ? unsupportedSuffix : '' })}
        />
      </div>

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
