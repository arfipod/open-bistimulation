import { useEffect, useId, useState } from 'react';
import type { AudioSettings, AudioSound } from '../domain/sessionTypes';
import { useI18n } from '../lib/i18n';

interface AuditoryPanelProps {
  audio: AudioSettings;
  onChange: (next: AudioSettings) => void;
  panelCollapsible?: boolean;
  defaultPanelCollapsed?: boolean;
  autoCollapse?: boolean;
}

const sounds: Array<{ value: AudioSound; labelKey: 'audio.snap' | 'audio.beep' | 'audio.bell' | 'audio.heartbeat' }> = [
  { value: 'snap', labelKey: 'audio.snap' },
  { value: 'beep', labelKey: 'audio.beep' },
  { value: 'bell', labelKey: 'audio.bell' },
  { value: 'heartbeat', labelKey: 'audio.heartbeat' },
];

export function AuditoryPanel({
  audio,
  onChange,
  panelCollapsible = false,
  defaultPanelCollapsed = false,
  autoCollapse = false,
}: AuditoryPanelProps) {
  const { t } = useI18n();
  const panelBodyId = useId();
  const [panelCollapsed, setPanelCollapsed] = useState(Boolean(panelCollapsible && (defaultPanelCollapsed || autoCollapse)));

  useEffect(() => {
    if (panelCollapsible) {
      setPanelCollapsed(Boolean(defaultPanelCollapsed || autoCollapse));
    }
  }, [autoCollapse, defaultPanelCollapsed, panelCollapsible]);

  return (
    <section className={`control-panel ${panelCollapsed ? 'is-collapsed' : ''}`}>
      <header className="panel-header">
        <h2>{t('audio.title')}</h2>
        <div className="panel-header-actions">
          <label className="switch">
            <input
              type="checkbox"
              checked={audio.enabled}
              onChange={(event) => onChange({ ...audio, enabled: event.target.checked })}
            />
            <span />
          </label>
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
        </div>
      </header>

      {!panelCollapsed ? (
        <div id={panelBodyId} className="panel-body">

      <div className="field-group">
        <label>{t('audio.sound')}</label>
        <div className="segmented-grid">
          {sounds.map((sound) => (
            <button
              key={sound.value}
              type="button"
              className={audio.sound === sound.value ? 'is-selected' : ''}
              onClick={() => onChange({ ...audio, sound: sound.value })}
            >
              {t(sound.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="volume">{t('audio.volume', { value: Math.round(audio.volume * 100) })}</label>
        <input
          id="volume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={audio.volume}
          onChange={(event) => onChange({ ...audio, volume: Number(event.target.value) })}
        />
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={audio.therapistMuted}
          onChange={(event) => onChange({ ...audio, therapistMuted: event.target.checked })}
        />
        {t('audio.muteTherapist')}
      </label>
        </div>
      ) : null}
    </section>
  );
}

function CollapseGlyph({ collapsed }: { collapsed: boolean }) {
  return (
    <span className={`collapse-glyph ${collapsed ? 'is-collapsed' : ''}`} aria-hidden="true">
      {collapsed ? '+' : '-'}
    </span>
  );
}
