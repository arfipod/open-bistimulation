import { BACKGROUND_COLORS, VISUAL_COLORS } from '../domain/defaults';
import type { VisualDirection, VisualSettings, VerticalPosition } from '../domain/sessionTypes';
import { useI18n } from '../lib/i18n';

interface VisualPanelProps {
  visual: VisualSettings;
  onChange: (next: VisualSettings) => void;
}

const directions: Array<{ value: VisualDirection; labelKey: 'visual.horizontal' | 'visual.vertical' | 'visual.diagonal' | 'visual.infinity' }> = [
  { value: 'horizontal', labelKey: 'visual.horizontal' },
  { value: 'vertical', labelKey: 'visual.vertical' },
  { value: 'diagonal', labelKey: 'visual.diagonal' },
  { value: 'infinity', labelKey: 'visual.infinity' },
];

const positions: Array<{ value: VerticalPosition; labelKey: 'visual.top' | 'visual.center' | 'visual.bottom' }> = [
  { value: 'top', labelKey: 'visual.top' },
  { value: 'center', labelKey: 'visual.center' },
  { value: 'bottom', labelKey: 'visual.bottom' },
];

export function VisualPanel({ visual, onChange }: VisualPanelProps) {
  const { t } = useI18n();

  return (
    <section className="control-panel">
      <header className="panel-header">
        <h2>{t('visual.title')}</h2>
        <label className="switch">
          <input
            type="checkbox"
            checked={visual.enabled}
            onChange={(event) => onChange({ ...visual, enabled: event.target.checked })}
          />
          <span />
        </label>
      </header>

      <div className="field-group">
        <label>{t('visual.color')}</label>
        <div className="swatch-row">
          {VISUAL_COLORS.map((color) => (
            <button
              key={color}
              className={`swatch ${visual.color === color ? 'is-selected' : ''}`}
              style={{ backgroundColor: color }}
              type="button"
              aria-label={t('visual.colorAria', { color })}
              onClick={() => onChange({ ...visual, color })}
            />
          ))}
          <input
            className="color-input"
            type="color"
            value={visual.color}
            onChange={(event) => onChange({ ...visual, color: event.target.value })}
          />
        </div>
      </div>

      <div className="field-group">
        <label>{t('visual.background')}</label>
        <div className="swatch-row">
          {BACKGROUND_COLORS.map((background) => (
            <button
              key={background}
              className={`swatch ${visual.background === background ? 'is-selected' : ''}`}
              style={{ backgroundColor: background }}
              type="button"
              aria-label={t('visual.backgroundAria', { color: background })}
              onClick={() => onChange({ ...visual, background })}
            />
          ))}
          <input
            className="color-input"
            type="color"
            value={visual.background}
            onChange={(event) => onChange({ ...visual, background: event.target.value })}
          />
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="speed">{t('visual.speed', { value: visual.speed })}</label>
        <input
          id="speed"
          type="range"
          min="1"
          max="20"
          step="0.5"
          value={visual.speed}
          onChange={(event) => onChange({ ...visual, speed: Number(event.target.value) })}
        />
      </div>

      <div className="field-group">
        <label>{t('visual.direction')}</label>
        <div className="segmented-grid">
          {directions.map((direction) => (
            <button
              key={direction.value}
              type="button"
              className={visual.direction === direction.value ? 'is-selected' : ''}
              onClick={() => onChange({ ...visual, direction: direction.value })}
            >
              {t(direction.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="field-group">
        <label>{t('visual.position')}</label>
        <div className="segmented-grid three">
          {positions.map((position) => (
            <button
              key={position.value}
              type="button"
              className={visual.verticalPosition === position.value ? 'is-selected' : ''}
              onClick={() => onChange({ ...visual, verticalPosition: position.value })}
            >
              {t(position.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="dot-size">{t('visual.size', { value: visual.dotSize })}</label>
        <input
          id="dot-size"
          type="range"
          min="20"
          max="100"
          step="2"
          value={visual.dotSize}
          onChange={(event) => onChange({ ...visual, dotSize: Number(event.target.value) })}
        />
      </div>
    </section>
  );
}
